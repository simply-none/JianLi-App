<template>
  <el-drawer
    v-model="visible"
    title="阅读设置"
    direction="rtl"
    size="360px"
    :append-to-body="false"
  >
    <div class="reader-settings">
      <div class="setting-group-title">字体设置</div>

      <!-- 字号：12~32px，与顶部工具栏原「字号」输入一致 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">字号</span>
          <span class="setting-value">{{ fontSizeModel }}px</span>
        </div>
        <el-input-number
          v-model="fontSizeModel"
          :min="12"
          :max="32"
          :step="1"
          size="small"
          controls-position="right"
          style="width: 100%"
        />
      </div>

      <!-- 中文字体：内置字体 + 系统已安装字体，可在「设置页 → 字体设置」中管理 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">中文字体</span>
        </div>
        <el-select-v2
          v-model="fontFamilyModel"
          :options="fontOptions"
          filterable
          clearable
          placeholder="默认字体"
          popper-class="font-select-popper"
          append-to=".ebook-reader-page"
          :item-height="72"
          style="width: 100%"
        >
          <template #default="{ item }">
            <span class="font-box" :style="{ fontFamily: item.value }">
              <span class="font-name">{{ item.label }}</span>
              <span class="font-preview">预览：中文English 123</span>
            </span>
          </template>
        </el-select-v2>
      </div>

      <!-- 英文字体 -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">英文字体</span>
        </div>
        <el-select-v2
          v-model="fontFamilyENModel"
          :options="fontOptions"
          filterable
          clearable
          placeholder="默认字体"
          popper-class="font-select-popper"
          append-to=".ebook-reader-page"
          :item-height="72"
          style="width: 100%"
        >
          <template #default="{ item }">
            <span class="font-box" :style="{ fontFamily: item.value }">
              <span class="font-name">{{ item.label }}</span>
              <span class="font-preview">Preview: 中文English 123</span>
            </span>
          </template>
        </el-select-v2>
      </div>

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
        <el-color-picker v-model="bgColorModel" append-to=".ebook-reader-page" />
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
        <!-- 已保存的背景图库：点击即可切换，按来源文件路径去重（跨格式共享） -->
        <div class="bg-gallery" v-if="bgImages.length">
          <div class="bg-gallery-title">已保存的背景图（点击切换）</div>
          <div class="bg-gallery-list">
            <div
              v-for="img in bgImages"
              :key="img.id"
              class="bg-gallery-thumb"
              :class="{ active: bgImageModel === img.dataUrl }"
              :style="{ backgroundImage: `url(${img.dataUrl})` }"
              :title="img.imagePath"
              @click="bgImageModel = img.dataUrl"
            >
              <button
                class="bg-gallery-del"
                type="button"
                title="删除"
                @click.stop="removeBgImage(img.id)"
              >
                ×
              </button>
            </div>
          </div>
        </div>
        <div class="setting-tip">图片以平铺方式作为阅读区背景；选过的背景图会保存到数据库，方便后续切换（按文件来源路径自动去重，不分电子书格式）</div>
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
          <el-color-picker v-model="textColorModel" append-to=".ebook-reader-page" />
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

      <!-- PDF 适应方式：适应宽度 / 适应高度（仅 PDF 生效） -->
      <div class="setting-row" v-if="currentFile.format === 'pdf'">
        <div class="setting-head">
          <span class="setting-label">PDF 适应方式</span>
        </div>
        <el-radio-group v-model="pdfFitModeModel">
          <el-radio-button value="width">适应宽度</el-radio-button>
          <el-radio-button value="height">适应高度</el-radio-button>
        </el-radio-group>
        <div class="setting-tip">适应宽度：单页宽度撑满阅读区；适应高度：单页高度≈一屏</div>
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

      <!-- 字间距 / 段间距 / 首行缩进：仅 EPUB 生效，注入 <style id="ebook-typo-style"> 到阅读 iframe 正文 -->
      <template v-if="currentFile.format === 'epub'">
        <div class="setting-row column">
          <div class="setting-head">
            <span class="setting-label">字间距</span>
            <span class="setting-value">{{ letterSpacingModel }}px</span>
          </div>
          <el-slider
            v-model="letterSpacingModel"
            :min="0"
            :max="4"
            :step="0.5"
            :show-tooltip="false"
          />
        </div>

        <div class="setting-row column">
          <div class="setting-head">
            <span class="setting-label">段间距</span>
            <span class="setting-value">{{ paragraphSpacingModel }}px</span>
          </div>
          <el-slider
            v-model="paragraphSpacingModel"
            :min="0"
            :max="40"
            :step="2"
            :show-tooltip="false"
          />
        </div>

        <div class="setting-row column">
          <div class="setting-head">
            <span class="setting-label">首行缩进</span>
            <span class="setting-value">{{ firstLineIndentModel }}em</span>
          </div>
          <el-slider
            v-model="firstLineIndentModel"
            :min="0"
            :max="4"
            :step="0.5"
            :show-tooltip="false"
          />
        </div>
      </template>

      <div class="setting-group-title">标注</div>
      <!-- 标注类型：决定新建标注用哪种类型（高亮/下划线/删除线/双下划线） -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">标注类型</span>
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
        <div class="setting-tip">选择后，新建标注即按该类型；下方为该类型单独设置的样式（各类型互不影响）</div>
      </div>

      <!-- 当前类型的样式（按类型分别记忆，切换类型即套用，无需每次重设） -->
      <div class="setting-row">
        <div class="setting-head">
          <span class="setting-label">类型样式（{{ activeTypeName }}）</span>
        </div>
        <div class="highlight-color-list">
          <button
            v-for="c in HIGHLIGHT_COLORS"
            :key="c.name"
            class="highlight-color-dot"
            :class="{ active: styleColorModel === c.name }"
            :style="{ background: c.value }"
            :title="c.label"
            type="button"
            @click="styleColorModel = c.name"
          ></button>
          <!-- 自定义颜色：选中态高亮 + 显示当前自定义色，点击取色器修改 -->
          <button
            class="highlight-color-dot custom"
            :class="{ active: !isPresetColorName(styleColorModel) }"
            :style="{ background: isPresetColorName(styleColorModel) ? 'transparent' : styleColorModel }"
            type="button"
            :title="isPresetColorName(styleColorModel) ? '自定义颜色' : styleColorModel"
            @click="styleCustomColorModel = styleCustomColorModel || '#FF5722'"
          >
            <span v-if="isPresetColorName(styleColorModel)" class="custom-plus">＋</span>
          </button>
        </div>
        <div class="highlight-color-custom">
          <el-color-picker v-model="styleCustomColorModel" size="small" append-to=".ebook-reader-page" />
          <span class="custom-tip">自定义颜色</span>
        </div>
        <div class="setting-tip">仅作用于「{{ activeTypeName }}」类型，与其它类型互不影响</div>
      </div>

      <!-- 划线间隙：随「当前类型」显隐（仅下划线 / 双下划线） -->
      <div class="setting-row column" v-if="showUnderlineGap">
        <div class="setting-head">
          <span class="setting-label">划线间隙</span>
          <span class="setting-value">{{ styleUnderlineGapModel }}px</span>
        </div>
        <el-slider
          v-model="styleUnderlineGapModel"
          :min="0"
          :max="10"
          :step="1"
          :show-tooltip="false"
        />
        <div class="setting-tip">下划线 / 双下划线 与文字之间的间隙（0-10px）</div>
      </div>

      <!-- 划线线宽：随「当前类型」显隐（仅下划线 / 删除线 / 双下划线） -->
      <div class="setting-row column" v-if="showLineThickness">
        <div class="setting-head">
          <span class="setting-label">划线线宽</span>
          <span class="setting-value">{{ styleLineThicknessModel }}px</span>
        </div>
        <el-slider
          v-model="styleLineThicknessModel"
          :min="1"
          :max="6"
          :step="1"
          :show-tooltip="false"
        />
        <div class="setting-tip">划线（下划线 / 删除线 / 双下划线）线条粗细（1-6px）</div>
      </div>

      <!-- 高亮行间距：随「当前类型」显隐（仅高亮） -->
      <div class="setting-row column" v-if="showRowPaddingY">
        <div class="setting-head">
          <span class="setting-label">高亮行间距</span>
          <span class="setting-value">{{ styleRowPaddingYModel }}px</span>
        </div>
        <el-slider
          v-model="styleRowPaddingYModel"
          :min="0"
          :max="8"
          :step="1"
          :show-tooltip="false"
        />
        <div class="setting-tip">高亮背景块上下外扩间距（0-8px）；值越大高亮越远离上下行</div>
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
import { computed, ref, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import LucideIcon from '@/components/LucideIcon.vue';
import useEbookReader from '@/store/useEbookReader';
import useGlobalSetting from '@/store/useGlobalSetting';
import type { EbookTheme, EbookBgType } from '@/store/useEbookReader';
import { HIGHLIGHT_COLORS, HIGHLIGHT_TYPES, isPresetColorName } from '../highlightConfig';
import { THEME_PRESETS, READING_PRESET_BG } from '../themePresets';

interface Props {
  /** 当前打开的文件信息，用于按格式（epub/txt）控制部分设置项显隐 */
  currentFile: { format: string };
}

const props = defineProps<Props>();
/** 抽屉可见性（v-model） */
const visible = defineModel<boolean>({ required: true });

const store = useEbookReader();
const { settings, bgImages } = storeToRefs(store);
const {
  setTheme,
  setBgType,
  setBgColor,
  setBgImage,
  setTextColor,
  loadBgImages,
  addBgImage,
  deleteBgImage,
  setLineHeight,
  setColumnCount,
  setScrollMode,
  setMargin,
  setLetterSpacing,
  setParagraphSpacing,
  setFirstLineIndent,
  setPdfFitMode,
  setAnnotationStyle,
  setHighlightType,
  setPageEffect,
  setReaderTopbarVisible,
  setReaderBottomBarVisible,
  setEdgeClickEnabled,
  setEdgeClickPercent,
  setWheelPageEnabled,
  setWheelPageSensitivity,
  setFontSize,
  setFontFamily,
  setFontFamilyEN,
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

/** PDF 适应方式双向绑定：'width' 适应宽度 / 'height' 适应高度 */
const pdfFitModeModel = computed({
  get: () => settings.value.pdfFitMode,
  set: (val: 'width' | 'height' | undefined) => {
    if (val === 'width' || val === 'height') setPdfFitMode(val);
  },
});

/** 页边距双向绑定 */
const marginModel = computed({
  get: () => settings.value.margin,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setMargin(val);
  },
});

/** 字间距（px）双向绑定，仅 epub 生效 */
const letterSpacingModel = computed({
  get: () => settings.value.letterSpacing,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setLetterSpacing(val);
  },
});

