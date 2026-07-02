<template>
  <div class="minimal-clock" :style="backgroundStyle">
    <div class="clock-container" :data-skin="currentSkin" @click="switchSkin">
      <div class="time-display">{{ currentTime }}</div>
      <div class="date-display">{{ currentDate }} {{ weekday }}</div>
      <div class="status-display" :class="curStatusC.value">
        <span class="status-dot"></span>
        <span class="status-text">{{ curStatusC.value === 'work' ? '正在专注' : '休息中' }}</span>
      </div>
    </div>

    <!-- 设置按钮 -->
    <el-popover placement="left" :width="320" trigger="click" :show-after="0" popper-class="minimal-clock-popper">
      <template #reference>
        <button class="settings-btn" title="背景设置">
          <LucideIcon name="Palette" :size="18" />
        </button>
      </template>
      <div class="background-panel">
        <div class="panel-title">
          <LucideIcon name="Image" :size="16" />
          <span>背景设置</span>
        </div>

        <!-- 色彩背景 -->
        <div class="preset-section">
          <div class="section-label">
            <LucideIcon name="Palette" :size="14" />
            <span>色彩背景</span>
          </div>
          <div class="preset-grid">
            <div v-for="bg in gradientBackgrounds" :key="bg.value" class="preset-item"
              :class="{ active: currentBackground.value === bg.value }" :style="{ background: bg.value }"
              :title="bg.label" @click="selectBackground(bg)">
              <span class="preset-label">{{ bg.label }}</span>
            </div>
          </div>
        </div>

        <!-- 图片背景 -->
        <div class="preset-section">
          <div class="section-label">
            <LucideIcon name="Image" :size="14" />
            <span>图片背景</span>
          </div>
          <div class="preset-grid">
            <div v-for="bg in imageBackgrounds" :key="bg.value" class="preset-item"
              :class="{ active: currentBackground.value === bg.value }"
              :style="{ backgroundImage: 'url(' + bg.value + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"
              :title="bg.label" @click="selectBackground(bg)">
              <span class="preset-label">{{ bg.label }}</span>
            </div>
          </div>

          <!-- 每日必应图片 -->
          <div v-if="bingImageUrl" class="bing-image-section">
            <div class="preset-item bing-item" :class="{ active: currentBackground.value === bingImageUrl }"
              :style="{ backgroundImage: 'url(' + bingImageUrl + ')', backgroundSize: 'cover', backgroundPosition: 'center' }"
              :title="bingImageTitle || '每日必应图片'" @click="selectBingImage">
              <span class="preset-label">每日必应</span>
              <span class="bing-badge">今日</span>
            </div>
          </div>
          <div v-else class="bing-loading">
            <span>加载每日图片...</span>
          </div>
        </div>

        <!-- 自定义图片 -->
        <div class="custom-section">
          <div class="section-label">自定义图片</div>
          <div class="upload-area" @click="triggerUpload" @dragover.prevent @drop.prevent="handleDrop">
            <input type="file" ref="fileInputRef" accept="image/*" style="display: none" @change="handleFileChange" />
            <LucideIcon name="Upload" :size="24" />
            <span>点击或拖拽上传图片</span>
          </div>
          <div v-if="customBackground.value" class="custom-preview">
            <img :src="customBackground.value" alt="自定义背景" />
            <button class="remove-btn" @click="removeCustomBackground">
              <LucideIcon name="X" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </el-popover>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import useGlobalSetting from '@/store/useGlobalSetting';
import { getStore, setStore } from '@/utils/common';

const { curStatusC } = storeToRefs(useGlobalSetting());

