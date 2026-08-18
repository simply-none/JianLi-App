<template>
  <div class="sticker-root" @dblclick="close" @wheel.prevent="onWheel">
    <div class="sticker-frame">
      <img
        :src="dataUrl"
        class="sticker-img"
        :style="{ transform: 'scale(' + zoom + ')' }"
        draggable="false"
        alt="贴图"
      />
    </div>
    <div class="sticker-toolbar no-drag">
      <span class="sticker-zoom">{{ Math.round(zoom * 100) }}%</span>
      <button class="sticker-btn" title="关闭 (Esc / 双击)" @click.stop="close">
        <LucideIcon name="X" :size="14" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import LucideIcon from "@/components/LucideIcon.vue";

const dataUrl = ref<string>("");

/** 滚轮缩放系数：仅缩放窗口内图片，不动 Electron 窗口尺寸（透明窗口背景不变，不影响其他内容） */
const zoom = ref(1);
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 5;

/** 向主进程索取本窗口要显示的贴图（按 webContents.id 匹配） */
async function loadImage() {
  try {
    const res: any = await window.ipcRenderer.handlePromise("sticker:get", {});
    if (res?.success && res.dataUrl) dataUrl.value = res.dataUrl;
  } catch {
    /* 取不到则不显示 */
  }
}

function close() {
  window.ipcRenderer.send("sticker:close");
}

/** 滚轮缩放：在固定透明窗口内对图片做 transform 缩放，不改变窗口大小，不影响其他内容。
 * 绑定在根元素 @wheel 上（避免 window 级监听在该透明窗口下不触发的问题）。 */
function onWheel(e: WheelEvent) {
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
  let next = zoom.value * factor;
  next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
  zoom.value = Math.round(next * 100) / 100;
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") close();
}

onMounted(() => {
  loadImage();
  window.addEventListener("keydown", onKey);
});

onUnmounted(() => {
  window.removeEventListener("keydown", onKey);
});
</script>

<style scoped lang="scss">
/* 根容器：不直接作为拖拽区，保证 wheel 等事件能正常冒泡/派发；
   拖拽交给图片本身（.sticker-img 设为 drag 区域），工具栏 no-drag 保证按钮可点 */
.sticker-root {
  width: 100%;
  height: 100%;
  padding: 3px;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  overflow: hidden;
}

/* 边框/投影承载层：包裹图片，描边贴合真实图像，
   白色描边 + 深色外环 + 投影，确保任意背景下都清晰可见 */
.sticker-frame {
  line-height: 0;
  background: #fff;
  border: 2px solid #fff;
  border-radius: 8px;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25), 0 8px 28px rgba(0, 0, 0, 0.45);
  max-width: 100%;
  max-height: 100%;
  -webkit-app-region: drag; /* 按住图片即可移动窗口（Snipaste 风格） */
}

.sticker-img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  border-radius: 6px;
  object-fit: contain;
  transform-origin: center center;
}

.sticker-toolbar {
  position: absolute;
  top: 6px;
  right: 6px;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 6px;
  /* 关闭按钮常显，用户无需悬停即可关闭贴图 */
  opacity: 1;
}

.sticker-zoom {
  padding: 2px 6px;
  font-size: 12px;
  line-height: 1;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  user-select: none;
}

.sticker-btn {
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  cursor: pointer;

  &:hover {
    background: rgba(245, 108, 108, 0.9);
  }
}
</style>
