<template>
  <el-drawer
    v-model="visible"
    title="阅读设置"
    direction="rtl"
    size="320px"
    :append-to-body="false"
  >
    <div class="reader-settings">
      <div class="setting-group-title">主题外观</div>
      <!-- 主题：日间 / 夜间 / 护眼 预设，点击切换整体主题并重置自定义背景/文字为跟随主题 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">主题</span>
        </div>
        <div class="theme-preset-list">
          <button
            v-for="t in THEME_PRESETS"
            :key="t.name"
            class="theme-preset-card"
            :class="{ active: themeModel === t.name }"
            :style="{ background: t.bg, color: t.text }"
            type="button"
            @click="selectThemePreset(t.name)"
          >
            <LucideIcon :name="t.icon" :size="16" />
            <span>{{ t.label }}</span>
          </button>
        </div>
      </div>

      <!-- 背景：跟随主题 / 纯色 / 图片 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">背景</span>
        </div>
        <el-radio-group v-model="bgTypeModel" @change="onBgTypeChange">
          <el-radio-button value="preset">跟随主题</el-radio-button>
          <el-radio-button value="color">纯色</el-radio-button>
          <el-radio-button value="image">图片</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 纯色背景：背景色选择 -->
      <div class="setting-row" v-if="bgTypeModel === 'color'">
        <div class="setting-head">
          <span class="setting-label">背景色</span>
          <span class="setting-value" v-if="bgColorModel">{{ bgColorModel }}</span>
        </div>
        <!-- 预设色块：点击快速切换 -->
        <div class="color-preset-list">
          <button
            v-for="preset in BG_COLOR_PRESETS"
            :key="preset.color"
            :title="preset.label"
            class="color-preset-dot"
            :class="{ active: bgColorModel === preset.color }"
            :style="{ backgroundColor: preset.color }"
            @click="bgColorModel = preset.color"
          ></button>
        </div>
        <el-color-picker v-model="bgColorModel" />
      </div>

      <!-- 图片背景：上传本地图片作为阅读区背景 -->
      <div class="setting-row" v-if="bgTypeModel === 'image'">
        <div class="setting-head">
          <span class="setting-label">背景图</span>
        </div>
        <div class="bg-image-control">
          <input
            ref="bgImageInput"
            type="file"
            accept="image/*"
            style="display: none"
            @change="onPickBgImage"
          />
          <el-button size="small" @click="bgImageInput?.click()">选择图片</el-button>
          <el-button size="small" type="danger" text v-if="bgImageModel" @click="bgImageModel = ''">
            清除
          </el-button>
          <div
            v-if="bgImageModel"
            class="bg-image-preview"
            :style="{ backgroundImage: `url(${bgImageModel})` }"
          ></div>
        </div>
        <div class="setting-tip">图片以平铺方式作为阅读区背景（存储为 data URL，过大图片会占用较多本地空间）</div>
      </div>

      <!-- 文字颜色：自定义前景色，空值回退到主题默认 -->
      <div class="setting-row" v-if="bgTypeModel !== 'preset'">
        <div class="setting-head">
          <span class="setting-label">文字颜色</span>
          <span class="setting-value" v-if="textColorModel">{{ textColorModel }}</span>
        </div>
        <!-- 预设色块：点击快速切换 -->
        <div class="color-preset-list">
          <button
            v-for="preset in TEXT_COLOR_PRESETS"
            :key="preset.color"
            :title="preset.label"
            class="color-preset-dot"
            :class="{ active: textColorModel === preset.color }"
            :style="{ backgroundColor: preset.color }"
            @click="textColorModel = preset.color"
          ></button>
        </div>
        <div class="text-color-control">
          <el-color-picker v-model="textColorModel" />
          <el-button size="small" text @click="textColorModel = ''">使用主题默认</el-button>
        </div>
      </div>

      <div class="setting-group-title">排版布局</div>
      <!-- 翻页模式：epub / txt 均支持（txt 翻页模式用 CSS 多列分页，滚动模式为原生纵向滚动） -->
      <div class="setting-row" v-if="currentFile.format === 'txt' || currentFile.format === 'epub'">
        <div class="setting-head">
          <span class="setting-label">翻页模式</span>
        </div>
        <el-radio-group v-model="scrollModeModel">
          <el-radio-button :value="false">翻页</el-radio-button>
          <el-radio-button :value="true">滚动</el-radio-button>
        </el-radio-group>
        <div class="setting-tip">滚动模式下「分栏」不生效，TXT 用原生纵向滚动</div>
      </div>

      <!-- 分栏：单栏 / 双栏 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">分栏</span>
        </div>
        <el-radio-group v-model="columnCountModel">
          <el-radio-button :value="1">单栏</el-radio-button>
          <el-radio-button :value="2" :disabled="(currentFile.format === 'txt' || currentFile.format === 'epub') && scrollModeModel">双栏</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 行距：紧凑 ~ 宽松 -->
      <div class="setting-row column">
        <div class="setting-head">
          <span class="setting-label">行距</span>
          <span class="setting-value">{{ lineHeightModel.toFixed(1) }}</span>
        </div>
        <el-slider
          v-model="lineHeightModel"
          :min="1.2"
          :max="2.4"
          :step="0.1"
          :show-tooltip="false"
        />
      </div>

      <!-- 页边距 -->
      <div class="setting-row column">
        <div class="setting-head">
          <span class="setting-label">页边距</span>
          <span class="setting-value">{{ marginModel }}px</span>
        </div>
        <el-slider
          v-model="marginModel"
          :min="0"
          :max="80"
          :step="4"
          :show-tooltip="false"
        />
      </div>

      <div class="setting-group-title">标注</div>
      <!-- 划线样式：颜色 + 类型，由右上角设置统一预设，选中文本后直接套用，便于沉浸式阅读 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">划线颜色</span>
        </div>
        <div class="highlight-color-list">
          <button
            v-for="c in HIGHLIGHT_COLORS"
            :key="c.name"
            class="highlight-color-dot"
            :class="{ active: highlightColorModel === c.name }"
            :style="{ background: c.value }"
            :title="c.label"
            type="button"
            @click="highlightColorModel = c.name"
          ></button>
        </div>
        <div class="setting-tip">选中文本后点击「划线 / 笔记」即按此颜色与样式标注</div>
      </div>

      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">划线样式</span>
        </div>
        <el-radio-group v-model="highlightTypeModel">
          <el-radio-button
            v-for="t in HIGHLIGHT_TYPES"
            :key="t.name"
            :value="t.name"
          >
            {{ t.label }}
          </el-radio-button>
        </el-radio-group>
      </div>

      <div class="setting-group-title">翻页与交互</div>
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">翻页效果</span>
        </div>
        <el-radio-group v-model="pageEffectModel" :disabled="currentFile.format !== 'epub'">
          <el-radio-button
            v-for="p in PAGE_EFFECT_OPTIONS"
            :key="p.name"
            :value="p.name"
          >
            {{ p.label }}
          </el-radio-button>
        </el-radio-group>
        <div class="setting-tip">滑动 / 覆盖 / 3D 仿真翻页，仅 EPUB 阅读器生效</div>
      </div>

      <!-- 边缘点击翻页：开关 + 感应区宽度百分比，便于沉浸式翻页 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">边缘点击翻页</span>
        </div>
        <el-switch v-model="edgeClickEnabledModel" />
        <div class="setting-tip">在阅读区左右边缘点击即可上一页 / 下一页，适合沉浸式翻页</div>
      </div>
      <div class="setting-row column" v-if="edgeClickEnabledModel">
        <div class="setting-head">
          <span class="setting-label">边缘感应区</span>
          <span class="setting-value">{{ edgeClickPercentModel }}%</span>
        </div>
        <el-slider
          v-model="edgeClickPercentModel"
          :min="2"
          :max="40"
          :step="1"
          :show-tooltip="false"
        />
        <div class="setting-tip">阅读区左右两侧各占该宽度作为翻页热区（2%-40%）</div>
      </div>

      <!-- 鼠标滚轮翻页：开关 + 灵敏度，便于用滚轮直接翻页 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">鼠标滚轮翻页</span>
        </div>
        <el-switch v-model="wheelPageEnabledModel" />
        <div class="setting-tip">在阅读区滚动鼠标滚轮即可上一页 / 下一页（关闭则滚轮仅用于页面内滚动）</div>
      </div>
      <div class="setting-row column" v-if="wheelPageEnabledModel">
        <div class="setting-head">
          <span class="setting-label">滚动灵敏度</span>
          <span class="setting-value">{{ wheelPageSensitivityModel }}</span>
        </div>
        <el-slider
          v-model="wheelPageSensitivityModel"
          :min="1"
          :max="10"
          :step="1"
          :show-tooltip="false"
        />
        <div class="setting-tip">数值越大越灵敏（滚动少量距离即翻页），范围 1-10</div>
      </div>

      <div class="setting-group-title">界面显示</div>
      <!-- 显示：控制阅读页顶部工具栏和底部翻页栏的显隐 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">顶部栏</span>
        </div>
        <el-switch v-model="readerTopbarVisibleModel" />
        <div class="setting-tip">显示/隐藏阅读页顶部工具栏（书架、打开、目录、字体、字号、设置等）</div>
      </div>
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">底部栏</span>
        </div>
        <el-switch v-model="readerBottomBarVisibleModel" />
        <div class="setting-tip">显示/隐藏阅读页底部翻页控制栏（上一页、进度、页码、下一页）</div>
      </div>
    </div>
  </el-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useEbookReader from '@/store/useEbookReader';
