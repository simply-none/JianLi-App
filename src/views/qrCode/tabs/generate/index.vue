<template>
  <div class="qr-generate">
    <!-- 左：类型 + 表单 + 样式 -->
    <div class="gen-left">
      <div class="gen-types">
        <button
          v-for="f in forms"
          :key="f.type"
          class="gen-type"
          :class="{ 'is-active': selectedType === f.type }"
          @click="selectType(f.type)"
        >
          <LucideIcon :name="f.icon" :size="15" />
          <span>{{ f.label }}</span>
        </button>
      </div>

      <div class="gen-form">
        <template v-for="field in activeForm.fields" :key="field.key">
          <label class="gen-field" :class="{ 'is-required': field.required }">
            <span class="gen-field-label">{{ field.label }}</span>

            <textarea
              v-if="field.type === 'textarea'"
              v-model="values[field.key]"
              class="gen-input"
              :placeholder="field.placeholder"
              rows="3"
            />
            <input
              v-else-if="field.type === 'password'"
              v-model="values[field.key]"
              type="password"
              class="gen-input"
              :placeholder="field.placeholder"
            />
            <input
              v-else-if="field.type === 'number'"
              v-model="values[field.key]"
              type="number"
              class="gen-input"
              :placeholder="field.placeholder"
            />
            <input
              v-else-if="field.type === 'date'"
              v-model="values[field.key]"
              type="text"
              class="gen-input"
              :placeholder="field.placeholder"
            />
            <select
              v-else-if="field.type === 'select'"
              v-model="values[field.key]"
              class="gen-input"
            >
              <option v-for="o in field.options" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
            <label v-else-if="field.type === 'checkbox'" class="gen-check">
              <input v-model="values[field.key]" type="checkbox" />
              <span>是</span>
            </label>
            <input
              v-else
              v-model="values[field.key]"
              type="text"
              class="gen-input"
              :placeholder="field.placeholder"
            />

            <span v-if="field.hint" class="gen-field-hint">{{ field.hint }}</span>
          </label>
        </template>
      </div>

      <StylePicker
        :model-value="style"
        :preset-id="presetId"
        :data-length="byteLength"
        @update:model-value="(s: any) => setStyle(s)"
        @update:preset-id="(id: string) => (presetId = id)"
      />
    </div>

    <!-- 右：预览 + 操作 -->
    <div class="gen-right">
      <div class="gen-preview">
        <QrCodeView
          ref="viewRef"
          :content="qrString"
          :style-options="style"
          :size="320"
        />
      </div>

      <div class="gen-capacity" :class="{ 'is-over': overCapacity }">
        <template v-if="overCapacity">
          <LucideIcon name="TriangleAlert" :size="14" />
          <span>内容过长，超出二维码容量上限</span>
        </template>
        <template v-else>
          <span>容量：约 {{ byteLength }} 字节 · 建议版本 {{ version < 0 ? '—' : 'V' + version }}</span>
        </template>
      </div>

      <div class="gen-actions">
        <button class="gen-act gen-act-primary" :disabled="!canGenerate" @click="onDownload">
          <LucideIcon name="Download" :size="15" /> 下载
        </button>
        <button class="gen-act" :disabled="!canGenerate" @click="onCopy">
          <LucideIcon name="Copy" :size="15" /> 复制
        </button>
        <button class="gen-act" :disabled="!canGenerate" @click="onAddHistory">
          <LucideIcon name="History" :size="15" /> 存历史
        </button>
      </div>

      <p v-if="!valid" class="gen-tip">
        请填写必填项（{{ missingRequired.join('、') }}）后再生成。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 二维码生成页（L3 Tab）
 * 选择内容类型 → 动态表单 → 实时预览 → 下载/复制/存历史。
 */
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import QrCodeView from '@/components/qrcode/QrCodeView.vue';
import StylePicker from '../../components/StylePicker.vue';
import {
  QR_FORMS,
  getForm,
  buildFromForm,
  type QrTypeForm,
} from '../../config/payloadForms';
import {
  saveQrImage,
  copyQrImage,
  addQrHistory,
  calcByteLength,
  estimateVersion,
  buildQrFileName,
  type QrPayloadType,
} from '@/utils/qrcode';
import { fileNotify } from '@/utils/fileNotify';
import useQrCodeStore, { QR_SOURCE } from '@/store/useQrCode';

