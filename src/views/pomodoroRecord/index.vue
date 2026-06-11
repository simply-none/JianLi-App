<template>
  <div class="pomodoro-record">
    <div class="record-header">
      <div class="setting-title fixed-width">番茄钟记录</div>
      <el-radio-group v-model="activeTab" size="small" style="margin-top: 10px">
        <el-radio-button value="table">列表</el-radio-button>
        <el-radio-button value="charts">图表</el-radio-button>
      </el-radio-group>
    </div>

    <div v-show="activeTab === 'table'" class="tab-content">
      <el-form class="pomodoro-record-form" label-width="120" label-position="left">
        <el-form-item label="选择日期" class="mode-wrapper">
          <el-date-picker v-model="curDate" value-format="YYYY-MM-DD" type="date" placeholder="选择日期"></el-date-picker>
        </el-form-item>
        <el-form-item label="该日番茄钟记录" class="mode-wrapper">
          <el-table :data="curDateData" max-height="600" :row-class-name="tableRowClassName">
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
    </div>

    <ChartsView v-show="activeTab === 'charts'" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { getSqlData, pomodoroStatusTable, getStore, setStore } from '@/utils/common'
import moment from 'moment'
import ChartsView from './charts.vue'

const POMODORO_TAB_KEY = 'pomodoroRecordActiveTab'
const savedTab = getStore(POMODORO_TAB_KEY)
const activeTab = ref(savedTab === 'charts' ? 'charts' : 'table')

watch(activeTab, (val) => {
  setStore(POMODORO_TAB_KEY, val)
})
const curDate = ref(moment().format('YYYY-MM-DD'))
const curDateData = ref<ObjectType[]>([])

watch(curDate, (val) => {
  if (val) {
    getSqlData({
      tableName: pomodoroStatusTable,
      conditions: {
        date: val,
      }
    }).then(res => {
      let getData = res.data || [] as ObjectType[]
      getData.sort = (a: any, b: any) => {
        return a.dateTime - b.dateTime
      }
      curDateData.value = (getData || [])
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

.record-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 16px;
}

.tab-content {
  margin-top: 8px;
}

.fixed-width {
  width: unset;
  padding-right: 36px;
  height: 36px;
  line-height: 36px;
}
</style>
