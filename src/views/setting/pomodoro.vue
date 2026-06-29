<template>
  <div class="pomodoro-set">
    <div class="action-bar">
      <el-button type="primary" @click="tipAll" class="action-btn">
        <LucideIcon name="AlarmClockCheck" />
        一键提醒
      </el-button>
      <el-button type="warning" @click="stopAllTip" class="action-btn">
        <LucideIcon name="AlarmClockMinus" />
        停止所有提醒
      </el-button>
    </div>

    <div class="section">
      <div class="section-header">
        <h3 class="section-title">
          <LucideIcon name="AlarmClockCheck" />
          当前提醒
        </h3>
        <el-button type="primary" size="small" @click="openTipDialog()" class="add-btn">
          <LucideIcon name="AlarmClockPlus" />
          新增提醒
        </el-button>
      </div>

      <div v-if="tipTypeCc.length > 0" class="tip-list">
        <div v-for="item in tipTypeCc" :key="item.type + item.gap" class="tip-card">
          <div class="tip-card-left">
            <div class="tip-icon">
              <el-image :src="decodeURIComponent(getIcon(item.type))" fit="cover">
                <template #error>
                  <LucideIcon name="AlarmClockCheck" />
                </template>
              </el-image>
            </div>
            <div class="tip-info">
              <div class="tip-type">{{ getType(item.type) }}</div>
              <div class="tip-gap">
                <span class="gap-value">{{ item.gap }}</span>
                <span class="gap-unit">{{ curUnit(item.unit) }}</span>
              </div>
            </div>
          </div>
          <div class="tip-card-right">
            <div class="tip-next-time">
              <LucideIcon name="AlarmClock" :size="14" />
              <span>{{ (nextTime[item.type] || {}).nextTime || '--' }}</span>
            </div>
            <div class="tip-actions">
              <el-button size="small" @click="openTipDialog(item)" class="tip-btn edit">
                <LucideIcon name="Pen" />
              </el-button>
              <el-button size="small" @click="() => tip(item)" class="tip-btn start">
                <LucideIcon name="Play" />
              </el-button>
              <el-button size="small" @click="() => stopTip(item)" class="tip-btn stop">
                <LucideIcon name="Pause" />
              </el-button>
              <el-button size="small" @click="delTip(item)" class="tip-btn delete">
                <LucideIcon name="Trash" />
              </el-button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <LucideIcon name="AlarmClockCheck" :size="48" class="empty-icon" />
        <div class="empty-text">暂无提醒</div>
      </div>
    </div>

    <div class="section">
      <div class="section-header">
        <h3 class="section-title">
          <LucideIcon name="BellRing" />
          提醒类型
        </h3>
        <el-button type="primary" size="small" @click="openTipOpsDialog()" class="add-btn">
          <LucideIcon name="BellPlus" />
          新增类型
        </el-button>
      </div>

      <div v-if="tipTypeOpsCc.length > 0" class="tip-ops-grid">
        <div v-for="item in tipTypeOpsCc" :key="item.value" class="tip-ops-card">
          <div class="tip-ops-icon">
            <div v-if="item.iconType == 'image'" class="icon-image">
              <el-image :src="decodeURIComponent(item.icon)" fit="cover">
                <template #error>
                  <LucideIcon name="image" />
                </template>
              </el-image>
            </div>
            <div v-else-if="item.icon" class="icon-emoji">
              <div v-html="decodeURIComponent(item.icon)"></div>
            </div>
            <div v-else class="icon-emoji">
              <LucideIcon name="image" />
            </div>
          </div>
          <div class="tip-ops-info">
            <div class="tip-ops-label">{{ item.label }}</div>
            <div class="tip-ops-value">{{ item.value }}</div>
          </div>
          <div class="tip-ops-actions">
            <el-button size="small" @click="openTipOpsDialog(item)" class="ops-btn edit">
              <LucideIcon name="Pen" />
            </el-button>
            <el-button size="small" @click="delTipOps(item)" class="ops-btn delete">
              <LucideIcon name="Trash" />
            </el-button>
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        <LucideIcon name="BellRing" :size="48" class="empty-icon" />
        <div class="empty-text">暂无提醒类型</div>
      </div>
    </div>

    <el-dialog v-model="tipDialogVisible" :title="isEditTip ? '编辑提醒' : '新增提醒'" width="480px" class="tip-dialog" @close="resetTipForm">
      <div class="dialog-form">
        <div class="form-item">
          <span class="form-label">提醒类型</span>
          <el-select v-model="tipForm.type" placeholder="请选择提醒类型" class="form-select">
            <el-option v-for="(item, index) in tipTypeOpsCc" :key="index" :label="item.label" :value="item.value" />
          </el-select>
        </div>
        <div class="form-item">
          <span class="form-label">时间间隔</span>
          <div class="gap-input-wrap">
            <el-input v-model="tipForm.gap" type="number" placeholder="请输入间隔时间" class="gap-input">
            </el-input>
            <el-select v-model="tipForm.unit" placeholder="单位" class="gap-unit">
              <el-option label="分钟" :value="60 * 1000" />
              <el-option label="小时" :value="60 * 60 * 1000" />
              <el-option label="秒" :value="1000" />
            </el-select>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="tipDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTip">{{ isEditTip ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="tipOpsDialogVisible" :title="isEditTipOps ? '编辑提醒类型' : '新增提醒类型'" width="520px" class="tip-ops-dialog" @close="resetTipOpsForm">
      <div class="dialog-form">
        <div class="form-item">
          <span class="form-label">名称</span>
          <el-input v-model="tipOpsForm.label" placeholder="请输入提醒类型名称" class="form-input" />
        </div>
        <div class="form-item">
          <span class="form-label">值</span>
          <el-input v-model="tipOpsForm.value" placeholder="请输入提醒类型值" class="form-input" />
        </div>
        <div class="form-item">
          <span class="form-label">图标</span>
          <div class="icon-input-wrap">
            <el-input v-model="tipOpsForm.icon" placeholder="请输入或选择图标" class="icon-input">
              <template #append>
                <el-button @click="uploadIcon">
                  <LucideIcon name="Upload" />
                </el-button>
              </template>
            </el-input>
          </div>
        </div>
        <div v-if="tipOpsForm.icon" class="icon-preview">
          <span class="preview-label">图标预览</span>
          <div v-if="tipOpsForm.iconType == 'image'" class="preview-image">
            <el-image :src="tipOpsForm.icon" fit="cover">
              <template #error>
                <div>图片加载失败</div>
              </template>
            </el-image>
          </div>
          <div v-else class="preview-emoji" v-html="tipOpsForm.icon"></div>
        </div>
      </div>
      <template #footer>
        <el-button @click="tipOpsDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitTipOps">{{ isEditTipOps ? '保存' : '新增' }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import useTips from '@/store/useTips';
import { send, sendSync } from '@/utils/common';

const { tipTypeC, tipTypeOpsC, nextTime } = storeToRefs(useTips());
const { setTipType, setTipTypeOps, setNextTime } = useTips();

const tipTypeCc = ref(tipTypeC.value);
watch(() => tipTypeC.value, (newVal) => {
  tipTypeCc.value = newVal;
}, { deep: true });

const tipTypeOpsCc = ref(tipTypeOpsC.value);
watch(() => tipTypeOpsC.value, (newVal) => {
  tipTypeOpsCc.value = newVal;
}, { deep: true });

const tipDialogVisible = ref(false);
const isEditTip = ref(false);
const tipForm = ref<ObjectType>({});
const editingTipIndex = ref(-1);

const openTipDialog = (item?: ObjectType) => {
  if (item) {
    isEditTip.value = true;
    tipForm.value = JSON.parse(JSON.stringify(item));
    editingTipIndex.value = tipTypeCc.value.findIndex(
      i => item.type == i.type && item.gap == i.gap && item.unit == i.unit
    );
  } else {
    isEditTip.value = false;
    tipForm.value = {};
    editingTipIndex.value = -1;
  }
  tipDialogVisible.value = true;
};

const resetTipForm = () => {
  tipForm.value = {};
  isEditTip.value = false;
  editingTipIndex.value = -1;
};

const submitTip = () => {
  if (!tipForm.value.type || !tipForm.value.gap || !tipForm.value.unit) {
    ElMessage({ message: '请填写完整信息', type: 'warning' });
    return;
  }
  if (isEditTip.value && editingTipIndex.value != -1) {
    tipTypeCc.value.splice(editingTipIndex.value, 1, tipForm.value);
    setTipType(tipTypeCc.value);
    ElMessage({ message: '修改成功', type: 'success' });
  } else {
    setTipType(tipForm);
    ElMessage({ message: '新增成功', type: 'success' });
  }
  tipDialogVisible.value = false;
};

const delTip = (item: ObjectType) => {
  const index = tipTypeCc.value.findIndex(i => item.type == i.type && item.gap == i.gap && item.unit == i.unit);
  if (index != -1) {
    tipTypeCc.value.splice(index, 1);
    setTipType(tipTypeCc.value);
  }
};

const tipAll = () => {
  tipTypeCc.value.forEach(item => {
    send('start-job', { type: item.type, gap: Number(item.gap) * Number(item.unit) });
  });
};

const stopAllTip = () => {
  setNextTime();
  tipTypeCc.value.forEach(item => {
    send('stop-job', { type: item.type });
  });
};

const tip = (item: ObjectType) => {
  send('start-job', { type: item.type, gap: Number(item.gap) * Number(item.unit) });
};

const stopTip = (item: ObjectType) => {
  setNextTime(item.type, {});
  send('stop-job', { type: item.type });
};

const tipOpsDialogVisible = ref(false);
const isEditTipOps = ref(false);
const tipOpsForm = ref<ObjectType>({});
const editingTipOpsIndex = ref(-1);

const openTipOpsDialog = (item?: ObjectType) => {
  if (item) {
    isEditTipOps.value = true;
    tipOpsForm.value = JSON.parse(JSON.stringify(item));
    editingTipOpsIndex.value = tipTypeOpsCc.value.findIndex(
      i => item.label == i.label && item.value == i.value
    );
  } else {
    isEditTipOps.value = false;
    tipOpsForm.value = {};
    editingTipOpsIndex.value = -1;
  }
  tipOpsDialogVisible.value = true;
};

const resetTipOpsForm = () => {
  tipOpsForm.value = {};
  isEditTipOps.value = false;
  editingTipOpsIndex.value = -1;
};

const submitTipOps = () => {
  if (!tipOpsForm.value.label || !tipOpsForm.value.value) {
    ElMessage({ message: '请填写完整信息', type: 'warning' });
    return;
  }
  if (isEditTipOps.value && editingTipOpsIndex.value != -1) {
    tipTypeOpsCc.value.splice(editingTipOpsIndex.value, 1, tipOpsForm.value);
    setTipTypeOps(tipTypeOpsCc.value);
    ElMessage({ message: '修改成功', type: 'success' });
  } else {
    setTipTypeOps(tipOpsForm);
    ElMessage({ message: '新增成功', type: 'success' });
  }
  tipOpsDialogVisible.value = false;
};

const delTipOps = (item: ObjectType) => {
  const index = tipTypeOpsCc.value.findIndex(i => item.label == i.label && item.value == i.value);
  if (index != -1) {
    tipTypeOpsCc.value.splice(index, 1);
    setTipTypeOps(tipTypeOpsCc.value);
  }
};

const uploadIcon = () => {
  const res = sendSync('get-file-list', { openDirectory: false, openFile: true, type: 'image' });
  if (res) {
    tipOpsForm.value.icon = 'jlocal:///' + encodeURIComponent(res[0]);
    tipOpsForm.value.iconType = 'image';
  }
};

const curUnit = (unit: number) => {
  if (unit == 60 * 1000) return '分钟';
  else if (unit == 60 * 60 * 1000) return '小时';
  else if (unit == 1000) return '秒';
};

const getType = (type: string) => {
  return tipTypeOpsCc.value.find(i => i.value == type)?.label;
};
const getIcon = (type: string) => {
  return tipTypeOpsCc.value.find(i => i.value == type)?.icon;
};
</script>

<style scoped lang="scss">
.pomodoro-set {
  width: 100%;
}

.action-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;

  .action-btn {
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 500;
    border-radius: 8px;
    transition: all 0.2s ease;

    &:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
  }
}

.section {
  margin-bottom: 24px;

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--color-primary);

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

.tip-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tip-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px 20px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
  }

  .tip-card-left {
    display: flex;
    align-items: center;
    gap: 14px;

    .tip-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
      display: flex;
      align-items: center;
      justify-content: center;
      color: #667eea;
    }

    .tip-info {
      display: flex;
      flex-direction: column;
      gap: 4px;

      .tip-type {
        font-size: 15px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .tip-gap {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 13px;
        color: var(--text-muted);

        .gap-value {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-primary);
        }
      }
    }
  }

  .tip-card-right {
    display: flex;
    align-items: center;
    gap: 16px;

    .tip-next-time {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--text-secondary);
      padding: 6px 12px;
      background: var(--bg-hover);
      border-radius: 6px;

      .el-icon {
        color: var(--color-primary);
      }
    }

    .tip-actions {
      display: flex;
      gap: 6px;

      .tip-btn {
        width: 34px;
        height: 34px;
        padding: 0;
        border: 1px solid transparent;
        border-radius: 8px;
        background: transparent;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          transform: translateY(-2px);
        }

        &:active {
          transform: translateY(0);
        }

        &.edit {
          color: #409eff;
          &:hover {
            background: rgba(64, 158, 255, 0.1);
            border-color: rgba(64, 158, 255, 0.2);
          }
        }

        &.start {
          color: #67c23a;
          &:hover {
            background: rgba(103, 194, 58, 0.1);
            border-color: rgba(103, 194, 58, 0.2);
          }
        }

        &.stop {
          color: #e6a23c;
          &:hover {
            background: rgba(230, 162, 60, 0.1);
            border-color: rgba(230, 162, 60, 0.2);
          }
        }

        &.delete {
          color: #f56c6c;
          &:hover {
            background: rgba(245, 108, 108, 0.1);
            border-color: rgba(245, 108, 108, 0.2);
          }
        }

        .el-icon {
          font-size: 16px;
        }
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

.tip-ops-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}

