<template>
  <el-form class="setting-home-mode-form" label-width="108" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">提醒设置</div>
      </template>
    </el-form-item>
    <el-form-item label="一键提醒" class="mode-wrapper">
      <div>
        <el-button type="primary" @click="tipAll">一键提醒</el-button>
        <!-- 停止提醒 -->
        <el-button type="warning" @click="stopAllTip">停止所有提醒</el-button>
      </div>
    </el-form-item>
    <el-form-item label="当前提醒" class="mode-wrapper">
      <!-- 当前所有的提醒 -->
      <el-table :data="tipTypeC" height="250" style="width: 100%">
        <el-table-column label="类型" width="180">
          <template #default="scope">
            <div style="display: flex; align-items: center">
              <span style="margin-left: 10px">{{ getType(scope.row.type) }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="时间间隔" width="180">
          <template #default="scope">
            <div style="display: flex; align-items: center">
              <span style="margin-left: 10px">{{ scope.row.gap }}</span>
              <span style="margin-left: 10px">{{ curUnit(scope.row.unit) }}</span>
            </div>
          </template>
        </el-table-column>
        <!-- 下一次提醒时间 -->
        <el-table-column label="下一次提醒时间" width="180">
          <template #default="scope">
            <div style="display: flex; align-items: center">
              {{ (nextTime[scope.row.type] || {}).nextTime || '--' }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300">
          <template #default="scope">
            <!-- 编辑 -->
            <el-button size="small" @click="editTip(JSON.parse(JSON.stringify(scope.row)))">编辑</el-button>
            <!-- 删除 -->
            <el-button size="small" type="danger" @click="delTip(scope.row)">删除</el-button>
            <!-- 提醒 -->
            <el-button size="small" type="primary" @click="() => tip(scope.row)">提醒</el-button>
            <!-- 终止提醒 -->
            <el-button size="small" type="warning" @click="() => stopTip(scope.row)">终止提醒</el-button>
          </template>
        </el-table-column>

      </el-table>


    </el-form-item>
    <el-form-item label="新增提醒" class="mode-wrapper">
      <el-form-item label="提醒时间类型" class="mode-wrapper">
        <el-select v-model="newTip.type" placeholder="请选择">
          <el-option v-for="(item, index) in tipTypeOpsCc" :key="index" :label="item.label" :value="item.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="提醒时间间隔" class="mode-wrapper">
        <el-input v-model="newTip.gap" type="number" placeholder="请输入提醒时间间隔">
          <template #append>
            <el-select v-model="newTip.unit" placeholder="请选择" style="width: 115px">
              <!-- 选项：时间单位：时分秒 -->
              <el-option label="分钟" :value="60 * 1000" />
              <el-option label="小时" :value="60 * 60 * 1000" />
              <el-option label="秒" :value="1000" />
            </el-select>
          </template>
        </el-input>
      </el-form-item>
      <el-form-item class="mode-wrapper">
        <el-button type="primary" @click="addTip">新增</el-button>
      </el-form-item>

    </el-form-item>
    <el-form-item label="当前提醒类型" class="mode-wrapper">
      <!-- 当前所有的提醒类型 -->
      <el-table :data="tipTypeOpsC" height="250" style="width: 100%">
        <el-table-column prop="label" label="名称" width="180" />
        <el-table-column prop="value" label="值" width="180" />
        <el-table-column label="图标" width="180">
          <template #default="scope">
            <div v-if="scope.row.iconType == 'image'" class="show-icon">
              <el-image :src="scope.row.icon">
                <template #error>
                  <div>图片加载失败</div>
                  <div>{{ '图标' }}</div>
                </template>
              </el-image>
            </div>
            <div v-else class="show-icon" v-html="scope.row.icon || '--'"></div>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <!-- 编辑 -->
            <el-button size="small" @click="editTipOps(JSON.parse(JSON.stringify(scope.row)))">编辑</el-button>
            <!-- 删除 -->
            <el-button size="small" @click="delTipOps(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

    </el-form-item>
    <el-form-item label="新增提醒类型" class="mode-wrapper">
      <!-- 当前所有的提醒类型 -->
      <el-form-item label="名称" class="mode-wrapper">
        <el-input v-model="newTipOps.label" placeholder="请输入">
        </el-input>
      </el-form-item>
      <el-form-item label="值" class="mode-wrapper">
        <el-input v-model="newTipOps.value" placeholder="请输入">
        </el-input>
      </el-form-item>
      <el-form-item label="图标" class="mode-wrapper">
        <el-input v-model="newTipOps.icon"  placeholder="请输入">
          <!-- 后置选择文件夹 -->
            <template #append>
              <el-button icon="Upload" @click="uploadIcon">选择</el-button>
            </template>
        </el-input>
        <div v-if="newTipOps.iconType == 'image'" class="show-icon">
          <el-image :src="newTipOps.icon">
            <template #error>
              <div>图片加载失败</div>
              <div>{{ '图标' }}</div>
            </template>
          </el-image>
        </div>
        <div v-else class="show-icon" v-html="newTipOps.icon"></div>
      </el-form-item>
      <el-form-item class="mode-wrapper">
        <el-button type="primary" @click="addTipOps">新增</el-button>
      </el-form-item>

    </el-form-item>
  </el-form>

</template>

<script setup lang="ts">
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { storeToRefs } from 'pinia';
import UploadVue from '@/components/upload.vue';
import useCacheSetStore from '@/store/useCacheSet'
import { send, sendSync } from '@/utils/common';
import { ElMessage } from 'element-plus';
import useTips from '@/store/useTips';
import { sysNotify, appNotify } from "@/utils/notify";

const { tipType, tipTypeC, tipTypeOps, tipTypeOpsC, nextTime } = storeToRefs(useTips());
const { setTipType, setTipTypeOps, setNextTime } = useTips();

const tipTypeCc = ref(tipTypeC.value)
watch(() => tipTypeC.value, (newVal) => {
  tipTypeCc.value = newVal
  console.log(tipTypeCc.value)
}, {
  deep: true,
})
const tipTypeOpsCc = ref(tipTypeOpsC.value)
watch(() => tipTypeOpsC.value, (newVal) => {
  tipTypeOpsCc.value = newVal
  console.log(tipTypeOpsCc.value)
}, {
  deep: true,
})

// 新增
const newTip = ref<ObjectType>({})
const addTip = () => {
  // 判空判断
  if (!newTip.value.type || !newTip.value.gap || !newTip.value.unit) {
    ElMessage({
      message: '请填写完整信息',
      type: 'warning',
    })
    return;
  }
  setTipType(newTip)
  newTip.value = {}
}
const editTip = (item: ObjectType) => {
  newTip.value = item
}
// 删除
const delTip = (item: ObjectType) => {
  const index = tipTypeCc.value.findIndex(i => item.type == i.type && item.gap == i.gap && item.unit == i.unit)
  if (index != -1) {
    tipTypeCc.value.splice(index, 1)
    setTipType(tipTypeCc.value)
  }
}
const tipAll = () => {
  tipTypeCc.value.forEach(item => {
    send('start-job', {
      type: item.type,
      gap: Number(item.gap) * Number(item.unit),
    })
  })
}
const stopAllTip = () => {
  setNextTime()
  tipTypeCc.value.forEach(item => {
    send('stop-job', {
      type: item.type,
    })
  })
}
// 提醒
const tip = (item: ObjectType) => {
  send('start-job', {
    type: item.type,
    gap: Number(item.gap) * Number(item.unit),
  })
}
// 终止提醒
const stopTip = (item: ObjectType) => {
  setNextTime(item.type, {})
  send('stop-job', {
    type: item.type,
  })
}

const newTipOps = ref<ObjectType>({})
// 新增
const addTipOps = () => {
  // 判空判断
  if (!newTipOps.value.label || !newTipOps.value.value) {
    ElMessage({
      message: '请填写完整信息',
      type: 'warning',
    })
    return;
  }
  setTipTypeOps(newTipOps)
  newTipOps.value = {}
}
const editTipOps = (item: ObjectType) => {
  newTipOps.value = item
}
// 删除
const delTipOps = (item: ObjectType) => {
  const index = tipTypeOpsCc.value.findIndex(i => item.label == i.label && item.value == i.value)
  if (index != -1) {
    tipTypeOpsCc.value.splice(index, 1)
    setTipTypeOps(tipTypeOpsCc.value)
  }
}

const uploadIcon = () => {
  const res = sendSync('get-file-list', {
    openDirectory: false,
    openFile: true,
    type: 'image',
  })
  if (res) {
    newTipOps.value.icon = 'jlocal:///' + encodeURIComponent(res[0])
    newTipOps.value.iconType = 'image'
  }
  console.log(res);
}

const curUnit = (unit: number) => {
  console.log(unit, 'unit')
  if (unit == 60 * 1000) {
    return '分钟'
  } else if (unit == 60 * 60 * 1000) {
    return '小时'
  } else if (unit == 1000) {
    return '秒'
  }
}
const getType = (type: string) => {
  return tipTypeOpsCc.value.find(i => i.value == type)?.label
}

onMounted(() => {
  console.log(tipTypeC.value)
})


</script>

<style scoped lang="scss">
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
  box-sizing: border-box;
  padding: 12px;
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

:deep(.file-move) {
  .el-form-item__content {
    .el-form-item {
      margin-top: 10px;

      .el-form-item__label {
        height: unset;
        line-height: 1.2em;
        display: flex;
        align-items: center;
      }
    }
  }
}

.show-icon {
    width: 36px;
    height: 36px;
    overflow: hidden;
    padding: 6px;
    &>* {
      width: 100%;
      height: 100%;
      display: inline-block;
    }
}
</style>
