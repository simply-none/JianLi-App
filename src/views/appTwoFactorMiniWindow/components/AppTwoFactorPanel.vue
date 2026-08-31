<!--
  2FA 验证测试面板（小窗内主体交互）。
  用途：端到端验证渐离App 的 2FA 功能（TOTP 引擎 + 二维码导出 + 保险库）。
  流程：① 注册本机 2FA（生成密钥+二维码）→ ② 打开 2FA 页面看动态码 → ③ 手输码校验。

  小窗通用约定（踩过的坑，别改回去）：
  1. 顶部栏用纯 CSS -webkit-app-region: drag 拖拽；栏内 button / input 必须显式 no-drag。
  2. 不做 blur 自动关闭（透明窗边缘点击会穿透导致误关）。
  3. Esc 监听挂 document，不能挂局部元素。
-->
<template>
  <div class="a2f-panel">
    <header class="a2f-panel__header">
      <div class="a2f-panel__title">
        <LucideIcon name="KeyRound" :size="16" />
        <span>2FA 验证测试</span>
      </div>
      <button class="a2f-panel__close" title="关闭 (Esc)" @click="close">×</button>
    </header>

    <div class="a2f-panel__body">
      <section class="a2f-block">
        <div class="a2f-step">① 注册本机 2FA</div>
        <p class="a2f-hint">
          生成本应用专属密钥并弹出二维码；用手机验证器扫码即完成真实二步验证注册。
        </p>
        <button class="a2f-btn" :disabled="enrolling" @click="enroll">
          {{ enrolling ? '注册中…' : (store.appEnrolled ? '重新生成二维码' : '注册并生成二维码') }}
        </button>
      </section>

      <section class="a2f-block">
        <div class="a2f-step">② 取动态码</div>
        <p class="a2f-hint">
          点击下方按钮聚焦 2FA 页面，复制「渐离App·本机」的 6 位动态码。
        </p>
        <button class="a2f-btn a2f-btn--ghost" @click="openPage">打开 2FA 页面看动态码</button>
      </section>

      <section class="a2f-block">
        <div class="a2f-step">③ 校验动态码</div>
        <input
          v-model="code"
          class="a2f-input"
          type="text"
          inputmode="numeric"
          maxlength="6"
          placeholder="输入 6 位动态码"
          @keyup.enter="verify"
        />
        <button class="a2f-btn a2f-btn--primary" :disabled="!code || verifying" @click="verify">
          {{ verifying ? '校验中…' : '验证' }}
        </button>
        <p v-if="result" class="a2f-result" :class="resultOk ? 'is-ok' : 'is-err'">{{ result }}</p>
      </section>
    </div>

    <footer class="a2f-panel__footer">Esc 关闭 · 顶部可拖动 · 输错码会验证失败，说明是真计算</footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import useTwoFactor from '@/store/useTwoFactor';
import { twoFactorApi } from '@/views/twoFactor/api/twoFactorApi';
import { showQrCode } from '@/components/qrcode/service';

const store = useTwoFactor();
const code = ref('');
const result = ref('');
const resultOk = ref(false);
const enrolling = ref(false);
const verifying = ref(false);

onMounted(() => {
  store.refreshAppStatus();
  document.addEventListener('keydown', onKeydown);
});
onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown));

/** Esc 关闭：必须挂 document，挂局部元素会在失焦后失效 */
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close();
}

function close() {
  // 小窗是 isSecondWindow 独立渲染进程，直接发 hide-new-window 最稳（hide 复用窗口）
  window.ipcRenderer?.send('hide-new-window', 'appTwoFactorMiniWindow');
}

async function enroll() {
  enrolling.value = true;
  result.value = '';
  try {
    const uri = await store.enrollApp();
    if (uri) {
      showQrCode({ content: uri, title: '渐离App 本机 2FA' });
      ElMessage.success('已注册，二维码已弹出（手机扫码 / 或去 2FA 页面看码）');
    } else {
      ElMessage.error(store.error || '注册失败');
    }
  } finally {
    enrolling.value = false;
  }
}

async function openPage() {
  await twoFactorApi.openTwoFactorPage();
}

async function verify() {
  if (!code.value) return;
  verifying.value = true;
  result.value = '';
  try {
    const ok = await store.verifyApp(code.value);
    resultOk.value = ok;
    result.value = ok ? '✓ 验证成功：动态码正确' : store.error || '验证失败';
    if (ok) {
      ElMessage.success('验证成功');
      code.value = '';
    } else {
      ElMessage.error(store.error || '验证失败');
    }
  } finally {
    verifying.value = false;
  }
}
</script>

<style scoped lang="scss">
.a2f-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  -webkit-user-select: none;
  user-select: none;
}

.a2f-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-subtle);
  -webkit-app-region: drag;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }
}

.a2f-panel__title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.a2f-panel__close {
  flex: none;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  -webkit-app-region: no-drag;

  &:hover {
    background: var(--bg-hover);
    color: var(--color-error);
  }
}

.a2f-panel__body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.a2f-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  background: var(--bg-base);
}

.a2f-step {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.a2f-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--text-muted);
}

.a2f-input {
  width: 100%;
  box-sizing: border-box;
  padding: 9px 10px;
  font-size: 15px;
  letter-spacing: 3px;
  text-align: center;
  color: var(--text-primary);
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  outline: none;
  -webkit-app-region: no-drag;

  &:focus {
    border-color: var(--color-primary);
  }
}

.a2f-btn {
  padding: 9px 12px;
  font-size: 13px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn, 8px);
  background: var(--bg-card);
  color: var(--text-secondary);
  cursor: pointer;
  -webkit-app-region: no-drag;
  transition: all 0.15s;

  &:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  &--ghost {
    background: transparent;
  }

  &--primary {
    color: #fff;
    background: var(--color-primary);
    border-color: var(--color-primary);

    &:hover:not(:disabled) {
      color: #fff;
      filter: brightness(1.05);
    }
  }
}

.a2f-result {
  margin: 0;
  font-size: 12px;
  text-align: center;

  &.is-ok {
    color: var(--color-success, #16a34a);
  }

  &.is-err {
    color: var(--color-error, #e11d48);
  }
}

.a2f-panel__footer {
  padding: 6px 12px;
  border-top: 1px solid var(--border-subtle);
  font-size: 11px;
  color: var(--text-muted);
  -webkit-app-region: drag;
}
</style>
