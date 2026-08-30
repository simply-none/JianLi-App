<template>
  <div class="date-calculator">
    <!-- 子工具切换（通用 TopTabs 替代 el-tabs） -->
    <TopTabs
      :tabs="subTabs"
      :model-value="subTab"
      @update:modelValue="(k: string | number) => (subTab = k as 'diff' | 'offset' | 'workday' | 'countdown' | 'ts')"
    />

    <!-- 日期差 -->
    <div v-show="subTab === 'diff'" class="panel">
      <div class="input-row">
        <el-date-picker v-model="diffStart" type="datetime" placeholder="开始" style="width:220px;" />
        <span class="icon-arrow">→</span>
        <el-date-picker v-model="diffEnd" type="datetime" placeholder="结束" style="width:220px;" />
        <el-button :icon="ArrowLeftRight" circle @click="swapDiff" />
        <el-button size="small" @click="useTodayEnd">今日结束</el-button>
      </div>
      <div v-if="diffStart && diffEnd" class="result-grid">
        <div class="result-card">
          <div class="res-label">相差</div>
          <div class="res-value">{{ diffHuman }}</div>
        </div>
        <div class="result-card">
          <div class="res-label">总天数</div>
          <div class="res-value">{{ diffDays }}</div>
        </div>
        <div class="result-card">
          <div class="res-label">总小时</div>
          <div class="res-value">{{ diffHours }}</div>
        </div>
        <div class="result-card">
          <div class="res-label">工作日</div>
          <div class="res-value">{{ diffWorkdays }} 天</div>
        </div>
      </div>
    </div>

    <!-- 日期加减 -->
    <div v-show="subTab === 'offset'" class="panel">
      <div class="input-row">
        <el-date-picker v-model="offsetBase" type="datetime" placeholder="基准日期" style="width:220px;" />
      </div>
      <div class="offset-grid">
        <div v-for="f in offsetFields" :key="f.key" class="offset-item">
          <span class="o-label">{{ f.label }}</span>
          <el-input-number v-model="f.value" size="small" :controls="false" />
        </div>
      </div>
      <div v-if="offsetBase" class="result-box">
        <div class="r-line"><span>结果:</span> <strong class="r-value">{{ offsetResult }}</strong></div>
        <div class="r-line"><span>星期:</span> {{ offsetWeekday }}</div>
        <div class="r-line"><span>距今天:</span> {{ offsetDaysFromNow }} 天</div>
      </div>
    </div>

    <!-- 工作日 -->
    <div v-show="subTab === 'workday'" class="panel">
      <div class="input-row">
        <el-date-picker v-model="wdStart" type="date" placeholder="开始" />
        <span>→</span>
        <el-date-picker v-model="wdEnd" type="date" placeholder="结束" />
        <el-switch v-model="wdExcludeWeekend" active-text="排除周末" />
      </div>
      <div v-if="wdStart && wdEnd" class="result-box">
        <div class="r-line"><span>总天数:</span> {{ wdTotal }}</div>
        <div class="r-line"><span>工作日:</span> {{ wdWorkdays }}</div>
        <div class="r-line"><span>周末:</span> {{ wdWeekends }}</div>
      </div>
    </div>

    <!-- 倒计时 -->
    <div v-show="subTab === 'countdown'" class="panel">
      <div class="input-row">
        <el-date-picker v-model="cdTarget" type="datetime" placeholder="目标日期" style="width:240px;" />
        <el-switch v-model="cdIsFuture" active-text="倒计时 (目标在未来)" inactive-text="正计时 (目标已过)" />
      </div>
      <div v-if="cdTarget" class="countdown-display">
        <div class="cd-block"><div class="cd-num">{{ cdParts.days }}</div><div class="cd-unit">天</div></div>
        <div class="cd-sep">:</div>
        <div class="cd-block"><div class="cd-num">{{ pad(cdParts.hours) }}</div><div class="cd-unit">时</div></div>
        <div class="cd-sep">:</div>
        <div class="cd-block"><div class="cd-num">{{ pad(cdParts.minutes) }}</div><div class="cd-unit">分</div></div>
        <div class="cd-sep">:</div>
        <div class="cd-block"><div class="cd-num">{{ pad(cdParts.seconds) }}</div><div class="cd-unit">秒</div></div>
      </div>
    </div>

    <!-- 时间戳 -->
    <div v-show="subTab === 'ts'" class="panel">
      <div class="ts-row">
        <span class="lbl">Unix 秒</span>
        <el-input v-model="tsSec" @input="onTsInput('sec')" />
      </div>
      <div class="ts-row">
        <span class="lbl">Unix 毫秒</span>
        <el-input v-model="tsMs" @input="onTsInput('ms')" />
      </div>
      <div class="ts-row">
        <span class="lbl">日期字符串</span>
        <el-input v-model="tsDate" @input="onTsInput('date')" />
      </div>
      <div class="ts-row actions">
        <el-button size="small" @click="fillNow">填入当前时间</el-button>
        <el-button size="small" @click="fillNowMs">填入当前时间(毫秒)</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 日期/时间计算器 - Tab5
 * 依赖: moment (项目已装)
 */
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import moment from 'moment';
import TopTabs, { type TopTabItem } from '@/components/TopTabs.vue';
import { ArrowLeftRight } from '@lucide/vue';

