<!-- 快捷键组合 -->
<template>
  <!-- el-select选择快捷键，最多选择3个，最少2个 -->
  <div class="myShortcut-select" v-for="(value, index) in source">
    <!-- 非第一个，加上+ -->
    <span v-if="index > 0" class="split">+</span>
    <el-select  v-model="myShortcut[index]" placeholder="请选择"  filterable @change="(val: string) => changeShortcutFn(val, index)">
      <el-option v-for="op in ops" :key="op.value" :label="op.label" :value="op.value"></el-option>
    </el-select>
  </div>

</template>

<script setup lang="ts">

import { computed, ref } from 'vue'

const source = ref(3)


const props = defineProps({
  shortcut: {
    type: Array as () => string[],
    default: () => ['', '', '']
  }
})
const emit = defineEmits(['update:myShortcut'])

const myShortcut = computed(() => {
  return props.shortcut
})

// 快捷键选项列表
const ops = ref([
  // 修饰键
  { value: 'Ctrl', label: 'Ctrl' },
  { value: 'Shift', label: 'Shift' },
  { value: 'Alt', label: 'Alt' },
  { value: 'Meta', label: 'Meta' },
  { value: 'Cmd', label: 'Cmd' },
  { value: 'Win', label: 'Win' },
  // 大写字母
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(item => ({ value: item, label: item })),
  // 数字
  ...'0123456789'.split('').map(item => ({ value: item, label: item })),
  // 功能键
  ...['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'].map(item => ({ value: item, label: item })),
  // 方向键
  ...['Up', 'Down', 'Left', 'Right'].map(item => ({ value: item, label: item })),
  // 其他键
  ...['Backspace', 'Tab', 'Enter', 'Escape', 'Space', 'PageUp', 'PageDown', 'End', 'Home', 'Insert', 'Delete'].map(item => ({ value: item, label: item }))
])

const changeShortcutFn = (val: string, index: number) => {
  console.log(myShortcut.value)
  // 判断是否有重复的快捷键shortcut包含两个以上的val
  if (myShortcut.value.filter(item => item.includes(val)).length > 1) {
    // 有重复的快捷键
    myShortcut.value[index] = ''
    return
  }
  emit('update:myShortcut', myShortcut.value)
}

</script>

<style lang="scss" scoped>
.myShortcut-select {
  display: flex;
  flex-wrap: wrap;
}
.myShortcut-select .el-select {
  width: 100px;
}
.myShortcut-select .split {
  font-size: 16px;
  margin: 0 5px;
  color: #606266;
}


</style>