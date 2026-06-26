<template>
  <div class="window-mode-container">
    <div class="section-title">窗口模式</div>

    <div class="window-card">
      <div class="card-header">
        <div class="card-title">
          <span class="icon">⏱</span>
          <span>番茄钟小窗口</span>
        </div>
        <div class="toggle-group">
          <button 
            class="toggle-btn" 
            :class="{ active: showPomodoroMiniWindowCc }"
            @click="changeShowPomodoroMiniWindowFn(true)"
          >
            开启
          </button>
          <button 
            class="toggle-btn" 
            :class="{ active: !showPomodoroMiniWindowCc }"
            @click="changeShowPomodoroMiniWindowFn(false)"
          >
            关闭
          </button>
          <button 
            class="apply-btn"
            @click="applyPomodoroWindow"
          >
            应用
          </button>
        </div>
      </div>

      <div class="card-content">
        <div class="config-section">
          <div class="config-label">📐 位置选择</div>
          <div class="position-wrapper">
            <div class="position-grid">
              <button 
                v-for="pos in positionOptions" 
                :key="pos.value"
                class="position-card"
                :class="{ selected: pomodoroConfig.position === pos.value }"
                @click="selectPosition('pomodoro', pos.value)"
              >
                {{ pos.icon }}
              </button>
            </div>
            <button 
              class="custom-btn"
              @click="openCustomModal('pomodoro', 'position')"
            >
              ⚙ 自定义
            </button>
          </div>
        </div>

        <div class="config-section">
          <div class="config-label">📏 窗口尺寸</div>
          <div class="size-row">
            <button 
              v-for="size in sizeOptions" 
              :key="size.label"
              class="size-card"
              :class="{ selected: pomodoroConfig.width === size.width && pomodoroConfig.height === size.height }"
              @click="selectSize('pomodoro', size.width, size.height)"
            >
              {{ size.label }}
            </button>
            <button 
              class="size-card custom-card"
              @click="openCustomModal('pomodoro', 'size')"
            >
              自定义
            </button>
          </div>
        </div>

        <div class="config-section">
          <div class="config-label">📐 边缘间隙</div>
          <div class="gap-row">
            <button 
              v-for="gap in gapOptions" 
              :key="gap"
              class="gap-card"
              :class="{ selected: pomodoroConfig.gap === gap }"
              @click="selectGap('pomodoro', gap)"
            >
              {{ gap }}px
            </button>
            <button 
              class="gap-card custom-card"
              @click="openCustomModal('pomodoro', 'gap')"
            >
              自定义
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="window-card">
      <div class="card-header">
        <div class="card-title">
          <span class="icon">📝</span>
          <span>笔记本小窗口</span>
        </div>
        <div class="toggle-group">
          <button 
            class="toggle-btn" 
            :class="{ active: showMiniNotebookWindowCc }"
            @click="changeShowMiniNotebookWindowFn(true)"
          >
            开启
          </button>
          <button 
            class="toggle-btn" 
            :class="{ active: !showMiniNotebookWindowCc }"
            @click="changeShowMiniNotebookWindowFn(false)"
          >
            关闭
          </button>
          <button 
            class="apply-btn"
            @click="applyNotebookWindow"
          >
            应用
          </button>
        </div>
      </div>

      <div class="card-content">
        <div class="config-section">
          <div class="config-label">📐 位置选择</div>
          <div class="position-wrapper">
            <div class="position-grid">
              <button 
                v-for="pos in positionOptions" 
                :key="pos.value"
                class="position-card"
                :class="{ selected: notebookConfig.position === pos.value }"
                @click="selectPosition('notebook', pos.value)"
              >
                {{ pos.icon }}
              </button>
            </div>
            <button 
              class="custom-btn"
              @click="openCustomModal('notebook', 'position')"
            >
              ⚙ 自定义
            </button>
          </div>
        </div>

        <div class="config-section">
          <div class="config-label">📏 窗口尺寸</div>
          <div class="size-row">
            <button 
              v-for="size in notebookSizeOptions" 
              :key="size.label"
              class="size-card"
              :class="{ selected: notebookConfig.width === size.width && notebookConfig.height === size.height }"
              @click="selectSize('notebook', size.width, size.height)"
            >
              {{ size.label }}
            </button>
            <button 
              class="size-card custom-card"
              @click="openCustomModal('notebook', 'size')"
            >
              自定义
            </button>
          </div>
        </div>

        <div class="config-section">
          <div class="config-label">📐 边缘间隙</div>
          <div class="gap-row">
            <button 
              v-for="gap in gapOptions" 
              :key="gap"
              class="gap-card"
              :class="{ selected: notebookConfig.gap === gap }"
              @click="selectGap('notebook', gap)"
            >
              {{ gap }}px
            </button>
            <button 
              class="gap-card custom-card"
              @click="openCustomModal('notebook', 'gap')"
            >
              自定义
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showModal" class="modal-overlay" @click="closeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          {{ modalTitle }}
          <button class="close-btn" @click="closeModal">✕</button>
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
          <button class="modal-btn cancel" @click="closeModal">取消</button>
          <button class="modal-btn confirm" @click="confirmCustom">确定</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, toRaw } from 'vue';