/** 子工具 Tab 数据源（纯文字，不强配色，回退主题主色） */
const subTabs: TopTabItem[] = [
  { key: 'diff', label: '日期差' },
  { key: 'offset', label: '日期加减' },
  { key: 'workday', label: '工作日' },
  { key: 'countdown', label: '倒计时' },
  { key: 'ts', label: '时间戳' },
];
const subTab = ref<'diff' | 'offset' | 'workday' | 'countdown' | 'ts'>('diff');

// ================ 日期差 ================
const diffStart = ref('');
const diffEnd = ref('');

const diffDays = computed(() => {
  if (!diffStart.value || !diffEnd.value) return 0;
  return moment(diffEnd.value).diff(moment(diffStart.value), 'days');
});
const diffHours = computed(() => {
  if (!diffStart.value || !diffEnd.value) return 0;
  return moment(diffEnd.value).diff(moment(diffStart.value), 'hours');
});
const diffHuman = computed(() => {
  if (!diffStart.value || !diffEnd.value) return '';
  const d = moment.duration(moment(diffEnd.value).diff(moment(diffStart.value)));
  return `${Math.abs(d.years())}年 ${Math.abs(d.months())}月 ${Math.abs(d.days())}天 ${Math.abs(d.hours())}小时`;
});
const diffWorkdays = computed(() => {
  if (!diffStart.value || !diffEnd.value) return 0;
  let d = moment(diffStart.value);
  const end = moment(diffEnd.value);
  let count = 0;
  while (d.isBefore(end)) {
    if (d.day() !== 0 && d.day() !== 6) count++;
    d.add(1, 'day');
  }
  return count;
});

function swapDiff() { [diffStart.value, diffEnd.value] = [diffEnd.value, diffStart.value]; }
function useTodayEnd() { diffEnd.value = moment().endOf('day').format('YYYY-MM-DD HH:mm:ss'); }

// ================ 日期加减 ================
const offsetBase = ref('');
const offsetFields = reactive([
  { key: 'years', label: '年', value: 0 },
  { key: 'months', label: '月', value: 0 },
  { key: 'days', label: '日', value: 0 },
  { key: 'hours', label: '时', value: 0 },
  { key: 'minutes', label: '分', value: 0 },
  { key: 'seconds', label: '秒', value: 0 },
]);

const offsetResult = computed(() => {
  if (!offsetBase.value) return '';
  let m = moment(offsetBase.value);
  for (const f of offsetFields) m = m.add(f.value, f.key as any);
  return m.format('YYYY-MM-DD HH:mm:ss');
});
const offsetWeekday = computed(() => moment(offsetResult.value).format('dddd'));
const offsetDaysFromNow = computed(() => {
  if (!offsetResult.value) return 0;
  return moment().diff(moment(offsetResult.value), 'days');
});

// ================ 工作日 ================
const wdStart = ref('');
const wdEnd = ref('');
const wdExcludeWeekend = ref(true);

const wdTotal = computed(() => {
  if (!wdStart.value || !wdEnd.value) return 0;
  return moment(wdEnd.value).diff(moment(wdStart.value), 'days') + 1;
});
const wdWorkdays = computed(() => {
  if (!wdStart.value || !wdEnd.value) return 0;
  let d = moment(wdStart.value);
  const end = moment(wdEnd.value);
  let c = 0;
  while (!d.isAfter(end)) {
    if (!wdExcludeWeekend.value || (d.day() !== 0 && d.day() !== 6)) c++;
    d.add(1, 'day');
  }
  return c;
});
const wdWeekends = computed(() => Math.max(0, wdTotal.value - wdWorkdays.value));

// ================ 倒计时 ================
const cdTarget = ref('');
const cdIsFuture = ref(true);
const nowTick = ref(Date.now());
let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => { timer = setInterval(() => nowTick.value = Date.now(), 1000); });
onUnmounted(() => { if (timer) clearInterval(timer); });

const cdParts = computed(() => {
  if (!cdTarget.value) return { days: 0, hours: 0, minutes: 0, seconds: 0 };
  const t = cdIsFuture.value
    ? moment(cdTarget.value).diff(moment(nowTick.value))
    : moment(nowTick.value).diff(moment(cdTarget.value));
  const d = moment.duration(Math.abs(t));
  return { days: Math.floor(d.asDays()), hours: d.hours(), minutes: d.minutes(), seconds: d.seconds() };
});
function pad(n: number): string { return String(n).padStart(2, '0'); }

