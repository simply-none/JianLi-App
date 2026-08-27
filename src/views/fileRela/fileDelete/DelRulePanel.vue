// 原子组件：删除规则面板
// 范围：按规则筛选 / 整体删除；按规则时复用「名称/类型/文件夹 含/不含」。
<script setup lang="ts">
import RuleTagGroup from './RuleTagGroup.vue';
import type { DeleteFilter } from './types';

const filter = defineModel<DeleteFilter>({ required: true });
</script>

<template>
  <div class="del-rule">
    <div class="scope-row">
      <span class="scope-label">范围</span>
      <el-radio-group v-model="filter.wholeFolder" class="radio-group">
        <el-radio :value="false">按规则筛选</el-radio>
        <el-radio :value="true">整体删除</el-radio>
      </el-radio-group>
    </div>

    <div v-if="!filter.wholeFolder" class="rule-groups">
      <RuleTagGroup
        title="名称"
        v-model:include="filter.nameInclude"
        v-model:exclude="filter.nameExclude"
        ph-include="输入名称关键字，回车添加"
      />
      <RuleTagGroup
        title="类型"
        v-model:include="filter.suffixInclude"
        v-model:exclude="filter.suffixExclude"
        ph-include="如 .log、.png，回车添加"
      />
      <RuleTagGroup
        title="文件夹"
        v-model:include="filter.folderInclude"
        v-model:exclude="filter.folderExclude"
        ph-include="如 temp、备份，回车添加"
        default-mode="exclude"
      />
    </div>

    <div v-else class="whole-tip">
      <el-icon><LucideIcon name="CircleAlert" /></el-icon>
      将删除整个文件夹及其所有内容（含子目录），此操作不可局部预览。
    </div>
  </div>
</template>

<style scoped lang="scss">
.del-rule {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  background: var(--bg-base, #f7f8fa);
  border-radius: 8px;
}

.scope-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.scope-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  width: 40px;
}

.rule-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.whole-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-warning, #ba7517);
}
</style>
