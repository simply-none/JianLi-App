<template>
  <div class="style-picker">
    <!-- 预设网格 -->
    <div class="sp-section">
      <div class="sp-label">样式预设</div>
      <div class="sp-presets">
        <button
          v-for="p in presets"
          :key="p.id"
          class="sp-preset"
          :class="{ 'is-active': presetId === p.id }"
          :title="p.label"
          @click="applyPreset(p)"
        >
          <span class="sp-swatch" :style="{ background: p.accent }">
            <LucideIcon name="QrCode" :size="22" :color="'#fff'" :stroke-width="2.4" />
          </span>
          <span class="sp-preset-name">{{ p.label }}</span>
        </button>
      </div>
    </div>

    <!-- Logo（默认无） -->
    <div class="sp-section">
      <div class="sp-label">Logo（默认无）</div>

      <div class="sp-logo">
        <!-- 上传 / 预览 -->
        <div class="sp-logo-drop" :class="{ 'has-logo': !!modelValue.logo }">
          <template v-if="modelValue.logo">
            <img :src="modelValue.logo" class="sp-logo-preview" alt="Logo" />
            <button class="sp-logo-remove" title="移除 Logo" @click="removeLogo">×</button>
          </template>
          <label v-else class="sp-logo-add" @click="triggerUpload">
            <LucideIcon name="ImagePlus" :size="22" />
            <span>上传 Logo</span>
          </label>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="sp-hidden"
            @change="onFileChange"
          />
        </div>

        <div class="sp-logo-controls" :class="{ 'is-disabled': !modelValue.logo }">
          <label class="sp-field">
            <span>形状</span>
            <select :value="modelValue.logoShape || 'square'" :disabled="!modelValue.logo" @change="setLogoShape">
              <option value="square">方形</option>
              <option value="rounded">圆角</option>
              <option value="circle">圆形</option>
            </select>
          </label>
          <label class="sp-field sp-field-range">
            <span>尺寸 {{ Math.round((modelValue.logoSize ?? 0.25) * 100) }}%</span>
            <input
              type="range"
              min="0.1"
              max="0.4"
              step="0.01"
              :value="modelValue.logoSize ?? 0.25"
              :disabled="!modelValue.logo"
              @input="setLogoSize"
            />
          </label>
          <div class="sp-field">
            <span>位置</span>
            <div class="sp-seg">
              <button :class="{ 'is-active': (modelValue.logoPosition || 'center') === 'center' }" :disabled="!modelValue.logo" @click="setLogoPosition('center')">中间</button>
              <button :class="{ 'is-active': modelValue.logoPosition === 'bottom-right' }" :disabled="!modelValue.logo" @click="setLogoPosition('bottom-right')">右下角</button>
            </div>
          </div>
          <label class="sp-field sp-field-switch">
            <span>边框投影</span>
            <button class="sp-switch" :class="{ 'is-on': modelValue.logoShadow }" :disabled="!modelValue.logo" @click="toggleLogoShadow">
              <span class="sp-switch-knob" />
            </button>
          </label>
        </div>
      </div>
    </div>

    <!-- 码点码眼（两者一起） -->
    <div class="sp-section">
      <div class="sp-label">码点码眼</div>

      <div class="sp-sub">前景色（普通颜色 / 渐变）</div>
      <ColorField
        :model-color="modelValue.dotsColor"
        :model-gradient="modelValue.dotsGradient ?? null"
        @update:model-color="setDotsColor"
        @update:model-gradient="setDotsGradient"
      />

      <div class="sp-sub">背景色（同前景色）</div>
      <ColorField
        :model-color="modelValue.background"
        :model-gradient="modelValue.backgroundGradient ?? null"
        @update:model-color="setBgColor"
        @update:model-gradient="setBgGradient"
      />

      <div class="sp-sub">形状（码点 + 码眼联动）</div>
      <div class="sp-shapes">
        <button
          v-for="o in shapeOptions"
          :key="o.key"
          class="sp-shape"
          :class="{ 'is-active': currentShape === o.key }"
          @click="selectShape(o.key)"
        >
          {{ o.label }}
        </button>
      </div>

      <div class="sp-grid2">
        <label class="sp-field">
          <span>码内眼颜色</span>
          <input type="color" :value="modelValue.cornersDotColor || '#000000'" @input="setInnerEye($event)" />
        </label>
        <label class="sp-field">
          <span>码外眼颜色</span>
          <input type="color" :value="modelValue.cornersSquareColor || '#000000'" @input="setOuterEye($event)" />
        </label>
      </div>
      <div class="sp-eye-palette">
        <button
          v-for="c in commonColors"
          :key="'in' + c"
          class="sp-swatch" :style="{ background: c }" :title="c"
          @click="patch({ cornersDotColor: c, cornersDotGradient: undefined, cornersSquareColor: c, cornersSquareGradient: undefined })"
        />
      </div>

      <div class="sp-sub sp-sub-row">
        <span>码点数量</span>
        <span class="sp-readonly">{{ moduleCountText }}</span>
      </div>
      <div class="sp-hint">由内容与容错率自动决定（如 21×21），无法手动强制</div>
    </div>

    <!-- 其他设置 -->
    <div class="sp-section">
      <div class="sp-label">其他设置</div>
      <div class="sp-grid2">
        <label class="sp-field sp-field-range">
          <span>码边距 {{ modelValue.margin ?? 8 }}px</span>
          <input type="range" min="0" max="32" :value="modelValue.margin ?? 8" @input="setMargin" />
        </label>
        <label class="sp-field">
          <span>容错率（{{ eccPercent }}）</span>
          <select :value="modelValue.errorCorrectionLevel || 'M'" @change="setEcc">
            <option value="L">L（约 7%）</option>
            <option value="M">M（约 15%）</option>
            <option value="Q">Q（约 25%）</option>
            <option value="H">H（约 30%）</option>
          </select>
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 二维码样式选择器（L3 复用子组件）
 * 三段式：Logo / 码点码眼 / 其他设置。
 * - 预设网格一键套用（含渐变预设）。
 * - 自定义区改动即 emit 最新 QrStyleOptions。
 * - 仅 emit，不改 store；store 由父级（generate / batch）统一写。
 */
