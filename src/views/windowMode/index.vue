<template>
  <layout-vue>
    <template #main>
      <div class="setting-page">
        <div class="section">
          <h2 class="section-title">
            <el-icon><Monitor /></el-icon>
            番茄钟小窗口
          </h2>

          <div class="toggle-card">
            <span class="toggle-label">小窗口状态</span>
            <div class="toggle-group">
              <el-button 
                :type="showPomodoroMiniWindowCc ? 'primary' : 'default'"
                :plain="!showPomodoroMiniWindowCc"
                @click="changeShowPomodoroMiniWindowFn(true)"
                class="toggle-btn"
              >
                开启
              </el-button>
              <el-button 
                :type="!showPomodoroMiniWindowCc ? 'primary' : 'default'"
                :plain="showPomodoroMiniWindowCc"
                @click="changeShowPomodoroMiniWindowFn(false)"
                class="toggle-btn"
              >
                关闭
              </el-button>
              <el-button 
                type="primary"
                @click="applyPomodoroWindow"
                class="apply-btn"
              >
                <el-icon><Plus /></el-icon>
                应用
              </el-button>
            </div>
          </div>

          <div class="window-card">
            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><Position /></el-icon>
                位置选择
              </div>
              <div class="position-wrapper">
                <div class="position-grid">
                  <el-button 
                    v-for="pos in positionOptions" 
                    :key="pos.value"
                    :type="pomodoroConfig.position === pos.value ? 'primary' : 'default'"
                    :plain="pomodoroConfig.position !== pos.value"
                    @click="selectPosition('pomodoro', pos.value)"
                    class="position-card"
                  >
                    {{ pos.icon }}
                  </el-button>
                </div>
                <el-button 
                  type="default"
                  plain
                  @click="openCustomModal('pomodoro', 'position')"
                  class="custom-btn"
                >
                  <el-icon :size="14"><EditPen /></el-icon>
                  自定义
                </el-button>
              </div>
            </div>

            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><FullScreen /></el-icon>
                窗口尺寸
              </div>
              <div class="size-row">
                <el-button 
                  v-for="size in sizeOptions" 
                  :key="size.label"
                  :type="pomodoroConfig.width === size.width && pomodoroConfig.height === size.height ? 'primary' : 'default'"
                  :plain="pomodoroConfig.width !== size.width || pomodoroConfig.height !== size.height"
                  @click="selectSize('pomodoro', size.width, size.height)"
                  class="config-option"
                >
                  {{ size.label }}
                </el-button>
                <el-button 
                  type="default"
                  plain
                  @click="openCustomModal('pomodoro', 'size')"
                  class="config-option custom-option"
                >
                  <el-icon :size="14"><EditPen /></el-icon>
                  自定义
                </el-button>
              </div>
            </div>

            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><Position /></el-icon>
                边缘间隙
              </div>
              <div class="gap-row">
                <el-button 
                  v-for="gap in gapOptions" 
                  :key="gap"
                  :type="pomodoroConfig.gap === gap ? 'primary' : 'default'"
                  :plain="pomodoroConfig.gap !== gap"
                  @click="selectGap('pomodoro', gap)"
                  class="config-option"
                >
                  {{ gap }}px
                </el-button>
                <el-button 
                  type="default"
                  plain
                  @click="openCustomModal('pomodoro', 'gap')"
                  class="config-option custom-option"
                >
                  <el-icon :size="14"><EditPen /></el-icon>
                  自定义
                </el-button>
              </div>
            </div>

            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><SetUp /></el-icon>
                皮肤主题
              </div>
              <div class="theme-row">
                <el-button 
                  v-for="theme in skinOptions" 
                  :key="theme.value"
                  :type="pomodoroConfig.skin === theme.value ? 'primary' : 'default'"
                  :plain="pomodoroConfig.skin !== theme.value"
                  @click="selectSkin(theme.value)"
                  class="config-option theme-option"
                >
                  {{ theme.label }}
                </el-button>
              </div>
            </div>

            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><Grid /></el-icon>
                排版样式
              </div>
              <div class="layout-row">
                <el-button 
                  v-for="layout in layoutOptions" 
                  :key="layout.value"
                  :type="pomodoroConfig.layout === layout.value ? 'primary' : 'default'"
                  :plain="pomodoroConfig.layout !== layout.value"
                  @click="selectLayout(layout.value)"
                  class="config-option"
                >
                  {{ layout.label }}
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="section">
          <h2 class="section-title">
            <el-icon><Notebook /></el-icon>
            笔记本小窗口
          </h2>

          <div class="toggle-card">
            <span class="toggle-label">小窗口状态</span>
            <div class="toggle-group">
              <el-button 
                :type="showMiniNotebookWindowCc ? 'primary' : 'default'"
                :plain="!showMiniNotebookWindowCc"
                @click="changeShowMiniNotebookWindowFn(true)"
                class="toggle-btn"
              >
                开启
              </el-button>
              <el-button 
                :type="!showMiniNotebookWindowCc ? 'primary' : 'default'"
                :plain="showMiniNotebookWindowCc"
                @click="changeShowMiniNotebookWindowFn(false)"
                class="toggle-btn"
              >
                关闭
              </el-button>
              <el-button 
                type="primary"
                @click="applyNotebookWindow"
                class="apply-btn"
              >
                <el-icon><Plus /></el-icon>
                应用
              </el-button>
            </div>
          </div>

          <div class="window-card">
            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><Position /></el-icon>
                位置选择
              </div>
              <div class="position-wrapper">
                <div class="position-grid">
                  <el-button 
                    v-for="pos in positionOptions" 
                    :key="pos.value"
                    :type="notebookConfig.position === pos.value ? 'primary' : 'default'"
                    :plain="notebookConfig.position !== pos.value"
                    @click="selectPosition('notebook', pos.value)"
                    class="position-card"
                  >
                    {{ pos.icon }}
                  </el-button>
                </div>
                <el-button 
                  type="default"
                  plain
                  @click="openCustomModal('notebook', 'position')"
                  class="custom-btn"
                >
                  <el-icon :size="14"><EditPen /></el-icon>
                  自定义
                </el-button>
              </div>
            </div>

            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><FullScreen /></el-icon>
                窗口尺寸
              </div>
              <div class="size-row">
                <el-button 
                  v-for="size in notebookSizeOptions" 
                  :key="size.label"
                  :type="notebookConfig.width === size.width && notebookConfig.height === size.height ? 'primary' : 'default'"
                  :plain="notebookConfig.width !== size.width || notebookConfig.height !== size.height"
                  @click="selectSize('notebook', size.width, size.height)"
                  class="config-option"
                >
                  {{ size.label }}
                </el-button>
                <el-button 
                  type="default"
                  plain
                  @click="openCustomModal('notebook', 'size')"
                  class="config-option custom-option"
                >
                  <el-icon :size="14"><EditPen /></el-icon>
                  自定义
                </el-button>
              </div>
            </div>

            <div class="config-section">
              <div class="config-label">
                <el-icon :size="16"><Position /></el-icon>
                边缘间隙
              </div>
              <div class="gap-row">
                <el-button 
                  v-for="gap in gapOptions" 
                  :key="gap"
                  :type="notebookConfig.gap === gap ? 'primary' : 'default'"
                  :plain="notebookConfig.gap !== gap"
                  @click="selectGap('notebook', gap)"
                  class="config-option"
                >
                  {{ gap }}px
                </el-button>
                <el-button 
                  type="default"
                  plain
                  @click="openCustomModal('notebook', 'gap')"
                  class="config-option custom-option"
                >
                  <el-icon :size="14"><EditPen /></el-icon>
                  自定义
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="showModal" class="modal-overlay" @click="closeModal">
          <div class="modal-content" @click.stop>
            <div class="modal-header">
              {{ modalTitle }}
              <el-button type="text" @click="closeModal" class="close-btn">
                <el-icon><Close /></el-icon>
              </el-button>
            </div>
            <div class="modal-body">
              <div v-if="modalType === 'position'" class="modal-form">
                <div class="form-item">
                  <label>X 坐标：</label>
                  <input type="number" v-model="customPosition.x" placeholder="输入X坐标" />
                </div>
                <div class="form-item">
                  <label>Y 坐标：</label>
                  <input type="number" v-model="customPosition.y" placeholder="输入Y坐标" />
                </div>
              </div>
              <div v-if="modalType === 'size'" class="modal-form">
                <div class="form-item">
                  <label>宽度：</label>
                  <input type="number" v-model="customSize.width" placeholder="输入宽度" />
                </div>
                <div class="form-item">
                  <label>高度：</label>
                  <input type="number" v-model="customSize.height" placeholder="输入高度" />
                </div>
              </div>
              <div v-if="modalType === 'gap'" class="modal-form">
                <div class="form-item">
                  <label>间隙：</label>
                  <input type="number" v-model="customGap" placeholder="输入间隙值" />
                </div>
              </div>
            </div>
            <div class="modal-footer">
              <el-button type="default" @click="closeModal" class="modal-btn">取消</el-button>
              <el-button type="primary" @click="confirmCustom" class="modal-btn">确定</el-button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