import { storeToRefs } from 'pinia';
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
.window-mode-container {
  // padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  // background: #f5f7fa;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 3px solid #409eff;
}

.window-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
  overflow: hidden;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  .card-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    font-weight: 600;
    color: #fff;
    
    .icon {
      font-size: 18px;
    }
  }
  
  .toggle-group {
    display: flex;
    align-items: center;
    gap: 8px;
    
    .toggle-btn {
      padding: 6px 16px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.2);
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      
      &.active {
        background: #fff;
        color: #667eea;
        font-weight: 600;
      }
      
      &:hover {
        opacity: 0.8;
      }
    }
    
    .apply-btn {
      padding: 6px 16px;
      border: 1px solid rgba(255, 255, 255, 0.5);
      border-radius: 6px;
      background: transparent;
      color: #fff;
      font-size: 14px;
      cursor: pointer;
      transition: all 0.3s ease;
      
      &:hover {
        background: rgba(255, 255, 255, 0.2);
      }
      
      &:active {
        background: rgba(255, 255, 255, 0.3);
      }
    }
  }
}

.card-content {
  padding: 20px;
}

.config-section {
  margin-bottom: 20px;
  
  &:last-child {
    margin-bottom: 0;
  }
}

.config-label {
  font-size: 14px;
  font-weight: 600;
  color: #606266;
  margin-bottom: 12px;
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
  background: #f5f7fa;
  border: 2px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #409eff;
    background: #ecf5ff;
  }
  
  &.selected {
    border-color: #409eff;
    background: #409eff;
    color: #fff;
  }
}

.custom-btn {
  padding: 8px 12px;
  background: #f5f7fa;
  border: 2px solid #e4e7ed;
  border-radius: 6px;
  cursor: pointer;
  font-size: 12px;
  color: #409eff;
  transition: all 0.2s ease;
  white-space: nowrap;
  
  &:hover {
    border-color: #409eff;
    background: #ecf5ff;
  }
}

.size-row,
.gap-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.size-card,
.gap-card {
  padding: 10px 16px;
  background: #f5f7fa;
  border: 2px solid #e4e7ed;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #606266;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: #409eff;
    background: #ecf5ff;
  }
  
  &.selected {
    border-color: #409eff;
    background: #409eff;
    color: #fff;
    font-weight: 600;
  }
  
  &.custom-card {
    color: #409eff;
    border-color: #409eff;
    background: #ecf5ff;
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
  background: #fff;
  border-radius: 12px;
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
  background: #f5f7fa;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  
  .close-btn {
    width: 28px;
    height: 28px;
    border: none;
    background: #e4e7ed;
    border-radius: 50%;
    font-size: 14px;
    cursor: pointer;
    
    &:hover {
      background: #dcdfe6;
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
    color: #606266;
  }
  
  input {
    padding: 10px 12px;
    border: 2px solid #e4e7ed;
    border-radius: 8px;
    font-size: 14px;
    outline: none;
    
    &:focus {
      border-color: #409eff;
    }
  }
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
}

.modal-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &.cancel {
    background: #f5f7fa;
    color: #606266;
    
    &:hover {
      background: #e4e7ed;
    }
  }
  
  &.confirm {
    background: #409eff;
    color: #fff;
    
    &:hover {
      background: #66b1ff;
    }
  }
}
</style>