import { computed, ref } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { QR_STYLE_PRESETS, QR_COMMON_COLORS, type QrStylePreset } from '@/utils/qrcode';
import {
  applyShape,
  resolveShapeKey,
  QR_SHAPE_OPTIONS,
  estimateModuleCount,
  type QrGradient,
} from '@/utils/qrcode';
import type {
  QrStyleOptions,
  QrErrorCorrection,
  QrDotType,
} from '@/utils/qrcode';
import ColorField from './ColorField.vue';

const props = withDefaults(
  defineProps<{
    modelValue: QrStyleOptions;
    presetId: string;
    /** 当前内容 UTF-8 字节长度，用于「码点数量」只读展示；缺省不展示 */
    dataLength?: number;
  }>(),
  { dataLength: 0 },
);

const emit = defineEmits<{
  (e: 'update:modelValue', value: QrStyleOptions): void;
  (e: 'update:presetId', value: string): void;
}>();

const presets = QR_STYLE_PRESETS;
const shapeOptions = QR_SHAPE_OPTIONS;
const commonColors = QR_COMMON_COLORS;
const fileInput = ref<HTMLInputElement | null>(null);

/* ---------- 通用 emit 助手 ---------- */
function emitStyle(next: QrStyleOptions) {
  emit('update:modelValue', next);
}
function patch(p: Partial<QrStyleOptions>) {
  emitStyle({ ...props.modelValue, ...p });
  markCustom();
}
function markCustom() {
  emit('update:presetId', 'custom');
}
function applyPreset(p: QrStylePreset) {
  emitStyle({ ...p.style });
  emit('update:presetId', p.id);
}

/* ---------- Logo ---------- */
function triggerUpload() {
  fileInput.value?.click();
}
function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const dataUrl = reader.result as string;
    patch({
      logo: dataUrl,
      logoShape: props.modelValue.logoShape ?? 'square',
      logoSize: props.modelValue.logoSize ?? 0.25,
      logoPosition: props.modelValue.logoPosition ?? 'center',
      logoShadow: props.modelValue.logoShadow ?? false,
    });
  };
  reader.readAsDataURL(file);
}
function removeLogo() {
  patch({ logo: undefined });
}
function setLogoShape(e: Event) {
  patch({ logoShape: (e.target as HTMLSelectElement).value as 'square' | 'rounded' | 'circle' });
}
function setLogoPosition(v: 'center' | 'bottom-right') {
  patch({ logoPosition: v });
}
function setLogoSize(e: Event) {
  patch({ logoSize: Number((e.target as HTMLInputElement).value) });
}
function toggleLogoShadow() {
  patch({ logoShadow: !props.modelValue.logoShadow });
}

/* ---------- 前景 / 背景 颜色 ---------- */
function setDotsColor(c?: string) {
  patch({ dotsColor: c, dotsGradient: undefined });
}
function setDotsGradient(g: QrGradient | null) {
  patch({ dotsGradient: g ?? undefined, dotsColor: undefined });
}
function setBgColor(c?: string) {
  patch({ background: c, backgroundGradient: undefined });
}
function setBgGradient(g: QrGradient | null) {
  patch({ backgroundGradient: g ?? undefined, background: undefined });
}

/* ---------- 形状（码点 + 码眼联动） ---------- */
const currentShape = computed(() => resolveShapeKey(props.modelValue));
function selectShape(key: QrDotType) {
  emitStyle(applyShape(props.modelValue, key));
  markCustom();
}