import type { EbookTheme, EbookBgType } from '@/store/useEbookReader';
import { HIGHLIGHT_COLORS, HIGHLIGHT_TYPES } from '../highlightConfig';
import { THEME_PRESETS, READING_PRESET_BG } from '../themePresets';

interface Props {
  /** 当前打开的文件信息，用于按格式（epub/txt）控制部分设置项显隐 */
  currentFile: { format: string };
}

const props = defineProps<Props>();
/** 抽屉可见性（v-model） */
const visible = defineModel<boolean>({ required: true });

const store = useEbookReader();
const { settings } = storeToRefs(store);
const {
  setTheme,
  setBgType,
  setBgColor,
  setBgImage,
  setTextColor,
  setLineHeight,
  setColumnCount,
  setScrollMode,
  setMargin,
  setHighlightColor,
  setHighlightType,
  setPageEffect,
  setReaderTopbarVisible,
  setReaderBottomBarVisible,
  setEdgeClickEnabled,
  setEdgeClickPercent,
  setWheelPageEnabled,
  setWheelPageSensitivity,
} = store;

/** 翻页效果选项（仅 epub 生效） */
const PAGE_EFFECT_OPTIONS = [
  { name: 'none', label: '无' },
  { name: 'slide', label: '滑动' },
  { name: 'cover', label: '覆盖' },
  { name: 'flip3d', label: '3D 仿真' },
] as const;

