<template>
  <div class="tag-color-picker">
    <span
      v-for="c in colorList"
      :key="c"
      class="color-dot"
      :class="{ active: modelValue === c }"
      :style="{ backgroundColor: c }"
      :title="c"
      @click="pick(c)"
    />
    <!-- 自定义颜色：el-color-picker 提供取色器，选择后写入 v-model -->
    <!-- 注意：el-tooltip 的触发子节点必须是单一元素根（ElTooltip 会用 ElOnlyChild
         给子节点克隆并绑定 v-show 等运行时指令）。直接把 el-color-picker 作为子节点时，
         该组件根节点为 fragment，Vue 会报
         "Runtime directive used on component with non-element root node"。
         因此这里用 <span> 包一层，让指令绑定到 span 上。 -->
    <el-tooltip content="自定义颜色" placement="top">
      <span class="custom-color">
        <el-color-picker
          v-model="customColor"
          size="small"
          :predefine="colorList"
          @change="onCustom"
        />
      </span>
    </el-tooltip>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { TAG_COLORS } from '../types';

const props = withDefaults(
  defineProps<{
    modelValue: string;
  }>(),
  { modelValue: TAG_COLORS[0] }
);

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>();

const colorList = TAG_COLORS;
// 自定义颜色选择器需要受控值，初始为当前选中色（若不在预设里也兼容）
const customColor = ref(props.modelValue);

watch(
  () => props.modelValue,
  (v) => {
    customColor.value = v;
  }
);

function pick(c: string) {
  emit('update:modelValue', c);
}

function onCustom(val: string | null) {
  if (val) emit('update:modelValue', val);
}
</script>

<style scoped lang="scss">
.tag-color-picker {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;

  .color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    box-sizing: border-box;
    transition: transform 0.15s;

    &:hover {
      transform: scale(1.15);
    }

    &.active {
      border-color: var(--text-primary);
    }
  }

  .custom-color {
    :deep(.el-color-picker__trigger) {
      width: 18px;
      height: 18px;
      padding: 0;
      border-radius: 50%;
    }
  }
}
</style>
