<template>
  <div class="reminder-page">
    <div class="section-header">
      <h2 class="section-title">
        <LucideIcon name="BellRing" />
        提醒
      </h2>
      <el-button type="primary" size="small" @click="openDialog()" class="add-btn">
        <LucideIcon name="AlarmClockPlus" />
        新增提醒
      </el-button>
    </div>

    <div class="reminder-set">
      <div v-if="remindersCc.length > 0" class="reminder-list">
        <div v-for="item in remindersCc" :key="item.id" class="reminder-card" :class="{ disabled: !item.enabled }">
          <div class="reminder-icon" :class="item.mode">
            <LucideIcon :name="modeIcon(item.mode)" :size="20" />
          </div>
          <div class="reminder-info">
            <div class="reminder-title">{{ item.title }}</div>
            <div class="reminder-rule">{{ getRuleText(item) }}</div>
            <div class="reminder-sub">{{ subInfoText(item) }}</div>
          </div>
          <el-tag size="small" :type="modeTagType(item.mode)" class="mode-tag" effect="plain">
            {{ modeTagText(item.mode) }}
          </el-tag>
          <el-tag v-if="item.recordAfter" size="small" type="warning" effect="plain" class="record-tag">
            记录
          </el-tag>
          <el-switch :model-value="item.enabled" @change="(val: boolean) => toggle(item.id, val)" />
          <div class="reminder-actions">
            <el-button size="small" @click="openDialog(item)" class="act-btn edit">
              <LucideIcon name="Pen" :size="14" />
              编辑
            </el-button>
            <el-button size="small" @click="del(item)" class="act-btn delete">
              <LucideIcon name="Trash" :size="14" />
              删除
            </el-button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <LucideIcon name="BellRing" :size="48" class="empty-icon" />
        <div class="empty-text">暂无提醒，点击右上角「新增提醒」添加</div>
      </div>

      <el-dialog v-model="dialogVisible" :title="isEdit ? '编辑提醒' : '新增提醒'" width="500px" class="reminder-dialog"
        @close="resetForm">
        <div class="dialog-form">
          <div class="form-item">
            <span class="form-label">标题</span>
            <el-input v-model="form.title" placeholder="请输入提醒标题" class="form-input" />
          </div>

          <div class="form-item">
            <span class="form-label">提醒内容</span>
            <el-input v-model="form.content" type="textarea" :rows="2" placeholder="提醒正文（可空）" class="form-input" />
          </div>

          <div class="form-item">
            <span class="form-label">提醒方式</span>
            <el-radio-group v-model="form.mode">
              <el-radio-button value="time">定点提醒</el-radio-button>
              <el-radio-button value="interval">周期提醒</el-radio-button>
              <el-radio-button value="stateful">多状态提醒</el-radio-button>
            </el-radio-group>
          </div>

          <div class="form-item">
            <span class="form-label">开始时间</span>
            <el-date-picker
              v-model="startTimeDate"
              type="datetime"
              format="YYYY-MM-DD HH:mm"
              value-format="x"
              placeholder="首次生效时间（留空=立即）"
              class="form-select"
            />
            <span class="form-hint">周期：开始时间+间隔推算下次；多状态：开始时间=第1个状态进入时刻，按各状态间隔推进</span>
          </div>

          <template v-if="form.mode === 'time'">
            <div class="form-item">
              <span class="form-label">重复规则</span>
              <el-select v-model="form.repeat" class="form-select">
                <el-option label="每小时" value="hourly" />
                <el-option label="每天" value="daily" />
                <el-option label="每周" value="weekly" />
                <el-option label="每月" value="monthly" />
                <el-option label="每年" value="yearly" />
                <el-option label="仅一次" value="once" />
              </el-select>
            </div>

            <div class="form-item" v-if="form.repeat === 'hourly'">
              <span class="form-label">分钟</span>
              <el-input-number v-model="form.minute" :min="0" :max="59" class="form-number" />
            </div>

            <div class="form-item" v-if="form.repeat === 'monthly'">
              <span class="form-label">日期（几号）</span>
              <el-input-number v-model="form.dayOfMonth" :min="1" :max="31" class="form-number" />
            </div>

            <div class="form-item" v-if="form.repeat === 'yearly'">
              <span class="form-label">月份与日期</span>
              <div class="ymd-wrap">
                <el-input-number v-model="form.month" :min="1" :max="12" class="ymd-input" />
                <span class="ymd-sep">月</span>
                <el-input-number v-model="form.dayOfMonth" :min="1" :max="31" class="ymd-input" />
                <span class="ymd-sep">日</span>
              </div>
            </div>

            <div class="form-item" v-if="form.repeat === 'once'">
              <span class="form-label">日期</span>
              <el-date-picker v-model="form.date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期"
                class="form-select" />
            </div>

            <div class="form-item" v-if="form.repeat === 'weekly'">
              <span class="form-label">星期</span>
              <el-checkbox-group v-model="form.weekDays">
                <el-checkbox v-for="w in weekOptions" :key="w.value" :value="w.value" :label="w.label" />
              </el-checkbox-group>
            </div>

            <div class="form-item" v-if="form.repeat !== 'hourly'">
              <span class="form-label">时间</span>
              <el-time-picker v-model="form.time" format="HH:mm" value-format="HH:mm" placeholder="选择时间"
                class="form-select" />
            </div>
          </template>

          <template v-else-if="form.mode === 'interval'">
            <div class="form-item">
              <span class="form-label">间隔</span>
              <div class="gap-input-wrap">
                <el-input v-model="form.interval" type="number" placeholder="请输入间隔数值" class="gap-input" />
                <el-select v-model="form.unit" class="gap-unit">
                  <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
                </el-select>
              </div>
            </div>
          </template>

          <template v-else-if="form.mode === 'stateful'">
            <div class="form-item">
              <span class="form-label">状态序列</span>
              <div class="state-list">
                <div v-for="(st, idx) in form.states" :key="st.key || idx" class="state-card"
                  :class="st.sequential === false ? 'is-nonseq' : 'is-seq'">
                  <div class="state-seq-badge">{{ idx + 1 }}</div>
                  <div class="state-card-body">
                    <div class="state-card-row state-row-head">
                      <el-input v-model="st.label" placeholder="状态名（例：工作、休息）" class="state-label-input" />
                      <el-button size="small" circle plain type="danger" @click="removeState(idx)" class="state-del-btn"
                        title="删除该状态">
                        <LucideIcon name="Trash" :size="14" />
                      </el-button>
                    </div>
                    <div class="state-card-row state-row-duration">
                      <span class="state-row-label">时长</span>
                      <el-input-number v-model="st.duration" :min="0" :max="9999" controls-position="right"
                        class="state-duration" />
                      <el-select v-model="st.unit" class="state-unit">
                        <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
                      </el-select>
                      <span v-if="Number(st.duration) === 0" class="state-permanent-tag">永久</span>
                    </div>
                    <div class="state-card-row state-row-toggles">
                      <div class="state-toggle-item">
                        <span class="state-row-text" :class="{ 'is-on': st.lockScreen }">锁屏</span>
                        <el-switch v-model="st.lockScreen" class="state-switch" />
                      </div>
                      <div class="state-toggle-item">
                        <span class="state-row-text" :class="st.sequential === false ? 'is-on-nonseq' : 'is-on-seq'">{{
                          st.sequential === false ? '非序列' : '序列' }}</span>
                        <el-switch v-model="st.sequential" :active-value="true" :inactive-value="false"
                          class="state-switch" />
                      </div>
                      <div v-if="st.sequential === false" class="state-toggle-item">
                        <span class="state-row-text" :class="st.continueLoop === false ? 'is-off-loop' : 'is-on-seq'">结束后{{
                          st.continueLoop === false ? '停止' : '继续循环' }}</span>
                        <el-switch v-model="st.continueLoop" :active-value="true" :inactive-value="false"
                          class="state-switch" />
                      </div>
                    </div>
                    <div class="state-card-row state-row-content">
                      <span class="state-row-label">提醒内容</span>
                      <el-input v-model="st.content" type="textarea" :rows="2" placeholder="该状态进入时展示的提醒内容（可空）"
                        class="state-content-input" />
                    </div>
                  </div>
                </div>
                <div class="state-list-foot">
                  <el-button size="small" @click="addState" class="state-add-btn">
                    <LucideIcon name="Plus" :size="14" /> 添加状态
                  </el-button>
                  <div class="state-tip">
                    <LucideIcon name="Info" :size="13" />
                    「序列」状态参与循环；「非序列」状态不参与循环，仅可运行时强制插入，结束后自动归位。
                  </div>
                </div>
              </div>
            </div>
            <div class="form-item">
              <span class="form-label">循环</span>
              <el-switch v-model="form.loop" />
              <span class="form-hint">开启后序列状态依次执行并循环（如工作 → 休息 → 工作 …）</span>
            </div>
          </template>

          <div class="form-item">
            <span class="form-label">是否结束后记录</span>
            <div class="record-after-wrap">
              <el-switch v-model="form.recordAfter" />
              <span class="form-hint">开启后，提醒结束会自动跳转到「主题对话」并记录当前情绪</span>
            </div>
          </div>
        </div>
        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submit">确定</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import useReminder from '@/store/useReminder';
