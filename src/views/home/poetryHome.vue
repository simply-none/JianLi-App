<template>
  <div class="poetry-home" @click="fetchPoem">
    <!-- 背景层：水墨山水氛围（颜色占位，后续可替换为真实图片） -->
    <div class="bg-layer">
      <!-- 远山剪影 - 用 CSS 渐变模拟 -->
      <div class="mountain mountain--far"></div>
      <div class="mountain mountain--mid"></div>
      <div class="mountain mountain--near"></div>
      <!-- 月亮 -->
      <div class="moon"></div>
      <!-- 雾气层 -->
      <div class="mist"></div>
    </div>

    <!-- 内容区 -->
    <div class="content">
      <!-- 固定头部：今日精选标签 + 标题 + 副标题 -->
      <div class="poem-header">
        <!-- 今日精选标签 -->
        <div class="tag">
          <span class="tag-icon">◆</span>
          <span class="tag-text">今日精选</span>
        </div>

        <!-- 标题：词牌名·诗词名 -->
        <h1 class="title" v-if="poemData">{{ displayTitle }}</h1>

        <!-- 副标题：[朝代] 作者 · 题注 -->
        <p class="subtitle" v-if="poemData">{{ displaySubtitle }}</p>
      </div>

      <!-- 可滚动诗词内容区（过长时滚动，首尾固定） -->
      <div class="poem-scroll">
        <!-- 诗词正文 -->
        <div class="poem-body" v-if="poemData && !isAuthorType">
          <p
            class="poem-line"
            v-for="(line, idx) in displayLines"
            :key="idx"
            :style="{ animationDelay: `${0.6 + idx * 0.15}s` }"
          >{{ line }}</p>
        </div>

        <!-- 词人小传模式（ciauthor 数据） -->
        <div class="author-bio" v-if="poemData && isAuthorType">
          <p
            class="bio-line"
            v-for="(para, idx) in bioParagraphs"
            :key="idx"
          >{{ para }}</p>
        </div>
      </div>

      <!-- 固定底部提示 -->
      <div class="hint">点击屏幕换一首</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

/** 诗词数据类型 */
interface CiPoem {
  rhythmic?: string   // 词牌名
  author?: string     // 作者
  paragraphs?: string[] // 诗句段落
}

interface CiAuthor {
  name?: string       // 词人姓名
  description?: string // 简介/小传
  long_desc?: string  // 长描述
}

type PoemData = CiPoem | CiAuthor | null

const poemData = ref<PoemData>(null)
const loading = ref(false)

/** 是否为词人小传类型（ ciauthor 表） */
const isAuthorType = computed(() => {
  if (!poemData.value) return false
  return !!(poemData.value as CiAuthor).name && !(poemData.value as CiPoem).rhythmic
})

/** 显示标题：ci 表用「词牌·首句」，ciauthor 表用「姓名」 */
const displayTitle = computed(() => {
  if (!poemData.value) return ''
  if (isAuthorType.value) {
    return (poemData.value as CiAuthor).name || ''
  }
  const p = poemData.value as CiPoem
  // 用词牌名 + 第一句前几字作标题
  const firstLine = p.paragraphs?.[0] || ''
  const shortFirst = firstLine.length > 6 ? firstLine.slice(0, 6) + '…' : firstLine
  return p.rhythmic ? `${p.rhythmic}` : shortFirst
})

/** 显示副标题：ci 表用「[朝代] 作者」，ciauthor 表用「词人小传」 */
const displaySubtitle = computed(() => {
  if (!poemData.value) return ''
  if (isAuthorType.value) {
    return '词人小传'
  }
  const p = poemData.value as CiPoem
  // poet-data 不返回朝代，只返回 author；这里用作者名
  return p.author || ''
})

/** 诗词正文行：将 paragraphs 拆成单行 */
const displayLines = computed(() => {
  if (!poemData.value || isAuthorType.value) return []
  const p = poemData.value as CiPoem
  if (!p.paragraphs) return []
  // 每个段落内部按换行或逗号/句号拆分
  const lines: string[] = []
  for (const para of p.paragraphs) {
    // 段落中可能包含 \n 或天然就是一行
    // 如果包含 >> ，则不继续处理
    if (para.includes('>>')) {
      break;
    }
    const parts = para.split(/\n/)
    for (const part of parts) {
      const trimmed = part.trim()
      if (trimmed) lines.push(trimmed)
    }
  }
  return lines
})

/** 词人小传段落 */
const bioParagraphs = computed(() => {
  if (!poemData.value || !isAuthorType.value) return []
  const a = poemData.value as CiAuthor
  const text = a.long_desc || a.description || ''
  return text.split(/\n/).filter((s: string) => s.trim())
})

/** 获取诗词数据 */
function fetchPoem() {
  if (loading.value) return
  loading.value = true
  try {
    // 使用 IPC 同步获取诗词数据（与 poet.vue 一致）
    let data = window.ipcRenderer?.sendSync?.('poet-data')
    poemData.value = data || null
  } catch (e) {
    console.error('获取诗词数据失败', e)
    poemData.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchPoem()
})
</script>

<style lang="scss" scoped>
/* ========== 整体容器 ========== */
.poetry-home {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", serif;
}

/* ========== 背景层：水墨山水氛围 ========== */
.bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  background: linear-gradient(
    180deg,
    #2c2f33 0%,
    #3a3d42 25%,
    #4a4d52 50%,
    #5a5d62 75%,
    #6a6d72 100%
  );
}

