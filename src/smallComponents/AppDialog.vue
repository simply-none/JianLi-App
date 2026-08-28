<template>
  <el-dialog
    v-bind="$attrs"
    :fullscreen="isFullscreen"
    :show-close="false"
    class="app-dialog"
  >
    <!-- 头部插槽：总是提供，确保 el-dialog 采用自定义头部（含全屏/关闭按钮）。
         若调用方自定义了 #header，则优先使用调用方内容，否则渲染默认标题 + 右上角动作区。 -->
    <template #header="headerScope">
      <slot name="header" v-bind="headerScope">
        <div class="app-dialog__head">
          <span class="app-dialog__title" :id="headerScope.titleId" :class="headerScope.titleClass">
            {{ titleText }}
          </span>
          <div class="app-dialog__actions">
            <button
              v-if="showFullscreen"
              type="button"
              class="app-dialog__btn"
              :title="isFullscreen ? '退出全屏' : '全屏'"
              @click="isFullscreen = !isFullscreen"
            >
              <LucideIcon :name="isFullscreen ? 'MinimizeIcon' : 'MaximizeIcon'" :size="16" />
            </button>
            <button
              v-if="showClose"
              type="button"
              class="app-dialog__btn"
              title="关闭"
              @click="headerScope.close"
            >
              <LucideIcon name="XIcon" :size="16" />
            </button>
          </div>
        </div>
      </slot>
    </template>

    <!-- 转发调用方提供的其它具名插槽（如 #footer），排除 default 与 header -->
    <template v-for="(slot, name) in forwardSlots" :key="name" #[name]="scope">
      <slot :name="name" v-bind="scope" />
    </template>

    <!-- 默认插槽：弹窗主体 -->
    <slot />
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs, useSlots } from 'vue'
import LucideIcon from '@/components/LucideIcon.vue'

withDefaults(
  defineProps<{
    /** 是否显示全屏切换按钮，默认 true */
    showFullscreen?: boolean
    /** 是否显示关闭按钮，默认 true（进度框等可设 false） */
    showClose?: boolean
  }>(),
  {
    showFullscreen: true,
    showClose: true,
  }
)

const attrs = useAttrs()
const slots = useSlots()

/** 内部全屏状态，绑定到 el-dialog 的 fullscreen 弹层样式 */
const isFullscreen = ref(false)

/** 标题文本取自调用方透传的 title 属性 */
const titleText = computed(() => (attrs.title as string) ?? '')

/** 需要转发的具名插槽（排除 default 与 header，header 由本组件自身决定） */
const forwardSlots = computed(() => {
  const result: Record<string, any> = {}
  for (const name of Object.keys(slots)) {
    if (name === 'default' || name === 'header') continue
    result[name] = (slots as any)[name]
  }
  return result
})
</script>

<style scoped lang="scss">
.app-dialog__head {
  display: flex;
  align-items: center;
  width: 100%;
}

.app-dialog__title {
  flex: 1;
  min-width: 0;
  font-weight: 600;
  font-size: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-dialog__actions {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 12px;
  margin-right: -4px; /* 抵消 el-dialog header 默认右内边距，使按钮贴近右上角 */
}

.app-dialog__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--el-text-color-regular, #606266);
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--el-fill-color-light, #f5f7fa);
  }
}
</style>
