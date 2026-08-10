<template>
  <!-- 选中文本后弹出的浮动工具条：包含划线、颜色选择、类型选择、笔记等功能 -->
  <div
    v-if="visible"
    class="annotation-toolbar"
    :style="{ left: `${x}px`, top: `${y}px` }"
    @click.stop
  >
    <!-- 划线按钮：仅高亮选中文本，不添加笔记 -->
    <div class="toolbar-section">
      <button
        class="toolbar-btn"
        type="button"
        title="划线"
        @click="handleHighlight"
      >
        <LucideIcon name="Pencil" :size="14" />
        <span class="toolbar-label">划线</span>
      </button>

      <!-- 颜色选择器：下拉选择高亮颜色 -->
      <div class="color-picker-wrapper">
        <button
          class="toolbar-btn color-btn"
          type="button"
          :title="`颜色：${getColorLabel(selectedColor)}`"
          @click="toggleColorPanel"
        >
          <span class="color-indicator" :style="{ background: getColorValue(selectedColor) }"></span>
          <LucideIcon name="ChevronDown" :size="12" />
        </button>
        <!-- 颜色选择面板 -->
        <div v-if="showColorPanel" class="color-panel" @click.stop>
          <button
            v-for="color in colors"
            :key="color.name"
            class="color-option"
            :class="{ active: selectedColor === color.name }"
            :title="color.label"
            @click="selectColor(color.name)"
          >
            <span class="color-dot" :style="{ background: color.value }"></span>
          </button>
        </div>
      </div>

      <!-- 划线类型选择器：下拉选择划线样式 -->
      <div class="type-picker-wrapper">
        <button
          class="toolbar-btn type-btn"
          type="button"
          :title="`样式：${getTypeLabel(selectedType)}`"
          @click="toggleTypePanel"
        >
          <span class="type-indicator">{{ getTypeIcon(selectedType) }}</span>
          <LucideIcon name="ChevronDown" :size="12" />
        </button>
        <!-- 类型选择面板 -->
        <div v-if="showTypePanel" class="type-panel" @click.stop>
          <button
            v-for="type in types"
            :key="type.name"
            class="type-option"
            :class="{ active: selectedType === type.name }"
            @click="selectType(type.name)"
          >
            <span class="type-icon">{{ type.icon }}</span>
            <span class="type-label">{{ type.label }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 分隔线 -->
    <span class="toolbar-divider"></span>

    <!-- 笔记按钮：高亮选中文本并添加笔记 -->
    <button
      class="toolbar-btn"
      type="button"
      title="笔记"
      @click="handleNote"
    >
      <LucideIcon name="NotebookPen" :size="14" />
      <span class="toolbar-label">笔记</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';

/** 颜色选项配置 */
const colors = [
  { name: 'yellow', label: '黄色', value: 'rgba(255,235,59,0.4)' },
  { name: 'green', label: '绿色', value: 'rgba(129,199,132,0.4)' },
  { name: 'blue', label: '蓝色', value: 'rgba(100,181,246,0.4)' },
  { name: 'pink', label: '粉色', value: 'rgba(244,143,177,0.4)' },
  { name: 'orange', label: '橙色', value: 'rgba(255,183,77,0.4)' },
  { name: 'purple', label: '紫色', value: 'rgba(186,160,227,0.4)' }
];

/** 划线类型选项配置 */
const types = [
  { name: 'highlight', label: '高亮', icon: '🟨' },
  { name: 'underline', label: '下划线', icon: '📝' },
  { name: 'wavy', label: '波浪线', icon: '〰️' }
];

/** 当前选中的颜色 */
const selectedColor = ref('yellow');
/** 当前选中的划线类型 */
const selectedType = ref('highlight');
/** 颜色面板显示状态 */
const showColorPanel = ref(false);
/** 类型面板显示状态 */
const showTypePanel = ref(false);

/** 组件 Props 定义 */
const props = defineProps<{
  /** 是否显示工具条 */
  visible: boolean;
  /** 工具条定位 x 坐标（相对视口，px） */
  x: number;
  /** 工具条定位 y 坐标（相对视口，px） */
  y: number;
}>();

/** 组件 Emits 定义 */
const emit = defineEmits<{
  /** 点击「划线」按钮：仅高亮选中文本，不添加笔记 */
  (e: 'highlight', payload: { color: string; type: string }): void;
  /** 点击「笔记」按钮：高亮选中文本并添加笔记 */
  (e: 'note', payload: { color: string; type: string }): void;
  /** 关闭工具条（点击外部或按钮后） */
  (e: 'close'): void;
}>();

/**
 * 获取颜色的中文标签
 *
 * @param name - 颜色名称
 * @returns 颜色标签
 */
function getColorLabel(name: string): string {
  return colors.find(c => c.name === name)?.label || name;
}

/**
 * 获取颜色的 CSS 值
 *
 * @param name - 颜色名称
 * @returns CSS 颜色值
 */
function getColorValue(name: string): string {
  return colors.find(c => c.name === name)?.value || colors[0].value;
}

/**
 * 获取划线类型的中文标签
 *
 * @param name - 类型名称
 * @returns 类型标签
 */
function getTypeLabel(name: string): string {
  return types.find(t => t.name === name)?.label || name;
}

/**
 * 获取划线类型的图标
 *
 * @param name - 类型名称
 * @returns 类型图标
 */
function getTypeIcon(name: string): string {
  return types.find(t => t.name === name)?.icon || types[0].icon;
}

/**
 * 切换颜色面板显示状态
 *
 * @returns 无返回值
 */
function toggleColorPanel(): void {
  showColorPanel.value = !showColorPanel.value;
  showTypePanel.value = false;
}

/**
 * 切换类型面板显示状态
 *
 * @returns 无返回值
 */
function toggleTypePanel(): void {
  showTypePanel.value = !showTypePanel.value;
  showColorPanel.value = false;
}

/**
 * 选择颜色
 * 选中后保持颜色子栏展开，便于继续对比/修改；
 * 再次点击颜色触发按钮，或点击工具条外部，即可收起子栏。
 *
 * @param colorName - 颜色名称
 * @returns 无返回值
 */
function selectColor(colorName: string): void {
  selectedColor.value = colorName;
}

/**
 * 选择划线类型
 * 选中后保持样式子栏展开，便于继续对比/修改。
 *
 * @param typeName - 类型名称
 * @returns 无返回值
 */
function selectType(typeName: string): void {
  selectedType.value = typeName;
}

/**
 * 点击「划线」按钮处理
 * 触发 highlight 事件，传递颜色和类型信息，然后关闭工具条
 *
 * @returns 无返回值
 */
function handleHighlight(): void {
  emit('highlight', {
    color: selectedColor.value,
    type: selectedType.value
  });
  emit('close');
  // 重置面板状态
  showColorPanel.value = false;
  showTypePanel.value = false;
}

/**
 * 点击「笔记」按钮处理
 * 触发 note 事件，传递颜色和类型信息，然后关闭工具条
 *
 * @returns 无返回值
 */
function handleNote(): void {
  emit('note', {
    color: selectedColor.value,
    type: selectedType.value
  });
  emit('close');
  // 重置面板状态
  showColorPanel.value = false;
  showTypePanel.value = false;
}

/**
 * document 点击事件处理（捕获阶段）
 * 用于检测工具条外部点击：
 * - 点击发生在工具条内部（含颜色/类型触发按钮及其展开的子面板）时，不关闭工具条，
 *   具体的子栏展开与收起由各按钮自身的 @click 逻辑处理；
 * - 只有真正点击在工具条外部时，才触发 close 关闭整个工具条。
 *
 * 修复说明：此前该回调仅把「子面板区域」视为内部，导致点击颜色/类型触发按钮
 * 被误判为外部点击而直接关闭工具条；现在只要点击落在 .annotation-toolbar 内
 * 就保持工具条可见，从而能正常展开子栏进行颜色/样式修改。
 *
 * @param e - 鼠标事件对象
 * @returns 无返回值
 */
function handleDocumentClick(e: MouseEvent): void {
  // 工具条未显示时不处理，避免无意义的 close 事件
  if (!props.visible) return;

  const target = e.target as HTMLElement;
  // 点击落在工具条内（含触发按钮与展开的子面板）→ 不关闭工具条
  if (target.closest('.annotation-toolbar')) {
    return;
  }

  // 真正点击工具条外部 → 关闭整个工具条及子面板
  emit('close');
  showColorPanel.value = false;
  showTypePanel.value = false;
}

onMounted(() => {
  // 注册 document 点击监听用于检测工具条外部点击（捕获阶段，确保先于冒泡触发）
  document.addEventListener('click', handleDocumentClick, true);
});

onUnmounted(() => {
  // 移除 document 点击监听，防止内存泄漏
  document.removeEventListener('click', handleDocumentClick, true);
});
</script>

<style scoped lang="scss">
/* 浮动工具条：绝对定位浮层，定位在选区上方，水平居中 */
.annotation-toolbar {
  position: fixed;
  z-index: 1000;
  transform: translate(-50%, -120%);
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  box-shadow: var(--shadow-card);
  user-select: none;
  /* 出现动画：scale + opacity 过渡 */
  animation: toolbar-pop 0.12s ease-out;

  /* 指向选区的小三角箭头（CSS 伪元素） */
  &::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: -6px;
    width: 10px;
    height: 10px;
    background: var(--bg-card);
    border-right: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
    transform: translateX(-50%) rotate(45deg);
  }
}

