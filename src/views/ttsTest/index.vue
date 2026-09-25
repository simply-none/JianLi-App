<template>
  <div class="tts-page">
    <!-- 头部：标题 + 状态摘要 -->
    <div class="page-head">
      <div class="head-titles">
        <h2>语音朗读</h2>
        <p>选择语音提供商并预览效果，配置将作为其他页面朗读的默认设置</p>
      </div>
      <div class="status-chips">
        <span class="chip" :class="systemAvailable ? 'ok' : 'bad'">
          <i class="dot" />系统 TTS {{ systemAvailable ? '可用' : '不可用' }}
        </span>
        <span class="chip" :class="webAvailable ? 'ok' : 'bad'">
          <i class="dot" />Web API {{ webAvailable ? '可用' : '不可用' }}
        </span>
        <span class="chip" :class="kokoroAvailable ? 'ok' : 'miss'">
          <i class="dot" />Kokoro {{ kokoroAvailable ? '已安装' : '未安装' }}
        </span>
        <span class="chip" :class="vitsAvailable ? 'ok' : 'miss'">
          <i class="dot" />中文 VITS {{ vitsAvailable ? '已安装' : '未安装' }}
        </span>
      </div>
    </div>

    <div class="content">
      <!-- 左侧：设置面板 -->
      <aside class="settings">
        <!-- 语音提供商 -->
        <section class="card">
          <h3>语音提供商</h3>
          <div class="provider-list">
            <button
              class="provider"
              :class="{ active: currentProvider === 'system' }"
              @click="switchProvider('system')"
            >
              <LucideIcon name="Cpu" :size="28" class="p-icon" />
              <div class="p-info">
                <span class="p-name">系统 TTS</span>
                <span class="p-desc">调用系统语音合成</span>
              </div>
              <LucideIcon v-if="currentProvider === 'system'" name="Check" :size="18" class="p-check" />
            </button>
            <button
              class="provider"
              :class="{ active: currentProvider === 'web' }"
              @click="switchProvider('web')"
            >
              <LucideIcon name="Globe" :size="28" class="p-icon" />
              <div class="p-info">
                <span class="p-name">Web API</span>
                <span class="p-desc">浏览器 Web Speech API</span>
              </div>
              <LucideIcon v-if="currentProvider === 'web'" name="Check" :size="18" class="p-check" />
            </button>
            <button
              class="provider"
              :class="{ active: currentProvider === 'kokoro' }"
              @click="switchProvider('kokoro')"
            >
              <LucideIcon name="Package" :size="28" class="p-icon" />
              <div class="p-info">
                <span class="p-name">Kokoro 本地模型</span>
                <span class="p-desc">离线高质量合成，需导入模型</span>
              </div>
              <LucideIcon v-if="currentProvider === 'kokoro'" name="Check" :size="18" class="p-check" />
            </button>
            <button
              class="provider"
              :class="{ active: currentProvider === 'piper' }"
              @click="switchProvider('piper')"
            >
              <LucideIcon name="Volume2" :size="28" class="p-icon" />
              <div class="p-info">
                <span class="p-name">Piper 本地模型</span>
                <span class="p-desc">sherpa-onnx VITS，需导入模型</span>
              </div>
              <LucideIcon v-if="currentProvider === 'piper'" name="Check" :size="18" class="p-check" />
            </button>
            <button
              class="provider"
              :class="{ active: currentProvider === 'vits' }"
              @click="switchProvider('vits')"
            >
              <LucideIcon name="Mic" :size="28" class="p-icon" />
              <div class="p-info">
                <span class="p-name">中文 VITS 本地模型</span>
                <span class="p-desc">sherpa VITS，多说话人，需导入模型</span>
              </div>
              <LucideIcon v-if="currentProvider === 'vits'" name="Check" :size="18" class="p-check" />
            </button>
          </div>
        </section>

        <!-- 朗读参数 -->
        <section class="card">
          <h3>朗读参数</h3>
          <div class="field">
            <div class="field-head">
              <label>语速</label>
              <span class="field-val">{{ rate.toFixed(1) }}</span>
            </div>
            <input type="range" v-model.number="rate" min="0.5" max="2" step="0.1" />
          </div>
          <div class="field">
            <label>语音</label>
            <select v-model="selectedVoice" @change="onVoiceSelectChange">
              <option value="">默认</option>
              <option v-for="voice in currentVoices" :key="voice.name" :value="voice.name">
                {{ voice.description || voice.name }}
              </option>
            </select>
          </div>
        </section>

        <!-- 本地语音包 -->
        <section class="card">
          <h3>
            本地语音包（Kokoro）
            <el-popover placement="right" :width="360" trigger="click" popper-class="tts-help-popover">
              <template #reference>
                <span class="help-icon-wrap">
                  <LucideIcon name="CircleHelp" :size="16" color="var(--color-primary)" title="使用帮助" />
                </span>
              </template>
              <div class="help-content">
                <p class="help-title">Kokoro 模型下载与导入</p>
                <ol>
                  <li>从 GitHub 或镜像站下载 <code>hexgrad/kokoro-multi-lang-v1_1</code> 模型包</li>
                  <li>解压到任意目录，保留内部文件结构</li>
                  <li>点击「导入模型目录」选择解压后的根目录即可</li>
                </ol>
              </div>
            </el-popover>
          </h3>
          <div class="model-status">
            <div class="ms-row">
              <span class="ms-label">安装状态</span>
              <span class="ms-val" :class="kokoroAvailable ? 'ok' : 'miss'">
                {{ kokoroAvailable ? '已安装' : '未安装' }}
              </span>
            </div>
            <div class="ms-row col">
              <span class="ms-label">模型目录</span>
              <span class="ms-val dir">{{ kokoroDir || '未导入' }}</span>
            </div>
          </div>
          <div class="model-actions">
            <button class="btn primary sm" @click="chooseModelDir">
              <LucideIcon name="FolderOpen" :size="16" /><span>导入模型目录</span>
            </button>
            <button class="btn ghost sm" @click="refreshKokoro">
              <LucideIcon name="RefreshCw" :size="16" /><span>刷新状态</span>
            </button>
          </div>
          <p class="model-hint">从 GitHub 下载 kokoro-multi-lang-v1_1 模型包并解压，然后导入解压目录</p>
        </section>

        <!-- 本地语音包 -->
        <section class="card">
          <h3>
            本地语音包（Piper 模型库）
            <el-popover placement="right" :width="380" trigger="click" popper-class="tts-help-popover">
              <template #reference>
                <span class="help-icon-wrap">
                  <LucideIcon name="CircleHelp" :size="16" color="var(--color-primary)" title="使用帮助" />
                </span>
              </template>
              <div class="help-content">
                <p class="help-title">Piper 模型下载与导入</p>
                <ol>
                  <li>下载 Piper 模型，如 <code>csukuangfj/vits-piper-zh_CN-huayan-medium</code>（onnx + tokens.txt）</li>
                  <li>把每个 Piper 模型单独放到「模型库目录」的一个子文件夹里</li>
                  <li>若模型目录内没有 <code>espeak-ng-data</code>，程序会自动复用 Kokoro 目录</li>
                  <li>点击「选择模型库目录」选择库根目录</li>
                </ol>
              </div>
            </el-popover>
          </h3>
          <div class="model-status">
            <div class="ms-row">
              <span class="ms-label">安装状态</span>
              <span class="ms-val" :class="piperAvailable ? 'ok' : 'miss'">
                {{ piperAvailable ? '已安装' : '未安装' }}
              </span>
            </div>
            <div class="ms-row">
              <span class="ms-label">已识别模型</span>
              <span class="ms-val">{{ piperModelCount }} 个</span>
            </div>
            <div class="ms-row col">
              <span class="ms-label">模型库目录</span>
              <span class="ms-val dir">{{ piperDir || '未导入' }}</span>
            </div>
          </div>
          <div class="model-actions">
            <button class="btn primary sm" @click="choosePiperModelDir">
              <LucideIcon name="FolderOpen" :size="16" /><span>选择模型库目录</span>
            </button>
            <button class="btn ghost sm" @click="refreshPiper">
              <LucideIcon name="RefreshCw" :size="16" /><span>刷新状态</span>
            </button>
          </div>
          <p class="model-hint">把每个 Piper 模型解压到「模型库目录」的子文件夹（每个子文件夹一个模型），程序自动扫描并聚合所有音色；默认库目录为 userData/tts-models/piper。espeak-ng-data 优先用模型自带，否则复用 Kokoro 目录。</p>
        </section>

        <!-- 本地语音包 -->
        <section class="card">
          <h3>
            本地语音包（中文 VITS 模型库）
            <el-popover placement="right" :width="380" trigger="click" popper-class="tts-help-popover">
              <template #reference>
                <span class="help-icon-wrap">
                  <LucideIcon name="CircleHelp" :size="16" color="var(--color-primary)" title="使用帮助" />
                </span>
              </template>
              <div class="help-content">
                <p class="help-title">中文 VITS 模型下载与导入</p>
                <ol>
                  <li>下载 sherpa-onnx VITS 中文模型，如 <code>csukuangfj/vits-zh-hf-theresa</code>、<code>vits-zh-hf-fanchen-C</code>、<code>vits-melo-tts-zh_en</code> 等</li>
                  <li>每个模型放一个子文件夹，内含 <code>*.onnx</code> + <code>tokens.txt</code>（可选 <code>lexicon.txt</code>）</li>
                  <li>点击「选择模型库目录」选择库根目录，导入时会自动探测说话人数（首次较慢）</li>
                </ol>
              </div>
            </el-popover>
          </h3>
          <div class="model-status">
            <div class="ms-row">
              <span class="ms-label">安装状态</span>
              <span class="ms-val" :class="vitsAvailable ? 'ok' : 'miss'">
                {{ vitsAvailable ? '已安装' : '未安装' }}
              </span>
            </div>
            <div class="ms-row">
              <span class="ms-label">已识别模型</span>
              <span class="ms-val">{{ vitsModelCount }} 个</span>
            </div>
            <div class="ms-row">
              <span class="ms-label">说话人总数</span>
              <span class="ms-val">{{ vitsSpeakerCount }} 个</span>
            </div>
            <div class="ms-row col">
              <span class="ms-label">模型库目录</span>
              <span class="ms-val dir">{{ vitsDir || '未导入' }}</span>
            </div>
          </div>
          <div class="model-actions">
            <button class="btn primary sm" @click="chooseVitsModelDir">
              <LucideIcon name="FolderOpen" :size="16" /><span>选择模型库目录</span>
            </button>
            <button class="btn ghost sm" @click="refreshVits">
              <LucideIcon name="RefreshCw" :size="16" /><span>刷新状态</span>
            </button>
          </div>
          <p class="model-hint">把 VITS 模型（&lt;model&gt;.onnx + tokens.txt，可选 lexicon.txt）直接放进「模型库目录」或其子文件夹，程序自动扫描聚合。导入时会逐个加载模型探测说话人数（首次较慢）。默认库目录为 userData/tts-models/vits。VITS 不依赖 espeak-ng-data。</p>
        </section>
      </aside>

      <!-- 右侧：预览面板 -->
      <main class="preview card">
        <h3 class="preview-title">朗读预览</h3>
        <div class="text-box">
          <textarea v-model="textToSpeak" rows="5" placeholder="输入要朗读的文本..." />
        </div>
        <div class="controls">
          <button class="btn primary" :disabled="speaking" @click="speak">
            <LucideIcon v-if="!speaking" name="Play" :size="16" />
            <LucideIcon v-else name="RefreshCw" :size="16" class="spin" />
            <span>{{ speaking ? '朗读中...' : '开始朗读' }}</span>
          </button>
          <button class="btn danger" @click="stopSpeak">
            <LucideIcon name="Pause" :size="16" /><span>停止</span>
          </button>
          <button class="btn ghost" @click="testDefault">
            <LucideIcon name="Headset" :size="16" /><span>A/B 对比测试</span>
          </button>
        </div>

        <hr class="sep" />

        <!-- 可用语音：一行三列自适应网格 -->
        <section class="voices">
          <div class="voices-head">
            <h3>可用语音</h3>
            <span class="voices-count">{{ voicesCountText }}</span>
          </div>
          <div v-if="currentVoiceGroupKeys.length > 1" class="voices-tabs">
            <button
              v-for="key in currentVoiceGroupKeys"
              :key="key"
              class="vtab"
              :class="{ active: currentVoiceGroupKey === key }"
              @click="currentVoiceGroupKey = key"
            >
              {{ key === 'default' ? '全部' : key }} ({{ groupedCurrentVoices[key]?.length }})
            </button>
          </div>

          <div v-if="activeGroupVoices.length === 0" class="empty">
            <LucideIcon name="BellRing" :size="28" />
            <p>{{ emptyStateText }}</p>
          </div>
          <div v-else class="voices-grid">
            <div
              v-for="voice in activeGroupVoices"
              :key="voice.name"
              class="voice-card"
              :class="{ active: selectedVoice === voice.name }"
              @click="selectVoice(voice)"
            >
              <div class="vc-row">
                <div class="vc-avatar"><LucideIcon name="User" :size="18" /></div>
                <div class="vc-info">
                  <div class="vc-name-row">
                    <span class="vc-name">{{ voice.description || voice.name }}</span>
                    <span v-if="voice.gender" class="vc-gender" :class="voice.gender">
                      {{ genderLabel(voice.gender) }}
                    </span>
                  </div>
                  <span class="vc-lang">{{ voice.lang }}<template v-if="voice.default"> · 默认</template></span>
                </div>
                <button class="vc-preview" @click.stop="previewVoice(voice.name)">
                  <LucideIcon name="Play" :size="14" /><span>试听</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElPopover } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { getTTSManager, type TTSProviderType, type VoiceInfo } from '@/utils/tts';