/* ---------- 码眼颜色 ---------- */
function setInnerEye(e: Event) {
  patch({ cornersDotColor: (e.target as HTMLInputElement).value, cornersDotGradient: undefined });
}
function setOuterEye(e: Event) {
  patch({ cornersSquareColor: (e.target as HTMLInputElement).value, cornersSquareGradient: undefined });
}

/* ---------- 其他 ---------- */
function setMargin(e: Event) {
  patch({ margin: Number((e.target as HTMLInputElement).value) });
}
function setEcc(e: Event) {
  patch({ errorCorrectionLevel: (e.target as HTMLSelectElement).value as QrErrorCorrection });
}

/* ---------- 只读：码点数量 ---------- */
const moduleCount = computed<number | null>(() => {
  if (!props.dataLength || props.dataLength <= 0) return null;
  const ecc = (props.modelValue.errorCorrectionLevel ?? 'M') as QrErrorCorrection;
  return estimateModuleCount(props.dataLength, ecc);
});
const moduleCountText = computed(() => {
  if (moduleCount.value === null) return '—';
  if (moduleCount.value < 0) return '超出容量上限';
  return `${moduleCount.value} × ${moduleCount.value}`;
});
const eccPercent = computed(() => {
  switch (props.modelValue.errorCorrectionLevel ?? 'M') {
    case 'L': return '约 7%';
    case 'M': return '约 15%';
    case 'Q': return '约 25%';
    case 'H': return '约 30%';
    default: return '约 15%';
  }
});
</script>

<style scoped lang="scss">
.style-picker {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.sp-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sp-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.sp-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}
.sp-sub-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-secondary);
  font-weight: 500;
}

.sp-readonly {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.sp-hint {
  font-size: 11px;
  color: var(--text-disabled);
  margin-top: -4px;
}

.sp-presets {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(76px, 1fr));
  gap: 10px;
}

.sp-preset {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 8px 4px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 10px);
  background: var(--bg-card);
  cursor: pointer;
  transition: all 0.15s;

  &:hover { border-color: var(--color-primary); }
  &.is-active {
    border-color: var(--color-primary);
    box-shadow: 0 0 0 2px var(--color-primary-light, rgba(99, 102, 241, 0.18));
  }
}

.sp-swatch {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
}

.sp-preset-name {
  font-size: 11px;
  color: var(--text-secondary);
}

/* Logo */
.sp-logo {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.sp-logo-drop {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96px;
  border: 1px dashed var(--border-subtle);
  border-radius: var(--radius-card, 12px);
  background: var(--bg-base);
  position: relative;
}
.sp-logo-drop.has-logo {
  border-style: solid;
}
.sp-logo-preview {
  max-width: 80px;
  max-height: 80px;
  border-radius: 8px;
}
.sp-logo-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  cursor: pointer;
  line-height: 1;
}
.sp-logo-add {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
}
.sp-hidden {
  display: none;
}

.sp-logo-controls {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  &.is-disabled {
    opacity: 0.45;
    pointer-events: none;
  }
}

/* 通用字段 */
.sp-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);

  input[type='color'] {
    width: 100%;
    height: 32px;
    padding: 2px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn, 8px);
    background: var(--bg-card);
    cursor: pointer;
  }
  select {
    height: 32px;
    padding: 0 8px;
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn, 8px);
    background: var(--bg-card);
    color: var(--text-primary);
    cursor: pointer;
  }
}
.sp-field-range input[type='range'] {
  width: 100%;
  accent-color: var(--color-primary);
}

.sp-grid2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.sp-eye-palette {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
.sp-swatch {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  border: 1px solid var(--border-subtle);
  cursor: pointer;
  padding: 0;
  &:hover { transform: scale(1.12); }
}

/* 形状网格 */
.sp-shapes {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.sp-shape {
  padding: 7px 0;
  font-size: 12px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  &:hover { border-color: var(--color-primary); }
  &.is-active {
    border-color: var(--color-primary);
    background: var(--color-primary-light, rgba(99, 102, 241, 0.1));
    color: var(--color-primary);
    font-weight: 600;
  }
}

/* 分段按钮 */
.sp-seg {
  display: inline-flex;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  overflow: hidden;
  width: fit-content;
  button {
    padding: 4px 12px;
    font-size: 12px;
    background: var(--bg-card);
    color: var(--text-muted);
    cursor: pointer;
    border: none;
    &:not(:last-child) { border-right: 1px solid var(--border-subtle); }
    &.is-active { background: var(--color-primary); color: #fff; }
    &:disabled { cursor: not-allowed; }
  }
}

/* 开关 */
.sp-field-switch {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}
.sp-switch {
  position: relative;
  width: 40px;
  height: 22px;
  border-radius: 11px;
  border: none;
  background: var(--border-subtle);
  cursor: pointer;
  transition: background 0.15s;
  &.is-on { background: var(--color-primary); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
}
.sp-switch-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.15s;
  .sp-switch.is-on & { transform: translateX(18px); }
}
</style>