const store = useQrCodeStore();
const forms = QR_FORMS;
const selectedType = ref<QrPayloadType>('text');
const values = ref<Record<string, any>>({ ...getForm('text').defaults() });
const style = computed(() => store.currentStyle);
const presetId = computed({
  get: () => store.stylePresetId,
  set: (v) => (store.stylePresetId = v),
});

const viewRef = ref<InstanceType<typeof QrCodeView> | null>(null);

const activeForm = computed<QrTypeForm>(() => getForm(selectedType.value));

function selectType(t: QrPayloadType) {
  selectedType.value = t;
  values.value = { ...getForm(t).defaults() };
}

// 必填校验
const missingRequired = computed(() => {
  return activeForm.value.fields
    .filter((f) => f.required && !String(values.value[f.key] ?? '').trim())
    .map((f) => f.label);
});
const valid = computed(() => missingRequired.value.length === 0);
const canGenerate = computed(() => valid.value && !!qrString.value);

const qrString = computed(() => {
  if (!valid.value) return '';
  return buildFromForm(selectedType.value, values.value);
});

const byteLength = computed(() => calcByteLength(qrString.value || ' '));
const version = computed(() => estimateVersion(byteLength.value));
const overCapacity = computed(() => version.value === -1);

function setStyle(s: any) {
  store.setStyle(s);
}

async function onDownload() {
  const dataUrl = viewRef.value?.getDataUrl();
  if (!dataUrl) return;
  const res = await saveQrImage({
    dataUrl,
    defaultName: buildQrFileName(qrString.value),
  });
  if (res?.canceled) return;
  if (res?.ok) fileNotify({ title: '二维码已保存', filePath: res.path });
  else ElMessage.error('保存失败：' + (res?.error || ''));
}

async function onCopy() {
  const dataUrl = viewRef.value?.getDataUrl();
  if (!dataUrl) return;
  const res = await copyQrImage({ dataUrl });
  if (res?.ok) ElMessage.success('已复制到剪贴板');
  else ElMessage.error('复制失败：' + (res?.error || ''));
}

async function onAddHistory() {
  if (!qrString.value) return;
  const rec = await addQrHistory({
    source: QR_SOURCE,
    type: selectedType.value,
    content: qrString.value,
    style: store.currentStyle,
    note: activeForm.value.label,
  });
  if (rec) {
    store.bumpHistory();
    ElMessage.success('已加入历史');
  } else {
    ElMessage.error('写入历史失败');
  }
}
</script>

<style scoped lang="scss">
.qr-generate {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
}

.gen-left {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
  overflow: auto;
  padding-right: 4px;
}

.gen-right {
  width: 360px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.gen-types {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.gen-type {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--color-primary);
    color: var(--text-primary);
  }
  &.is-active {
    border-color: var(--color-primary);
    background: var(--color-primary-light, rgba(99, 102, 241, 0.1));
    color: var(--color-primary);
    font-weight: 600;
  }
}

.gen-form {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.gen-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.gen-field-label::after {
  content: '';
}
.gen-field.is-required .gen-field-label::before {
  content: '* ';
  color: var(--color-error, #e11d48);
}

.gen-input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  &:focus {
    border-color: var(--color-primary);
  }
}

textarea.gen-input {
  height: auto;
  padding: 8px 10px;
  resize: vertical;
  font-family: inherit;
}

.gen-check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  color: var(--text-primary);
}

.gen-field-hint {
  font-size: 11px;
  color: var(--text-disabled);
}

.gen-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  background: #fff;
  border-radius: var(--radius-card, 14px);
  border: 1px solid var(--border-subtle);
  box-shadow: var(--shadow-card);
}

.gen-capacity {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);

  &.is-over {
    color: var(--color-error, #e11d48);
  }
}

.gen-actions {
  display: flex;
  gap: 10px;
}

.gen-act {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.gen-act-primary {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
  &:hover:not(:disabled) {
    color: #fff;
    background: var(--color-primary-hover, #5457e0);
  }
}

.gen-tip {
  font-size: 12px;
  color: var(--color-error, #e11d48);
  margin: 0;
}
</style>
