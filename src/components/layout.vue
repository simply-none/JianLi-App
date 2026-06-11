<template>
  <div
    class="layout"
    :class="{ 'is-padded': props.isPadding }"
    :style="{
      padding: props.isPadding ? '16px' : '0px',
      backgroundColor: props.isPadding ? (props.paddingColor || '#f5f6fa') : 'unset',
    }"
  >
    <div class="top" v-if="$slots.top" ref="top">
      <slot name="top">
        顶部
      </slot>
    </div>
    <div class="content" ref="content">
      <div class="left" v-if="$slots.left">
        <slot name="left">
          左侧
        </slot>
      </div>
      <div class="main" v-if="$slots.main">
        <slot name="main">
          主内容
        </slot>
      </div>
    </div>
    <div class="bottom" v-if="$slots.bottom" ref="bottom">
      <slot name="bottom">
        底部
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import useGlobalSetting from '../store/useGlobalSetting';
import { storeToRefs } from 'pinia';

const props = defineProps({
  isPadding: {
    type: Boolean,
    default: false,
  },
  paddingColor: {
    type: String,
    default: '#f5f6fa',
  }
});
const top = ref<HTMLElement>();
const bottom = ref<HTMLElement>();
const content = ref<HTMLElement>();

onMounted(() => {
})
</script>

<style scoped lang="scss">
.layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  box-sizing: border-box;
  gap: 0;

  .top {
    flex-shrink: 0;
    padding: 0 4px 14px 4px;
    // 使用细线 + 微妙阴影替代粗边框
    border-bottom: 1px solid rgba(0, 0, 0, 0.06);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.03);
    margin-bottom: 14px;
  }

  .content {
    flex: 1;
    overflow: hidden;
    display: flex;

    .left,
    .main {
      height: 100%;
    }

    .left {
      flex: 0 0 210px;
      overflow: hidden;
    }

    .main {
      flex: 1;
      width: 0;
      overflow: auto;
      box-sizing: border-box;

      // hover 时显示滚动条
      &::-webkit-scrollbar {
        width: 4px;
        opacity: 0;
      }
      &::-webkit-scrollbar-thumb {
        background: transparent;
        border-radius: 4px;
        transition: background 0.2s;
      }
      &:hover::-webkit-scrollbar-thumb {
        background: rgba(0, 0, 0, 0.15);
      }
      &:hover::-webkit-scrollbar-thumb:hover {
        background: rgba(0, 0, 0, 0.3);
      }
    }
  }

  /* 卡片式样式仅在 isPadding 模式下生效 */
  &.is-padded {
    .content {
      gap: 16px;

      .left {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03);
      }

      .main {
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.03);
        padding: 20px 24px;
      }
    }
  }

  .bottom {
    flex-shrink: 0;
    padding-top: 12px;
    border-top: 1px solid rgba(0, 0, 0, 0.06);
  }
}
</style>