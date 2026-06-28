<template>
  <layout-vue>
    <template #main>
      <div class="about-page">
        <!-- AutoUpdate 组件 -->
        <div class="section">
          <AutoUpdate />
        </div>

        <!-- Section 1: 关于信息 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="BadgeInfo" />
            关于
          </h2>
          <div class="info-card">
            <div class="info-item">
              <span class="info-icon">📝</span>
              <span class="info-label">应用名称</span>
              <span class="info-value">{{ packageJson.name }}</span>
            </div>
            <div class="info-item">
              <span class="info-icon">📊</span>
              <span class="info-label">版本</span>
              <span class="info-value">{{ packageJson.version }}</span>
            </div>
            <div class="info-item">
              <span class="info-icon">👤</span>
              <span class="info-label">应用作者</span>
              <span class="info-value">{{ packageJson.author }}</span>
            </div>
            <div class="info-item">
              <span class="info-icon">📄</span>
              <span class="info-label">应用描述</span>
              <span class="info-value">{{ packageJson.description }}</span>
            </div>
          </div>
        </div>

        <!-- Section 2: 鸣谢 -->
        <div class="section">
          <h2 class="section-title">
            <LucideIcon name="Coins" />
            鸣谢
          </h2>
          <div class="thanks-card">
            <div class="thanks-intro">（排名不分先后）</div>
            <div class="thanks-tags">
              <span 
                v-for="(value, key) in thanks" 
                :key="key" 
                class="thanks-tag"
              >
                {{ value }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </layout-vue>
</template>

<script setup lang="ts">
import packageJson from '../../../package.json';
import LayoutVue from '@/components/layout.vue';
import AutoUpdate from './autoUpdate.vue';
import LucideIcon from '@/components/LucideIcon.vue';

const thanks = ['electron-vite-vue', ...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)].sort();
</script>

<style scoped lang="scss">
:deep(.main) {
  padding: 0 !important;
}

.about-page {
  width: 100%;
  min-height: 100%;
  box-sizing: border-box;

  .section {
    margin-bottom: 28px;

    .section-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0 0 16px;
      padding-bottom: 10px;
      border-bottom: 2px solid var(--color-primary);
    }
  }

  .info-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .info-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 0;
    border-bottom: 1px solid var(--border-light);

    &:last-child {
      border-bottom: none;
    }

    .info-icon {
      font-size: 16px;
      width: 24px;
      text-align: center;
    }

    .info-label {
      font-size: 14px;
      color: var(--text-secondary);
      min-width: 80px;
    }

    .info-value {
      font-size: 14px;
      color: var(--text-primary);
      flex: 1;
      font-weight: 500;
    }
  }

  .thanks-card {
    background: var(--bg-card);
    border: 1px solid var(--border-subtle);
    border-radius: var(--radius-card);
    padding: 20px;
  }

  .thanks-intro {
    font-size: 13px;
    color: var(--text-secondary);
    margin-bottom: 12px;
  }

  .thanks-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .thanks-tag {
    padding: 4px 10px;
    background: var(--tag-bg-info);
    color: var(--color-primary);
    border-radius: 4px;
    font-size: 12px;
    border: 1px solid var(--border-subtle);
  }
}
</style>