import usePomodoroRuntime from '@/store/usePomodoroRuntime';
import { requestPomodoroState } from '@/hooks/usePomodoroBridge';
import type { Reminder, ReminderState } from '@/store/useReminder';

const { remindersC } = storeToRefs(useReminder());
const { addReminder, updateReminder, deleteReminder, toggleReminder } = useReminder();

// 多状态提醒运行时统一来自全局桥接写入的 usePomodoroRuntime（app 启动期注册唯一一次），
// 列表页不再各自 ipcRenderer.on，避免「漏注册导致状态空白」。按当前 active 的那条匹配到列表项。
const {
  activeId,
  stateLabel,
  nextStateLabel,
  nextStateTime,
  stateStartTime,
  injected,
  stopped,
} = storeToRefs(usePomodoroRuntime());

// 当前多状态运行时（匹配到指定提醒 id；全局桥接只持有一条 active 运行时）
function runtimeByItem(id: string) {
  if (id !== activeId.value) return null;
  return {
    stateLabel: stateLabel.value,
    nextStateLabel: nextStateLabel.value,
    nextTime: nextStateTime.value,
    stateStartTime: stateStartTime.value,
    injected: !!injected.value,
    stopped: !!stopped.value,
  };
}

const remindersCc = ref(remindersC.value);
watch(() => remindersC.value, (newVal) => {
  remindersCc.value = newVal;
}, { deep: true });

