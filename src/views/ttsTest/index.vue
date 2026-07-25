<template>
  <div class="tts-test-page">
    <div class="page-header">
      <h2>TTS 语音合成测试</h2>
      <p>测试系统 TTS 和 Web Speech API 两种方案</p>
    </div>

    <div class="status-section">
      <div class="status-cards">
        <div class="status-card" :class="{ 'is-available': systemAvailable, 'is-unavailable': !systemAvailable }">
          <div class="status-header">
            <LucideIcon name="Cpu" :size="20" />
            <span>系统 TTS</span>
          </div>
          <div class="status-value">{{ systemAvailable ? '可用' : '不可用' }}</div>
        </div>
        <div class="status-card" :class="{ 'is-available': webAvailable, 'is-unavailable': !webAvailable }">
          <div class="status-header">
            <LucideIcon name="Globe" :size="20" />
            <span>Web API</span>
          </div>
          <div class="status-value">{{ webAvailable ? '可用' : '不可用' }}</div>
        </div>
        <div class="status-card current-provider">
          <div class="status-header">
            <LucideIcon name="Zap" :size="20" />
            <span>当前使用</span>
          </div>
          <div class="status-value">{{ currentProviderLabel }}</div>
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3>提供商切换</h3>
      <div class="provider-switch">
        <button class="provider-btn" :class="{ 'is-active': currentProvider === 'system' }" @click="switchProvider('system')">
          <LucideIcon name="Cpu" :size="16" />
          <span>系统 TTS</span>
        </button>
        <button class="provider-btn" :class="{ 'is-active': currentProvider === 'web' }" @click="switchProvider('web')">
          <LucideIcon name="Globe" :size="16" />
          <span>Web API</span>
        </button>
      </div>
    </div>

    <div class="speak-section">
      <h3>文本朗读</h3>
      <div class="input-group">
        <textarea v-model="textToSpeak" placeholder="输入要朗读的文本..." rows="3" />
      </div>
      <div class="options-row">
        <div class="option-item">
          <label>语速: {{ rate.toFixed(1) }}</label>
          <input type="range" v-model.number="rate" min="0.5" max="2" step="0.1" />
        </div>
        <div class="option-item">
          <label>语音:</label>
          <select v-model="selectedVoice">
            <option value="">默认</option>
            <option v-for="voice in currentVoices" :key="voice.name" :value="voice.name">
              {{ voice.description || voice.name }}
            </option>
          </select>
        </div>
      </div>
      <div class="button-group">
        <button class="btn btn-primary" :disabled="speaking" @click="speak">
          <LucideIcon v-if="!speaking" name="Play" :size="16" />
          <LucideIcon v-else name="RefreshCcw" :size="16" class="spin" />
          <span>{{ speaking ? '朗读中...' : '开始朗读' }}</span>
        </button>
        <button class="btn btn-danger" @click="stopSpeak">
          <LucideIcon name="Pause" :size="16" />
          <span>停止</span>
        </button>
        <button class="btn btn-secondary" @click="testDefault">
          <LucideIcon name="Headset" :size="16" />
          <span>A/B 对比测试</span>
        </button>
      </div>
    </div>

    <div class="voices-section">
      <h3>可用语音列表</h3>
      <div class="voices-tabs">
        <button class="tab-btn" :class="{ 'is-active': activeTab === 'system' }" @click="activeTab = 'system'">
          系统 ({{ systemVoices.length }})
        </button>
        <button class="tab-btn" :class="{ 'is-active': activeTab === 'web' }" @click="activeTab = 'web'">
          Web ({{ webVoices.length }})
        </button>
      </div>
      <div class="voices-list">
        <div v-if="currentVoices.length === 0" class="empty-state">
          <LucideIcon name="BellRing" :size="32" />
          <p>{{ emptyStateText }}</p>
        </div>
        <div v-else class="voice-items">
          <div v-for="voice in currentVoices" :key="voice.name" class="voice-item" @click="previewVoice(voice.name)">
            <LucideIcon name="User" :size="16" />
            <span class="voice-name">{{ voice.description || voice.name }}</span>
            <span v-if="voice.gender" class="voice-gender" :class="voice.gender">{{ voice.gender === 'male' ? '♂' : '♀' }}</span>
            <span class="voice-lang">{{ voice.lang }}</span>
            <span v-if="voice.default" class="default-tag">默认</span>
          </div>
        </div>
      </div>
    </div>

    <div class="logs-section">
      <h3>操作日志</h3>
      <div class="logs-container">
        <div v-if="logs.length === 0" class="empty-state">
          <LucideIcon name="FileText" :size="24" />
          <p>暂无日志</p>
        </div>
        <div v-else class="log-items">
          <div v-for="(log, index) in logs" :key="index" class="log-item" :class="log.type">
            <span class="log-time">{{ log.time }}</span>
            <div class="log-content">
              <span class="log-message">{{ log.message }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import { getTTSManager, type TTSProviderType, type VoiceInfo } from '@/utils/tts';

const ttsManager = getTTSManager({
  defaultProvider: 'system',
  autoFallback: true,
});

const systemAvailable = ref(false);
const webAvailable = ref(false);
const currentProvider = ref<TTSProviderType>('system');
const speaking = ref(false);
const textToSpeak = ref('该休息了，保护眼睛');
const rate = ref(1.0);
const selectedVoice = ref('');
const activeTab = ref<'system' | 'web'>('system');
const systemVoices = ref<VoiceInfo[]>([]);
const webVoices = ref<VoiceInfo[]>([]);

interface LogEntry {
  type: 'info' | 'success' | 'error' | 'warn';
  time: string;
  message: string;
}
const logs = ref<LogEntry[]>([]);

function addLog(message: string, type: LogEntry['type'] = 'info') {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
  logs.value.unshift({ type, time, message });
  if (logs.value.length > 50) {
    logs.value.pop();
  }
}

const currentProviderLabel = computed(() => {
  const labels: Record<TTSProviderType, string> = {
    system: '系统 TTS',
    web: 'Web API',
  };
  return labels[currentProvider.value];
});

const currentVoices = computed(() => {
  const voicesMap: Record<string, VoiceInfo[]> = {
    system: systemVoices.value,
    web: webVoices.value,
  };
  return voicesMap[activeTab.value] || [];
});

const emptyStateText = computed(() => {
  const texts: Record<string, string> = {
    system: '暂无系统语音',
    web: '暂无 Web 语音',
  };
  return texts[activeTab.value] || '暂无语音';
});

watch(currentProvider, (newType) => {
  ttsManager.setProvider(newType);
  selectedVoice.value = '';
  const labels: Record<TTSProviderType, string> = {
    system: '系统 TTS',
    web: 'Web API',
  };
  addLog(`切换到 ${labels[newType]}`, 'info');
  loadVoices();
});

async function checkAvailability() {
  try {
    const availability = await ttsManager.checkAvailability();
    systemAvailable.value = availability.system;
    webAvailable.value = availability.web;
    addLog(`系统 TTS: ${availability.system ? '可用' : '不可用'}`, availability.system ? 'success' : 'error');
    addLog(`Web API: ${availability.web ? '可用' : '不可用'}`, availability.web ? 'success' : 'error');
  } catch (err) {
    addLog(`检测失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

async function loadVoices() {
  try {
    const allVoices = await ttsManager.getAllVoices();
    systemVoices.value = allVoices.system;
    webVoices.value = allVoices.web;
    addLog(`加载语音: 系统 ${systemVoices.value.length}, Web ${webVoices.value.length}`, 'info');
  } catch (err) {
    addLog(`加载语音失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

function switchProvider(type: TTSProviderType) {
  currentProvider.value = type;
}

async function speak() {
  if (!textToSpeak.value.trim()) {
    addLog('请输入要朗读的文本', 'error');
    return;
  }

  speaking.value = true;
  addLog(`[${currentProviderLabel.value}] 开始朗读: "${textToSpeak.value.substring(0, 20)}${textToSpeak.value.length > 20 ? '...' : ''}"`, 'info');

  try {
    await ttsManager.speak(textToSpeak.value, {
      rate: rate.value,
      voice: selectedVoice.value || undefined,
    });
    addLog('朗读完成', 'success');
  } catch (err) {
    addLog(`朗读失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  } finally {
    speaking.value = false;
  }
}

function stopSpeak() {
  ttsManager.stop();
  speaking.value = false;
  addLog('停止朗读', 'info');
}

async function testDefault() {
  const testTexts = ['你好，这是一段测试语音。', '该休息了，看看远方的绿色植物吧。', '工作顺利，身体健康！'];
  
  // A/B 对比：在所有可用的 Provider 间切换
  const providers: TTSProviderType[] = ['system', 'web'];
  const availableProviders = providers.filter(p => {
    switch (p) {
      case 'system': return systemAvailable.value;
      case 'web': return webAvailable.value;
    }
  });

  if (availableProviders.length === 0) {
    addLog('没有可用的 TTS 提供商', 'error');
    return;
  }

  addLog(`将在 ${availableProviders.length} 个提供商间进行 A/B 对比测试`, 'info');
  
  const savedProvider = currentProvider.value;
  
  for (const provider of availableProviders) {
    const labels: Record<TTSProviderType, string> = {
      system: '系统 TTS',
      web: 'Web API',
    };
    
    addLog(`\n===== 测试 ${labels[provider]} =====`, 'info');
    ttsManager.setProvider(provider);
    currentProvider.value = provider;
    
    for (const text of testTexts) {
      addLog(`  朗读: "${text}"`, 'info');
      try {
        await ttsManager.speak(text, { rate: 1.0 });
        addLog(`  ✓ 完成`, 'success');
      } catch (err) {
        addLog(`  ✗ 失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
        break;
      }
    }
  }

  // 恢复原来的 Provider
  ttsManager.setProvider(savedProvider);
  currentProvider.value = savedProvider;
  addLog('\n===== A/B 对比测试完成 =====', 'success');
}

async function previewVoice(voiceName: string) {
  addLog(`预览语音: ${voiceName}`, 'info');
  try {
    await ttsManager.speak('这是一段语音预览', { voice: voiceName, rate: 1.0 });
    addLog('预览完成', 'success');
  } catch (err) {
    addLog(`预览失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

onMounted(async () => {
  addLog('TTS 测试页面已加载', 'info');
  addLog('初始化 TTS 管理器...', 'info');

  await ttsManager.initialize();
  addLog(`当前默认提供商: ${ttsManager.getProviderType()}`, 'info');

  currentProvider.value = ttsManager.getProviderType();
  await checkAvailability();
  await loadVoices();
});
</script>

<style scoped lang="scss">
.tts-test-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-sizing: border-box;
  overflow: auto;
}

.page-header {
  h2 {
    margin: 0;
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
  }
  p {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--text-muted);
  }
}

.status-section {
  .status-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }
  .status-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    transition: all 0.3s;

    &.is-available {
      border-color: var(--color-success, #22c55e);
      .status-value { color: var(--color-success, #22c55e); }
    }
    &.is-unavailable {
      opacity: 0.6;
      .status-value { color: var(--color-danger, #ef4444); }
    }
    &.current-provider {
      border-color: var(--color-primary);
      .status-value { color: var(--color-primary); }
    }

    .status-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--text-secondary);
      font-size: 13px;
      font-weight: 500;
    }
    .status-value {
      font-size: 18px;
      font-weight: 700;
    }
  }
}

.config-section,
.speak-section,
.voices-section,
.logs-section {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 16px;

  h3 {
    margin: 0 0 12px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border-subtle);
  }
}

.provider-switch {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.provider-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: var(--bg-base);
  border: 2px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(.is-disabled) {
    border-color: var(--color-primary);
    color: var(--text-primary);
  }
  &.is-active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
  }
  &.is-disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.input-group {
  margin-bottom: 12px;
  textarea {
    width: 100%;
    resize: vertical;
    padding: 10px 12px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;

    &:focus {
      border-color: var(--color-primary);
    }
  }
}

.options-row {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);

  input[type="range"] {
    width: 120px;
    accent-color: var(--color-primary);
  }
  select {
    padding: 6px 10px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-btn);
    color: var(--text-primary);
    font-size: 13px;
    outline: none;
    cursor: pointer;

    &:focus { border-color: var(--color-primary); }
  }
}

.button-group {
  display: flex;
  gap: 10px;
}
.btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-btn);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &.btn-primary {
    background: var(--color-primary);
    color: white;
    &:hover:not(:disabled) {
      background: var(--color-primary-hover);
    }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }
  &.btn-danger {
    background: var(--color-danger, #ef4444);
    color: white;
    &:hover { background: #dc2626; }
  }
  &.btn-secondary {
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    &:hover { border-color: var(--color-primary); color: var(--text-primary); }
  }
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.voices-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.tab-btn {
  padding: 6px 14px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover { border-color: var(--color-primary); }
  &.is-active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary-solid);
  }
}

.voices-list {
  max-height: 200px;
  overflow-y: auto;
}
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--text-muted);

  svg { opacity: 0.5; }
  p { margin: 0; font-size: 13px; }
}

.voice-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.voice-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: var(--color-primary);
    background: var(--bg-hover);
  }

  .voice-name {
    flex: 1;
    font-size: 13px;
    color: var(--text-primary);
  }
  .voice-gender {
    font-size: 14px;
    &.male { color: #3b82f6; }
    &.female { color: #ec4899; }
  }
  .voice-lang {
    font-size: 12px;
    color: var(--text-muted);
  }
  .default-tag {
    font-size: 11px;
    padding: 2px 6px;
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
    border-radius: 4px;
  }
}

.logs-container {
  max-height: 240px;
  overflow-y: auto;
}
.log-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.log-item {
  display: flex;
  gap: 8px;
  padding: 8px 10px;
  background: var(--bg-base);
  border-radius: var(--radius-btn);
  font-size: 12px;

  .log-time {
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .log-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .log-message {
    flex: 1;
    word-break: break-all;
    white-space: pre-wrap;
  }

  &.info .log-message { color: var(--text-secondary); }
  &.success .log-message { color: var(--color-success, #22c55e); }
  &.error .log-message { color: var(--color-danger, #ef4444); }
  &.warn .log-message { color: var(--color-warning, #f59e0b); }
}
</style>
