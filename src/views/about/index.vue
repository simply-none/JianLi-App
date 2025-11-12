<template>
  <el-form class="setting-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">关于</div>
      </template>
    </el-form-item>
    <el-form-item label="应用名称" class="mode-wrapper">
      <div class="about-item">{{ packageJson.name }}</div>
    </el-form-item>
    <el-form-item label="版本" class="mode-wrapper">
      <div class="about-item">{{ packageJson.version }}</div>
    </el-form-item>
    <!-- 应用作者 -->
    <el-form-item label="应用作者" class="mode-wrapper">
      <div class="about-item">{{ packageJson.author }}</div>
    </el-form-item>
    <!-- 应用描述 -->
    <el-form-item label="应用描述" class="mode-wrapper">
      <div class="about-item">{{ packageJson.description }}</div>
    </el-form-item>
    <!-- 鸣谢 -->
    <el-form-item label="鸣谢" class="mode-wrapper">
      <div class="about-item">（排名不分先后）</div>
      <div class="about-item" v-for="(value, key) in thanks">
        {{ value }}
      </div>
    </el-form-item>
  </el-form>

</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw } from 'vue';
import { useRouter } from 'vue-router';
import packageJson from '../../../package.json';

console.log(packageJson, 'version')

// 鸣谢
let thanks = ['electron-vite-vue', ...Object.keys(packageJson.dependencies), ...Object.keys(packageJson.devDependencies)].sort()


</script>

<style scoped lang="scss">
.home-mode-form {
  padding: 24px;
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.cur-status {
  &-work {
    &::before {
      content: '•';
      color: #00ffbf;
      display: inline-block;
    }

    &::rest {
      content: '•';
      color: #ff0303;
      display: inline-block;
    }
  }
}

.setting-form {
  width: 100%;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
  padding: 24px;
  background-color: #ffffff;
}

// 主页模式
:deep(.mode-wrapper) {
  .el-form-item__content {
    flex-direction: column;
    align-items: flex-start;
  }
}

.mode-ops {
  width: 100%;

  .mode-item {
    display: flex;
    margin-bottom: 10px;
  }

  .mode-label {
    width: 150px;
  }
}
</style>