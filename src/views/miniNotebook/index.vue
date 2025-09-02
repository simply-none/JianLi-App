<template>
  <div class="pomodoroMiniWindow">
    <div class="move">
      <div class="move-left" @mousemove="enableMouseClickThroughFn"></div>
      <div class="move-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>
    <div class="drag"></div>
    <div class="content">
      <umo-editor v-bind="options"  />
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref, onBeforeUnmount } from 'vue';
import moment from 'moment';
import { throttle } from '@/utils/index';
import { UmoEditor } from '@umoteam/editor';

const curStatusC = ref({})
const nextTime = ref()
const nextDiffTime = ref()

const options = ref({
  // 配置项
  // ...
});

window.ipcRenderer.on('sync-data-to-other-window', (event, arg) => {
  console.log(arg, 'MY miniNotebook')
})

// 鼠标移入移出
const enableMouseClickThroughFn = () => {
  // throttle(() => {
  window.ipcRenderer.send('enable-mouse-click-through', 'miniNotebook')
  // }, 100)

}
const disableMouseClickThroughFn = () => {
  // throttle(() => {
  window.ipcRenderer.send('disable-mouse-click-through', 'miniNotebook')
  // }, 100)
}

const onBeforeCreate = () => {
  console.log('onBeforeCreate', '编辑器即将创建，无可用参数')
}
const onCreated = () => {
  console.log('onCreated', '编辑器已创建，可用参数:', { editor })
}
const onChanged = () => {
  console.log('onChanged', '编辑器内容已更新，可用参数:', { editor })
}
const onChangedSelection = () => {
  console.log('onChanged:selection', '所选内容已发生变化，可用参数:', { editor })
}
const onChangedTransaction = () => {
  console.log(
    'onChanged:transaction',
    '编辑器状态已发生变化，可用参数:', { editor, transaction },
  )
}
const onChangedMenu = (currentMenu) => {
  console.log(
    'onChanged:menu',
    '菜单栏状态发生变化，可用参数: currentMenu，当前菜单为', currentMenu,
  )
}
const onChangedToolbar = ({ toolbar, oldToolbar }) => {
  console.log(
    'onChanged:toolbar',
    '工具栏信息发生变化，可用参数:', { toolbar, oldToolbar }
  )
}
const onChangedPageLayout = ({ pageLayout, oldPageLayout }) => {
  console.log(
    'onChanged:pageLayout',
    '页面布局发生变化，可用参数:', { pageLayout, oldPageLayout }
  )
}
const onChangedPageSize = ({ pageSize, oldPageSize }) => {
  console.log(
    'onChanged:pageSize',
    '页面大小信息发生变化，可用参数:', { pageSize, oldPageSize }
  )
}
const onChangedPageOrientation = ({ pageOrientation, oldPageOrientation }) => {
  console.log(
    'onChanged:pageOrientation',
    '页面方向发生变化，可用参数:', { pageOrientation, oldPageOrientation }
  )
}
const onChangedPageMargin = ({ pageMargin, oldPageMargin }) => {
  console.log(
    'onChanged:pageMargin',
    '页面边距信息发生变化，可用参数:', { pageMargin, oldPageMargin },
  )
}
const onChangedPageBackground = ({ pageBackground, oldPageBackground }) => {
  console.log(
    'onChanged:pageBackground',
    '页面背景发生变化，可用参数:', { pageBackground, oldPageBackground },
  )
}
const onChangedZoom = ({ zoomLevel, oldZoomLevel }) => {
  console.log(
    'onChanged:pageZoom',
    '页面缩放比例发生变化，可用参数:', { zoomLevel, oldZoomLevel }
  )
}
const onChangedPageShowToc = (showToc) => {
  console.log(
    'onChanged:pageShowToc',
    '页面大纲面板显示状态发生变化，可用参数:', showToc
  )
}
const onChangedpreview = (enabled) => {
  console.log(
    'onChanged:pagePreview',
    '页面预览模式发生变化，可用参数:', enabled,
  )
}
const onChangedPageWatermark = ({ pageWatermark, oldPageWatermark }) => {
  console.log(
    'onChanged:pageWatermark',
    '页面水印信息发生变化，可用参数:', { pageWatermark, oldPageWatermark }
  )
}
const onChangedLocale = ({ locale, oldLocale }) => {
  console.log(
    'onChanged:locale',
    '语言设置发生变化，可用参数:', { locale, oldLocale }
  )
}
const onChangedTheme = (theme) => {
  console.log(
    'onChanged:theme',
    '主题设置发生变化，可用参数:', theme
  )
}
const onContentError = ({ editor, error, disableCollaboration }) => {
  console.log(
    'onContentError',
    '文档内容解析错误:', { editor, error, disableCollaboration }
  )
}
const onPrint = () => {
  console.log('onPrint', '编辑器获得焦点，无可用参数')
}
const onFocus = () => {
  console.log('onFocus', '编辑器获得焦点，可用参数:', { editor, event })
}
const onBlur = () => {
  console.log('onBlur', '编辑器失去焦点，可用参数:', { editor, event })
}
const onSaved = () => {
  console.log('onSaved', '文档已保存，无可用参数')
}
const onDestroy = () => {
  console.log('onDestroy', '编辑器组件已销毁，无可用参数')
}

onMounted(() => {
})
</script>

<style lang="scss" scoped>
.pomodoroMiniWindow {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 0 12px 12px 12px;
  background: #e6e6e68e;
}

.drag {
  width: 100%;
  height: 12px;
  -webkit-app-region: drag;
  cursor: pointer;
  background-color: #63ff6365;
}

.move {
  width: 100%;
  height: 12px;
  display: flex;
  justify-content: space-around;

  &-left {
    width: 9px;
    height: 9px;
    background: #a8a8a83f;
  }

  &-right {
    width: 9px;
    height: 9px;
    background: #a8a8a83f;
  }
}

.label {
  font-size: 18px;
  font-weight: 500;
  color: #333;
  pointer-events: none;
}

.value {
  font-size: 20px;
  font-weight: 900;
  color: #333;
  pointer-events: none;
}

.tip {
  display: flex;
  align-items: center;

  &-label {
    font-size: 16px;
    font-weight: 500;
    color: #333;
  }

  &-status {
    margin-right: 12px;
    display: flex;
    align-items: center;
  }

  .work,
  .rest {
    // 实现一个小圆点
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .work {
    background: #00ff00;
  }

  .rest {
    background: #ff0000;
  }
}
</style>