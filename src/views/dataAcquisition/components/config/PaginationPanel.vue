<template>
  <div class="pagination-panel">
    <div class="panel-title">分页设置</div>
    <el-form label-width="92px" size="small">
      <el-form-item label="分页方式">
        <el-radio-group v-model="pagination.type">
          <el-radio-button value="none">不分页</el-radio-button>
          <el-radio-button value="selector">点击下一页</el-radio-button>
          <el-radio-button value="template">URL 模板</el-radio-button>
          <el-radio-button value="scroll">滚动加载</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <template v-if="pagination.type === 'selector'">
        <el-form-item label="下一页选择器">
          <el-input v-model="pagination.next" placeholder="如 span.next a" />
        </el-form-item>
        <el-form-item label="最大页数">
          <el-input-number v-model="pagination.maxPages" :min="1" :max="10000" />
        </el-form-item>
      </template>

      <template v-else-if="pagination.type === 'template'">
        <el-form-item label="URL 说明">
          <span class="tip">URL 中写 {page} 占位符，或填页码参数名自动追加</span>
        </el-form-item>
        <el-form-item label="页码参数名">
          <el-input v-model="pagination.pageParam" placeholder="如 page（URL 含 {page} 时忽略）" />
        </el-form-item>
        <el-form-item label="起始页码">
          <el-input-number v-model="pagination.startPage" :min="0" :max="100000" />
        </el-form-item>
        <el-form-item label="最大页数">
          <el-input-number v-model="pagination.maxPages" :min="1" :max="10000" />
        </el-form-item>
      </template>

      <template v-else-if="pagination.type === 'scroll'">
        <el-form-item label="滚动次数">
          <el-input-number v-model="pagination.scrollTimes" :min="1" :max="200" />
        </el-form-item>
        <el-form-item label="滚动间隔(ms)">
          <el-input-number v-model="pagination.scrollWaitMs" :min="200" :max="10000" :step="100" />
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<script setup lang="ts">
/**
 * 分页设置面板
 * ------------------------------------------------------------------
 * 配置分页推进方式：不分页 / 点击下一页选择器 / URL 模板（{page} 或查询参数）/
 * 滚动加载（滚动 N 次后一次性抽取）。
 */
import type { PaginationConfig } from '../../types'

/** 组件属性（引用透传，原地修改） */
const props = defineProps<{
  /** 分页配置对象 */
  pagination: PaginationConfig;
}>()

// 引用透传即可，无需额外逻辑；props 保留供模板使用
void props;
</script>

<style scoped>
.pagination-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-title {
  font-weight: 600;
  font-size: 13px;
}
.tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