/** 段间距（px）双向绑定，仅 epub 生效 */
const paragraphSpacingModel = computed({
  get: () => settings.value.paragraphSpacing,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setParagraphSpacing(val);
  },
});

/** 首行缩进（em）双向绑定，仅 epub 生效 */
const firstLineIndentModel = computed({
  get: () => settings.value.firstLineIndent,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setFirstLineIndent(val);
  },
});

/** 当前所选标注类型的展示名（用于「类型样式（xxx）」标题） */
const activeTypeName = computed(() => {
  const t = HIGHLIGHT_TYPES.find((x) => x.name === settings.value.highlightType);
  return t?.label ?? '';
});
/** 当前类型是否为下划线 / 双下划线（显示「划线间隙」） */
const showUnderlineGap = computed(() => ['underline', 'markStrong'].includes(settings.value.highlightType));
/** 当前类型是否为下划线 / 删除线 / 双下划线（显示「划线线宽」） */
const showLineThickness = computed(() => ['underline', 'mark', 'markStrong'].includes(settings.value.highlightType));
/** 当前类型是否为高亮（显示「高亮行间距」） */
const showRowPaddingY = computed(() => settings.value.highlightType === 'highlight');

/** 当前类型的预设样式（用于各控件双向绑定，缺失时回退默认） */
const activeTypeStyle = computed(() =>
  (settings.value.annotationStyles as any)[settings.value.highlightType] ||
  { color: 'yellow', underlineGap: 2, lineThickness: 2, rowPaddingY: 2 }
);

