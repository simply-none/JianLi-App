<template>
  <div class="unit-converter">
    <!-- 类别切换（通用 TopTabs 替代 el-tabs） -->
    <TopTabs
      :tabs="catTabs"
      :model-value="activeCat"
      @update:modelValue="(k: string | number) => (activeCat = k as string)"
    />

    <!-- 转换主区 -->
    <div class="convert-main">
      <div class="convert-row">
        <el-input-number v-model="inputValue" size="large" :controls="false" class="num-input" placeholder="输入值" />
        <el-select v-model="fromUnit" size="large" class="unit-select">
          <el-option v-for="u in currentUnits" :key="u.id" :label="`${u.label} (${u.symbol})`" :value="u.id" />
        </el-select>
      </div>
      <el-button :icon="ArrowLeftRight" circle size="large" class="swap-btn" @click="swapUnits" />
      <div class="convert-row">
        <el-input-number v-model="outputValue" size="large" :controls="false" class="num-input" placeholder="结果" />
        <el-select v-model="toUnit" size="large" class="unit-select">
          <el-option v-for="u in currentUnits" :key="u.id" :label="`${u.label} (${u.symbol})`" :value="u.id" />
        </el-select>
      </div>
    </div>

    <!-- 精度 & 快捷操作 -->
    <div class="options-bar">
      <span>精度:</span>
      <el-radio-group v-model="precision" size="small">
        <el-radio-button :value="0">0</el-radio-button>
        <el-radio-button :value="2">2</el-radio-button>
        <el-radio-button :value="4">4</el-radio-button>
        <el-radio-button :value="6">6</el-radio-button>
      </el-radio-group>
      <el-button size="small" :icon="Trash2" @click="clearVals">清空</el-button>
      <el-button size="small" :icon="Plus" @click="addHistory">记录</el-button>
    </div>

    <!-- 快速换算表 -->
    <div class="quick-table-wrap">
      <div class="quick-header">{{ inputValue || 0 }} {{ currentUnitObj.label }} 等于:</div>
      <div class="quick-list">
        <div v-for="u in currentUnits" :key="u.id" class="quick-item">
          <span class="q-val">{{ formatResult(convertQuick(u.id)) }}</span>
          <span class="q-unit">{{ u.label }} <small class="q-symbol">({{ u.symbol }})</small></span>
        </div>
      </div>
    </div>

    <!-- 历史记录 -->
    <div v-if="history.length" class="history-wrap">
      <div class="section-header">
        <span>历史记录 (最近 10 条)</span>
        <el-button size="small" :icon="Trash2" text @click="clearHistory">清除</el-button>
      </div>
      <div class="history-list">
        <div v-for="(h, i) in history" :key="i" class="history-item" @click="restoreHistory(h)">
          <span class="h-text">{{ h.text }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 单位换算器 - Tab6
 * 支持长度/重量/温度/面积/体积，纯前端，localStorage 存历史
 */
import { ref, computed, watch, reactive } from 'vue';
import TopTabs, { type TopTabItem } from '@/components/TopTabs.vue';
import { ArrowLeftRight, Trash2, Plus } from '@lucide/vue';

// ============== 单位类别配置 ==============
interface UnitDef { id: string; label: string; symbol: string; }
interface CategoryDef {
  id: string; label: string;
  base: string; // 基准单位 id
  units: UnitDef[];
  // 普通类别用系数表，温度用特殊公式
  coefs?: Record<string, number>;
}

const categories: CategoryDef[] = [
  {
    id: 'length', label: '长度', base: 'm',
    units: [
      { id: 'm', label: '米', symbol: 'm' },
      { id: 'km', label: '千米', symbol: 'km' },
      { id: 'cm', label: '厘米', symbol: 'cm' },
      { id: 'mm', label: '毫米', symbol: 'mm' },
      { id: 'mi', label: '英里', symbol: 'mi' },
      { id: 'yd', label: '码', symbol: 'yd' },
      { id: 'ft', label: '英尺', symbol: 'ft' },
      { id: 'in', label: '英寸', symbol: 'in' },
      { id: 'cn_li', label: '里', symbol: '里' },
      { id: 'chi_chi', label: '尺', symbol: '尺' },
      { id: 'chi_cun', label: '寸', symbol: '寸' },
      { id: 'nmile', label: '海里', symbol: 'nmi' },
    ],
    coefs: { m: 1, km: 1000, cm: 0.01, mm: 0.001, mi: 1609.344, yd: 0.9144, ft: 0.3048, in: 0.0254, cn_li: 500, chi_chi: 1 / 3, chi_cun: 1 / 30, nmile: 1852 },
  },
  {
    id: 'weight', label: '重量', base: 'kg',
    units: [
      { id: 'kg', label: '千克', symbol: 'kg' },
      { id: 'g', label: '克', symbol: 'g' },
      { id: 'mg', label: '毫克', symbol: 'mg' },
      { id: 't', label: '吨', symbol: 't' },
      { id: 'lb', label: '磅', symbol: 'lb' },
      { id: 'oz', label: '盎司', symbol: 'oz' },
      { id: 'qian', label: '钱', symbol: '钱' },
      { id: 'liang', label: '两', symbol: '两' },
      { id: 'jin', label: '斤', symbol: '斤' },
    ],
    coefs: { kg: 1, g: 0.001, mg: 0.000001, t: 1000, lb: 0.45359237, oz: 0.02834952, qian: 0.005, liang: 0.05, jin: 0.5 },
  },
  {
    id: 'temperature', label: '温度', base: 'C',
    units: [
      { id: 'C', label: '摄氏度', symbol: '℃' },
      { id: 'F', label: '华氏度', symbol: '℉' },
      { id: 'K', label: '开尔文', symbol: 'K' },
    ],
  },
  {
    id: 'area', label: '面积', base: 'm2',
    units: [
      { id: 'm2', label: '平方米', symbol: '㎡' },
      { id: 'km2', label: '平方千米', symbol: 'k㎡' },
      { id: 'ha', label: '公顷', symbol: 'ha' },
      { id: 'mu', label: '亩', symbol: '亩' },
      { id: 'ft2', label: '平方英尺', symbol: 'ft²' },
      { id: 'acre', label: '英亩', symbol: 'acre' },
    ],
    coefs: { m2: 1, km2: 1e6, ha: 1e4, mu: 666.6667, ft2: 0.092903, acre: 4046.8564 },
  },
  {
    id: 'volume', label: '体积', base: 'L',
    units: [
      { id: 'L', label: '升', symbol: 'L' },
      { id: 'mL', label: '毫升', symbol: 'mL' },
      { id: 'm3', label: '立方米', symbol: 'm³' },
      { id: 'gal', label: '加仑(美)', symbol: 'gal' },
      { id: 'floz', label: '液盎司(美)', symbol: 'floz' },
    ],
    coefs: { L: 1, mL: 0.001, m3: 1000, gal: 3.78541, floz: 0.0295735 },
  },
];

// ============== 状态 ==============
const activeCat = ref('length');
/** 类别 Tab 数据源：复用 categories 的 id/label（纯文字，不强配色，回退主题主色） */
const catTabs: TopTabItem[] = categories.map(c => ({ key: c.id, label: c.label }));
const inputValue = ref<number | null>(1);
const outputValue = ref<number | null>(null);
const fromUnit = ref('m');
const toUnit = ref('km');
const precision = ref(2);

// 历史（localStorage）
interface HistoryItem { text: string; input: number; from: string; to: string; category: string; }
const history = ref<HistoryItem[]>(JSON.parse(localStorage.getItem('devToolbox:unitHistory') || '[]'));
function saveHistory() {
  localStorage.setItem('devToolbox:unitHistory', JSON.stringify(history.value.slice(0, 10)));
}
function addHistory() {
  const a = inputValue.value, b = outputValue.value;
  if (a === null || b === null) return;
  const item: HistoryItem = {
    text: `${formatResult(a)} ${currentUnitDef(fromUnit.value).label} = ${formatResult(b)} ${currentUnitDef(toUnit.value).label}`,
    input: a, from: fromUnit.value, to: toUnit.value, category: activeCat.value,
  };
  history.value = [item, ...history.value.filter(h => h.text !== item.text)].slice(0, 10);
  saveHistory();
}
function restoreHistory(h: HistoryItem) {
  activeCat.value = h.category;
  fromUnit.value = h.from; toUnit.value = h.to;
  inputValue.value = h.input;
}
function clearHistory() { history.value = []; saveHistory(); }

// ============== 计算核心 ==============
function currentCat(): CategoryDef { return categories.find(c => c.id === activeCat.value)!; }
const currentUnits = computed(() => currentCat().units);
function currentUnitDef(id: string): UnitDef {
  return currentCat().units.find(u => u.id === id)!;
}
const currentUnitObj = computed(() => currentUnitDef(fromUnit.value));

// 类别切换时重置默认单位
watch(activeCat, (id) => {
  const c = categories.find(x => x.id === id)!;
  fromUnit.value = c.base;
  toUnit.value = c.units[Math.min(1, c.units.length - 1)].id;
});

// 温度特殊公式
function convertTemp(val: number, from: string, to: string): number {
  // 先转摄氏度
  let C = val;
  if (from === 'F') C = (val - 32) * 5 / 9;
  if (from === 'K') C = val - 273.15;
  // 再转目标
  if (to === 'C') return C;
  if (to === 'F') return C * 9 / 5 + 32;
  if (to === 'K') return C + 273.15;
  return val;
}

/** 通用转换: val from fromUnit → toUnit */
function convert(val: number, fromU: string, toU: string): number {
  if (fromU === toU) return val;
  const c = currentCat();
  if (c.id === 'temperature') return convertTemp(val, fromU, toU);
  // 普通：先转基准单位，再转目标
  const coefs = c.coefs!;
  const baseVal = val * coefs[fromU];
  return baseVal / coefs[toU];
}

// 双向联动
watch([inputValue, fromUnit, toUnit, activeCat], () => {
  if (inputValue.value === null || inputValue.value === undefined || inputValue.value !== inputValue.value) {
    outputValue.value = null; return;
  }
  try {
    outputValue.value = convert(inputValue.value, fromUnit.value, toUnit.value);
  } catch { outputValue.value = null; }
});
watch(outputValue, () => {
  // 不反向触发 input，保持单向
}, { flush: 'sync' });

function convertQuick(targetId: string): number {
  if (inputValue.value === null) return 0;
  return convert(inputValue.value, fromUnit.value, targetId);
}

function swapUnits() {
  [fromUnit.value, toUnit.value] = [toUnit.value, fromUnit.value];
}
function clearVals() { inputValue.value = null; outputValue.value = null; }

function formatResult(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return '-';
  // 大数或极小用科学计数法
  if ((Math.abs(n) > 1e12 || Math.abs(n) < 1e-4) && n !== 0) {
    return n.toExponential(precision.value);
  }
  return n.toFixed(precision.value);
}
</script>

<style lang="scss" scoped>
/* 根撑满内容区，各区块纵向排列 */
.unit-converter {
  display: flex; flex-direction: column; gap: 14px;
  height: 100%; min-height: 0;
}

/* 内嵌 TopTabs 与下方面板的间距（覆盖通用组件的默认 margin-bottom） */
.unit-converter :deep(.top-tabs) { margin-bottom: 0; flex-shrink: 0; }

/* 转换主区：渐变强调卡片 */
.convert-main {
  display: grid; grid-template-columns: 1fr auto 1fr; gap: 10px; align-items: center;
  padding: 16px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--bg-base, var(--el-fill-color-light)));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  border-radius: var(--radius-btn, 10px);
  flex-shrink: 0;
}
.convert-row { display: flex; gap: 8px; }
.num-input { flex: 1; }
.num-input :deep(.el-input__wrapper) {
  font-family: Consolas, monospace; font-size: 18px; font-weight: 600;
}
.unit-select { width: 140px; }
.swap-btn { align-self: center; }

