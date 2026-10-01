<!--
  思维导图 —— 节点属性弹窗（备注 + 位置 + 分支色 / 背景色 / 文字色）。

  为什么把这些收进弹窗，而不是直接画在节点上：
    · 备注是长文本，铺在节点里会把布局撑歪（节点宽度上限只有 264px）；
    · 颜色是一组离散选项，常驻在节点上会喧宾夺主。
  收进弹窗之后，节点上只多一个**绝对定位的小浮标**，布局尺寸完全不受影响 ——
  这是「坐标是派生数据」这条设计底线的一部分。

  弹窗与**右键菜单**共用同一套色板组件（MindColorRow）与同一批 setter，
  所以两条入口改出来的结果完全一致，不会出现「菜单里能设、弹窗里没有」的缺口。

  打开状态存在 useMindView 的单例里（`nodePanelId`），不走父子传参：
  触发点有三个（节点上的浮标、工具条按钮、右键菜单），走 props 得从页面层再穿一层。

  ⚠️ 色板变量来自 `--mm-tone-*` / `--mm-branch-*`：弹窗被 teleport 到 body 下，
     拿不到 `.mind-canvas` 上的自定义属性，所以此处 `@use` 一次 `styles/palette.scss`，
     让 `.mind-palette-scope` 作用域把变量带进来。
-->
<template>
  <AppDialog v-model="opened" title="节点属性" width="520px" :show-fullscreen="false">
    <div v-if="node" class="mind-panel mind-palette-scope">
      <!-- 节点文本（只读预览，改文本请用 F2 / 双击） -->
      <div class="mind-panel__node">
        <LucideIcon name="Network" :size="15" class="mind-panel__node-icon" />
        <span class="mind-panel__node-text">{{ node.text }}</span>
      </div>

      <!-- 备注 -->
      <div class="mind-panel__section">
        <div class="mind-panel__label">
          <span>备注</span>
          <span class="mind-panel__hint">{{ noteDraft.length }} / {{ MAX_NOTE_LEN }}</span>
        </div>
        <el-input
          v-model="noteDraft"
          type="textarea"
          :rows="5"
          resize="none"
          :maxlength="MAX_NOTE_LEN"
          placeholder="给这个节点补一段说明。备注只在这里维护，不会影响画布上的节点尺寸。"
          @keydown.stop
        />
      </div>

      <!-- 图标：一个 emoji，排在节点文字左侧；留空即清除 -->
      <div class="mind-panel__section">
        <div class="mind-panel__label">
          <span>图标</span>
          <span class="mind-panel__hint">
            一个 emoji（最多 {{ MAX_ICON_CODEPOINTS }} 个码点），显示在节点文字左侧
          </span>
        </div>
        <div class="mind-panel__row">
          <el-input
            v-model="iconDraft"
            class="mind-panel__input"
            size="small"
            :maxlength="8"
            placeholder="例如 🚀（留空即清除）"
            @keydown.stop
            @change="onApplyIcon"
          />
          <button type="button" class="mind-panel__btn" :disabled="!node.icon" @click="onClearIcon">
            清除
          </button>
        </div>
      </div>

      <!-- 链接：只放行 http/https；设好后节点左上角会出现跳转徽标 -->
      <div class="mind-panel__section">
        <div class="mind-panel__label">
          <span>链接</span>
          <span class="mind-panel__hint">只支持 http / https，留空即清除</span>
        </div>
        <div class="mind-panel__row">
          <el-input
            v-model="linkDraft"
            class="mind-panel__input"
            size="small"
            :maxlength="MAX_LINK_LEN"
            placeholder="https://…（留空即清除）"
            @keydown.stop
            @change="onApplyLink"
          />
          <button type="button" class="mind-panel__btn" :disabled="!node.link" @click="onClearLink">
            清除
          </button>
        </div>
      </div>

      <!-- 位置：节点被拖过后坐标会固定下来，这里给它一个明确的「还原」出口 -->
      <div class="mind-panel__section">
        <div class="mind-panel__label">
          <span>位置</span>
          <span class="mind-panel__hint">
            拖动节点即可固定它的位置，其后代跟着走
          </span>
        </div>
        <div class="mind-panel__row">
          <span class="mind-panel__pill" :class="{ 'is-fixed': Boolean(node.pos) }">
            <LucideIcon :name="node.pos ? 'Pin' : 'Move'" :size="12" />
            {{ node.pos ? '已手动固定' : '自动排版' }}
          </span>
          <button
            type="button"
            class="mind-panel__btn"
            :disabled="!node.pos"
            @click="onResetPos"
          >
            恢复自动
          </button>
        </div>
      </div>

      <!-- 颜色：分支色 / 背景色 / 文字色（三者互相独立，点选即刻生效） -->
      <div class="mind-panel__section">
        <div class="mind-panel__colors">
          <MindColorRow
            label="分支色"
            variant="branch"
            none-label="默认"
            hint="整棵子树默认继承，子节点可再覆盖"
            :model-value="node.color"
            @pick="onPickBranch"
          />
          <MindColorRow
            label="背景色"
            variant="bg"
            none-label="无"
            hint="只作用这一个节点，不继承"
            :model-value="node.bgColor"
            @pick="onPickBg"
          />
          <MindColorRow
            label="文字色"
            variant="text"
            none-label="默认"
            hint="只作用这一个节点，不继承"
            :model-value="node.textColor"
            @pick="onPickText"
          />
        </div>
      </div>
    </div>

    <div v-else class="mind-panel__missing">这个节点已经不存在了。</div>

    <div class="mind-panel__footer">
      <button
        type="button"
        class="mind-panel__btn"
        :disabled="!node || !node.note"
        @click="onClearNote"
      >
        清除备注
      </button>
      <div class="mind-panel__footer-right">
        <button type="button" class="mind-panel__btn" @click="opened = false">关闭</button>
        <button
          type="button"
          class="mind-panel__btn mind-panel__btn--primary"
          :disabled="!node"
          @click="onSaveNote"
        >
          保存备注
        </button>
      </div>
    </div>
  </AppDialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