/** 纯色背景预设色板：8 种常用阅读背景色 */
const BG_COLOR_PRESETS = [
  { label: '纯白', color: '#FFFFFF' },
  { label: '米白', color: '#F5F0E8' },
  { label: '浅灰', color: '#E8E8E8' },
  { label: '浅绿', color: '#C8E6C9' },
  { label: '浅蓝', color: '#BBDEFB' },
  { label: '浅紫', color: '#E1BEE7' },
  { label: '深灰', color: '#2D2D2D' },
  { label: '纯黑', color: '#1A1A1A' },
] as const;

/** 文字颜色预设色板：8 种常用阅读文字色 */
const TEXT_COLOR_PRESETS = [
  { label: '深灰', color: '#333333' },
  { label: '中灰', color: '#555555' },
  { label: '暖棕', color: '#4A3728' },
  { label: '藏蓝', color: '#1A237E' },
  { label: '墨绿', color: '#2E7D32' },
  { label: '橙棕', color: '#E65100' },
  { label: '深红', color: '#880E4F' },
  { label: '浅灰白', color: '#EEEEEE' },
] as const;

/** 主题（预设）双向绑定：写入 store 并持久化 */
const themeModel = computed<EbookTheme>({
  get: () => settings.value.theme,
  set: (v) => setTheme(v),
});