// 渐变色彩背景列表
const gradientBackgrounds = [
  { type: 'gradient', value: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)', label: '深空黑' },
  { type: 'gradient', value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', label: '星空紫' },
  { type: 'gradient', value: 'linear-gradient(135deg, #2d1e2f 0%, #4a3728 100%)', label: '晨曦橙' },
  { type: 'gradient', value: 'linear-gradient(135deg, #0f2027 0%, #203a43 100%)', label: '极光绿' },
  { type: 'gradient', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 100%)', label: '深海蓝' },
];

// 预设图片背景列表
const imageBackgrounds = [
  { type: 'image', value: 'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1920&q=80', label: '城市夜景' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80', label: '自然风光' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1558591710-4b4a1ae0f04d?w=1920&q=80', label: '抽象艺术' },
  { type: 'image', value: 'https://images.unsplash.com/photo-1557683316-973673baf926?w=1920&q=80', label: '极简几何' },
];

// 每日必应图片
const bingImageUrl = ref('');
const bingImageTitle = ref('');
const bingImageDate = ref('');
const isUseBing = ref(false);
const storedBingDate = ref('');

// 默认背景
const defaultBackground = {
  type: 'gradient',
  value: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)',
};

// 当前背景状态
const currentBackground = ref({ ...defaultBackground });
const customBackground = ref('');

// 文件上传引用
const fileInputRef = ref(null);

// 存储键名
const STORAGE_KEY = 'home-mode:minimal-clock';