import { Monitor, Notebook, Position, FullScreen, EditPen, Close, Plus, SetUp, Grid } from '@element-plus/icons-vue';
import LayoutVue from '@/components/layout.vue';
import useWindowMode from '@/store/useWindowMode';
import { setStore } from '@/utils/common';

const { 
  showPomodoroMiniWindowC, 
  showMiniNotebookWindowC,
  pomodoroMiniWindowConfig,
  miniNotebookWindowConfig
} = storeToRefs(useWindowMode());
const { setShowPomodoroMiniWindow, setShowMiniNotebookWindow } = useWindowMode();

const showPomodoroMiniWindowCc = ref(showPomodoroMiniWindowC.value);
const showMiniNotebookWindowCc = ref(showMiniNotebookWindowC.value);

const pomodoroConfig = ref({ ...pomodoroMiniWindowConfig.value });
const notebookConfig = ref({ ...miniNotebookWindowConfig.value });

watch(showPomodoroMiniWindowC, (val) => {
  showPomodoroMiniWindowCc.value = JSON.parse(JSON.stringify(val));
});

watch(showMiniNotebookWindowC, (val) => {
  showMiniNotebookWindowCc.value = JSON.parse(JSON.stringify(val));
});

watch(pomodoroMiniWindowConfig, (val) => {
  pomodoroConfig.value = { ...val };
}, { deep: true });

