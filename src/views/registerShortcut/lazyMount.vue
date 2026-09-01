<template>
  <!-- 懒挂载容器：进入视口（含预加载边距）后才渲染真实内容，未渲染时以占位高度撑住布局 -->
  <div ref="hostRef" class="lazy-mount" :style="hostStyle">
    <slot v-if="mounted" />
  </div>
</template>

<script setup lang="ts">
/**
 * 懒挂载组件
 * 用于卡片数量很多的列表页：一次性挂载全部卡片会创建大量组件实例（如下拉选择器），
 * 导致主线程长时间阻塞、页面停滞。这里借助 IntersectionObserver，
 * 仅在卡片滚动接近视口时才挂载其内容，把渲染成本摊平到多帧。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';

const props = withDefaults(
  defineProps<{
    /** 可选：未挂载时的占位最小高度（px），用于撑住网格布局、避免挂载后剧烈跳动。默认 280 */
    minHeight?: number;
    /** 可选：视口预加载边距（px），向下提前多少距离就开始挂载。默认 200 */
    rootMargin?: number;
  }>(),
  { minHeight: 280, rootMargin: 200 }
);

/** 容器元素引用 */
const hostRef = ref<HTMLElement | null>(null);
/** 是否已挂载真实内容；挂载后不再回退，避免反复创建销毁 */
const mounted = ref(false);
/** 观察器实例，卸载时断开 */
let observer: IntersectionObserver | null = null;

/** 未挂载时固定占位高度，挂载后交由内容自撑 */
const hostStyle = computed(() =>
  mounted.value ? {} : { minHeight: `${props.minHeight}px` }
);

onMounted(() => {
  const el = hostRef.value;
  if (!el) return;
  // 环境不支持 IntersectionObserver 时直接挂载，保证功能可用
  if (typeof IntersectionObserver === 'undefined') {
    mounted.value = true;
    return;
  }
  observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        mounted.value = true;
        // 已挂载即完成使命，停止观察减少开销
        observer?.disconnect();
        observer = null;
      }
    },
    // 向下提前一个屏幕边距挂载，滚动时不易看到空白
    { rootMargin: `${props.rootMargin}px 0px` }
  );
  observer.observe(el);
});

onBeforeUnmount(() => {
  observer?.disconnect();
  observer = null;
});
</script>

<style scoped>
.lazy-mount {
  /* 占位时保持块级撑开，不塌陷 */
  display: block;
}
</style>
