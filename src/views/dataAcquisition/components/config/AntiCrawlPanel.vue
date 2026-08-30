<template>
  <div class="anti-crawl-panel">
    <div class="panel-title">反爬与登录</div>
    <el-form label-width="92px" size="small">
      <el-form-item label="登录档案">
        <el-select
          v-model="anti.loginProfile"
          clearable
          placeholder="选择已保存的登录态（可选）"
          class="full-width"
        >
          <el-option v-for="p in profiles" :key="p.name" :label="`${p.name}（${p.cookieCount} Cookie）`" :value="p.name" />
        </el-select>
      </el-form-item>
      <el-form-item label="登录管理">
        <div class="login-row">
          <el-input v-model="loginProfileName" class="login-name" placeholder="新档案名" size="small" />
          <el-input v-model="loginUrl" class="login-url" placeholder="登录页 URL" size="small" />
          <el-button size="small" :loading="loginLoading" @click="startLogin">打开登录窗口</el-button>
        </div>
        <div v-if="loginPending" class="login-pending">
          已打开有头浏览器窗口，请在窗口中完成登录后点击「保存登录态」
          <div class="login-actions">
            <el-button size="small" type="primary" @click="finishLogin">保存登录态</el-button>
            <el-button size="small" @click="cancelLogin">取消</el-button>
          </div>
        </div>
      </el-form-item>
      <el-form-item label="屏蔽资源">
        <el-checkbox-group v-model="blockList">
          <el-checkbox value="image">图片</el-checkbox>
          <el-checkbox value="font">字体</el-checkbox>
          <el-checkbox value="media">媒体</el-checkbox>
          <el-checkbox value="stylesheet">样式</el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="页间延时(ms)">
        <div class="delay-row">
          <el-input-number v-model="delayMin" :min="0" :max="60000" :step="100" controls-position="right" />
          <span class="delay-sep">~</span>
          <el-input-number v-model="delayMax" :min="0" :max="60000" :step="100" controls-position="right" />
        </div>
      </el-form-item>
      <el-form-item label="自定义UA">
        <el-input
          v-model="anti.userAgent"
          placeholder="留空使用全局默认 User-Agent"
          title="自定义 User-Agent，可伪装移动端"
        />
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
/**
 * 反爬与登录面板
 * ------------------------------------------------------------------
 * 配置反爬选项（资源屏蔽提速、页间随机延时、自定义 UA），
 * 以及登录态管理：打开有头浏览器窗口手动登录 → 保存 Cookie 档案 →
 * 任务运行时自动注入，支持需要登录/验证码的页面采集。
 */
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import type { AntiCrawlConfig } from '../../types'

/** 组件属性（引用透传，原地修改） */
const props = defineProps<{
  /** 反爬配置对象 */
  anti: AntiCrawlConfig;
}>()

/** 已保存的登录档案列表 */
const profiles = ref<{ name: string; cookieCount: number; savedAt: string }[]>([])
/** 新档案名输入 */
const loginProfileName = ref('')
/** 登录页 URL 输入 */
const loginUrl = ref('')
/** 登录会话进行中标记 */
const loginPending = ref(false)
/** 登录操作 loading */
const loginLoading = ref(false)

/** 屏蔽资源复选框绑定（与 anti.blockResources 双向同步） */
const blockList = computed({
  get: () => props.anti.blockResources || [],
  set: (val: string[]) => {
    props.anti.blockResources = val
  },
})

/** 页间延时下限绑定 */
const delayMin = computed({
  get: () => props.anti.delayMs?.[0] ?? 0,
  set: (val: number) => {
    props.anti.delayMs = [val, props.anti.delayMs?.[1] ?? val]
  },
})

/** 页间延时上限绑定 */
const delayMax = computed({
  get: () => props.anti.delayMs?.[1] ?? 0,
  set: (val: number) => {
    props.anti.delayMs = [props.anti.delayMs?.[0] ?? 0, val]
  },
})

/**
 * 刷新登录档案列表
 */
async function refreshProfiles(): Promise<void> {
  const res = await window.ipcRenderer.scraper.loginList()
  profiles.value = res?.data || []
}

/**
 * 打开有头登录窗口（真实浏览器，用户手动完成登录/验证码）
 */
async function startLogin(): Promise<void> {
  if (!loginProfileName.value.trim()) {
    ElMessage.warning('请先填写档案名')
    return
  }
  if (!loginUrl.value.trim()) {
    ElMessage.warning('请先填写登录页 URL')
    return
  }
  loginLoading.value = true
  try {
    const res = await window.ipcRenderer.scraper.loginStart(loginProfileName.value.trim(), loginUrl.value.trim())
    if (res?.success) {
      loginPending.value = true
    } else {
      ElMessage.error(res?.error || '打开登录窗口失败')
    }
  } finally {
    loginLoading.value = false
  }
}

/**
 * 保存登录态：读取会话 Cookie 存入档案并关闭有头窗口
 */
async function finishLogin(): Promise<void> {
  const res = await window.ipcRenderer.scraper.loginFinish(loginProfileName.value.trim())
  if (res?.success) {
    ElMessage.success(`登录态已保存（${res.cookieCount} 条 Cookie）`)
    loginPending.value = false
    loginProfileName.value = ''
    loginUrl.value = ''
    await refreshProfiles()
  } else {
    ElMessage.error(res?.error || '保存登录态失败')
  }
}

/**
 * 取消登录会话（不保存 Cookie）
 */
async function cancelLogin(): Promise<void> {
  await window.ipcRenderer.scraper.loginCancel()
  loginPending.value = false
}

onMounted(refreshProfiles)
</script>

<style scoped>
.anti-crawl-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-title {
  font-weight: 600;
  font-size: 13px;
}
.full-width {
  width: 100%;
}
.login-row {
  display: flex;
  gap: 6px;
  width: 100%;
}
.login-name {
  width: 130px;
}
.login-url {
  flex: 1;
}
.login-pending {
  width: 100%;
  margin-top: 6px;
  font-size: 12px;
  color: var(--el-color-warning);
}
.login-actions {
  margin-top: 4px;
  display: flex;
  gap: 8px;
}
.delay-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.delay-sep {
  color: var(--el-text-color-secondary);
}
</style>
