<template>
  <!-- 写一个功能：请求头表格输入，表格有两列，一列是key，一列是value，可以自增表格行 -->
  <el-button type="primary" size="small" @click="addColumn">添加</el-button>
  <el-table :data="column" style="width: 100%">
    <el-table-column prop="key" label="名称">
      <template #default="scope">
        <el-input spellcheck="false" :ref="(el: any) => inputKeyRefs[scope.$index] = el" v-model="scope.row.key"
          @keyup.enter="(e: KeyboardEvent) => keyEnterFn(e, scope.$index)" />
      </template>
    </el-table-column>
    <el-table-column prop="value" label="值">
      <template #default="scope">
        <el-input spellcheck="false" :ref="(el: any) => inputValueRefs[scope.$index] = el" v-model="scope.row.value"
          @keyup.enter="(e: KeyboardEvent) => valueEnterFn(e, scope.$index)" />
      </template>
    </el-table-column>
    <el-table-column label="操作" width="180">
      <template #default="scope">
        <el-button type="danger" size="small" @click="removeColumn(scope.$index)">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import { h, ref, reactive, watch, computed, toRaw, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  label: string,
}>();

const emit = defineEmits<{
  (e: 'update', val: ObjectType): void
}>()

// ------接口测试 start------
const column = ref<ObjectType>([{ key: '', value: '' }]);

watch(column, (val) => {
  if (val) {
    emit('update', val);
  }
}, {
  deep: true,
  immediate: true,
})

// 定义一个数组，用来存储输入框的ref
const inputKeyRefs = ref<Record<number, any>>({});
const inputValueRefs = ref<Record<number, any>>({});

function addColumn() {
  column.value.push({ key: '', value: '' });
  nextTick(() => {
    setTimeout(() => {
      inputKeyRefs.value[column.value.length - 1].$refs.input.focus();
    }, 10);
  })
}

function removeColumn(index: number) {
  column.value.splice(index, 1);
}

function keyEnterFn(e: KeyboardEvent, index: number) {
  // 聚焦焦点到下一个输入框
  inputValueRefs.value[index].$refs.input.focus();
}

function valueEnterFn(e: KeyboardEvent, index: number) {
  // 判断index是否是最后一个，是就新增一行，否则就跳到下一行
  console.log(index, 'index', column.value.length - 1)
  if (index === column.value.length - 1) {
    addColumn();
  }
}

</script>

<style scoped lang="scss">
.pomodoro-record {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.result-tabs {
  width: 100%;
  min-height: 420px;
  max-height: 500px;

  :deep(.el-tabs__content) {
    overflow: auto;
  }

  :deep(.el-tab-pane) {
    height: 100%;
  }
}

:deep(.el-table .table-work) {
  --el-table-tr-bg-color: #f0f9eb;

}

:deep(.el-table .table-rest) {
  --el-table-tr-bg-color: #fff5f5;
}

:deep(.el-table .table-screen) {
  --el-table-tr-bg-color: #e6fffb;
}
</style>
