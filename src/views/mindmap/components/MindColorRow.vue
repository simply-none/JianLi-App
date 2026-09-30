<!--
  思维导图 —— 一行色板（分支色 / 背景色 / 文字色**共用**）。

  为什么抽成组件：这三种颜色在**两处**都要出现（右键菜单、节点属性弹窗），
  而每一处都是「标签 + 未设置按钮 + 6 个色块 + 选中态」这套结构。
  写两遍就会漂移（一处是实色块、一处忘了换成铺底色），所以只留一份。

  ⚠️ 关于色板变量：本组件的**根节点自带 `.mind-palette-scope`**，
     并在样式里 `@use '../styles/palette.scss'`。
     这样 scoped 编译出来是 `.mind-palette-scope[data-v-xxx]` —— 正好落在自己的根上，
     于是色板变量就地生效，**不依赖**父级（弹窗 / 菜单）有没有引来色板。
     浮层类是 teleport 到 body 的，拿不到 `.mind-canvas` 上的自定义属性，
     这种「自带变量」的做法比「靠父级挂载顺序」可靠。

  取色口径（variant）决定色块画成什么样：
    · `branch` 分支色 —— 实色（与节点描边、色条同款）
    · `bg`     背景色 —— **低透铺底色**（画成实色会让人误以为节点会变成那样重）
    · `text`   文字色 —— 实色
-->
<template>
  <div class="mind-color-row mind-palette-scope">
    <div class="mind-color-row__label">
      <span>{{ label }}</span>
      <span v-if="hint" class="mind-color-row__hint">{{ hint }}</span>
    </div>
    <div class="mind-color-row__swatches">
      <button
        type="button"
        class="mind-color-row__none"
        :class="{ 'is-active': !modelValue }"
        :title="noneLabel"
        @click="emit('pick', undefined)"
      >
        {{ noneLabel }}
      </button>
      <button
        v-for="item in MIND_COLORS"
        :key="item.value"
        type="button"
        class="mind-color-row__swatch"
        :class="{ 'is-active': modelValue === item.value }"
        :style="{ background: swatchOf(item.value) }"
        :title="item.label"
        @click="emit('pick', item.value)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { MIND_COLORS, branchVar, toneSoftVar, toneVar } from '../constants'
import type { MindColorKey } from '../types'

const props = defineProps<{
  /** 行标题 */
  label: string
  /** 当前选中的色 key；undefined = 未设置（走「默认 / 无」） */
  modelValue?: MindColorKey
  /** 取色口径：决定色块是画实色还是画低透铺底色 */
  variant: 'branch' | 'bg' | 'text'
  /** 「未设置」按钮的文案（分支色 / 文字色是「默认」，背景色是「无」） */
  noneLabel: string
  /** 标题右侧的补充说明（可选） */
  hint?: string
}>()

const emit = defineEmits<{
  (e: 'pick', key?: MindColorKey): void
}>()

/** 色块用什么颜色画：背景色看的是「铺上去之后的样」，所以用低透色 */
function swatchOf(key: MindColorKey): string {
  if (props.variant === 'bg') return toneSoftVar(key)
  if (props.variant === 'branch') return branchVar(key)
  return toneVar(key)
}
</script>

<style scoped lang="scss">
@use '../styles/palette.scss';

.mind-color-row__label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.mind-color-row__hint {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 400;
}

.mind-color-row__swatches {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  /*
    尺寸走**可继承的尺寸变量**（配 fallback 用，不在本组件里声明默认值）：
    这样调用方只要在祖先上写一行 `--mind-swatch-size` 就能整体缩放，
    不用 :deep() 去改四条规则 —— 弹窗与右键菜单的空间预算差一倍，
    但色板的排版逻辑必须还是同一份。
  */
  gap: var(--mind-swatch-gap, 8px);
}

.mind-color-row__swatch {
  width: var(--mind-swatch-size, 26px);
  height: var(--mind-swatch-size, 26px);
  padding: 0;
  border: 1px solid var(--border-subtle);
  border-radius: calc(var(--mind-swatch-size, 26px) * 0.3);
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;

  &:hover {
    transform: translateY(-1px);
  }

  &.is-active {
    border-color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 3px var(--text-muted);
  }
}

.mind-color-row__none {
  height: var(--mind-swatch-size, 26px);
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: calc(var(--mind-swatch-size, 26px) * 0.3);
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, box-shadow 0.15s;

  &:hover {
    color: var(--text-primary);
  }

  &.is-active {
    border-color: var(--text-primary);
    color: var(--text-primary);
    box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 3px var(--text-muted);
  }
}
</style>