import { getStoreAsync, setStoreAsync } from '@/utils/common';

const ttsManager = getTTSManager({
  defaultProvider: 'system',
  autoFallback: true,
});

const systemAvailable = ref(false);
const webAvailable = ref(false);
const kokoroAvailable = ref(false);
const kokoroDir = ref('');
const piperAvailable = ref(false);
const piperDir = ref('');
const piperModelCount = ref(0);
const vitsAvailable = ref(false);
const vitsDir = ref('');
const vitsModelCount = ref(0);
const vitsSpeakerCount = ref(0);
const currentProvider = ref<TTSProviderType>('system');
const speaking = ref(false);
const textToSpeak = ref('该休息了，保护眼睛');
const rate = ref(1.0);
const selectedVoice = ref('');
const currentVoiceGroupKey = ref<string>('default');
/** 供应商切换同步抑制开关：A/B 对比测试期间内部切换供应商时，避免反复重置选音/重载列表 */
let suppressProviderSync = false;
const systemVoices = ref<VoiceInfo[]>([]);
const webVoices = ref<VoiceInfo[]>([]);
const kokoroVoices = ref<VoiceInfo[]>([]);
const piperVoices = ref<VoiceInfo[]>([]);
const vitsVoices = ref<VoiceInfo[]>([]);

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
    kokoro: 'Kokoro 本地模型',
    piper: 'Piper 本地模型',
    vits: '中文 VITS 本地模型',
  };
  return labels[currentProvider.value];
});