import AppDialog from '@/components/AppDialog.vue'
import LucideIcon from '@/components/LucideIcon.vue'
import { MAX_ICON_CODEPOINTS, MAX_LINK_LEN, MAX_NOTE_LEN } from '../constants'
import { useMindDoc } from '../composables/useMindDoc'
import { useMindView } from '../composables/useMindView'
import type { MindColorKey } from '../types'
import { findNode } from '../utils/tree'
import MindColorRow from './MindColorRow.vue'

const mind = useMindDoc()
const view = useMindView()

/** 把单例里的「当前打开的节点 id」包成可读写的 v-model */
const opened = computed({
  get: () => Boolean(view.nodePanelId.value),
  set: (value: boolean) => {
    if (!value) view.closeNodePanel()
  },
})

/** 正在编辑的节点；被删除时自动关闭弹窗 */
const node = computed(() => {
  const id = view.nodePanelId.value
  if (!id) return undefined
  return findNode(mind.tree.value, id)
})

const noteDraft = ref('')
const iconDraft = ref('')
const linkDraft = ref('')

// 换节点时把三个草稿重新灌一次（只按 id 变化触发，避免自己打字时被回写覆盖）
watch(
  () => node.value?.id,
  () => {
    noteDraft.value = node.value?.note ?? ''
    iconDraft.value = node.value?.icon ?? ''
    linkDraft.value = node.value?.link ?? ''
  },
  { immediate: true },
)

watch(node, (value) => {
  if (!value) view.closeNodePanel()
})

/**
 * 三类颜色都是离散选择，点了立刻生效 —— 不需要再点保存。
 * 各自维护一个 handler 而不是传一个「改哪个字段」的参数：
 * 三个 setter 各自有自己的语义（清除时回落的目标不同），
 * 用参数拼一个通用写法反而要在调用处写字符串，更容易写错。
 */
function onPickBranch(color?: MindColorKey) {
  const target = node.value
  if (target) mind.setNodeColor(target.id, color)
}

function onPickBg(color?: MindColorKey) {
  const target = node.value
  if (target) mind.setNodeBg(target.id, color)
}

function onPickText(color?: MindColorKey) {
  const target = node.value
  if (target) mind.setNodeTextColor(target.id, color)
}

/** 把该节点交回自动排版（只影响这一个节点，后代仍相对它摆放） */
function onResetPos() {
  const target = node.value
  if (!target || !target.pos) return
  if (mind.setNodePos(target.id)) ElMessage.success('已恢复自动位置')
}

/* ------------------------------------------------------- 图标 / 链接 */

