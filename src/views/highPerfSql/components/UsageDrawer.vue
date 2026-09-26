<script setup lang="ts">
/**
 * 用法指南抽屉（右侧滑出）：三步上手 + 常用按钮 + 高级功能说明。
 */
import { CircleHelp, X, Plus, Pencil, Trash2, Download, RefreshCw } from "@lucide/vue";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const buttonGuide = [
  { icon: Plus, label: "新增一行：在当前表底部添加一条记录。" },
  { icon: Pencil, label: "编辑：修改选中行的数据内容。" },
  { icon: Trash2, label: "删除：移除选中行，删除前建议先备份。" },
  { icon: Download, label: "导出：把当前表数据导出为文件，便于备份与迁移。" },
  { icon: RefreshCw, label: "刷新：重新从数据库加载最新数据。" },
];
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="usage-mask" @click.self="emit('close')">
      <div class="usage-drawer">
        <div class="drawer-header">
          <span class="drawer-title">用法指南</span>
          <CircleHelp class="help-icon" />
          <span class="flex-spacer" />
          <button class="close-btn" @click="emit('close')"><X class="close-icon" /></button>
        </div>

        <div class="drawer-body">
          <div class="hero-card">
            <div class="hero-title">不用写代码，也能管好数据</div>
            <p class="hero-text">
              本功能帮您查看、新增、修改、删除数据，以及创建和管理数据表。跟着下面的步骤即可轻松上手。
            </p>
          </div>

          <div class="section-title">三步上手</div>

          <div class="step-card">
            <div class="step-name">① 选择数据表</div>
            <p class="step-text">在左侧「数据表」列表中点击你要操作的表。</p>
          </div>
          <div class="step-card">
            <div class="step-name">② 查看与编辑数据</div>
            <p class="step-text">切到「数据」页即可浏览记录；点「新增一行」可添加，选中某行后可「编辑」或「删除」。</p>
          </div>
          <div class="step-card">
            <div class="step-name">③ 新建数据表</div>
            <p class="step-text">点击右上角「新建表」，按向导填写表名和字段，即可创建一张属于你的表。</p>
          </div>

          <div class="section-title">常用按钮一览</div>
          <div class="btn-guide">
            <div v-for="(g, i) in buttonGuide" :key="i" class="guide-row">
              <component :is="g.icon" class="guide-icon" />
              <span>{{ g.label }}</span>
            </div>
          </div>

          <div class="adv-card">
            <div class="adv-name">高级功能（开发者）</div>
            <p class="adv-text">索引管理、视图、触发器、事务、并发测试位于左侧「高级」分组，适合有数据库基础的用户，日常使用无需触碰。</p>
          </div>

          <div class="tip-card">
            <div class="tip-name">小贴士</div>
            <p class="tip-text">重要数据改动前，建议先点「导出」备份。删除操作的结果会显示在底部状态条，但无法自动撤销，请确认后再删除。</p>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped lang="scss">
.usage-mask {
  position: fixed;
  inset: 0;
  z-index: 1500;
  background: rgba(0, 0, 0, 0.35);
}

/* 对齐设计稿 3:282：460px 宽、56px 头、内容 padding 20 gap 10 */
.usage-drawer {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 460px;
  max-width: 90vw;
  background: var(--bg-card);
  box-shadow: -6px 0 24px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 56px;
  padding: 0 16px 0 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.drawer-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.help-icon {
  width: 16px;
  height: 16px;
  color: var(--color-primary);
}

.flex-spacer {
  flex: 1;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: var(--bg-hover);
  cursor: pointer;
}

.close-icon {
  width: 16px;
  height: 16px;
  color: var(--text-secondary);
}

.drawer-body {
  flex: 1;
  overflow-y: auto;
  padding: 20px 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-card {
  background: var(--color-primary-light);
  border-radius: 12px;
  padding: 14px;
}

.hero-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.hero-text {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.section-title {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

.step-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 12px 14px;
}

.step-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.step-text {
  margin: 0;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
}

.btn-guide {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 2px 2px;
}

.guide-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.guide-icon {
  width: 13px;
  height: 13px;
  color: var(--text-secondary);
  flex-shrink: 0;
  margin-top: 2px;
}

/* 设计稿 3:340：橙底提示卡 / 3:343：绿底小贴士（带同色描边） */
.adv-card {
  background: var(--tag-bg-warning);
  border: 1px solid var(--color-warning);
  border-radius: 10px;
  padding: 12px 14px;
  margin-top: 8px;
}

.adv-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-warning);
  margin-bottom: 4px;
}

.adv-text {
  margin: 0;
  font-size: 12px;
  color: var(--color-warning);
  line-height: 1.6;
}

.tip-card {
  background: var(--tag-bg-success);
  border: 1px solid var(--color-success);
  border-radius: 10px;
  padding: 12px 14px;
}

.tip-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-success);
  margin-bottom: 4px;
}

.tip-text {
  margin: 0;
  font-size: 12px;
  color: var(--color-success);
  line-height: 1.6;
}
</style>