watch(miniNotebookWindowConfig, (val) => {
  notebookConfig.value = { ...val };
}, { deep: true });

function changeShowPomodoroMiniWindowFn(val: boolean) {
  setShowPomodoroMiniWindow(toRaw(val));
}

function changeShowMiniNotebookWindowFn(val: boolean) {
  setShowMiniNotebookWindow(toRaw(val));
}

function applyPomodoroWindow() {
  if (showPomodoroMiniWindowCc.value) {
    changeShowPomodoroMiniWindowFn(false);
    setTimeout(() => {
      changeShowPomodoroMiniWindowFn(true);
    }, 300);
  } else {
    changeShowPomodoroMiniWindowFn(true);
  }
}

function applyNotebookWindow() {
  if (showMiniNotebookWindowCc.value) {
    changeShowMiniNotebookWindowFn(false);
    setTimeout(() => {
      changeShowMiniNotebookWindowFn(true);
    }, 300);
  } else {
    changeShowMiniNotebookWindowFn(true);
  }
}

const positionOptions = [
  { value: 'top-left', icon: '↖' },
  { value: 'center-top', icon: '↑' },
  { value: 'top-right', icon: '↗' },
  { value: 'center-left', icon: '←' },
  { value: 'center', icon: '●' },
  { value: 'center-right', icon: '→' },
  { value: 'bottom-left', icon: '↙' },
  { value: 'center-bottom', icon: '↓' },
  { value: 'bottom-right', icon: '↘' },
];

const sizeOptions = [
  { label: '108×81', width: 108, height: 81 },
  { label: '200×100', width: 200, height: 100 },
  { label: '300×150', width: 300, height: 150 },
];

const notebookSizeOptions = [
  { label: '600×400', width: 600, height: 400 },
  { label: '800×600', width: 800, height: 600 },
  { label: '1024×768', width: 1024, height: 768 },
];