const currentVoices = computed(() => {
  const voicesMap: Record<string, VoiceInfo[]> = {
    system: systemVoices.value,
    web: webVoices.value,
    kokoro: kokoroVoices.value,
    piper: piperVoices.value,
    vits: vitsVoices.value,
  };
  return voicesMap[currentProvider.value] || [];
});

const groupedCurrentVoices = computed(() => {
  const groups: Record<string, VoiceInfo[]> = {};
  for (const voice of currentVoices.value) {
    const key = getVoiceGroupKey(currentProvider.value, voice);
    if (!groups[key]) groups[key] = [];
    groups[key].push(voice);
  }
  return groups;
});

const currentVoiceGroupKeys = computed(() => Object.keys(groupedCurrentVoices.value));

const activeGroupVoices = computed(() => {
  const groups = groupedCurrentVoices.value;
  const key = currentVoiceGroupKey.value;
  if (groups[key]) return groups[key];
  const first = currentVoiceGroupKeys.value[0];
  return first ? groups[first] : [];
});

const emptyStateText = computed(() => {
  const texts: Record<string, string> = {
    system: '暂无系统语音',
    web: '暂无 Web 语音',
    kokoro: '未安装 Kokoro 模型或导入的目录无效',
    piper: '未安装 Piper 模型或导入的目录无效',
    vits: '未安装中文 VITS 模型或导入的目录无效',
  };
  return texts[currentProvider.value] || '暂无语音';
});