/*
  ⚠️ 这两个输入走 `@change`（失焦 / 回车）提交，**不是**每次按键都写 ——
     每一次成功写入都是一步撤销（commit），逐字符提交会把撤销栈刷满，
     用户按 Ctrl+Z 会变成「一个一个字符地退」，完全没法用。
     与备注「填完再点保存」是同一个道理，只是这里省掉了保存按钮。
*/

/** 应用图标：非法（超长 / 非 emoji）时 `normalizeIcon` 会回落成清除 */
function onApplyIcon() {
  const target = node.value
  if (!target) return
  mind.setNodeIcon(target.id, iconDraft.value)
  // 回读真实落库值：被 normalize 掉的内容要让输入框立刻反映出来，不留「看起来设上了」的假象
  iconDraft.value = findNode(mind.tree.value, target.id)?.icon ?? ''
}

function onClearIcon() {
  const target = node.value
  if (!target) return
  iconDraft.value = ''
  mind.setNodeIcon(target.id, '')
}

/**
 * 应用链接。
 * 非 http/https 的输入会被 `normalizeLink` 当作清除处理（协议白名单是硬底线 ——
 * 这个字符串最终会交给浏览器打开）。这种情况下给一句明确提示，
 * 而不是默默把用户刚粘的东西擦掉、让人以为是程序坏了。
 */
function onApplyLink() {
  const target = node.value
  if (!target) return
  const raw = linkDraft.value.trim()
  mind.setNodeLink(target.id, raw)
  const saved = findNode(mind.tree.value, target.id)?.link ?? ''
  linkDraft.value = saved
  if (raw && !saved) ElMessage.warning('只支持 http / https 链接，已清除')
}

function onClearLink() {
  const target = node.value
  if (!target) return
  linkDraft.value = ''
  mind.setNodeLink(target.id, '')
}

function onSaveNote() {
  const target = node.value
  if (!target) return
  const changed = mind.setNodeNote(target.id, noteDraft.value)
  if (changed) ElMessage.success('备注已保存')
  view.closeNodePanel()
}

function onClearNote() {
  const target = node.value
  if (!target) return
  noteDraft.value = ''
  mind.setNodeNote(target.id, '')
}
</script>

<style scoped lang="scss">
/*
  显式引入一次分支色板：作用域选择器会被编译成 `.mind-palette-scope[data-v-xxx]`，
  正好落在本组件的根节点上。这样即使用户先访问别的页面、或将来把弹窗搬到别处，
  色板也不会因为「依赖 MindCanvas 的样式块」而丢掉。

  用 `@use`（不用已弃用的 `@import`）：两者在「把 palette 的 CSS 内联到这里」这一点上
  产物完全一致，scoped 属性落点也相同；`@use` 必须写在所有规则之前，这里正好是首行。
*/
@use '../styles/palette.scss';

.mind-panel__node {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-hover);
}

.mind-panel__node-icon {
  flex: none;
  color: var(--color-primary);
}

.mind-panel__node-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.mind-panel__section {
  margin-top: 16px;
}

.mind-panel__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.mind-panel__hint {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

/* ---- 位置：状态药丸 + 恢复按钮 ---- */
.mind-panel__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

/* 图标 / 链接那一行的输入框：占满剩余宽度（右侧留一个「清除」按钮） */
.mind-panel__input {
  flex: 1;
  min-width: 0;
}

.mind-panel__pill {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border: 1px solid var(--border-subtle);
  border-radius: 999px;
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.6;
}

.mind-panel__pill.is-fixed {
  border-color: color-mix(in srgb, var(--color-primary) 45%, transparent);
  background: color-mix(in srgb, var(--color-primary) 14%, transparent);
  color: var(--color-primary);
}

/* 三行色板纵向排开；每行内部的「标签 + 色块」由 MindColorRow 自己排版 */
.mind-panel__colors {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.mind-panel__missing {
  padding: 24px 0;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

.mind-panel__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 18px;
}

.mind-panel__footer-right {
  display: flex;
  gap: 8px;
}

.mind-panel__btn {
  padding: 7px 14px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    color: var(--text-primary);
    border-color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  &--primary {
    border-color: var(--color-primary);
    background: var(--color-primary);
    color: #fff;

    &:hover:not(:disabled) {
      color: #fff;
      background: var(--color-primary-solid, var(--color-primary));
    }
  }
}
</style>