/** 当前类型预设颜色双向绑定 */
const styleColorModel = computed({
  get: () => activeTypeStyle.value.color,
  set: (val: string) => setAnnotationStyle(settings.value.highlightType as any, { color: val }),
});

/** 当前类型自定义颜色（取色器）双向绑定：预设色名时取色器空，自定义色时回填 */
const styleCustomColorModel = computed({
  get: () => (isPresetColorName(activeTypeStyle.value.color) ? '' : activeTypeStyle.value.color),
  set: (val: string) => {
    if (val) setAnnotationStyle(settings.value.highlightType as any, { color: val });
  },
});

/** 当前类型预设划线间隙双向绑定 */
const styleUnderlineGapModel = computed({
  get: () => activeTypeStyle.value.underlineGap,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setAnnotationStyle(settings.value.highlightType as any, { underlineGap: val });
  },
});

/** 当前类型预设划线线宽双向绑定 */
const styleLineThicknessModel = computed({
  get: () => activeTypeStyle.value.lineThickness,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setAnnotationStyle(settings.value.highlightType as any, { lineThickness: val });
  },
});

/** 当前类型预设高亮行间距双向绑定 */
const styleRowPaddingYModel = computed({
  get: () => activeTypeStyle.value.rowPaddingY,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setAnnotationStyle(settings.value.highlightType as any, { rowPaddingY: val });
  },
});

/** 当前默认标注类型双向绑定（高亮 / 下划线 / 删除线 / 双下划线） */
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

