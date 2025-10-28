<template>
  <div class="layout" :style="{
    padding: props.isPadding ? '12px' : '0px',
    backgroundColor: props.isPadding ? (props.paddingColor || '#ffffff') : 'unset',
  }">
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
    default: '#ffffff',
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

  .top {
    border-bottom: 2px solid #f3f3f3;
    padding-bottom: 12px;
  }

  .content {
    flex: 1;
    overflow: auto;
    display: flex;

    .left,
    .main {
      height: 100%;
      // overflow: auto;
    }

    .left {
      flex: 0 0 200px;
    }

    .main {
      flex: 1;
      width: 0;
      // overflow: auto;
    }
  }
}
</style>