// 列表页挂载后请求主进程补偿当前多状态运行时（与 home 一致），
// 否则启动竞态下主进程首帧 reminder-state-change 早于全局桥接注册而丢失，
// 导致列表「当前状态/下一次时间」整行空白。request 幂等，可重复调用。
onMounted(() => {
  requestPomodoroState();
});

// 格式化时间戳为「MM-DD HH:mm」或「MM-DD HH:mm:ss」
function fmt(ts?: number | null): string {
  if (!ts || isNaN(Number(ts))) return '—';
  const d = new Date(Number(ts));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 计算「下一次提醒时间」：
//  - 非多状态：基于 startTime（或 now）推算下个未来触发点，与引擎算法保持一致
//  - 多状态：使用主进程下发的 nextTime
function nextTriggerTime(item: Reminder): number | null {
  if (item.mode === 'stateful') {
    return runtimeByItem(item.id)?.nextTime ?? null;
  }
  if (item.mode === 'interval') {
    const gap = Number(item.interval) * Number(item.unit);
    if (isNaN(gap) || gap <= 0) return null;
    const base = (item.startTime && !isNaN(item.startTime)) ? Number(item.startTime) : Date.now();
    let next = base;
    const now = Date.now();
    if (next <= now) {
      const rounds = Math.floor((now - next) / gap) + 1;
      next += gap * rounds;
    }
    return next;
  }
  // 定点模式：基于重复规则求下一个未来匹配时刻
  return nextCronTime(item);
}

// 渲染端推算定点提醒的下一次触发（对齐主进程 buildReminderCronExpr 语义）
function nextCronTime(item: Reminder): number | null {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const toTs = (yr: number, mo: number, da: number, h: number, mi: number) =>
    new Date(yr, mo - 1, da, h, mi, 0, 0).getTime();

  if (item.repeat === 'hourly') {
    const mi = item.minute ?? 0;
    // 下一个「xx 分」时刻
    let t = new Date(now);
    t.setMinutes(mi, 0, 0);
    if (t.getTime() <= now.getTime()) t = new Date(t.getTime() + 3600000);
    return t.getTime();
  }
  if (item.repeat === 'daily') {
    const [h, m] = (item.time || '09:00').split(':').map(Number);
    let t = toTs(now.getFullYear(), now.getMonth() + 1, now.getDate(), h, m);
    if (t <= now.getTime()) t += 86400000;
    return t;
  }
  if (item.repeat === 'weekly') {
    const [h, m] = (item.time || '09:00').split(':').map(Number);
    const days = item.weekDays || [];
    for (let add = 0; add < 8; add++) {
      const d = new Date(now.getTime() + add * 86400000);
      if (days.includes(d.getDay())) {
        const t = toTs(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m);
        if (t > now.getTime()) return t;
      }
    }
    return null;
  }
  if (item.repeat === 'monthly') {
    const [h, m] = (item.time || '09:00').split(':').map(Number);
    const dom = item.dayOfMonth || 1;
    for (let add = 0; add < 62; add++) {
      const d = new Date(now.getTime() + add * 86400000);
      if (d.getDate() === dom) {
        const t = toTs(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m);
        if (t > now.getTime()) return t;
      }
    }
    return null;
  }
  if (item.repeat === 'yearly') {
    const [h, m] = (item.time || '09:00').split(':').map(Number);
    const mon = item.month || 1;
    const dom = item.dayOfMonth || 1;
    for (let add = 0; add < 400; add++) {
      const d = new Date(now.getTime() + add * 86400000);
      if (d.getMonth() + 1 === mon && d.getDate() === dom) {
        const t = toTs(d.getFullYear(), d.getMonth() + 1, d.getDate(), h, m);
        if (t > now.getTime()) return t;
      }
    }
    return null;
  }
  if (item.repeat === 'once') {
    const [h, m] = (item.time || '09:00').split(':').map(Number);
    const parts = (item.date || '').split('-').map(Number);
    if (parts.length < 3) return null;
    const t = toTs(parts[0], parts[1], parts[2], h, m);
    return t > now.getTime() ? t : null;
  }
  return null;
}

// 列表第二行文案
function subInfoText(item: Reminder): string {
  const startTimeText = (item.startTime && !isNaN(item.startTime))
    ? `（本次开始时间：${fmt(item.startTime)}）`
    : '（本次开始时间：立即）';
  if (item.mode === 'stateful') {
    const rt = runtimeByItem(item.id);
    if (!rt || rt.stopped) {
      return `当前状态：—，下一个状态：—的提醒时间为 —${startTimeText}`;
    }
    const cur = rt.stateLabel || '?';
    const nextLabel = rt.nextStateLabel || '?';
    const nextT = fmt(rt.nextTime);
    // 「本次开始时间」优先用运行时真实对齐后的状态起点（主进程按当前时间 realign 得到），
    // 避免展示配置里陈旧的 startTime（如 00:02）而番茄钟实际早已在新一轮；
    // 无运行时（极端竞态）才回退到配置值。
    const startText = rt.stateStartTime && !isNaN(rt.stateStartTime)
      ? `（本次开始时间：${fmt(rt.stateStartTime)}）`
      : startTimeText;
    return `当前状态：${cur}，下一个状态：${nextLabel} 的提醒时间为 ${nextT}${startText}`;
  }
  const nextT = fmt(nextTriggerTime(item));
  return `下一次提醒时间：${nextT}${startTimeText}`;
}

const weekOptions = [
  { label: '周日', value: 0 },
  { label: '周一', value: 1 },
  { label: '周二', value: 2 },
  { label: '周三', value: 3 },
  { label: '周四', value: 4 },
  { label: '周五', value: 5 },
  { label: '周六', value: 6 },
];

const unitOptions = [
  { label: '秒', value: 1000 },
  { label: '分钟', value: 60 * 1000 },
  { label: '小时', value: 60 * 60 * 1000 },
];

const weekLabelMap: Record<number, string> = {
  0: '日', 1: '一', 2: '二', 3: '三', 4: '四', 5: '五', 6: '六',
};

function getRuleText(item: Reminder): string {
  // 开始时间文案（绝对基准点）
  const startText = item.startTime && !isNaN(Number(item.startTime))
    ? ` 起${new Date(Number(item.startTime)).toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`
    : '';
  if (item.mode === 'stateful') {
    const seq = (item.states || []).map((s, i) => {
      const u = unitOptions.find(o => o.value === s.unit)?.label || '';
      const tag = s.sequential === false ? '※' : `${i + 1}`;
      return `${tag}${s.label || '?'}${s.duration || 0}${u}`;
    }).join(' → ');
    return seq + (item.loop ? '（循环）' : '') + startText;
  }
  if (item.mode === 'time') {
    const t = item.time || '--:--';
    let base = '';
    if (item.repeat === 'hourly') base = `每小时第 ${item.minute ?? 0} 分钟`;
    else if (item.repeat === 'daily') base = `每天 ${t}`;
    else if (item.repeat === 'weekly') {
      const days = (item.weekDays || []).slice().sort((a, b) => a - b).map(d => weekLabelMap[d] || '').filter(Boolean).join('、');
      base = `每周${days} ${t}`;
    }
    else if (item.repeat === 'monthly') base = `每月 ${item.dayOfMonth || 1} 日 ${t}`;
    else if (item.repeat === 'yearly') base = `每年 ${item.month || 1} 月 ${item.dayOfMonth || 1} 日 ${t}`;
    else if (item.repeat === 'once') base = `${item.date || '--'} ${t}`;
    else base = t;
    return base + startText;
  }
  const unit = unitOptions.find(u => u.value === item.unit)?.label || '';
  return `每 ${item.interval || 0} ${unit}` + startText;
}

const dialogVisible = ref(false);
const isEdit = ref(false);
const form = ref<Reminder>(defaultForm());
// 开始时间：el-date-picker 绑定 Date 对象；提交时转成毫秒时间戳写入 form.startTime
const startTimeDate = ref<Date | null>(null);

// 将 number 时间戳 <-> Date 互转
function tsToDate(ts?: number | null): Date | null {
  if (!ts || isNaN(Number(ts))) return null;
  return new Date(Number(ts));
}
function dateToTs(d: Date | null): number | null {
  if (!d) return null;
  const t = d.getTime();
  return isNaN(t) ? null : t;
}

function defaultForm(): Reminder {
  return {
    id: '',
    mode: 'time',
    title: '',
    content: '',
    enabled: true,
    startTime: null,
    time: '09:00',
    repeat: 'daily',
    date: '',
    weekDays: [1, 2, 3, 4, 5],
    minute: 0,
    dayOfMonth: 1,
    month: 1,
    interval: 30,
    unit: 60 * 1000,
    recordAfter: false,
    states: [],
    loop: true,
  };
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function defaultState(): ReminderState {
  return {
    key: 'state_' + Date.now().toString(36),
    label: '',
    content: '',
    duration: 1,
    unit: 60 * 1000,
    lockScreen: false,
    sequential: true,
    continueLoop: true,
  };
}

function addState() {
  if (!form.value.states) form.value.states = [];
  form.value.states.push(defaultState());
}

function removeState(idx: number) {
  form.value.states?.splice(idx, 1);
}

function modeIcon(mode?: string): string {
  if (mode === 'time') return 'AlarmClock';
  if (mode === 'stateful') return 'Repeat';
  return 'RefreshCw';
}

function modeTagType(mode?: string): string {
  if (mode === 'time') return 'primary';
  if (mode === 'stateful') return 'warning';
  return 'success';
}

function modeTagText(mode?: string): string {
  if (mode === 'time') return '定点';
  if (mode === 'stateful') return '多状态';
  return '周期';
}

function openDialog(item?: Reminder) {
  if (item) {
    isEdit.value = true;
    form.value = JSON.parse(JSON.stringify(item));
    startTimeDate.value = tsToDate(item.startTime);
  } else {
    isEdit.value = false;
    form.value = defaultForm();
    startTimeDate.value = null;
  }
  dialogVisible.value = true;
}

function resetForm() {
  form.value = defaultForm();
  isEdit.value = false;
}

function submit() {
  const f = form.value;
  // 把 Date 形式的开始时间转回毫秒时间戳
  f.startTime = dateToTs(startTimeDate.value);
  if (!f.title.trim()) {
    ElMessage({ message: '请输入提醒标题', type: 'warning' });
    return;
  }
  if (f.mode === 'time') {
    if (f.repeat === 'hourly') {
      if (f.minute === undefined || f.minute === null) {
        ElMessage({ message: '请设置分钟', type: 'warning' });
        return;
      }
    } else if (!f.time) {
      ElMessage({ message: '请选择提醒时间', type: 'warning' });
      return;
    }
    if (f.repeat === 'once' && !f.date) {
      ElMessage({ message: '请选择提醒日期', type: 'warning' });
      return;
    }
    if (f.repeat === 'weekly' && (!f.weekDays || f.weekDays.length === 0)) {
      ElMessage({ message: '请选择星期', type: 'warning' });
      return;
    }
    if (f.repeat === 'monthly' && !f.dayOfMonth) {
      ElMessage({ message: '请设置日期（几号）', type: 'warning' });
      return;
    }
    if (f.repeat === 'yearly' && (!f.month || !f.dayOfMonth)) {
      ElMessage({ message: '请设置月份与日期', type: 'warning' });
      return;
    }
  } else if (f.mode === 'interval') {
    if (!f.interval || Number(f.interval) <= 0) {
      ElMessage({ message: '请输入有效的间隔数值', type: 'warning' });
      return;
    }
  } else if (f.mode === 'stateful') {
    if (!f.states || f.states.length === 0) {
      ElMessage({ message: '请至少添加一个状态', type: 'warning' });
      return;
    }
    for (const st of f.states) {
      if (!st.label || !st.label.trim()) {
        ElMessage({ message: '请填写状态名称', type: 'warning' });
        return;
      }
      if (!st.key) st.key = st.label;
      // 向后兼容：未显式设置 sequential 的旧数据视为序列状态
      if (st.sequential === undefined) st.sequential = true;
      // 向后兼容：未显式设置 continueLoop 的旧数据（非序列）视为结束后继续循环
      if (st.sequential === false && st.continueLoop === undefined) st.continueLoop = true;
      // 时长校验：非序列状态允许 duration=0 表示「永久」（如强制锁屏）；
      // 序列状态必须有正时长，否则无法推进循环。
      if (st.sequential !== false && (!st.duration || Number(st.duration) <= 0)) {
        ElMessage({ message: '序列状态请输入有效的状态时长（大于 0）', type: 'warning' });
        return;
      }
    }
  }

  if (isEdit.value) {
    updateReminder(JSON.parse(JSON.stringify(f)));
    ElMessage({ message: '修改成功', type: 'success' });
  } else {
    addReminder({ ...JSON.parse(JSON.stringify(f)), id: genId() });
    ElMessage({ message: '新增成功', type: 'success' });
  }
  dialogVisible.value = false;
}

function toggle(id: string, enabled: boolean) {
  toggleReminder(id, enabled);
}

function del(item: Reminder) {
  deleteReminder(item.id);
  ElMessage({ message: '已删除', type: 'success' });
}
</script>

<style scoped lang="scss">
.reminder-page {
  width: 100%;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 1px solid transparent;
    background: linear-gradient(90deg, var(--color-primary), transparent) no-repeat left bottom / 100% 1px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;

      .el-icon {
        color: var(--color-primary);
      }
    }

    .add-btn {
      font-size: 13px;
      font-weight: 500;
      padding: 6px 14px;
      border-radius: 6px;
    }
  }
}