/* 精度与快捷操作：浅底圆角条 */
.options-bar {
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  padding: 10px 14px;
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 8px;
  flex-shrink: 0;
}

/* 快速换算表：统一卡片，弹性占满剩余高度 */
.quick-table-wrap {
  padding: 14px;
  background: var(--bg-card, var(--el-bg-color));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  border-radius: var(--radius-btn, 10px);
  box-shadow: var(--shadow-card, none);
  display: flex; flex-direction: column; gap: 10px;
  flex: 1; min-height: 0;
}
.quick-header {
  font-size: 12px; color: var(--text-secondary, var(--el-text-color-secondary));
  font-weight: 500; flex-shrink: 0;
}
/* 单位网格：尽量占满高度，超出内部滚动 */
.quick-list {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  grid-auto-rows: min-content; gap: 8px;
  flex: 1; min-height: 0; align-content: flex-start;
  overflow: auto;
}
.quick-item {
  display: flex; flex-direction: column; padding: 8px 10px;
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 6px;
}
.q-val {
  font-family: Consolas, monospace; font-weight: 600;
  color: var(--color-primary, var(--el-color-primary));
  font-size: 14px;
}
.q-unit { font-size: 12px; color: var(--text-secondary, var(--el-text-color-secondary)); margin-top: 2px; }
.q-symbol { opacity: 0.7; }

.history-wrap { border-top: 1px solid var(--border-subtle, var(--el-border-color-lighter)); padding-top: 12px; flex-shrink: 0; }
.section-header {
  display: flex; justify-content: space-between; align-items: center;
  font-size: 13px; color: var(--text-secondary, var(--el-text-color-secondary));
}
.history-list { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.history-item {
  padding: 8px 12px;
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 6px;
  cursor: pointer; font-size: 13px; font-family: Consolas, monospace;
  transition: background 0.15s;
  &:hover { background: var(--el-color-primary-light-9); color: var(--color-primary, var(--el-color-primary)); }
}
</style>
