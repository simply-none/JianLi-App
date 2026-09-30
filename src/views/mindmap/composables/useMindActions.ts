/**
 * 思维导图 —— 动作编排（工具条 / 快捷键 / 弹窗共用一个入口）。
 *
 * 把三层缝在一起，让视图层只调一个方法：
 *   状态（useMindDoc）  +  持久化（useMindPersist）  +  用户反馈（ElMessage / ElMessageBox）
 *
 * 为什么「删除节点」「新建导图」这类**带确认策略**的动作也放在这里：
 *   同一个动作有两条触发路径（工具条按钮 / 键盘快捷键），策略写两份迟早会漂移 ——
 *   按钮删节点弹确认、快捷键删节点直接删，这种不一致最难解释。所以策略只有一份。
 */

import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

import { DEFAULT_DOC_NAME } from '../constants'
import type { MindDocRecord } from '../types'
import { normalizeDocData } from '../utils/tree'
import { useMindDoc } from './useMindDoc'
import { listDocs, loadDocById, loadLatestDoc, removeDoc, saveDoc } from './useMindPersist'
import { useMindView } from './useMindView'

/**
 * 「启动时恢复最近文档」整个会话只做一次。
 * 状态是模块级单例，页面卸载再进入时会保留现场，重复恢复反而会把用户的改动冲掉，
 * 所以用模块级 Promise 做闸门（不用 `loadedFromDb`：那是「有没有成功载入过」的语义）。
 */
let bootstrapPromise: Promise<boolean> | null = null

export function useMindActions() {
  const mind = useMindDoc()
  const view = useMindView()

  /** 文档列表（打开对话框用） */
  const docs = ref<MindDocRecord[]>([])
  const listLoading = ref(false)
  const saving = ref(false)

  /* ------------------------------------------------------------ 列表 */

  async function refreshList(): Promise<MindDocRecord[]> {
    listLoading.value = true
    try {
      docs.value = await listDocs()
      return docs.value
    } finally {
      listLoading.value = false
    }
  }

  /* ------------------------------------------------------ 打开 / 新建 */

  /** 把数据库记录灌进状态；脏数据由 normalizeDocData 兜底，不抛错 */
  function applyRecord(record: MindDocRecord) {
    view.requestFit()
    mind.replaceDoc({
      id: record.id,
      name: record.name || DEFAULT_DOC_NAME,
      data: normalizeDocData(record.data, mind.layout.value),
    })
  }

  /** 按 id 打开某份导图 */
  async function openDoc(id: number): Promise<boolean> {
    const record = await loadDocById(id)
    if (!record) {
      ElMessage.error('打开失败：记录不存在')
      return false
    }
    applyRecord(record)
    return true
  }

  /** 恢复最近一次保存的导图；没有历史记录时返回 false（不弹错，保持空白图） */
  async function openLatest(): Promise<boolean> {
    const record = await loadLatestDoc()
    if (!record) return false
    applyRecord(record)
    return true
  }

  /** 页面挂载时调用：整个会话只真正恢复一次 */
  function bootstrap(): Promise<boolean> {
    if (!bootstrapPromise) bootstrapPromise = openLatest()
    return bootstrapPromise
  }

  /** 直接重置为空白图（内部用，不带确认） */
  function resetToBlank() {
    view.requestFit()
    mind.newDoc(DEFAULT_DOC_NAME)
  }

  /** 新建空白导图；当前有未保存改动时先确认，避免一键抹掉工作 */
  async function createNew(): Promise<boolean> {
    if (mind.dirty.value) {
      try {
        await ElMessageBox.confirm('当前导图有未保存的改动，新建会丢失这些改动。', '新建导图', {
          type: 'warning',
          confirmButtonText: '仍然新建',
          cancelButtonText: '取消',
        })
      } catch {
        return false
      }
    }
    resetToBlank()
    return true
  }

  /* ------------------------------------------------------------ 保存 */

  /** 保存当前文档；首次保存会拿到新 id 并回写状态（后续保存变成覆盖） */
  async function save(): Promise<boolean> {
    if (saving.value) return false
    saving.value = true
    try {
      const id = await saveDoc({
        id: mind.doc.value.id,
        name: mind.doc.value.name,
        data: mind.doc.value.data,
      })
      if (typeof id !== 'number') {
        ElMessage.error('保存失败')
        return false
      }
      mind.markSaved(id)
      // 保存后列表里那条记录的 update_time 变了，顺手刷新
      await refreshList()
      ElMessage.success('已保存')
      return true
    } finally {
      saving.value = false
    }
  }

  /* -------------------------------------------------------- 布局与坐标 */

  /**
   * 整理布局：清掉所有「手动固定」的坐标，全部交回算法重排。
   *
   * 带确认 —— 一次会抹掉用户的所有手工微调（虽然可 Ctrl+Z 撤销，
   * 但那要先知道「刚才那步是整理」）。没有任何固定坐标时直接返回 false，不弹窗。
   */
  async function resetPositions(): Promise<boolean> {
    const count = mind.fixedPositionCount.value
    if (!count) return false
    try {
      await ElMessageBox.confirm(
        `将清除 ${count} 个节点的手动位置，全部按算法重新排版。`,
        '整理布局',
        { type: 'warning', confirmButtonText: '整理', cancelButtonText: '取消' },
      )
    } catch {
      return false
    }
    // 整体重排 ⇒ 需要重新适应画布（requestFit 必须在 commit 之前，供那次重排消费）
    view.requestFit()
    const changed = mind.resetPositions()
    if (changed) ElMessage.success('已恢复自动布局')
    return changed
  }

  /* ------------------------------------------------------------ 删除 */

  /**
   * 删除选中节点。
   * - 根节点不可删（提示而不是静默无反应）；
   * - 带子节点时二次确认 —— 虽然能 Ctrl+Z 撤销，但一步丢一整棵子树仍然值得拦一下；
   * - 叶子节点直接删，保证连续输入时的键盘流不被弹窗打断。
   */
  async function deleteSelected(): Promise<boolean> {
    const id = mind.selectedId.value
    if (!id) return false
    if (id === mind.tree.value.id) {
      ElMessage.warning('根节点不可删除')
      return false
    }
    const node = mind.selectedNode.value
    if (node && node.children.length) {
      try {
        await ElMessageBox.confirm('将连同其全部子节点一起删除，且无法撤销。', '删除节点', {
          type: 'warning',
          confirmButtonText: '删除',
          cancelButtonText: '取消',
        })
      } catch {
        return false
      }
    }
    return mind.removeNodeById(id)
  }

  /**
   * 删除某份导图记录。
   * 若删的正是当前打开的那份，则顺势回到空白图 —— 否则状态里会留着一个已不存在的 id，
   * 之后再点保存会把它「复活」成一条新记录，很反直觉。
   */
  async function removeById(id: number): Promise<boolean> {
    const ok = await removeDoc(id)
    if (!ok) {
      ElMessage.error('删除失败')
      return false
    }
    docs.value = docs.value.filter(item => item.id !== id)
    if (mind.doc.value.id === id) resetToBlank()
    ElMessage.success('已删除')
    return true
  }

  return {
    docs,
    listLoading,
    saving,
    refreshList,
    openDoc,
    openLatest,
    bootstrap,
    createNew,
    save,
    resetPositions,
    deleteSelected,
    removeById,
  }
}