.reminder-set {
  width: 100%;
}

.reminder-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-bottom: 16px;

  .add-btn {
    font-size: 13px;
    font-weight: 500;
    padding: 6px 14px;
    border-radius: 6px;
  }
}

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reminder-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 14px 18px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }

  &.disabled {
    opacity: 0.55;
  }

  .reminder-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    &.time {
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.15), rgba(102, 126, 234, 0.15));
      color: #409eff;
    }

    &.interval {
      background: linear-gradient(135deg, rgba(103, 194, 58, 0.15), rgba(133, 206, 97, 0.15));
      color: #67c23a;
    }
  }

  .reminder-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;

    .reminder-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .reminder-rule {
      font-size: 13px;
      color: var(--text-muted);
    }

    .reminder-sub {
      font-size: 12px;
      color: var(--text-secondary);
      line-height: 1.5;
    }
  }

  .mode-tag {
    flex-shrink: 0;
  }

  .record-tag {
    flex-shrink: 0;
  }

  .reminder-actions {
    display: flex;
    gap: 6px;

    .act-btn {
      padding: 6px 10px;
      font-size: 12px;
      border-radius: 6px;

      &.edit {
        color: #409eff;
      }

      &.delete {
        color: #f56c6c;
      }
    }
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);

  .empty-icon {
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .empty-text {
    font-size: 14px;
    color: var(--text-muted);
  }
}

