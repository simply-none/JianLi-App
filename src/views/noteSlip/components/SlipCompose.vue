<!--
  小纸条 · 发送区（纯展示原子组件，状态与动作全部来自 useNoteSlip store）
  结构：目标选择（扫描 / 下拉 / 手动 IP）→ 文本输入 → 字数与发送按钮。
-->
<template>
  <div class="slip-compose">
    <!-- 目标 -->
    <div class="slip-compose__row">
      <span class="slip-compose__label">发送到</span>
      <el-select
        v-model="store.selectedIp"
        size="small"
        placeholder="选择设备"
        class="slip-compose__select"
        clearable
      >
        <el-option
          v-for="t in store.targets"
          :key="t.ip"
          :label="`${t.name}（${t.ip}）`"
          :value="t.ip"
        />
      </el-select>
      <el-button size="small" :loading="store.scanning" @click="store.scan()">
        <LucideIcon name="Radar" :size="14" style="margin-right: 4px" />
        扫描
      </el-button>
    </div>

    <div class="slip-compose__row">
      <el-input
        v-model="manualIp"
        size="small"
        placeholder="手动填 IP（模拟器：adb forward 后填 127.0.0.1:47125）"
        @keyup.enter="addManual"
      />
      <el-button size="small" @click="addManual">添加</el-button>
    </div>

    <!-- 输入 -->
    <el-input
      v-model="store.draft"
      type="textarea"
      :rows="5"
      resize="none"
      maxlength="8000"
      placeholder="粘贴或输入文字 / 链接，Ctrl+Enter 发送"
      @keydown.ctrl.enter="onSend"
    />

    <div class="slip-compose__footer">
      <span class="slip-compose__count" :class="{ 'is-over': store.overflow }">
        {{ store.draft.trim().length }} / 8000
      </span>
      <div class="slip-compose__actions">
        <el-button size="small" :disabled="store.sending" @click="onSendClipboard">
          <LucideIcon name="ClipboardCopy" :size="14" style="margin-right: 4px" />
          发剪贴板
        </el-button>
        <el-button
          size="small"
          type="primary"
          :loading="store.sending"
          :disabled="!store.canSend"
          @click="onSend"
        >
          <LucideIcon name="Send" :size="14" style="margin-right: 4px" />
          发送
        </el-button>
      </div>
    </div>

    <p v-if="store.overflow" class="slip-compose__error">内容超过 8000 字上限，请精简后再发。</p>
    <p v-else-if="store.error" class="slip-compose__error">{{ store.error }}</p>
    <p v-else-if="store.okMessage" class="slip-compose__ok">{{ store.okMessage }}</p>
    <p v-else-if="!store.hasTarget" class="slip-compose__hint">
      还没有目标设备：点「扫描」发现局域网里的手机，或手动填 IP。
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { useNoteSlip } from "@/store/useNoteSlip";

const store = useNoteSlip();
const manualIp = ref("");

function addManual() {
  const ip = manualIp.value.trim();
  if (!ip) return;
  store.addManual(ip);
  manualIp.value = "";
}

async function onSend() {
  await store.send();
}

async function onSendClipboard() {
  await store.sendClipboard();
}
</script>

<style scoped lang="scss">
.slip-compose {
  display: flex;
  flex-direction: column;
  gap: 10px;

  &__row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  &__label {
    font-size: 12px;
    opacity: 0.7;
    flex-shrink: 0;
  }

  &__select {
    flex: 1;
    min-width: 0;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  &__count {
    font-size: 11px;
    opacity: 0.55;

    &.is-over {
      color: var(--el-color-danger, #f56c6c);
      opacity: 1;
    }
  }

  &__actions {
    display: flex;
    gap: 8px;
  }

  &__error {
    margin: 0;
    font-size: 12px;
    color: var(--el-color-danger, #f56c6c);
  }

  &__ok {
    margin: 0;
    font-size: 12px;
    color: var(--el-color-success, #67c23a);
  }

  &__hint {
    margin: 0;
    font-size: 12px;
    opacity: 0.55;
  }
}
</style>
