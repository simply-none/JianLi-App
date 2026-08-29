<template>
  <!-- 单个主页模式选项卡片（原子组件）：
       参考 demo 的卡片结构，去图片改渐变背景；
       首行固定"选项"（card__category），次行模式选项名称（card__heading）。
       竖版比例 + 大字 + 大圆角，还原 demo 的卡片观感。 -->
  <div
    class="mode-option-card"
    :class="{ 'is-active': active }"
    :style="{ '--card-gradient': gradient }"
    :title="label"
    role="button"
    tabindex="0"
    @click="$emit('select')"
    @keydown.enter="$emit('select')"
  >
    <!-- 渐变背景层（替代 demo 的 background-image） -->
    <div class="mode-option-card__bg"></div>

    <!-- 底部暗化蒙层：保证亮色渐变上白字可读（demo 用 brightness(0.75) 同理） -->
    <div class="mode-option-card__scrim"></div>

    <!-- 选中态角标 -->
    <div v-if="active" class="mode-option-card__badge">
      <LucideIcon name="Check" :size="16" />
    </div>

    <!-- 文字内容：首行固定"选项" + 次行模式名 -->
    <div class="mode-option-card__content">
      <p class="mode-option-card__category">选项</p>
      <h3 class="mode-option-card__heading">{{ label }}</h3>
    </div>
  </div>
</template>

<script setup lang="ts">
import LucideIcon from '@/components/LucideIcon.vue';

// 原子组件：单个模式选项卡片
// label   - 模式选项名称（第二行大字）
// active  - 是否当前选中
// gradient- 卡片渐变背景（CSS background 值），由父级按选项序号分配
defineProps<{
  label: string;
  active?: boolean;
  gradient?: string;
}>();

// 点击/回车选中
defineEmits<{ (e: 'select'): void }>();
</script>

<style scoped lang="scss">
.mode-option-card {
  position: relative;
  // 竖版卡片比例（对应 demo 的 padding-bottom:150% → 高:宽 = 1.5）
  width: 100%;
  aspect-ratio: 2 / 3;
  height: 200px;
  border-radius: 18px;
  overflow: hidden;
  cursor: pointer;
  user-select: none;
  border: 2px solid transparent;
  transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;

  // 渐变背景层
  .mode-option-card__bg {
    position: absolute;
    inset: 0;
    background-image: var(--card-gradient, linear-gradient(135deg, var(--color-primary), var(--el-color-primary-dark-2)));
    background-size: cover;
    background-position: center;
    transform-origin: center;
    transition: transform 0.25s ease, filter 0.25s ease;
  }

  // 底部暗化蒙层（提升白字对比度）
  .mode-option-card__scrim {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 60%;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0) 100%);
    pointer-events: none;
    z-index: 1;
  }

  // hover：轻微放大 + 提亮（沿用 demo 的 scale / filter 思路）
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.25);

    .mode-option-card__bg {
      transform: scale(1.06);
      filter: brightness(1.1) saturate(1.15);
    }
  }

  // 选中态：主色描边 + 光晕
  &.is-active {
    border-color: var(--color-primary, #409eff);
    box-shadow: 0 10px 26px rgba(64, 158, 255, 0.4);
  }

  // 选中角标（右上角打勾）
  .mode-option-card__badge {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: var(--color-primary, #409eff);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
    z-index: 3;
  }

  // 文字内容：底部左对齐（缩略图观感，对应 demo 的 card__content）
  .mode-option-card__content {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 18px 20px;
    z-index: 2;
  }

  .mode-option-card__category {
    margin: 0 0 8px;
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.82);
    letter-spacing: 2px;
    text-transform: uppercase;
  }

  .mode-option-card__heading {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
    color: #fff;
    line-height: 1.25;
    text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
    word-break: break-word;
  }
}
</style>