// ================ 时间戳 ================
const tsSec = ref('');
const tsMs = ref('');
const tsDate = ref('');
let silent = false;

function onTsInput(type: 'sec' | 'ms' | 'date') {
  if (silent) return;
  silent = true;
  try {
    if (type === 'sec') {
      const n = Number(tsSec.value);
      if (!isNaN(n)) {
        tsMs.value = String(n * 1000);
        tsDate.value = moment.unix(n).format('YYYY-MM-DD HH:mm:ss');
      }
    } else if (type === 'ms') {
      const n = Number(tsMs.value);
      if (!isNaN(n)) {
        tsSec.value = String(Math.floor(n / 1000));
        tsDate.value = moment(n).format('YYYY-MM-DD HH:mm:ss');
      }
    } else {
      const m = moment(tsDate.value);
      if (m.isValid()) {
        tsSec.value = String(m.unix());
        tsMs.value = String(m.valueOf());
      }
    }
  } finally {
    setTimeout(() => { silent = false; }, 0);
  }
}

function fillNow() {
  const m = moment();
  tsSec.value = String(m.unix());
  tsMs.value = String(m.valueOf());
  tsDate.value = m.format('YYYY-MM-DD HH:mm:ss');
}
function fillNowMs() { fillNow(); }
</script>

<style lang="scss" scoped>
/* 根撑满内容区，面板弹性占满剩余高度 */
.date-calculator {
  display: flex; flex-direction: column; gap: 14px;
  height: 100%; min-height: 0;
}

/* 内嵌 TopTabs 与下方面板的间距（覆盖通用组件的默认 margin-bottom） */
.date-calculator :deep(.top-tabs) { margin-bottom: 0; flex-shrink: 0; }

/* 统一工具卡片：flex:1 撑满剩余高度 */
.panel {
  padding: 16px;
  background: var(--bg-card, var(--el-bg-color));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  border-radius: var(--radius-btn, 10px);
  box-shadow: var(--shadow-card, none);
  display: flex; flex-direction: column; gap: 14px;
  flex: 1; min-height: 0;
}
.input-row {
  display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
  flex-shrink: 0;
}
.icon-arrow { color: var(--text-secondary, var(--el-text-color-secondary)); }

/* 结果卡片网格：填充剩余高度并居中展示 */
.result-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px;
  flex: 1; min-height: 0; align-content: center;
}
.result-card {
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 8px; padding: 16px 14px;
  display: flex; flex-direction: column; gap: 4px;
}
.res-label { font-size: 12px; color: var(--text-secondary, var(--el-text-color-secondary)); }
.res-value {
  font-size: 20px; font-weight: 600;
  font-family: Consolas, monospace;
  color: var(--color-primary, var(--el-color-primary));
}

.offset-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 8px; }
.offset-item { display: flex; flex-direction: column; gap: 4px; }
.o-label { font-size: 12px; color: var(--text-secondary, var(--el-text-color-secondary)); }

.result-box {
  background: var(--bg-base, var(--el-fill-color-light));
  border-radius: 8px; padding: 12px 14px;
  display: flex; flex-direction: column; gap: 6px; font-size: 13px;
}
.r-line { display: flex; gap: 10px; }
.r-value { color: var(--color-primary, var(--el-color-primary)); font-family: Consolas, monospace; }

/* 倒计时：大数字居中放大，占满面板剩余空间 */
.countdown-display {
  display: flex; align-items: center; gap: 6px; justify-content: center;
  flex: 1; min-height: 0;
  padding: 24px;
  background: linear-gradient(135deg, var(--el-color-primary-light-9), var(--bg-base, var(--el-fill-color-light)));
  border-radius: 10px;
}
.cd-block {
  display: flex; flex-direction: column; align-items: center;
  background: var(--bg-card, var(--el-bg-color));
  border: 1px solid var(--border-subtle, var(--el-border-color-lighter));
  border-radius: 8px; padding: 16px 20px; min-width: 76px;
  box-shadow: var(--shadow-card, 0 2px 8px rgba(0,0,0,0.06));
}
.cd-num {
  font-size: 36px; font-weight: 700;
  font-family: Consolas, monospace;
  color: var(--color-primary, var(--el-color-primary));
  line-height: 1;
}
.cd-unit { font-size: 12px; color: var(--text-secondary, var(--el-text-color-secondary)); margin-top: 4px; }
.cd-sep { font-size: 28px; font-weight: 700; color: var(--text-secondary, var(--el-text-color-secondary)); }

.ts-row { display: grid; grid-template-columns: 100px 1fr; gap: 10px; align-items: center; }
.ts-row.actions { grid-template-columns: 1fr; justify-content: flex-start; }
.lbl { font-size: 13px; font-weight: 500; }
</style>
