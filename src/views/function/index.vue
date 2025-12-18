<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">小工具</div>
      </template>
    </el-form-item>

    <el-form-item label="生成唯一ID" class="mode-wrapper">
      <div class="about-item">
        {{ uniqueId }}
        <el-button type="primary" @click="generateUniqueId">切换</el-button>
      </div>
    </el-form-item>
  </el-form>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'

// 唯一id
const uniqueId = ref('')
generateUniqueId()
// 生成唯一ID
function generateUniqueId() {
  uniqueId.value = crypto.randomUUID()
}


</script>

<style scoped lang="scss">
.fileRela-form {
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

.el-timeline {
  width: 100%;
}

.clipboard-item {
  margin: 10px 0;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 8px;
}

.item-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.item-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 10px;

}
</style>