/** 阅读区背景类型双向绑定 */
const bgTypeModel = computed<EbookBgType>({
  get: () => settings.value.bgType,
  set: (v) => setBgType(v),
});

/** 阅读区背景色双向绑定 */
const bgColorModel = computed({
  get: () => settings.value.bgColor,
  set: (v: string) => setBgColor(v),
});

/** 阅读区背景图（data URL）双向绑定 */
const bgImageModel = computed({
  get: () => settings.value.bgImage,
  set: (v: string) => setBgImage(v),
});

/** 阅读区文字颜色双向绑定 */
const textColorModel = computed({
  get: () => settings.value.textColor,
  set: (v: string) => setTextColor(v),
});

/** 正文行距双向绑定 */
const lineHeightModel = computed({
  get: () => settings.value.lineHeight,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setLineHeight(val);
  },
});

/** 分栏数双向绑定（1 单栏 / 2 双栏） */
const columnCountModel = computed({
  get: () => settings.value.columnCount,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setColumnCount(val);
  },
});

/** 翻页模式双向绑定（false 翻页 / true 滚动） */
const scrollModeModel = computed({
  get: () => settings.value.scrollMode,
  set: (val: boolean | undefined) => {
    if (typeof val === 'boolean') setScrollMode(val);
  },
});

/** 页边距双向绑定 */
const marginModel = computed({
  get: () => settings.value.margin,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setMargin(val);
  },
});

/** 划线默认颜色双向绑定（右上角设置预设，划线/笔记时直接套用） */
const highlightColorModel = computed({
  get: () => settings.value.highlightColor,
  set: (val: string) => setHighlightColor(val),
});

/** 划线默认类型双向绑定（高亮 / 下划线 / 波浪线） */
const highlightTypeModel = computed({
  get: () => settings.value.highlightType,
  set: (val: string) => setHighlightType(val),
});

/** 翻页效果双向绑定（仅 epub 阅读器生效：none / slide / cover / flip3d） */
const pageEffectModel = computed({
  get: () => settings.value.pageEffect,
  set: (val: 'none' | 'slide' | 'cover' | 'flip3d') => setPageEffect(val),
});

/** 顶部栏显隐双向绑定 */
const readerTopbarVisibleModel = computed({
  get: () => settings.value.readerTopbarVisible,
  set: (val: boolean) => setReaderTopbarVisible(val),
});

/** 底部栏显隐双向绑定 */
const readerBottomBarVisibleModel = computed({
  get: () => settings.value.readerBottomBarVisible,
  set: (val: boolean) => setReaderBottomBarVisible(val),
});

/** 边缘点击翻页开关双向绑定 */
const edgeClickEnabledModel = computed({
  get: () => settings.value.edgeClickEnabled,
  set: (val: boolean) => setEdgeClickEnabled(val),
});

/** 边缘点击感应区宽度百分比双向绑定 */
const edgeClickPercentModel = computed({
  get: () => settings.value.edgeClickPercent,
  set: (val: number) => setEdgeClickPercent(val),
});

/** 鼠标滚轮翻页开关双向绑定 */
const wheelPageEnabledModel = computed({
  get: () => settings.value.wheelPageEnabled,
  set: (val: boolean) => setWheelPageEnabled(val),
});