const gapOptions = [10, 20, 30, 50];

const skinOptions = [
  { label: '默认(白)', value: 'white' },
  { label: '珊瑚橙', value: 'coral' },
  { label: '薄荷绿', value: 'mint' },
  { label: '星空蓝', value: 'sky' },
  { label: '薰衣草', value: 'lavender' },
  { label: '樱花粉', value: 'sakura' },
  { label: '琥珀金', value: 'amber' },
  { label: '暗夜黑', value: 'dark' },
  { label: '薄雾灰', value: 'gray' },
  { label: '极光青', value: 'aurora' },
];

const layoutOptions = [
  { label: '默认', value: 'default' },
  { label: '简约', value: 'simple' },
  { label: '圆形', value: 'circle' },
  { label: '紧凑', value: 'compact' },
  { label: '经典', value: 'classic' },
  { label: '翻页', value: 'flip' },
];

function selectSkin(value: string) {
  pomodoroConfig.value.skin = value;
  pomodoroMiniWindowConfig.value.skin = value;
  setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
}

function selectLayout(value: string) {
  pomodoroConfig.value.layout = value;
  pomodoroMiniWindowConfig.value.layout = value;
  setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
}

function selectPosition(type: string, value: string) {
  if (type === 'pomodoro') {
    pomodoroConfig.value.position = value;
    pomodoroMiniWindowConfig.value.position = value;
    setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
  } else {
    notebookConfig.value.position = value;
    miniNotebookWindowConfig.value.position = value;
    setStore('window-mode:notebook', { ...miniNotebookWindowConfig.value });
  }
}

function selectSize(type: string, width: number, height: number) {
  if (type === 'pomodoro') {
    pomodoroConfig.value.width = width;
    pomodoroConfig.value.height = height;
    pomodoroMiniWindowConfig.value.width = width;
    pomodoroMiniWindowConfig.value.height = height;
    setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
  } else {
    notebookConfig.value.width = width;
    notebookConfig.value.height = height;
    miniNotebookWindowConfig.value.width = width;
    miniNotebookWindowConfig.value.height = height;
    setStore('window-mode:notebook', { ...miniNotebookWindowConfig.value });
  }
}

function selectGap(type: string, gap: number) {
  if (type === 'pomodoro') {
    pomodoroConfig.value.gap = gap;
    pomodoroMiniWindowConfig.value.gap = gap;
    setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
  } else {
    notebookConfig.value.gap = gap;
    miniNotebookWindowConfig.value.gap = gap;
    setStore('window-mode:notebook', { ...miniNotebookWindowConfig.value });
  }
}

const showModal = ref(false);
const modalType = ref<'position' | 'size' | 'gap'>('position');
const modalTarget = ref<'pomodoro' | 'notebook'>('pomodoro');

const customPosition = ref({ x: 0, y: 0 });
const customSize = ref({ width: 0, height: 0 });
const customGap = ref(30);

const modalTitle = computed(() => {
  const titles: Record<string, string> = {
    'position': '自定义位置',
    'size': '自定义尺寸',
    'gap': '自定义间隙',
  };
  return titles[modalType.value];
});

function openCustomModal(target: 'pomodoro' | 'notebook', type: 'position' | 'size' | 'gap') {
  modalTarget.value = target;
  modalType.value = type;
  
  const config = target === 'pomodoro' ? pomodoroConfig.value : notebookConfig.value;
  
  if (type === 'position') {
    customPosition.value = { x: 0, y: 0 };
  } else if (type === 'size') {
    customSize.value = { width: config.width, height: config.height };
  } else {
    customGap.value = config.gap;
  }
  
  showModal.value = true;
}

function closeModal() {
  showModal.value = false;
}