/** 字体选项来源（与设置页「字体设置」保持一致）：内置字体列表 + 系统已安装字体 */
const { globalFontOpsC } = storeToRefs(useGlobalSetting());
/** 系统字体列表（由主进程 get-fonts 返回，结构 { label, value }） */
const sysFonts = ref<{ label: string; value: string }[]>([]);
/** 合并后的字体下拉选项 */
const fontOptions = computed(() => [...(globalFontOpsC.value || []), ...sysFonts.value]);

/** 字号双向绑定（12~32px），与顶部工具栏原「字号」输入一致 */
const fontSizeModel = computed({
  get: () => settings.value.fontSize,
  set: (val: number | undefined) => {
    if (typeof val === 'number') setFontSize(val);
  },
});

/** 中文正文字体双向绑定 */
const fontFamilyModel = computed({
  get: () => settings.value.fontFamily,
  set: (val: string | undefined) => setFontFamily(val ?? ''),
});

/** 英文正文字体双向绑定 */
const fontFamilyENModel = computed({
  get: () => settings.value.fontFamilyEN,
  set: (val: string | undefined) => setFontFamilyEN(val ?? ''),
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

/**
 * 选择本地图片作为阅读区背景图
 * 1) 读取为 data URL 应用为当前背景；
 * 2) 同时按来源文件路径保存到数据库（跨格式共享、按路径去重），便于后续切换展示。
 */
async function onPickBgImage(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    const dataUrl = reader.result as string;
    bgImageModel.value = dataUrl;
    // 来源文件路径用于去重（Electron 的 <input type=file> 提供 file.path）
    const imagePath = (file as unknown as { path?: string }).path || file.name;
    await addBgImage(imagePath, dataUrl);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

/**
 * 从背景图库删除某张背景图（按库记录 id）
 * @param id 背景图库记录 id
 */
async function removeBgImage(id: number) {
  await deleteBgImage(id);
}

// 拉取系统字体供字体选择下拉使用（字体选项同时含设置页管理的「内置字体」），并加载已保存的背景图库
onMounted(() => {
  window.ipcRenderer
    .handlePromise('get-fonts', {})
    .then((result) => {
      sysFonts.value = result || [];
    })
    .catch((err) => {
      console.error('获取系统字体失败', err);
    });
  loadBgImages();
});
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

    /* 自定义颜色色块：透明底 + ＋号提示，选中态（自定义色生效）高亮 */
    .highlight-color-dot.custom {
      display: flex;
      align-items: center;
      justify-content: center;
      background: transparent !important;

      .custom-plus {
        font-size: 16px;
        line-height: 1;
        color: var(--text-muted);
      }
    }
  }

  /* 自定义取色器行（取色器 + 文字提示） */
  .highlight-color-custom {
    display: flex;
    align-items: center;
    gap: 8px;

    .custom-tip {
      font-size: 12px;
      color: var(--text-muted);
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

  /* 已保存背景图库：缩略图网格，点击切换、悬停出现删除 */
  .bg-gallery {
    width: 100%;
    margin-top: 10px;

    .bg-gallery-title {
      font-size: 12px;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .bg-gallery-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
      gap: 8px;
    }

    .bg-gallery-thumb {
      position: relative;
      aspect-ratio: 1 / 1;
      border-radius: 8px;
      border: 2px solid transparent;
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      cursor: pointer;
      transition: border-color 0.15s ease;

      &:hover {
        border-color: var(--color-primary);
      }

      &.active {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px var(--bg-base), 0 0 0 4px var(--color-primary);
      }

      .bg-gallery-del {
        position: absolute;
        top: -6px;
        right: -6px;
        width: 18px;
        height: 18px;
        line-height: 16px;
        text-align: center;
        padding: 0;
        border: none;
        border-radius: 50%;
        background: var(--color-danger, #f56c6c);
        color: #fff;
        font-size: 12px;
        cursor: pointer;
        opacity: 0;
        transition: opacity 0.15s ease;
      }

      &:hover .bg-gallery-del {
        opacity: 1;
      }
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

<!-- 字体下拉面板样式（与设置页字体选择保持一致），非 scoped 以便作用于 body 下的 popper -->
<style lang="scss">
.font-select-popper {
  background: var(--bg-card) !important;
  border: 1px solid var(--border-subtle) !important;

  .el-select-dropdown__item {
    display: flex;
    flex-direction: column;
    justify-content: center;
    height: fit-content;
    color: var(--text-primary) !important;

    &:hover {
      background: var(--bg-hover) !important;
    }

    .font-box {
      display: flex;
      flex-direction: column;
      justify-content: center;
      height: 72px;
    }

    .font-name {
      font-size: 14px;
      font-weight: 500;
    }

    .font-preview {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
  }
}
</style>