const voicesCountText = computed(() => {
  return `${currentProviderLabel.value} · ${currentVoices.value.length} 个`;
});

function genderLabel(g?: 'male' | 'female' | 'neutral'): string {
  if (g === 'male') return '男';
  if (g === 'female') return '女';
  return '中';
}

function getVoiceGroupKey(provider: TTSProviderType, voice: VoiceInfo): string {
  if ((provider === 'vits' || provider === 'piper') && voice.name.includes(':')) {
    const segments = voice.name.split(':');
    if (segments.length >= 3) return segments[1];
  }
  return 'default';
}

function syncVoiceGroupKey() {
  const groups = groupedCurrentVoices.value;
  const keys = Object.keys(groups);
  if (keys.length === 0) {
    currentVoiceGroupKey.value = 'default';
    return;
  }
  if (selectedVoice.value) {
    const target = keys.find((k) => groups[k].some((v) => v.name === selectedVoice.value));
    if (target) {
      currentVoiceGroupKey.value = target;
      return;
    }
  }
  currentVoiceGroupKey.value = keys[0];
}

function onVoiceSelectChange() {
  syncVoiceGroupKey();
}

watch(currentProvider, (newType) => {
  ttsManager.setProvider(newType);
  // A/B 对比测试期间由 testDefault 自行管理 setProvider / 选音，跳过此处副作用
  if (suppressProviderSync) return;
  // 切换到新供应商：选中语音重置为该供应商的「默认」，保证网格高亮与朗读参数下拉同源
  selectedVoice.value = '';
  syncVoiceGroupKey();
  const labels: Record<TTSProviderType, string> = {
    system: '系统 TTS',
    web: 'Web API',
    kokoro: 'Kokoro 本地模型',
    piper: 'Piper 本地模型',
    vits: '中文 VITS 本地模型',
  };
  addLog(`切换到 ${labels[newType]}`, 'info');
  loadVoices();
});

