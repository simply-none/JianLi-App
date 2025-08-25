<template>
  <el-form class="pomodoro-record" label-width="120" label-position="left">
    <el-form-item>
      <template #label>
        <div class="setting-title">番茄钟记录</div>
      </template>
    </el-form-item>

    <el-form-item label="选择日期" class="mode-wrapper">
      <el-date-picker v-model="curDate" value-format="YYYY-MM-DD" type="date" placeholder="选择日期"></el-date-picker>
    </el-form-item>
    <el-form-item label="该日番茄钟记录" class="mode-wrapper">
      <el-table :data="curDateData" max-height="360" :row-class-name="tableRowClassName">
        <el-table-column prop="label" label="工作状态">
          <template #default="scope">
            {{ scope.row.label }}
          </template>
        </el-table-column>
        <el-table-column prop="dateTime" label="时间">
          <template #default="scope">
            {{ scope.row.dateTime }}
          </template>
        </el-table-column>
      </el-table>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { h, ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { send, sendSync, getStore, setStore, getSqlData, pomodoroStatusTable } from '@/utils/common';
import moment from 'moment';
import { prefix } from '@/store/useGlobalSetting';

const curDate = ref(moment().format('YYYY-MM-DD'))
const curDateData = ref<ObjectType[]>([])

watch(curDate, (val) => {
  console.log(val)
  if (val) {
    getSqlData({
      tableName: pomodoroStatusTable,
      conditions: {
        date: val,
      }
    }).then(res => {
      console.log(res, '获取当前日期的数据')
      let getData = res.data || [] as ObjectType[]
      getData.sort = (a: any, b: any) => {
        return a.dateTime - b.dateTime
      }
      console.log(getData)
      curDateData.value = (getData || [])
      // .filter((item: ObjectType) => item.mode != 'development')
    })
  }
}, {
  immediate: true
})

const tableRowClassName = ({
  row,
  rowIndex,
}: {
  row: ObjectType
  rowIndex: number
}) => {
  return 'table-' + row.value
}

</script>

<style scoped lang="scss">
.pomodoro-record {
  padding: 24px;
  box-sizing: border-box;
  height: 100%;
  overflow: auto;
}

:deep(.el-table .table-work) {
  --el-table-tr-bg-color: #f0f9eb;

}

:deep(.el-table .table-rest) {
  --el-table-tr-bg-color: #fff5f5;
}

:deep(.el-table .table-screen) {
  --el-table-tr-bg-color: #e6fffb;
}
</style>