.dialog-form {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .form-item {
    display: flex;
    flex-direction: column;
    gap: 8px;

    .form-label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
    }

    .form-input,
    .form-select {
      width: 100%;
      font-size: 14px;
    }

    .form-hint {
      display: block;
      margin-top: 4px;
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.4;
    }

    .record-after-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;

      .form-hint {
        font-size: 12px;
        color: var(--text-muted);
      }
    }

    .form-number {
      width: 160px;
    }

    .ymd-wrap {
      display: flex;
      align-items: center;
      gap: 8px;

      .ymd-input {
        width: 120px;
      }

      .ymd-sep {
        font-size: 13px;
        color: var(--text-secondary);
      }
    }

    .gap-input-wrap {
      display: flex;
      align-items: center;
      gap: 8px;

      .gap-input {
        flex: 1;
      }

      .gap-unit {
        width: 100px;
        flex-shrink: 0;
      }


    }
  }
}

.state-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;

  .state-card {
    display: flex;
    align-items: stretch;
    gap: 12px;
    border-radius: 10px;
    padding: 10px 12px;
    border: 1px solid;
    transition: all 0.2s ease;

    &.is-seq {
      background: linear-gradient(135deg, rgba(64, 158, 255, 0.08), rgba(102, 126, 234, 0.06));
      border-color: rgba(64, 158, 255, 0.35);
    }

    &.is-nonseq {
      background: linear-gradient(135deg, rgba(230, 162, 60, 0.1), rgba(245, 108, 108, 0.06));
      border-color: rgba(230, 162, 60, 0.55);
      border-style: dashed;
    }

    .state-seq-badge {
      flex-shrink: 0;
      align-self: flex-start;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 15px;
      font-weight: 700;
      color: #fff;
    }

    &.is-seq .state-seq-badge {
      background: linear-gradient(135deg, #409eff, #667eea);
      box-shadow: 0 2px 6px rgba(64, 158, 255, 0.35);
    }

    &.is-nonseq .state-seq-badge {
      background: linear-gradient(135deg, #e6a23c, #f56c6c);
      box-shadow: 0 2px 6px rgba(230, 162, 60, 0.35);
    }

    .state-card-body {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 12px;

      // 第 1 行：名称 + 删除（名称撑满，删除靠右两端对齐）
      .state-row-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;

        .state-label-input {
          flex: 1;
          min-width: 0;
        }

        .state-del-btn {
          flex-shrink: 0;
        }
      }

      // 第 2 行：时长（标签 + 数值 + 单位）
      .state-row-duration {
        display: flex;
        align-items: center;
        gap: 8px;

        .state-row-label {
          flex-shrink: 0;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          line-height: 1;
          user-select: none;
        }

        .state-duration {
          flex-shrink: 0;
          flex: 1;
        }

        .state-unit {
          flex-shrink: 0;
          width: 96px;
          max-width: 96px;
        }

        .state-permanent-tag {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 600;
          color: #909399;
          background: rgba(144, 147, 153, 0.14);
          padding: 2px 8px;
          border-radius: 10px;
          user-select: none;
        }
      }

      // 第 3 行：锁屏 + 序列（左对齐）
      .state-row-toggles {
        display: flex;
        align-items: center;
        gap: 28px;

        .state-toggle-item {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;

          .state-switch {
            flex-shrink: 0;
          }

          .state-row-text {
            font-size: 13px;
            color: var(--text-muted);
            user-select: none;
            transition: color 0.15s ease;
            white-space: nowrap;

            &.is-on {
              color: #e6a23c;
              font-weight: 600;
            }

            &.is-on-seq {
              color: #409eff;
              font-weight: 600;
            }

            &.is-on-nonseq {
              color: #e6a23c;
              font-weight: 600;
            }

            &.is-off-loop {
              color: #f56c6c;
              font-weight: 600;
            }
          }
        }
      }

      // 第 4 行：提醒内容（标签 + textarea）
      .state-row-content {
        display: flex;
        align-items: flex-start;
        gap: 8px;

        .state-row-label {
          flex-shrink: 0;
          width: 52px;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-secondary);
          line-height: 32px;
          user-select: none;
        }

        .state-content-input {
          flex: 1;
          min-width: 0;
        }
      }
    }
  }

  .state-list-foot {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;

    .state-add-btn {
      align-self: flex-start;
    }

    .state-tip {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
      padding: 4px 2px;

      .el-icon {
        margin-top: 2px;
        flex-shrink: 0;
      }
    }
  }
}
</style>