/* 月亮 */
.moon {
  position: absolute;
  top: 8%;
  right: 22%;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle at 40% 40%, rgba(230, 225, 210, 0.9), rgba(200, 195, 180, 0.4));
  box-shadow:
    0 0 60px 20px rgba(220, 215, 200, 0.15),
    0 0 120px 40px rgba(200, 195, 180, 0.08);
  filter: blur(1px);
}

/* 远山 - 三层，由远及近 */
.mountain {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center bottom;
}

.mountain--far {
  height: 45%;
  background: linear-gradient(175deg,
    transparent 40%,
    rgba(80, 82, 88, 0.35) 55%,
    rgba(70, 72, 78, 0.5) 70%,
    transparent 85%
  );
  clip-path: polygon(
    0% 100%, 5% 65%, 12% 72%, 20% 55%, 28% 63%, 36% 48%,
    44% 58%, 52% 42%, 60% 54%, 68% 38%, 76% 52%, 84% 45%,
    92% 58%, 98% 50%, 100% 100%
  );
  opacity: 0.5;
}

.mountain--mid {
  height: 38%;
  background: linear-gradient(172deg,
    transparent 45%,
    rgba(55, 57, 62, 0.5) 60%,
    rgba(45, 47, 52, 0.65) 75%,
    transparent 90%
  );
  clip-path: polygon(
    0% 100%, 8% 70%, 15% 58%, 24% 68%, 32% 52%, 42% 64%,
    50% 48%, 58% 60%, 66% 44%, 74% 56%, 82% 42%, 90% 54%,
    96% 48%, 100% 100%
  );
  opacity: 0.65;
}

.mountain--near {
  height: 28%;
  background: linear-gradient(168deg,
    transparent 50%,
    rgba(35, 37, 42, 0.6) 65%,
    rgba(28, 30, 35, 0.8) 80%,
    transparent 95%
  );
  clip-path: polygon(
    0% 100%, 10% 75%, 18% 62%, 28% 72%, 38% 55%, 48% 68%,
    58% 50%, 68% 64%, 78% 48%, 86% 60%, 94% 52%, 100% 100%
  );
  opacity: 0.8;
}

/* 雾气层 */
.mist {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 30%;
  background: linear-gradient(to top, rgba(180, 175, 165, 0.12), transparent);
  filter: blur(20px);
}

/* ========== 内容区 ========== */
.content {
  position: relative;
  z-index: 1;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  padding: 60px 80px;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow: hidden;
  animation: contentFadeIn 1s ease-out both;
}

/* 固定头部：今日精选 + 标题 + 副标题 */
.poem-header {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 可滚动诗词内容区（首尾固定，过长滚动） */
.poem-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 8px;
  scrollbar-width: thin;
  scrollbar-color: rgba(200, 195, 185, 0.25) transparent;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(200, 195, 185, 0.25);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(200, 195, 185, 0.45);
  }
}

@keyframes contentFadeIn {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ---------- 今日精选标签 ---------- */
.tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: flex-start;
  padding: 4px 12px 4px 8px;
  border: 1px solid rgba(180, 120, 110, 0.5);
  border-radius: 14px;
  font-size: 13px;
  color: rgba(200, 140, 130, 0.9);
  background: rgba(180, 120, 110, 0.08);
  backdrop-filter: blur(4px);
  animation: tagSlideIn 0.6s ease-out 0.2s both;

  .tag-icon {
    color: #c06050;
    font-size: 10px;
  }

  .tag-text {
    letter-spacing: 1px;
  }
}

@keyframes tagSlideIn {
  from { opacity: 0; transform: translateX(-12px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ---------- 标题 ---------- */
.title {
  margin: 8px 0 0;
  font-size: 42px;
  font-weight: 600;
  color: rgba(245, 242, 235, 0.92);
  letter-spacing: 3px;
  line-height: 1.35;
  animation: titleReveal 0.8s ease-out 0.35s both;
}

@keyframes titleReveal {
  from { opacity: 0; transform: translateY(20px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ---------- 副标题 ---------- */
.subtitle {
  margin: 0;
  font-size: 15px;
  color: rgba(180, 175, 168, 0.7);
  letter-spacing: 1.5px;
  animation: subtitleReveal 0.7s ease-out 0.5s both;
}

@keyframes subtitleReveal {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ---------- 诗词正文 ---------- */
.poem-body {
  display: flex;
  flex-direction: column;
  gap: 18px;
  margin-top: 12px;
}

.poem-line {
  margin: 0;
  font-size: 19px;
  color: rgba(235, 232, 225, 0.85);
  line-height: 1.85;
  letter-spacing: 2px;
  animation: lineFadeIn 0.7s ease-out both;
}

@keyframes lineFadeIn {
  from { opacity: 0; transform: translateX(-16px); }
  to   { opacity: 1; transform: translateX(0); }
}

/* ---------- 词人小传 ---------- */
.author-bio {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 8px;

  .bio-line {
    margin: 0;
    font-size: 17px;
    color: rgba(225, 222, 215, 0.8);
    line-height: 1.9;
    letter-spacing: 1.2px;
    text-indent: 2em;
    animation: lineFadeIn 0.7s ease-out both;
  }
}

/* ---------- 提示文字（固定底部） ---------- */
.hint {
  flex-shrink: 0;
  margin-top: 0;
  padding-top: 24px;
  font-size: 12px;
  color: rgba(160, 155, 148, 0.4);
  letter-spacing: 2px;
  animation: hintFade 1s ease-out 2s both;
}

@keyframes hintFade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
</style>
