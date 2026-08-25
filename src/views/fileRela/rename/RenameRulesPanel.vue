<template>
  <div class="rules-panel">
    <!-- 1. 查找替换 -->
    <div class="rule-block">
      <div class="rule-title">
        <el-switch v-model="model.search.enabled" size="small" />
        <span>查找替换</span>
      </div>
      <div class="rule-body" :class="{ disabled: !model.search.enabled }">
        <el-input v-model="model.search.find" placeholder="查找内容" class="rule-input" :disabled="!model.search.enabled" />
        <el-input v-model="model.search.replace" placeholder="替换为（可空）" class="rule-input" :disabled="!model.search.enabled" />
        <el-checkbox v-model="model.search.regex" :disabled="!model.search.enabled">正则</el-checkbox>
        <el-checkbox v-model="model.search.case" :disabled="!model.search.enabled">区分大小写</el-checkbox>
      </div>
    </div>

    <!-- 2. 前后缀 -->
    <div class="rule-block">
      <div class="rule-title"><span>前后缀</span></div>
      <div class="rule-body">
        <el-input v-model="model.prefix" placeholder="前缀（加在文件名前）" class="rule-input" />
        <el-input v-model="model.suffix" placeholder="后缀（加在文件名后，扩展名前）" class="rule-input" />
      </div>
    </div>

    <!-- 3. 序号 -->
    <div class="rule-block">
      <div class="rule-title">
        <el-switch v-model="model.seq.enabled" size="small" />
        <span>添加序号</span>
      </div>
      <div class="rule-body" :class="{ disabled: !model.seq.enabled }">
        <div class="seq-grid">
          <label>起始<el-input v-model.number="model.seq.start" type="number" :disabled="!model.seq.enabled" size="small" /></label>
          <label>步长<el-input v-model.number="model.seq.step" type="number" :disabled="!model.seq.enabled" size="small" /></label>
          <label>位数<el-input v-model.number="model.seq.digits" type="number" :disabled="!model.seq.enabled" size="small" /></label>
          <label>分隔符<el-input v-model="model.seq.sep" placeholder="_" :disabled="!model.seq.enabled" size="small" /></label>
          <label>位置
            <el-select v-model="model.seq.pos" :disabled="!model.seq.enabled" size="small">
              <el-option label="序号在前" value="prefix" />
              <el-option label="序号在后" value="suffix" />
            </el-select>
          </label>
        </div>
      </div>
    </div>

    <!-- 4. 大小写 -->
    <div class="rule-block">
      <div class="rule-title"><span>大小写</span></div>
      <div class="rule-body">
        <el-select v-model="model.caseMode" class="rule-input">
          <el-option label="保持不变" value="keep" />
          <el-option label="全部大写" value="upper" />
          <el-option label="全部小写" value="lower" />
          <el-option label="首字母大写" value="title" />
        </el-select>
      </div>
    </div>

    <!-- 5. 扩展名 -->
    <div class="rule-block">
      <div class="rule-title"><span>扩展名</span></div>
      <div class="rule-body">
        <el-select v-model="model.ext.mode" class="rule-input">
          <el-option label="保持不变" value="keep" />
          <el-option label="改为…" value="set" />
        </el-select>
        <el-input v-model="model.ext.value" placeholder="如 png / .jpg" class="rule-input" :disabled="model.ext.mode !== 'set'" />
      </div>
    </div>

    <!-- 6~9. 规则子组件（按文件日期 / 随机 / 清理 / 截取） -->
    <RuleDate v-model="model.date" />
    <RuleRandom v-model="model.random" />
    <RuleClean v-model="model.clean" />
    <RuleTrim v-model="model.trim" />
  </div>
</template>

<script setup lang="ts">
import type { RenameRules } from './engine';
import RuleDate from './rules/RuleDate.vue';
import RuleRandom from './rules/RuleRandom.vue';
import RuleClean from './rules/RuleClean.vue';
import RuleTrim from './rules/RuleTrim.vue';

const model = defineModel<RenameRules>({ required: true });
</script>

<style scoped lang="scss">
.rules-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-block {
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 10px 14px;
}

.rule-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 10px;
}

.rule-body {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;

  &.disabled {
    opacity: 0.5;
    pointer-events: none;
  }

  &.col {
    flex-direction: column;
    align-items: flex-start;
  }
}

.rule-input {
  width: 220px;
}

.mini-input {
  width: 90px;
}

.mini-select {
  width: 110px;
}

.mini-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.specified-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.specified-input {
  width: 140px;
}

.seq-grid {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;

  label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--text-secondary);

    .el-input,
    .el-select {
      width: 90px;
    }
  }
}
</style>
