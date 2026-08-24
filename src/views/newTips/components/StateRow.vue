<template>
  <div class="state-card" :class="state.sequential === 0 ? 'is-nonseq' : 'is-seq'">
    <div class="state-seq-badge">{{ index + 1 }}</div>
    <div class="state-card-body">
      <div class="state-card-row state-row-head">
        <el-input v-model="state.label" placeholder="状态名（例：工作、休息）" class="state-label-input" />
        <el-tooltip v-if="isBuiltin" content="系统内置状态不可删除" placement="top">
          <el-button size="small" circle plain type="info" disabled class="state-del-btn" title="系统内置状态不可删除">
            <LucideIcon name="Lock" :size="14" />
          </el-button>
        </el-tooltip>
        <el-button v-else size="small" circle plain type="danger" @click="$emit('remove')" class="state-del-btn" title="删除该状态">
          <LucideIcon name="Trash" :size="14" />
        </el-button>
      </div>
      <div class="state-card-row state-row-duration">
        <span class="state-row-label">时长</span>
        <el-input-number v-model="state.duration" :min="0" :max="9999" controls-position="right" class="state-duration" />
        <el-select v-model="state.unit" class="state-unit">
          <el-option v-for="u in unitOptions" :key="u.value" :label="u.label" :value="u.value" />
        </el-select>
        <span v-if="Number(state.duration) === 0" class="state-permanent-tag">永久</span>
      </div>
      <div class="state-card-row state-row-toggles">
        <div class="state-toggle-item">
          <span class="state-row-text" :class="{ 'is-on': state.lockScreen === 1 }">锁屏</span>
          <el-switch v-model="state.lockScreen" :active-value="1" :inactive-value="0" class="state-switch" />
        </div>
        <div class="state-toggle-item">
          <span class="state-row-text" :class="state.sequential === 0 ? 'is-on-nonseq' : 'is-on-seq'">{{
            state.sequential === 0 ? '非序列' : '序列'
          }}</span>
          <el-switch v-model="state.sequential" :active-value="1" :inactive-value="0" class="state-switch" />
        </div>
        <div v-if="state.sequential === 0" class="state-toggle-item">
          <span class="state-row-text" :class="state.continueLoop === 0 ? 'is-off-loop' : 'is-on-seq'">结束后{{
            state.continueLoop === 0 ? '开始新循环' : '继续循环'
          }}</span>
          <el-switch v-model="state.continueLoop" :active-value="1" :inactive-value="0" class="state-switch" />
        </div>
      </div>
      <div class="state-card-row state-row-content">
        <span class="state-row-label">提醒内容</span>
        <el-input v-model="state.content" type="textarea" :rows="2" placeholder="该状态进入时展示的提醒内容（可空）" class="state-content-input" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from "@/components/LucideIcon.vue";
import type { TipsState } from "../types";

const props = defineProps<{ state: TipsState; index: number }>();
defineEmits<{ remove: [] }>();

// 系统内置状态 key（番茄钟 work/rest/lock 不可删除，保证核心功能不被破坏）
const BUILTIN_STATE_KEYS = ["work", "rest", "lock"];
const isBuiltin = BUILTIN_STATE_KEYS.includes(props.state.key);

const unitOptions = [
  { label: "秒", value: 1000 },
  { label: "分钟", value: 60 * 1000 },
  { label: "小时", value: 60 * 60 * 1000 },
];
</script>

<style scoped lang="scss">
.state-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 9px;
  border: 1px solid var(--el-border-color-lighter, #ebeef5);
  &.is-seq { background: rgba(64, 158, 255, 0.05); }
  &.is-nonseq { background: rgba(230, 162, 60, 0.07); }
}
.state-seq-badge {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--el-color-primary, #409eff);
  color: #fff;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.state-card-body { flex: 1; display: flex; flex-direction: column; gap: 8px; }
.state-row-head { display: flex; gap: 8px; align-items: center; }
.state-label-input { flex: 1; }
.state-row-duration { display: flex; align-items: center; gap: 8px; }
.state-row-label { font-size: 12px; color: var(--el-text-color-secondary, #909399); }
.state-duration { width: 130px; }
.state-unit { width: 100px; }
.state-permanent-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f56c6c22;
  color: #f56c6c;
}
.state-row-toggles { display: flex; gap: 16px; flex-wrap: wrap; }
.state-toggle-item { display: flex; align-items: center; gap: 6px; }
.state-row-text { font-size: 12px; }
.is-on { color: #f56c6c; }
.is-on-seq { color: #409eff; }
.is-on-nonseq { color: #e6a23c; }
.is-off-loop { color: #909399; }
</style>