/** 鼠标滚轮翻页灵敏度双向绑定（1-10） */
const wheelPageSensitivityModel = computed({
  get: () => settings.value.wheelPageSensitivity,
  set: (val: number) => setWheelPageSensitivity(val),
});

/** 背景图文件选择 input 引用 */
const bgImageInput = ref<HTMLInputElement | null>(null);

/**
 * 选择主题预设（日间 / 夜间 / 护眼）
 * 切换预设的同时将自定义背景类型/颜色/图片/文字色重置为「跟随主题」，
 * 保证点选预设即呈现该预设的默认阅读配色，避免与之前残留的自定义配置叠加。
 */
function selectThemePreset(name: EbookTheme) {
  themeModel.value = name;
  bgTypeModel.value = 'preset';
  bgColorModel.value = '';
  bgImageModel.value = '';
  textColorModel.value = '';
}

/**
 * 背景类型切换时的兜底初始化
 * 切到「纯色」且尚未选背景色时，用当前主题的预设背景色预填，避免空背景。
 */
function onBgTypeChange(val: EbookBgType) {
  if (val === 'color' && !settings.value.bgColor) {
    setBgColor(READING_PRESET_BG[settings.value.theme]);
  }
}

/** 选择本地图片作为阅读区背景图，读取为 data URL 存入 settings.bgImage */
function onPickBgImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    bgImageModel.value = reader.result as string;
  };
  reader.readAsDataURL(file);
  input.value = '';
}
</script>

<style scoped lang="scss">
/* 更多阅读设置抽屉内容 */
.reader-settings {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px 2px;

  /* 设置分类标题：左侧主题色竖条 + 浅色小标题，用于为杂乱的设置项分组 */
  .setting-group-title {
    display: flex;
    align-items: center;
    gap: 8px;
    position: relative;
    padding-left: 10px;
    margin-top: 2px;
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: var(--text-muted);

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 13px;
      border-radius: 2px;
      background: var(--color-primary);
    }
  }

  .setting-row {
    display: flex;
    flex-direction: column;
    gap: 10px;

    &.column {
      gap: 6px;
    }

    .setting-head {
      display: flex;
      align-items: center;
      justify-content: space-between;

      .setting-label {
        font-size: 14px;
        font-weight: 500;
        color: var(--text-primary);
      }

      .setting-value {
        font-size: 13px;
        color: var(--color-primary);
        font-variant-numeric: tabular-nums;
      }
    }

    .setting-tip {
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }
  }

  /* 划线颜色色板 */
  .highlight-color-list {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;

    .highlight-color-dot {
      width: 26px;
      height: 26px;
      padding: 0;
      border-radius: 50%;
      border: 2px solid transparent;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      box-shadow: 0 0 0 1px var(--border-subtle);

      &:hover {
        transform: scale(1.08);
      }

      &.active {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary);
      }
    }
  }

  /* 主题预设卡片：日间 / 夜间 / 护眼，点击切换 */
  .theme-preset-list {
    display: flex;
    gap: 10px;

    .theme-preset-card {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 12px 8px;
      border-radius: 10px;
      border: 2px solid var(--border-subtle);
      cursor: pointer;
      font-size: 13px;
      transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;

      &:hover {
        transform: translateY(-1px);
      }

      &.active {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary);
      }
    }
  }

  /* 背景图上传控件 */
  .bg-image-control {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;

    .bg-image-preview {
      width: 100%;
      height: 64px;
      margin-top: 4px;
      border-radius: 8px;
      border: 1px solid var(--border-subtle);
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
    }
  }

  /* 文字颜色控件：取色器 + 恢复默认 */
  .text-color-control {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* 背景色 / 文字颜色预设色板 */
  .color-preset-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .color-preset-dot {
    width: 26px;
    height: 26px;
    padding: 0;
    border-radius: 50%;
    border: 2px solid transparent;
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    box-shadow: 0 0 0 1px var(--border-subtle);
    outline: none;

    &:hover {
      transform: scale(1.12);
    }

    &.active {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary);
    }
  }
}
</style>
