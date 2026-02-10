<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">

    <el-form-item>
      <template #label>
        <div class="setting-title">笔记</div>
      </template>
    </el-form-item>

    <div class="notebook-panel"  v-if="showNotebookHistory">
      <div class="notebook-date">
          <el-date-picker-panel v-model="curDate" :border="true" @panel-change="panelChange">
            <template #default="scope">
              <div class="notebook-date-item">
                <div class="notebook-date-label">
                  {{  formatDate(scope.date).day }}
                </div>
                <div class="notebook-date-note" :class="[getCurDateNoteCount(scope.date) ? 'notebook-date-note-is' : '']">
                </div>
              </div>
            </template>
          </el-date-picker-panel>
      </div>
      <div class="notebook-list">
        <el-table :data="noteBookData" max-height="360">
          <el-table-column prop="excerpt" label="摘要">
            <template #default="scope">
              {{ scope.row.excerpt }}
            </template>
          </el-table-column>
          <el-table-column prop="createTime" label="时间">
            <template #default="scope">
              {{ scope.row.createTime || '--' }}
            </template>
          </el-table-column>
          <el-table-column prop="updateTime" label="更新时间">
            <template #default="scope">
              {{ scope.row.updateTime || '--' }}
            </template>
          </el-table-column>
          <el-table-column label="操作" width="150" fixed="right">

            <template #default="scope">
              <el-button type="primary" size="small" @click="showContent(scope.row)">显示</el-button>
              <el-button type="danger" size="small" @click="deleteContent(scope.row)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <el-form-item label="笔记数据" class="mode-wrapper">
      <el-button type="primary" @click="showNotebookHistoryFn">
        {{ showNotebookHistory ? '隐藏' : '显示' }}
      </el-button>
      <el-button type="primary" @click="getNoteBookData">
        展示所有笔记
      </el-button>
    </el-form-item>

    <el-divider></el-divider>

    <el-form-item>
      <template #label>
        <div class="setting-title">{{ curstatusLabel }}</div>
      </template>
      <div class="setting-handle">
        <el-button type="warning" @click="addContent">清空数据新建内容</el-button>
        <el-button type="primary" @click="saveNoteBook">保存笔记</el-button>
      </div>
    </el-form-item>

    <el-form-item :label="curstatusLabel" class="mode-wrapper" v-if="showEditor">
      <umo-editor ref="editorRef" :options="options" />
    </el-form-item>
  </el-form>

</template>

<script setup>
import { ref, reactive, watch, computed, toRaw, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { UmoEditor } from '@umoteam/editor';
import '@umoteam/editor/style'
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, getMonthRange, groupByDate } from '@/utils/time';
import { ElMessage } from 'element-plus';
import umoEditor from './umoEditor.vue';

const showEditor = ref(false);
const key = ref(uuidv4());
const curNote = ref({})
const editorRef = ref(null);
const curstatusLabel = ref('新内容')

const options = ref({
  // 配置项
  // ...
  onSave: async (content, page, document) => {
    console.log(content, page, document);
    try {
      let result = await window.ipcRenderer.handlePromise('set-data', {
        tableName: 'note_book',
        data: {
          ...curNote.value,
          key: curNote.value.key || key.value,
          excerpt: editorRef.value.getContentExcerpt(),
          html: content.html,
          createTime: curNote.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
          updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        },
        config: {
          primaryKey: 'key',
        }
      })
      if (result.success) {
        ElMessage.success('保存成功');
        curNote.value = {}
        panelChange(new Date());
        return true;

      } else {
        ElMessage.error('保存失败:' + result.error);
        return false;
      }
    } catch (error) {
      ElMessage.error('保存失败:' + error);
      return false;
    }
  }
});

async function saveNoteBook () {
  try {
    let content = editorRef.value.getContent('html');
    let result = await window.ipcRenderer.handlePromise('set-data', {
      tableName: 'note_book',
      data: {
        ...curNote.value,
        key: curNote.value.key || key.value,
        excerpt: editorRef.value.getContentExcerpt(),
        html: content,
        createTime: curNote.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
        updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      },
      config: {
        primaryKey: 'key',
      }
    })
    if (result.success) {
      panelChange(new Date());
      ElMessage.success('保存成功');
      curNote.value = {}
      return true;

    } else {
      ElMessage.error('保存失败:' + result.error);
      return false;
    }
  } catch (error) {
    ElMessage.error('保存失败:' + error);
    return false;
  }
}

