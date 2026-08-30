<template>
  <!-- 应用锁遮罩：锁定时全屏覆盖，毛玻璃模糊防窥，输密码解锁 -->
  <Transition name="lock-fade">
    <div v-if="lockStore.locked" class="app-lock-mask">
      <div class="lock-panel">
        <div class="lock-icon">
          <LucideIcon name="LockKeyhole" :size="42" />
        </div>
        <div class="lock-title">渐离App 已锁定</div>
        <div class="lock-desc">输入密码解锁应用</div>
        <el-input
          ref="pwdInputRef"
          v-model="password"
          type="password"
          placeholder="请输入密码"
          size="large"
          show-password
          :disabled="cooldown > 0"
          class="lock-input"
          @keyup.enter="handleUnlock"
        />
        <div class="lock-error">
          <template v-if="cooldown > 0">
            密码错误次数过多，请 {{ cooldown }} 秒后再试
          </template>
          <template v-else-if="errorText">{{ errorText }}</template>
        </div>
        <el-button
          type="primary"
          class="lock-btn"
          size="large"
          :loading="unlocking"
          :disabled="cooldown > 0 || !password"
          @click="handleUnlock"
        >
          解锁
        </el-button>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import useAppLock from '@/store/useAppLock';

/** 应用锁 store（锁定态由主进程广播驱动） */
const lockStore = useAppLock();

/** 密码输入 */
const password = ref('');
/** 输入框引用（锁定时自动聚焦） */
const pwdInputRef = ref();
/** 是否正在解锁 */
const unlocking = ref(false);
/** 错误提示文本 */
const errorText = ref('');
/** 连续错误计数（达 5 次触发冷却） */
const failCount = ref(0);
/** 冷却倒计时（秒），0 表示无冷却 */
const cooldown = ref(0);
/** 冷却定时器句柄 */
let cooldownTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  lockStore.init();
});

// 锁定态变化：清空输入并自动聚焦（防遗留上一次的密码在输入框中）
watch(
  () => lockStore.locked,
  async (locked) => {
    if (locked) {
      password.value = '';
      errorText.value = '';
      await nextTick();
      pwdInputRef.value?.focus?.();
    }
  }
);

/**
 * 解锁：主进程校验通过即广播解锁；失败累计错误并触发冷却惩罚
 *
 * @returns {Promise<void>}
 */
async function handleUnlock(): Promise<void> {
  if (!password.value || cooldown.value > 0 || unlocking.value) return;
  unlocking.value = true;
  errorText.value = '';
  try {
    const matched = await lockStore.unlock(password.value);
    if (matched) {
      // 成功：清空输入与错误计数
      password.value = '';
      failCount.value = 0;
      errorText.value = '';
    } else {
      failCount.value += 1;
      if (failCount.value >= 5) {
        startCooldown(30);
      } else {
        errorText.value = `密码错误（还剩 ${5 - failCount.value} 次尝试机会）`;
      }
    }
  } catch (err: any) {
    errorText.value = '解锁失败：' + (err?.message || '未知错误');
  } finally {
    unlocking.value = false;
    if (lockStore.locked) pwdInputRef.value?.focus?.();
  }
}

/**
 * 启动冷却倒计时（连续输错 5 次后锁定输入 30 秒，防暴力尝试）
 *
 * @param {number} seconds - 冷却秒数
 * @returns {void}
 */
function startCooldown(seconds: number): void {
  cooldown.value = seconds;
  errorText.value = '';
  if (cooldownTimer) clearInterval(cooldownTimer);
  cooldownTimer = setInterval(() => {
    cooldown.value -= 1;
    if (cooldown.value <= 0) {
      if (cooldownTimer) clearInterval(cooldownTimer);
      cooldownTimer = null;
      failCount.value = 0; // 冷却结束重置错误计数
    }
  }, 1000);
}
</script>

<style scoped lang="scss">
.app-lock-mask {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  // 毛玻璃 + 深色遮罩：完全遮蔽底下的应用内容（防窥）
  background: rgba(15, 18, 25, 0.55);
  backdrop-filter: blur(24px) saturate(120%);
}

.lock-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 320px;
  padding: 36px 32px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.35);
}

.lock-icon {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--color-primary, #409eff), var(--color-primary-light, #79bbff));
  color: #fff;
}

.lock-title {
  font-size: 17px;
  font-weight: 600;
  color: #fff;
}

.lock-desc {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
}

.lock-input {
  width: 100%;
  margin-top: 8px;

  :deep(.el-input__wrapper) {
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25) inset;

    &.is-focus {
      box-shadow: 0 0 0 1px var(--color-primary, #409eff) inset;
    }

    .el-input__inner {
      color: #fff;

      &::placeholder {
        color: rgba(255, 255, 255, 0.45);
      }
    }
  }
}

.lock-error {
  min-height: 18px;
  font-size: 12px;
  color: #ff9a8a;
}

.lock-btn {
  width: 100%;
}

// 锁定遮罩淡入淡出
.lock-fade-enter-active,
.lock-fade-leave-active {
  transition: opacity 0.25s ease;
}

.lock-fade-enter-from,
.lock-fade-leave-to {
  opacity: 0;
}
</style>
