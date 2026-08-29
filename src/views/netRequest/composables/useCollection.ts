/**
 * 网络请求工作台 - 集合管理
 * ------------------------------------------------------------------
 * 维护集合树（文件夹/请求）的加载 / 新增 / 更新 / 删除，数据走 db.ts。
 * 树构建逻辑在 db.listCollectionTree 中完成，这里只做状态管理。
 */

import { ref } from 'vue'
import type { CollectionNode, RequestConfig } from '../types'
import {
  deleteCollectionNode,
  insertCollectionNode,
  listCollectionTree,
  updateCollectionNode,
} from '../db'

/** 集合树（根级节点数组，children 已挂载） */
const collectionTree = ref<CollectionNode[]>([])

/**
 * 加载集合树
 */
export async function refreshCollection(): Promise<void> {
  collectionTree.value = await listCollectionTree()
}

/**
 * 新建文件夹
 * @param parentId 父节点 id（0 = 根级）
 * @param name 文件夹名称
 * @returns 新文件夹节点 id（供保存弹窗自动选中）
 */
export async function createFolder(parentId: number, name: string): Promise<number> {
  const id = await insertCollectionNode({
    parentId,
    nodeType: 'folder',
    name,
    method: '',
    url: '',
    config: null,
    sort: 0,
  })
  await refreshCollection()
  return id
}

/**
 * 保存请求到集合（存在 id 则更新，否则插入）
 * @param opts.id 请求节点 id（可选，编辑保存时传入）
 * @param opts.parentId 父文件夹 id（0 = 根级）
 * @param opts.name 显示名称
 * @param opts.config 请求配置
 */
export async function saveRequestToCollection(opts: {
  id?: number
  parentId: number
  name: string
  config: RequestConfig
}): Promise<void> {
  if (opts.id) {
    await updateCollectionNode(opts.id, {
      name: opts.name,
      method: opts.config.method,
      url: opts.config.url,
      config: opts.config,
    })
  } else {
    await insertCollectionNode({
      parentId: opts.parentId,
      nodeType: 'request',
      name: opts.name,
      method: opts.config.method,
      url: opts.config.url,
      config: opts.config,
      sort: 0,
    })
  }
  await refreshCollection()
}

/**
 * 删除节点（文件夹级联删除子孙）
 * @param id 节点 id
 */
export async function removeCollectionNode(id: number): Promise<void> {
  await deleteCollectionNode(id)
  await refreshCollection()
}

/**
 * 重命名节点
 * @param id 节点 id
 * @param name 新名称
 */
export async function renameCollectionNode(id: number, name: string): Promise<void> {
  await updateCollectionNode(id, { name })
  await refreshCollection()
}

/**
 * 批量导入节点到集合（导入 Postman/OpenAPI 用）
 * @param nodes 待导入节点数组（含 children 的临时树）
 * @param parentId 挂载的父节点 id（默认 0 根级）
 */
export async function importNodes(
  nodes: CollectionNode[],
  parentId = 0
): Promise<void> {
  for (const node of nodes) {
    if (node.nodeType === 'folder') {
      const newId = await insertCollectionNode({
        parentId,
        nodeType: 'folder',
        name: node.name,
        method: '',
        url: '',
        config: null,
        sort: node.sort || 0,
      })
      if (node.children?.length) {
        await importNodes(node.children, newId)
      }
    } else {
      await insertCollectionNode({
        parentId,
        nodeType: 'request',
        name: node.name,
        method: node.method,
        url: node.url,
        config: node.config,
        sort: node.sort || 0,
      })
    }
  }
  await refreshCollection()
}

/**
 * 在树中查找节点
 * @param nodes 树节点数组
 * @param id 目标节点 id
 * @returns 找到的节点（未找到返回 null）
 */
function findNode(nodes: CollectionNode[], id: number): CollectionNode | null {
  for (const n of nodes) {
    if (n.id === id) return n
    const hit = findNode(n.children || [], id)
    if (hit) return hit
  }
  return null
}

/**
 * 判断 target 是否在 node 的子孙 subtree 中
 * @param node 祖先候选节点
 * @param targetId 目标节点 id
 * @returns true = target 是 node 的子孙（或就是 node）
 */
function isDescendant(node: CollectionNode, targetId: number): boolean {
  if (node.id === targetId) return true
  return (node.children || []).some((c) => isDescendant(c, targetId))
}

/**
 * 拖拽移动节点到目标文件夹（防环：不能移入自身或自己的子孙）
 * @param dragId 被拖拽节点 id
 * @param targetParentId 目标父文件夹 id（0 = 根目录）
 * @throws 目标非法或移动到自身子树时抛错（调用方提示）
 */
export async function moveCollectionNode(dragId: number, targetParentId: number): Promise<void> {
  const dragNode = findNode(collectionTree.value, dragId)
  if (!dragNode) throw new Error('被移动的节点不存在')
  if (targetParentId !== 0) {
    const target = findNode(collectionTree.value, targetParentId)
    if (!target || target.nodeType !== 'folder') {
      throw new Error('目标位置必须是文件夹')
    }
    if (isDescendant(dragNode, targetParentId)) {
      throw new Error('不能移动到自身或自己的子文件夹内')
    }
  }
  // 排到目标层级的末尾
  const siblingCount = targetParentId === 0
    ? collectionTree.value.length
    : (findNode(collectionTree.value, targetParentId)?.children?.length || 0)
  await updateCollectionNode(dragId, { parentId: targetParentId, sort: siblingCount })
  await refreshCollection()
}

/**
 * 导出集合树引用（供侧边栏组件使用）
 * @returns 集合树 ref
 */
export function useCollectionState() {
  return collectionTree
}