// 背景样式计算属性
const backgroundStyle = computed(() => {
  if (customBackground.value) {
    return { backgroundImage: `url(${customBackground.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  if (currentBackground.value.type === 'image') {
    return { backgroundImage: `url(${currentBackground.value.value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  return { background: currentBackground.value.value };
});

let timer = null;

onMounted(() => {
  updateTime();
  timer = setInterval(updateTime, 1000);
  loadBackgroundConfig();
  fetchBingImage();
});

onUnmounted(() => {
  clearInterval(timer);
});

function updateTime() {
  const now = new Date();
  currentTime.value = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  currentDate.value = now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  weekday.value = weekdays[now.getDay()];
}

// 从 store 加载配置
function loadBackgroundConfig() {
  try {
    const config = getStore(STORAGE_KEY);
    if (config && typeof config === 'object') {
      if (config.useBing === true) {
        isUseBing.value = true;
        storedBingDate.value = config.date || '';
      }
      if (config.type === 'custom' && config.customUrl) {
        customBackground.value = config.customUrl;
        currentBackground.value = { type: 'custom', value: config.customUrl };
      } else if (config.type && config.value) {
        currentBackground.value = { type: config.type, value: config.value };
      }
    }
  } catch (err) {
    console.error('加载背景配置失败:', err);
  }
}

// 保存配置到 store
function saveBackgroundConfig(config) {
  try {
    setStore(STORAGE_KEY, config);
  } catch (err) {
    console.error('保存背景配置失败:', err);
  }
}

// 选择预设背景
function selectBackground(bg) {
  currentBackground.value = { type: bg.type, value: bg.value };
  customBackground.value = '';
  isUseBing.value = false;
  saveBackgroundConfig({ type: bg.type, value: bg.value, useBing: false });
  ElMessage.success(`已切换至「${bg.label}」背景`);
}

// 触发文件上传
function triggerUpload() {
  fileInputRef.value?.click();
}

// 处理文件选择
function handleFileChange(event) {
  const file = event.target.files?.[0];
  if (file) {
    processImageFile(file);
  }
  // 清空 input 以便重复选择同一文件
  if (fileInputRef.value) {
    fileInputRef.value.value = '';
  }
}

// 处理拖拽上传
function handleDrop(event) {
  const file = event.dataTransfer?.files?.[0];
  if (file && file.type.startsWith('image/')) {
    processImageFile(file);
  } else {
    ElMessage.warning('请上传图片文件');
  }
}

// 处理图片文件
function processImageFile(file) {
  // 检查文件大小（限制 5MB）
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 5MB');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target?.result;
    if (typeof dataUrl === 'string') {
      customBackground.value = dataUrl;
      currentBackground.value = { type: 'custom', value: dataUrl };
      isUseBing.value = false;
      saveBackgroundConfig({ type: 'custom', customUrl: dataUrl, useBing: false });
      ElMessage.success('已应用自定义背景');
    }
  };
  reader.readAsDataURL(file);
}

// 移除自定义背景
function removeCustomBackground() {
  customBackground.value = '';
  currentBackground.value = { ...defaultBackground };
  isUseBing.value = false;
  saveBackgroundConfig({ type: defaultBackground.type, value: defaultBackground.value, useBing: false });
  ElMessage.success('已恢复默认背景');
}

// 获取每日必应图片（通过 Electron 主进程）
async function fetchBingImage() {
  try {
    const result = await window.ipcRenderer.handlePromise('get-bing-image');
    if (result && result.url) {
      bingImageUrl.value = result.url;
      bingImageTitle.value = result.copyright || '';
      bingImageDate.value = result.date || '';

      if (isUseBing.value) {
        if (!storedBingDate.value || storedBingDate.value !== result.date) {
          currentBackground.value = { type: 'image', value: result.url };
          customBackground.value = '';
          saveBackgroundConfig({
            type: 'image',
            value: result.url,
            useBing: true,
            date: result.date,
            bingTitle: result.copyright || ''
          });
          storedBingDate.value = result.date;
        }
      }
    }
  } catch (err) {
    console.error('获取每日必应图片失败:', err);
  }
}

// 选择每日必应图片
function selectBingImage() {
  if (!bingImageUrl.value) return;
  isUseBing.value = true;
  currentBackground.value = { type: 'image', value: bingImageUrl.value };
  customBackground.value = '';
  saveBackgroundConfig({
    type: 'image',
    value: bingImageUrl.value,
    useBing: true,
    date: bingImageDate.value,
    bingTitle: bingImageTitle.value
  });
  storedBingDate.value = bingImageDate.value;
  ElMessage.success('已切换至「每日必应」背景');
}

const currentTime = ref('');
const currentDate = ref('');
const weekday = ref('');

const skins = ['white', 'amber', 'aurora', 'coral', 'dark', 'gray', 'lavender', 'mint', 'sakura', 'sky'];
const currentSkin = ref('white');
getInitSkin();
function getInitSkin () {
  let skin = localStorage.getItem('skin');
  console.log('skin', skin);
  if (skin) {
    currentSkin.value = skin;
  } else {
    currentSkin.value = 'white';
  }
}

function switchSkin() {
  const currentIndex = skins.indexOf(currentSkin.value);
  currentSkin.value = skins[(currentIndex + 1) % skins.length];
  localStorage.setItem('skin', currentSkin.value);
}
</script>

<style lang="scss" scoped>
.minimal-clock {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%);
  display: flex;
  justify-content: center;
  align-items: center;
  user-select: none;
  position: relative;
}

.settings-btn {
  position: absolute;
  bottom: 24px;
  right: 24px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  opacity: 0;
  z-index: 10;

  &:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
    color: #fff;
    border-color: rgba(255, 255, 255, 0.2);
  }
}

.minimal-clock:hover .settings-btn {
  opacity: 1;
}

.clock-container {
  text-align: center;
  color: var(--skin-text-primary, #4338ca);
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.02);
  }
}

.time-display {
  font-size: 120px;
  font-weight: 600;
  letter-spacing: -4px;
  line-height: 1;
  font-feature-settings: 'tnum';
  text-shadow: 0 0 60px rgba(67, 56, 202, 0.15);
}