const noteBookData = ref([]);

onMounted(() => {
  panelChange(new Date());
  showEditor.value = true;
})

const curDate = ref();
const curMonthGroupNote = ref({})
watch(curDate, (newV) => {
  noteBookData.value = curMonthGroupNote.value[formatDate(newV).dateStr] || []
})

function getCurDateNoteCount(date) {
  let dateStr = formatDate(date).dateStr;
  return curMonthGroupNote.value[dateStr]?.length || 0;
}

function panelChange(date, mode, view) {
  let { firstDay, lastDay } = getMonthRange(date || new Date())
  fetchNoteData({
    startDate: firstDay,
    endDate: lastDay,
  }).then(data => {
    let newData = groupByDate(data)
    curMonthGroupNote.value = newData;
    noteBookData.value = data || []
  })
}

function fetchNoteData(options = {}) {
  const {
    days = 90,
    specificDate = null,
    startDate = null,
    endDate = null
  } = options;
  
  let whereStr;
  
  if (specificDate) {
    // 查询指定日期的数据
    whereStr = `createTime BETWEEN '${specificDate}' AND datetime('${specificDate}', '+1 day')`;
  } else if (startDate && endDate) {
    // 查询指定日期范围的数据
    whereStr = `createTime BETWEEN '${startDate}' AND '${endDate}'`;
  } else {
    // 查询最近指定天数的数据
    whereStr = `createTime >= DATE('now', '-${days} days')`;
  }
  
  return window.ipcRenderer.handlePromise('query-data', {
    tableName: 'note_book',
    conditions: {
      whereStr: whereStr,
      limit: 100,
      orderByDesc: false,
      orderBy: 'createTime'
    }
  }).then(result => {
    if (result.success) {
      ElMessage.success('查询成功');
      return result.data;
    }
    return [];
  }).catch(err => {
    ElMessage.error('查询失败:' + err);
    return [];
  });
}

async function getNoteBookData() {
  if (!showNotebookHistory.value) return;
  fetchNoteData({
    days: 360,
    startDate: formatDate(new Date()).dateStr
  }).then(data => {
    noteBookData.value = data;
    curMonthGroupNote.value = groupByDate(data);
  })
}

const showNotebookHistory = ref(true);
const showNotebookHistoryFn = () => {
  if (showNotebookHistory.value) {
    showNotebookHistory.value = false;
    noteBookData.value = [];
    return;
  }
  showNotebookHistory.value = true;
  panelChange(new Date());
}


function addContent() {
  console.log('新增内容:');
  key.value = uuidv4();
  curNote.value = {}
  editorRef.value.setContent('');
  curstatusLabel.value = '新内容'
}

function showContent(row) {
  console.log('显示内容:', row);
  key.value = row.key;
  curNote.value = row;
  editorRef.value.setContent(row.html);
  curstatusLabel.value = '查看内容'
}

function deleteContent(row) {
  window.ipcRenderer.handlePromise('delete-data', {
    tableName: 'note_book',
    condition: {
      key: row.key,
    }
  }).then(result => {
    if (result.success) {
      ElMessage.success('删除成功');
      panelChange(new Date());
    } else {
      ElMessage.error('删除失败');
    }
  })
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

.setting-form {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  background-color: #ffffff;
}

.setting-handle {
  width: 100%;
  text-align: right;
}

.cache-list {
  word-break: break-all;
}

:deep(.today) {
  color: #409eff;
  font-weight: 900;
}
.notebook-panel {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 24px;
  padding-bottom: 24px;

  .notebook-list {
    flex: 1;
    width: 0;
  }
  .notebook-date-item {
    &:hover {
      background: #57c5ff;
      color: #fff;
      border-radius: 6px;
    }
  }
  .notebook-date-note-is {
    height: 5px;
    width: 5px;
    position: absolute;
    left: 50%;
    text-align: center;
    transform: translate(-50%, -6px);
    border-radius: 50%;
    background: #409eff;
  }
}
</style>