// 选中语音变化时持久化（网格点击 selectVoice 与朗读参数下拉 v-model 都会经过这里）
watch(selectedVoice, (val) => {
  setStoreAsync('tts_voice', val);
});

async function checkAvailability() {
  try {
    const availability = await ttsManager.checkAvailability();
    systemAvailable.value = availability.system;
    webAvailable.value = availability.web;
    kokoroAvailable.value = availability.kokoro;
    piperAvailable.value = availability.piper;
    vitsAvailable.value = availability.vits;
    addLog(`系统 TTS: ${availability.system ? '可用' : '不可用'}`, availability.system ? 'success' : 'error');
    addLog(`Web API: ${availability.web ? '可用' : '不可用'}`, availability.web ? 'success' : 'error');
    addLog(`Kokoro 本地模型: ${availability.kokoro ? '可用' : '未安装'}`, availability.kokoro ? 'success' : 'warn');
    addLog(`Piper 本地模型: ${availability.piper ? '可用' : '未安装'}`, availability.piper ? 'success' : 'warn');
    addLog(`中文 VITS 本地模型: ${availability.vits ? '可用' : '未安装'}`, availability.vits ? 'success' : 'warn');
  } catch (err) {
    addLog(`检测失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

async function loadVoices() {
  try {
    const allVoices = await ttsManager.getAllVoices();
    systemVoices.value = allVoices.system;
    webVoices.value = allVoices.web;
    kokoroVoices.value = allVoices.kokoro;
    piperVoices.value = allVoices.piper;
    vitsVoices.value = allVoices.vits;
    addLog(`加载语音: 系统 ${systemVoices.value.length}, Web ${webVoices.value.length}, Kokoro ${kokoroVoices.value.length}, Piper ${piperVoices.value.length}, VITS ${vitsVoices.value.length}`, 'info');
    syncVoiceGroupKey();
  } catch (err) {
    addLog(`加载语音失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

function switchProvider(type: TTSProviderType) {
  currentProvider.value = type;
  // 持久化供应商，下次打开直接还原
  setStoreAsync('tts_provider', type);
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

  const providers: TTSProviderType[] = ['system', 'web', 'kokoro', 'piper', 'vits'];
  const availableProviders = providers.filter((p) => {
    switch (p) {
      case 'system':
        return systemAvailable.value;
      case 'web':
        return webAvailable.value;
      case 'kokoro':
        return kokoroAvailable.value;
      case 'piper':
        return piperAvailable.value;
      case 'vits':
        return vitsAvailable.value;
    }
  });

  if (availableProviders.length === 0) {
    addLog('没有可用的 TTS 提供商', 'error');
    return;
  }

  addLog(`将在 ${availableProviders.length} 个提供商间进行 A/B 对比测试`, 'info');

  const savedProvider = currentProvider.value;
  const savedVoice = selectedVoice.value;
  // 抑制供应商切换的副作用（重置选音/重载列表），由本函数自行管理
  suppressProviderSync = true;

  try {
    for (const provider of availableProviders) {
      const labels: Record<TTSProviderType, string> = {
        system: '系统 TTS',
        web: 'Web API',
        kokoro: 'Kokoro 本地模型',
        piper: 'Piper 本地模型',
        vits: '中文 VITS 本地模型',
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
  } finally {
    ttsManager.setProvider(savedProvider);
    currentProvider.value = savedProvider;
    selectedVoice.value = savedVoice;
    suppressProviderSync = false;
    addLog('\n===== A/B 对比测试完成 =====', 'success');
  }
}

/** 从 voice 名前缀推断所属供应商（vits:/piper:/kokoro:），用于预览时临时切换 */
function providerOfVoice(name: string): TTSProviderType | null {
  if (name.startsWith('kokoro:')) return 'kokoro';
  if (name.startsWith('piper:')) return 'piper';
  if (name.startsWith('vits:')) return 'vits';
  return null;
}

async function previewVoice(voiceName: string) {
  addLog(`预览语音: ${voiceName}`, 'info');
  const p = providerOfVoice(voiceName);
  const prevProvider = currentProvider.value;
  if (p && p !== prevProvider) {
    ttsManager.setProvider(p);
  }
  try {
    await ttsManager.speak(textToSpeak.value.trim() || '这是一段语音预览', { voice: voiceName, rate: 1.0 });
    addLog('预览完成', 'success');
  } catch (err) {
    addLog(`预览失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  } finally {
    if (p && p !== prevProvider) {
      ttsManager.setProvider(prevProvider);
    }
  }
}

function selectVoice(voice: VoiceInfo) {
  selectedVoice.value = voice.name;
  previewVoice(voice.name);
}

/** 刷新 Kokoro 模型状态（读取渲染端持久化的目录 + 主进程校验文件） */
async function refreshKokoro() {
  try {
    const savedDir = await getStoreAsync('tts_kokoro_model_dir');
    const status = await window.ipcRenderer.tts.kokoro.status(typeof savedDir === 'string' && savedDir ? savedDir : undefined);
    kokoroAvailable.value = status.installed;
    kokoroDir.value = status.dir || '';
  } catch (err) {
    addLog(`刷新 Kokoro 状态失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

/** 导入模型目录：主进程弹目录选择框并校验必需文件，成功后持久化到 store 并刷新缓存/列表 */
async function chooseModelDir() {
  try {
    const res = await window.ipcRenderer.tts.kokoro.chooseModelDir();
    if (res.canceled) return;
    if (!res.success || !res.dir) {
      addLog(res.error || '导入模型目录失败', 'error');
      return;
    }
    await setStoreAsync('tts_kokoro_model_dir', res.dir);
    ttsManager.invalidateKokoroModelDirCache();
    addLog(`已导入模型目录: ${res.dir}`, 'success');
    await refreshKokoro();
    await loadVoices();
  } catch (err) {
    addLog(`导入模型目录失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

/** 刷新 Piper 模型状态（读取渲染端持久化的目录 + 主进程校验文件） */
async function refreshPiper() {
  try {
    const savedDir = await getStoreAsync('tts_piper_model_dir');
    const status = await window.ipcRenderer.tts.piper.status(typeof savedDir === 'string' && savedDir ? savedDir : undefined);
    piperAvailable.value = status.installed;
    piperDir.value = status.dir || '';
    piperModelCount.value = status.modelCount || 0;
  } catch (err) {
    addLog(`刷新 Piper 状态失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

/** 导入 Piper 模型目录：主进程弹目录选择框并校验模型文件，成功后持久化到 store 并刷新缓存/列表 */
async function choosePiperModelDir() {
  try {
    const res = await window.ipcRenderer.tts.piper.chooseModelDir();
    if (res.canceled) return;
    if (!res.success || !res.dir) {
      addLog(res.error || '导入 Piper 模型目录失败', 'error');
      ElMessage.error(res.error || '导入 Piper 模型目录失败');
      return;
    }
    await setStoreAsync('tts_piper_model_dir', res.dir);
    ttsManager.invalidatePiperModelDirCache();
    addLog(`已导入 Piper 模型目录: ${res.dir}`, 'success');
    ElMessage.success('已导入 Piper 模型目录');
    await refreshPiper();
    await loadVoices();
  } catch (err) {
    const msg = `导入 Piper 模型目录失败: ${err instanceof Error ? err.message : String(err)}`;
    addLog(msg, 'error');
    ElMessage.error(msg);
  }
}

/** 刷新中文 VITS 模型状态（读取渲染端持久化的目录 + 主进程校验文件 + 说话人数缓存） */
async function refreshVits() {
  try {
    const savedDir = await getStoreAsync('tts_vits_model_dir');
    const status = await window.ipcRenderer.tts.vits.status(typeof savedDir === 'string' && savedDir ? savedDir : undefined);
    vitsAvailable.value = status.installed;
    vitsDir.value = status.dir || '';
    vitsModelCount.value = status.modelCount || 0;
    vitsSpeakerCount.value = status.speakerCount || 0;
  } catch (err) {
    addLog(`刷新中文 VITS 状态失败: ${err instanceof Error ? err.message : String(err)}`, 'error');
  }
}

/** 导入 VITS 模型目录：主进程弹目录选择框、校验模型文件并探测说话人数，成功后持久化并刷新缓存/列表 */
async function chooseVitsModelDir() {
  try {
    const res = await window.ipcRenderer.tts.vits.chooseModelDir();
    if (res.canceled) return;
    if (!res.success || !res.dir) {
      addLog(res.error || '导入中文 VITS 模型目录失败', 'error');
      ElMessage.error(res.error || '导入中文 VITS 模型目录失败');
      return;
    }
    await setStoreAsync('tts_vits_model_dir', res.dir);
    ttsManager.invalidateVitsModelDirCache();
    addLog(`已导入中文 VITS 模型目录: ${res.dir}（${res.modelCount ?? 0} 个模型 / ${res.speakerCount ?? 0} 个说话人）`, 'success');
    ElMessage.success(`已导入中文 VITS 模型目录（${res.modelCount ?? 0} 个模型 / ${res.speakerCount ?? 0} 个说话人）`);
    await refreshVits();
    await loadVoices();
  } catch (err) {
    const msg = `导入中文 VITS 模型目录失败: ${err instanceof Error ? err.message : String(err)}`;
    addLog(msg, 'error');
    ElMessage.error(msg);
  }
}

onMounted(async () => {
  addLog('语音朗读页面已加载', 'info');
  addLog('初始化 TTS 管理器...', 'info');

  await ttsManager.initialize();
  addLog(`当前默认提供商: ${ttsManager.getProviderType()}`, 'info');

  // 恢复上次保存的供应商（无效值 / 首次使用则回退到管理器默认）
  const savedProvider = await getStoreAsync('tts_provider');
  const initialProvider: TTSProviderType =
    savedProvider === 'system' || savedProvider === 'web' || savedProvider === 'kokoro' || savedProvider === 'piper' || savedProvider === 'vits'
      ? savedProvider
      : ttsManager.getProviderType();

  // 抑制切换副作用：还原阶段不触发「清空选音 / 重复加载列表」
  suppressProviderSync = true;
  currentProvider.value = initialProvider;
  ttsManager.setProvider(initialProvider);
  await checkAvailability();
  await refreshKokoro();
  await refreshPiper();
  await refreshVits();
  await loadVoices();
  suppressProviderSync = false;

  // 恢复上次保存的语音（仅当该语音确实属于当前供应商，避免跨供应商串音）
  const savedVoice = await getStoreAsync('tts_voice');
  if (typeof savedVoice === 'string' && savedVoice) {
    const belongs = [systemVoices.value, webVoices.value, kokoroVoices.value, piperVoices.value, vitsVoices.value].some((arr) =>
      arr.some((v) => v.name === savedVoice),
    );
    if (belongs) {
      selectedVoice.value = savedVoice;
      syncVoiceGroupKey();
    }
  }
});
</script>

<style scoped lang="scss">
.tts-page {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 24px;
  box-sizing: border-box;
  overflow: auto;
  padding-bottom: 8px;
}

.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;

  .head-titles {
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

  .status-chips {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary);

    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--color-success, #22c55e);
    }
    &.bad .dot { background: var(--color-danger, #ef4444); }
    &.miss .dot { background: var(--color-warning, #f59e0b); }
  }
}

.content {
  display: flex;
  gap: 24px;
  flex: 1;
  min-height: 0;
}

.settings {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
  overflow-y: auto;
  padding-right: 4px;
}

.card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  padding: 24px;

  h3 {
    margin: 0 0 16px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

/* 提供商卡片单选 */
.provider-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.provider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 14px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s;

  .p-icon {
    flex-shrink: 0;
    color: var(--text-muted);
  }
  .p-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
  }
  .p-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }
  .p-desc {
    font-size: 12px;
    color: var(--text-muted);
  }
  .p-check {
    flex-shrink: 0;
    color: var(--color-primary);
  }

  &:hover {
    border-color: var(--color-primary);
  }
  &.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    .p-icon { color: var(--color-primary-solid); }
  }
}

/* 参数 */
.field {
  margin-bottom: 16px;
  &:last-child { margin-bottom: 0; }

  label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }
  .field-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .field-val {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-primary);
  }
  input[type='range'] {
    width: 100%;
    accent-color: var(--color-primary);
  }
  select {
    width: 100%;
    margin-top: 8px;
    padding: 8px 10px;
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

/* 本地模型 */
.model-status {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 14px;
  margin-bottom: 12px;
}
.ms-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  font-size: 12px;
  &.col { flex-direction: column; align-items: flex-start; gap: 4px; }
  .ms-label { color: var(--text-muted); flex-shrink: 0; }
  .ms-val {
    color: var(--text-primary);
    font-weight: 600;
    &.ok { color: var(--color-success, #22c55e); }
    &.miss { color: var(--color-warning, #f59e0b); }
    &.dir { font-weight: 400; font-size: 11px; word-break: break-all; }
  }
}
.model-actions {
  display: flex;
  gap: 8px;
}
.model-hint {
  margin: 12px 0 0;
  font-size: 11px;
  line-height: 1.6;
  color: var(--text-muted);
}

/* 按钮 */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  border: none;
  border-radius: var(--radius-btn);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  &.sm { padding: 8px 12px; flex: 1; }
  &.primary {
    background: var(--color-primary);
    color: #fff;
    &:hover:not(:disabled) { background: var(--color-primary-hover); }
    &:disabled { opacity: 0.6; cursor: not-allowed; }
  }
  &.danger {
    background: var(--color-danger, #ef4444);
    color: #fff;
    &:hover { background: #dc2626; }
  }
  &.ghost {
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    &:hover { border-color: var(--color-primary); color: var(--text-primary); }
  }
}

/* 右侧预览 */
.preview {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-y: auto;

  .preview-title {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}
.text-box {
  textarea {
    width: 100%;
    height: 140px;
    resize: vertical;
    padding: 12px 14px;
    background: var(--bg-base);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    color: var(--text-primary);
    font-size: 14px;
    font-family: inherit;
    line-height: 22px;
    outline: none;
    box-sizing: border-box;
    &:focus { border-color: var(--color-primary); }
  }
}
.controls {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.sep {
  border: none;
  border-top: 1px solid var(--border-subtle);
  margin: 0;
}

/* 可用语音网格 */
.voices {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .voices-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    h3 { margin: 0; font-size: 14px; font-weight: 600; color: var(--text-primary); }
  }
  .voices-count {
    font-size: 12px;
    color: var(--text-muted);
  }
}
.voices-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.vtab {
  padding: 6px 14px;
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover { border-color: var(--color-primary); }
  &.active {
    background: var(--color-primary-light);
    border-color: var(--color-primary);
    color: var(--color-primary-solid);
    font-weight: 600;
  }
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px;
  color: var(--text-muted);
  svg { opacity: 0.5; }
  p { margin: 0; font-size: 13px; }
}
.voices-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.voice-card {
  background: var(--bg-base);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 14px;
  cursor: pointer;
  transition: all 0.2s;
  &:hover {
    border-color: var(--color-primary);
    background: var(--bg-hover);
  }
  &.active {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }

  .vc-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .vc-avatar {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-card);
    color: var(--text-muted);
  }
  .vc-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .vc-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .vc-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .vc-gender {
    font-size: 10px;
    flex-shrink: 0;
    &.male { color: #3b82f6; }
    &.female { color: #ec4899; }
    &.neutral { color: #9ca3af; }
  }
  .vc-lang {
    font-size: 11px;
    color: var(--text-muted);
  }
  .vc-preview {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: 8px;
    color: var(--text-secondary);
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s;
    &:hover {
      border-color: var(--color-primary);
      color: var(--color-primary-solid);
      background: var(--color-primary-light);
    }
  }
}

.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.help-icon-wrap {
  display: inline-flex;
  vertical-align: middle;
  margin-left: 6px;
  cursor: pointer;
}

.help-content {
  font-size: 13px;
  line-height: 1.6;
  .help-title {
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-primary);
  }
  ol {
    padding-left: 16px;
    margin: 0;
  }
  li {
    margin-bottom: 6px;
  }
  code {
    background: rgba(0, 0, 0, 0.06);
    padding: 1px 4px;
    border-radius: 3px;
    font-size: 12px;
  }
}
</style>
