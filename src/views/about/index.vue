<template>
  <div class="about-container">
    <AutoUpdate />

    <div class="about-card">
      <div class="card-header">
        <div class="header-icon">
          <el-icon><InfoFilled /></el-icon>
        </div>
        <span class="card-title">关于</span>
      </div>
      <div class="card-content">
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

    <div class="about-card">
      <div class="card-header">
        <div class="header-icon">
          <el-icon><Coin /></el-icon>
        </div>
        <span class="card-title">鸣谢</span>
      </div>
      <div class="card-content">
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

<script setup lang="ts">
import packageJson from '../../../package.json';
import AutoUpdate from './autoUpdate.vue';
import { InfoFilled, Coin } from '@element-plus/icons-vue';

const thanks = ['electron-vite-vue', ...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)].sort();
</script>

<style scoped lang="scss">
.about-container {
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  background: var(--bg-base);
}

.about-card {
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-card);
  margin-bottom: 20px;
  overflow: hidden;

  &:last-child {
    margin-bottom: 0;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 20px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-subtle);

  .header-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-light) 100%);
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;

    .el-icon {
      font-size: 18px;
      color: #fff;
    }
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
  }
}

.card-content {
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
</style>