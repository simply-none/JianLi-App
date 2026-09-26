<script setup lang="ts">
/**
 * 写操作确认弹窗（双重确认）：
 * 展示将在事务中执行的真实语句、影响预览，勾选确认后才允许执行。
 */
import { ref } from "vue";
import { AlertTriangle } from "@lucide/vue";

defineProps<{
  open: boolean;
  statements: string[];
  targetTable: string;
  estimatedRows: number | null;
  running: boolean;
}>();

const emit = defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

const checked = ref(false);

</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="wcd-mask" @click.self="emit('cancel')">
      <div class="wcd-dialog">
        <div class="wcd-header">
          <AlertTriangle class="warn-icon" />
          <div>
            <div class="wcd-title">确认执行写操作</div>
            <div class="wcd-subtitle">此操作将在单一事务中修改数据库 · 失败自动回滚（ROLLBACK）</div>
          </div>
        </div>

        <div class="wcd-section-title">将执行（事务内自动包裹）</div>
        <div class="wcd-statements">
          <div v-for="(stmt, i) in statements" :key="i" class="wcd-stmt">
            <span class="stmt-index">{{ i + 1 }}</span>
            <code class="stmt-code">{{ stmt }}</code>
          </div>
        </div>

        <div class="wcd-impact">
          影响表：{{ targetTable || "（未指定）" }} ·
          {{ estimatedRows != null ? `预估写入 ${estimatedRows.toLocaleString("zh-CN")} 行` : "行数未知（建议先探查 SELECT 节点）" }}
        </div>

        <label class="wcd-check">
          <input v-model="checked" type="checkbox" />
          <span>我已了解此操作将修改数据（双重确认）</span>
        </label>

        <div class="wcd-actions">
          <button class="cancel-btn" @click="emit('cancel')">取消</button>
          <button class="confirm-btn" :disabled="!checked || running" @click="emit('confirm')">
            {{ running ? "执行中…" : "确认执行" }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.wcd-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 18vh;
  background: rgba(0, 0, 0, 0.45);
}

.wcd-dialog {
  width: 560px;
  max-width: calc(100vw - 48px);
  max-height: 70vh;
  overflow-y: auto;
  background: var(--bg-card);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.25);
  box-sizing: border-box;
}

.wcd-header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.warn-icon {
  width: 22px;
  height: 22px;
  color: var(--color-warning);
  flex-shrink: 0;
  margin-top: 2px;
}

.wcd-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.wcd-subtitle {
  margin-top: 3px;
  font-size: 12px;
  color: var(--text-secondary);
}

.wcd-section-title {
  margin: 14px 0 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.wcd-statements {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.wcd-stmt {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-hover);
  border-radius: 6px;
}

.stmt-index {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--bg-active-btn);
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 16px;
  text-align: center;
  margin-top: 1px;
}

.stmt-code {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11px;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.wcd-impact {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  background: var(--tag-bg-warning);
  color: var(--color-warning);
  font-size: 12px;
}

.wcd-check {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;

  input {
    accent-color: var(--color-primary);
  }
}

.wcd-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.cancel-btn {
  padding: 7px 18px;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-card);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;

  &:hover {
    background: var(--bg-hover);
  }
}

.confirm-btn {
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  background: var(--color-error);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--color-error);
    filter: brightness(0.92);
  }

  &:disabled {
    opacity: 0.5;
    cursor: default;
  }
}
</style>