/* 工具条分区 */
.toolbar-section {
  display: flex;
  align-items: center;
  gap: 2px;
}

/* 紧凑按钮样式 */
.toolbar-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border: none;
  background: transparent;
  border-radius: calc(var(--radius-btn) - 2px);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  &:active {
    background: var(--bg-hover);
    opacity: 0.85;
  }

  .toolbar-label {
    white-space: nowrap;
  }
}

/* 颜色按钮 */
.color-btn {
  gap: 2px;
  padding: 4px 6px;
}

.color-indicator {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid var(--border-subtle);
}

/* 类型按钮 */
.type-btn {
  gap: 2px;
  padding: 4px 6px;
}

.type-indicator {
  font-size: 12px;
  line-height: 1;
}

/* 颜色选择器包装 */
.color-picker-wrapper {
  position: relative;
}

/* 颜色选择面板 */
.color-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  box-shadow: var(--shadow-card);
  z-index: 1001;
  min-width: 120px;
}

.color-option {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--text-muted);
  }

  &.active {
    border-color: var(--color-primary);
    background: var(--bg-hover);
  }
}

.color-dot {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

/* 类型选择器包装 */
.type-picker-wrapper {
  position: relative;
}

/* 类型选择面板 */
.type-panel {
  position: absolute;
  top: calc(100% + 4px);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-btn);
  box-shadow: var(--shadow-card);
  z-index: 1001;
  min-width: 100px;
}

.type-option {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: calc(var(--radius-btn) - 2px);
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.15s;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--color-primary-light);
    color: var(--color-primary-solid);
  }
}

.type-icon {
  font-size: 14px;
}

.type-label {
  white-space: nowrap;
}

/* 按钮间分隔线 */
.toolbar-divider {
  width: 1px;
  height: 16px;
  background: var(--border-subtle);
  flex-shrink: 0;
  margin: 0 2px;
}

/* 出现动画关键帧 */
@keyframes toolbar-pop {
  from {
    opacity: 0;
    transform: translate(-50%, -110%) scale(0.92);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -120%) scale(1);
  }
}
</style>
