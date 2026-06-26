<template>
  <div class="shortcut-container">
    <div class="keys-row">
      <div 
        v-for="(value, index) in shortcut" 
        :key="index" 
        class="key-wrapper"
      >
        <div 
          class="key-item"
          :class="{ 
            'active': activeIndex === index,
            'empty': !value 
          }"
          @click="activateInput(index)"
        >
          <span v-if="value" class="key-value">{{ value }}</span>
          <span v-else class="key-placeholder">点击输入</span>
        </div>
        <el-select 
          v-model="localShortcut[index]" 
          placeholder="" 
          class="key-select"
          filterable
          @change="(val: string) => handleSelectChange(val, index)"
          @visible-change="(visible: boolean) => handleSelectVisible(visible, index)"
        >
          <el-option 
            v-for="op in ops" 
            :key="op.value" 
            :label="op.label" 
            :value="op.value"
          ></el-option>
        </el-select>
        <div v-if="index < 2" class="key-separator">+</div>
      </div>
    </div>
    <div class="input-hint">
      <span>⌨️ 点击按键区域输入键盘</span>
      <span>或</span>
      <span>📋 使用下拉选择</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps({
  shortcut: {
    type: Array as () => string[],
    default: () => ['', '', '']
  }
})

const emit = defineEmits(['update:shortcut'])

const localShortcut = ref([...props.shortcut])
const activeIndex = ref<number | null>(null)

watch(() => props.shortcut, (newVal) => {
  localShortcut.value = [...newVal]
}, { deep: true })

const ops = ref([
  { value: 'Ctrl', label: 'Ctrl' },
  { value: 'Shift', label: 'Shift' },
  { value: 'Alt', label: 'Alt' },
  { value: 'Meta', label: 'Meta' },
  { value: 'Cmd', label: 'Cmd' },
  { value: 'Win', label: 'Win' },
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(item => ({ value: item, label: item })),
  ...'0123456789'.split('').map(item => ({ value: item, label: item })),
  ...['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].map(item => ({ value: item, label: item })),
  ...['Up', 'Down', 'Left', 'Right'].map(item => ({ value: item, label: item })),
  ...['Backspace', 'Tab', 'Enter', 'Escape', 'Space', 'PageUp', 'PageDown', 'End', 'Home', 'Insert', 'Delete'].map(item => ({ value: item, label: item }))
])

const keyMap: Record<string, string> = {
  'Control': 'Ctrl',
  'Shift': 'Shift',
  'Alt': 'Alt',
  'Meta': 'Win',
  'ArrowUp': 'Up',
  'ArrowDown': 'Down',
  'ArrowLeft': 'Left',
  'ArrowRight': 'Right',
  ' ': 'Space',
  'Backspace': 'Backspace',
  'Tab': 'Tab',
  'Enter': 'Enter',
  'Escape': 'Escape',
  'PageUp': 'PageUp',
  'PageDown': 'PageDown',
  'End': 'End',
  'Home': 'Home',
  'Insert': 'Insert',
  'Delete': 'Delete'
}

const activateInput = (index: number) => {
  activeIndex.value = index
  document.addEventListener('keydown', handleKeyDown)
}

const deactivateInput = () => {
  activeIndex.value = null
  document.removeEventListener('keydown', handleKeyDown)
}

const handleKeyDown = (event: KeyboardEvent) => {
  event.preventDefault()
  
  if (activeIndex.value === null) return
  
  let key = event.key
  
  if (keyMap[key]) {
    key = keyMap[key]
  } else if (key.length === 1) {
    key = key.toUpperCase()
  }
  
  if (key === 'Space') {
    key = 'Space'
  }
  
  if (key === 'Backspace' || key === 'Delete') {
    localShortcut.value[activeIndex.value] = ''
  } else {
    if (localShortcut.value.filter(item => item === key).length > 0) {
      return
    }
    localShortcut.value[activeIndex.value] = key
  }
  
  emit('update:shortcut', [...localShortcut.value])
  
  setTimeout(() => {
    deactivateInput()
  }, 300)
}

const handleSelectChange = (val: string, index: number) => {
  if (val && localShortcut.value.filter(item => item === val).length > 1) {
    localShortcut.value[index] = ''
    return
  }
  emit('update:shortcut', [...localShortcut.value])
}

const handleSelectVisible = (visible: boolean, index: number) => {
  if (visible) {
    activeIndex.value = index
  }
}

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement
  if (!target.closest('.shortcut-container')) {
    deactivateInput()
  }
}

document.addEventListener('click', handleClickOutside)
</script>

<style lang="scss" scoped>
.shortcut-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.keys-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.key-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.key-item {
  width: 72px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  
  &:hover {
    border-color: #409eff;
    box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
  }
  
  &.active {
    border-color: #409eff;
    background: linear-gradient(180deg, #ecf5ff 0%, #e6f7ff 100%);
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
    animation: pulse 1s infinite;
  }
  
  &.empty {
    background: linear-gradient(180deg, #fafafa 0%, #f0f0f0 100%);
  }
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 0 0 0 2px rgba(64, 158, 255, 0.2);
  }
  50% {
    box-shadow: 0 0 0 4px rgba(64, 158, 255, 0.1);
  }
}

.key-value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  font-family: 'SF Mono', Monaco, 'Consolas', monospace;
}

.key-placeholder {
  font-size: 12px;
  color: #909399;
}

.key-select {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
}

.key-separator {
  font-size: 18px;
  font-weight: 600;
  color: #909399;
  margin: 0 4px;
}

.input-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #c0c4cc;
  
  span {
    display: flex;
    align-items: center;
  }
}
</style>