function confirmCustom() {
  if (modalType.value === 'position') {
    if (customPosition.value.x >= 0 && customPosition.value.y >= 0) {
      if (modalTarget.value === 'pomodoro') {
        pomodoroConfig.value.position = 'custom';
        pomodoroMiniWindowConfig.value.position = 'custom';
        pomodoroMiniWindowConfig.value.x = customPosition.value.x;
        pomodoroMiniWindowConfig.value.y = customPosition.value.y;
        setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
      } else {
        notebookConfig.value.position = 'custom';
        miniNotebookWindowConfig.value.position = 'custom';
        miniNotebookWindowConfig.value.x = customPosition.value.x;
        miniNotebookWindowConfig.value.y = customPosition.value.y;
        setStore('window-mode:notebook', { ...miniNotebookWindowConfig.value });
      }
    }
  } else if (modalType.value === 'size') {
    if (customSize.value.width > 0 && customSize.value.height > 0) {
      if (modalTarget.value === 'pomodoro') {
        pomodoroConfig.value.width = customSize.value.width;
        pomodoroConfig.value.height = customSize.value.height;
        pomodoroMiniWindowConfig.value.width = customSize.value.width;
        pomodoroMiniWindowConfig.value.height = customSize.value.height;
        setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
      } else {
        notebookConfig.value.width = customSize.value.width;
        notebookConfig.value.height = customSize.value.height;
        miniNotebookWindowConfig.value.width = customSize.value.width;
        miniNotebookWindowConfig.value.height = customSize.value.height;
        setStore('window-mode:notebook', { ...miniNotebookWindowConfig.value });
      }
    }
  } else {
    if (customGap.value >= 0) {
      if (modalTarget.value === 'pomodoro') {
        pomodoroConfig.value.gap = customGap.value;
        pomodoroMiniWindowConfig.value.gap = customGap.value;
        setStore('window-mode:pomodoro', { ...pomodoroMiniWindowConfig.value });
      } else {
        notebookConfig.value.gap = customGap.value;
        miniNotebookWindowConfig.value.gap = customGap.value;
        setStore('window-mode:notebook', { ...miniNotebookWindowConfig.value });
      }
    }
  }
  
  closeModal();
}
</script>

<style scoped lang="scss">
.el-button+.el-button {
  margin-left: 0px;
}
:deep(.main) {
  padding: 0 !important;
}

.setting-page {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;
  padding: 20px;

  .section {
    margin-bottom: 28px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--color-primary);

      .el-icon {
        color: var(--color-primary);
      }
    }
  }

  .toggle-card {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 16px 20px;
    margin-bottom: 16px;

    .toggle-label {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .toggle-group {
      display: flex;
      gap: 10px;

      .toggle-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
      }

      .apply-btn {
        padding: 10px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
      }
    }
  }

  .window-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
    position: relative;
    overflow: hidden;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background: linear-gradient(180deg, var(--color-primary), var(--color-primary) 50%, rgba(0,0,0,0.1));
    }
  }

  .config-section {
    margin-bottom: 20px;

    &:last-child {
      margin-bottom: 0;
    }
  }

  .config-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: var(--text-primary);
    margin-bottom: 12px;

    .el-icon {
      color: var(--color-primary);
    }
  }

  .position-wrapper {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }

  .position-grid {
    display: grid;
    grid-template-columns: repeat(3, 36px);
    gap: 6px;
  }

  .position-card {
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    border-radius: 6px;
    padding: 0;
  }

  .custom-btn {
    padding: 8px 12px;
    border-radius: 6px;
    font-size: 12px;
    white-space: nowrap;
  }

  .size-row,
  .gap-row,
  .theme-row,
  .layout-row {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }

  .theme-row {
    max-height: 120px;
    overflow-y: auto;
  }

  .config-option {
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 14px;

    &.custom-option {
      color: var(--color-primary);
    }
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--bg-card);
  border-radius: var(--radius-card);
  width: 90%;
  max-width: 320px;
  overflow: hidden;
  animation: modalIn 0.2s ease;
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: var(--bg-subtle);
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);

  .close-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: all 0.2s ease;

    &:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
      border-radius: 50%;
    }
  }
}

.modal-body {
  padding: 20px;
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;

  label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  input {
    padding: 10px 12px;
    border: 1px solid var(--input-border);
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    background: var(--input-bg);
    color: var(--text-primary);

    &:focus {
      border-color: var(--input-border-focus);
    }
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid var(--border-light);

  .modal-btn {
    padding: 8px 20px;
    border-radius: 8px;
    font-size: 14px;
  }
}
</style>
