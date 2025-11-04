<template>
  <el-form-item v-for="(staticVal, staticKey) in data" :key="staticKey" class="mode-wrapper">
    <template #label>
      {{ staticKey }}
    </template>
    <template v-if="Object.prototype.toString.call(staticVal) === '[object String]'">
      {{ staticVal }}
    </template>
    <template v-else-if="Object.prototype.toString.call(staticVal) === '[object Object]'">
      <el-form-item v-for="(itemVal, itemKey) in staticVal" :key="itemKey" class="mode-wrapper">
        <template #label>
          {{ itemKey }}
        </template>
        <div>
          {{ itemVal }}
        </div>
      </el-form-item>
    </template>
    <!-- 数组 -->
    <template v-else-if="Object.prototype.toString.call(staticVal) === '[object Array]'">
      <el-form-item v-for="(itemVal, itemKey) in staticVal" :key="itemKey" class="mode-wrapper">
        <template #label>
          {{ itemKey }}
        </template>
        <!-- 字符串，对象 -->
        <template v-if="Object.prototype.toString.call(itemVal) === '[object String]'">
          {{ itemVal }}
        </template>
        <template v-else-if="Object.prototype.toString.call(itemVal) === '[object Object]'">
          <el-form-item v-for="(subItemVal, subItemKey) in itemVal" :key="subItemKey" class="mode-wrapper">
            <template #label>
              {{ subItemKey }}
            </template>
            <div>
              {{ subItemVal }}
            </div>
          </el-form-item>
        </template>
      </el-form-item>
    </template>
  </el-form-item>
</template>

<script setup lang="ts">
import { h, ref, reactive, watch, computed, toRaw, onMounted, onUnmounted, nextTick } from 'vue';

const props = defineProps<{
  data: ObjectType,
}>();

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

// 主页模式
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
