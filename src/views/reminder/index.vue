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
            <LucideIcon :name="item.mode === 'time' ? 'AlarmClock' : 'RefreshCw'" :size="20" />
          </div>
          <div class="reminder-info">
            <div class="reminder-title">{{ item.title }}</div>
            <div class="reminder-rule">{{ getRuleText(item) }}</div>
          </div>
          <el-tag size="small" :type="item.mode === 'time' ? 'primary' : 'success'" class="mode-tag" effect="plain">
            {{ item.mode === 'time' ? '定点' : '周期' }}
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
            </el-radio-group>
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

          <template v-else>
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
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import useReminder from '@/store/useReminder';
import type { Reminder } from '@/store/useReminder';

const { remindersC } = storeToRefs(useReminder());
const { addReminder, updateReminder, deleteReminder, toggleReminder } = useReminder();

const remindersCc = ref(remindersC.value);
watch(() => remindersC.value, (newVal) => {
  remindersCc.value = newVal;
}, { deep: true });

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
  if (item.mode === 'time') {
    const t = item.time || '--:--';
    if (item.repeat === 'hourly') return `每小时第 ${item.minute ?? 0} 分钟`;
    if (item.repeat === 'daily') return `每天 ${t}`;
    if (item.repeat === 'weekly') {
      const days = (item.weekDays || []).slice().sort((a, b) => a - b).map(d => weekLabelMap[d] || '').filter(Boolean).join('、');
      return `每周${days} ${t}`;
    }
    if (item.repeat === 'monthly') return `每月 ${item.dayOfMonth || 1} 日 ${t}`;
    if (item.repeat === 'yearly') return `每年 ${item.month || 1} 月 ${item.dayOfMonth || 1} 日 ${t}`;
    if (item.repeat === 'once') return `${item.date || '--'} ${t}`;
    return t;
  }
  const unit = unitOptions.find(u => u.value === item.unit)?.label || '';
  return `每 ${item.interval || 0} ${unit}`;
}

const dialogVisible = ref(false);
const isEdit = ref(false);
const form = ref<Reminder>(defaultForm());

function defaultForm(): Reminder {
  return {
    id: '',
    mode: 'time',
    title: '',
    content: '',
    enabled: true,
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
  };
}

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function openDialog(item?: Reminder) {
  if (item) {
    isEdit.value = true;
    form.value = JSON.parse(JSON.stringify(item));
  } else {
    isEdit.value = false;
    form.value = defaultForm();
  }
  dialogVisible.value = true;
}

function resetForm() {
  form.value = defaultForm();
  isEdit.value = false;
}

function submit() {
  const f = form.value;
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
  } else {
    if (!f.interval || Number(f.interval) <= 0) {
      ElMessage({ message: '请输入有效的间隔数值', type: 'warning' });
      return;
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
</style>