.date-display {
  font-size: 24px;
  font-weight: 400;
  margin-top: 20px;
  color: var(--skin-text-secondary, #6366f1);
  opacity: 0.6;
  letter-spacing: 2px;
}

.status-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 40px;
  padding: 12px 24px;
  border-radius: 50px;
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  width: fit-content;
  margin-left: auto;
  margin-right: auto;

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .status-text {
    font-size: 16px;
    font-weight: 400;
  }

  &.work {
    .status-dot {
      background: #ff6b6b;
      box-shadow: 0 0 12px #ff6b6b;
      animation: pulse 2s infinite;
    }

    .status-text {
      color: #ff6b6b;
    }
  }

  &.rest {
    .status-dot {
      background: #51cf66;
      box-shadow: 0 0 12px #51cf66;
    }

    .status-text {
      color: #51cf66;
    }
  }
}

@keyframes pulse {

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

// 背景设置面板样式
.background-panel {
  padding: 4px;

  .panel-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .preset-section {
    margin-bottom: 16px;

    .section-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .preset-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .bing-image-section {
      margin-top: 8px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .bing-item {
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-end;
      justify-content: center;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: linear-gradient(135deg, rgba(88, 166, 255, 0.3) 0%, transparent 50%);
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      &:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(88, 166, 255, 0.3);

        &::before {
          opacity: 1;
        }

        .preset-label {
          opacity: 1;
        }
      }

      &.active {
        border-color: #58a6ff;
        box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);

        &::before {
          opacity: 1;
        }
      }

      .preset-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.9);
        background: rgba(88, 166, 255, 0.8);
        padding: 2px 6px;
        border-radius: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
        z-index: 1;
      }

      .bing-badge {
        position: absolute;
        top: 4px;
        right: 4px;
        font-size: 9px;
        color: #fff;
        background: #58a6ff;
        padding: 1px 5px;
        border-radius: 10px;
        z-index: 1;
      }
    }

    .bing-loading {
      margin-top: 8px;
      padding: 16px;
      text-align: center;
      color: rgba(255, 255, 255, 0.4);
      font-size: 12px;
    }

    .preset-item {
      aspect-ratio: 16 / 9;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: flex-end;
      justify-content: center;

      .preset-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.8);
        background: rgba(0, 0, 0, 0.5);
        padding: 2px 6px;
        border-radius: 4px;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      &:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);

        .preset-label {
          opacity: 1;
        }
      }

      &.active {
        border-color: #58a6ff;
        box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.3);
      }
    }
  }

  .custom-section {
    .section-label {
      font-size: 12px;
      color: rgba(255, 255, 255, 0.5);
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .upload-area {
      border: 2px dashed rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      color: rgba(255, 255, 255, 0.4);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;

      span {
        font-size: 12px;
      }

      &:hover {
        border-color: rgba(255, 255, 255, 0.4);
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.6);
      }
    }

    .custom-preview {
      margin-top: 12px;
      position: relative;
      border-radius: 8px;
      overflow: hidden;

      img {
        width: 100%;
        height: 100px;
        object-fit: cover;
        border-radius: 8px;
      }

      .remove-btn {
        position: absolute;
        top: 4px;
        right: 4px;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.6);
        border: none;
        color: #fff;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;

        &:hover {
          background: rgba(248, 81, 73, 0.8);
        }
      }
    }
  }
}
</style>

<!-- 全局样式：弹出面板深色主题 -->
<style lang="scss">
.el-popper.minimal-clock-popper {
  background: #1a1a1a !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  border-radius: 12px !important;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;

  .el-popper__arrow::before {
    background: #1a1a1a !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
  }

  .background-panel {
    .panel-title {
      color: #fff;
    }

    .section-label {
      color: rgba(255, 255, 255, 0.6) !important;
    }

    .upload-area {
      border-color: rgba(255, 255, 255, 0.2) !important;
      background: rgba(255, 255, 255, 0.03) !important;
      color: rgba(255, 255, 255, 0.6) !important;

      &:hover {
        border-color: rgba(255, 255, 255, 0.4) !important;
        background: rgba(255, 255, 255, 0.08) !important;
        color: rgba(255, 255, 255, 0.8) !important;
      }
    }
  }
}
</style>
