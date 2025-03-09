<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">窗口模式</div>
      </template>
    </el-form-item>

    <el-form-item label="番茄钟小窗口" class="mode-wrapper">
      <el-radio-group v-model="showPomodoroMiniWindowCc" @change="changeShowPomodoroMiniWindowFn">
        <el-radio label="开启" :value="true" border></el-radio>
        <el-radio label="关闭" :value="false" border></el-radio>
      </el-radio-group>
    </el-form-item>
  </el-form>

</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import useWindowMode from '@/store/useWindowMode';

const { showPomodoroMiniWindowC } = storeToRefs(useWindowMode());
const { setShowPomodoroMiniWindow } = useWindowMode();

const showPomodoroMiniWindowCc = ref(showPomodoroMiniWindowC.value)

watch(showPomodoroMiniWindowC, (val) => {
  showPomodoroMiniWindowCc.value = JSON.parse(JSON.stringify(val));
});

function changeShowPomodoroMiniWindowFn(val: any) {
  setShowPomodoroMiniWindow(toRaw(val));
}



</script>

<style scoped lang="scss">
.fileRela-form {
  padding: 24px;
}

.setting-title {
  padding-left: 3px;
  border-bottom: 6px solid #6d6d6d;
  width: 100%;
  font-weight: 600;
}

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

.cache-list {
  word-break: break-all;
}

.cache-item-wrapper {
  display: flex;
  flex-wrap: wrap;
  align-items: center;

  &+& {
    padding-top: 12px;
    padding-bottom: 12px;
    border-top: 2px solid #e8e8e8
  }

  .cache-key {
    width: 120px;
    font-weight: 600;
    line-height: 1;
    word-break: break-all;
  }

  .cache-item {
    color: #828282;
    flex: 1;

  }

  .level-2 {
    word-break: break-all;
  }

  .level-3 {
    display: flex;
    align-items: center;

    .cache-key {
      width: unset;
      padding-right: 24px;
    }
  }

  .level-4 {
    word-break: break-all;
  }
}
</style>
