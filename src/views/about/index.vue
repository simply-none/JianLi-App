<template>
  <div class="about-container">
    <AutoUpdate />

    <div class="about-card">
      <div class="card-header">
        <span class="icon">ℹ️</span>
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
        <span class="icon">🙏</span>
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

const thanks = ['electron-vite-vue', ...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)].sort();
</script>

<style scoped lang="scss">
.about-container {
  // padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
  // background: #f5f7fa;
}

.about-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  margin-bottom: 20px;
  overflow: hidden;

  &:last-child {
    margin-bottom: 0;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

  .icon {
    font-size: 18px;
  }

  .card-title {
    font-size: 16px;
    font-weight: 600;
    color: #fff;
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
  border-bottom: 1px solid #f0f0f0;

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
    color: #909399;
    min-width: 80px;
  }

  .info-value {
    font-size: 14px;
    color: #303133;
    flex: 1;
    font-weight: 500;
  }
}

.thanks-intro {
  font-size: 13px;
  color: #909399;
  margin-bottom: 12px;
}

.thanks-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.thanks-tag {
  padding: 4px 10px;
  background: #ecf5ff;
  color: #409eff;
  border-radius: 4px;
  font-size: 12px;
  border: 1px solid #d9ecff;
}
</style>