.tip-ops-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: var(--shadow-card);
    transform: translateY(-2px);
  }

  .tip-ops-icon {
    width: 56px;
    height: 56px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(103, 194, 58, 0.1), rgba(133, 206, 97, 0.1));
    display: flex;
    align-items: center;
    justify-content: center;

    .icon-image,
    .icon-emoji {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;

      :deep(.el-image) {
        width: 100%;
        height: 100%;
      }
    }
  }

  .tip-ops-info {
    text-align: center;

    .tip-ops-label {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .tip-ops-value {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
  }

  .tip-ops-actions {
    display: flex;
    gap: 6px;

    .ops-btn {
      width: 32px;
      height: 32px;
      padding: 0;
      border: 1px solid transparent;
      border-radius: 8px;
      background: transparent;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      justify-content: center;

      &:hover {
        transform: translateY(-2px);
      }

      &:active {
        transform: translateY(0);
      }

      &.edit {
        color: #409eff;
        &:hover {
          background: rgba(64, 158, 255, 0.1);
          border-color: rgba(64, 158, 255, 0.2);
        }
      }

      &.delete {
        color: #f56c6c;
        &:hover {
          background: rgba(245, 108, 108, 0.1);
          border-color: rgba(245, 108, 108, 0.2);
        }
      }

      .el-icon {
        font-size: 14px;
      }
    }
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

    .icon-input-wrap {
      width: 100%;
    }

    .icon-preview {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 8px;
      padding-top: 12px;
      border-top: 1px solid var(--border-subtle);

      .preview-label {
        font-size: 13px;
        color: var(--text-secondary);
      }

      .preview-image,
      .preview-emoji {
        width: 48px;
        height: 48px;
        border-radius: 8px;
        background: var(--bg-hover);
        display: flex;
        align-items: center;
        justify-content: center;

        :deep(.el-image) {
          width: 100%;
          height: 100%;
        }
      }
    }
  }
}
</style>