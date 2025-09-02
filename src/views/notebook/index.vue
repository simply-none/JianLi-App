<template>
  <el-form class="fileRela-form" label-width="108" label-position="left">

    <el-form-item>
      <template #label>
        <div class="setting-title">笔记</div>
      </template>
    </el-form-item>

    <el-form-item label="笔记数据" class="mode-wrapper">
      <el-button type="primary" @click="showNotebookHistoryFn">显示笔记</el-button>
    </el-form-item>

    <el-form-item label="笔记数据" class="mode-wrapper" v-if="showNotebookHistory">

      <el-table :data="noteBookData" max-height="360">
        <el-table-column prop="excerpt" label="摘要">
          <template #default="scope">
            {{ scope.row.excerpt }}
          </template>
        </el-table-column>
        <el-table-column prop="createTime" label="时间">
          <template #default="scope">
            {{ scope.row.createTime }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">

          <template #default="scope">
            <el-button type="primary" size="small" @click="showContent(scope.row)">显示</el-button>
            <el-button type="danger" size="small" @click="deleteContent(scope.row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-form-item>

    <el-divider></el-divider>

    <el-form-item>
      <template #label>
        <div class="setting-title">{{ curstatusLabel }}</div>
      </template>
      <div class="setting-handle">
        <el-button type="primary" @click="addContent">新增内容</el-button>
      </div>
    </el-form-item>

    <el-form-item :label="curstatusLabel" class="mode-wrapper" v-if="showEditor">
      <umo-editor ref="editorRef" v-bind="options" />
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

const showEditor = ref(false);
const key = ref(uuidv4());
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
          key: key.value,
          excerpt: editorRef.value.getContentExcerpt(),
          html: content.html,
          createTime: moment().format('YYYY-MM-DD HH:mm:ss'),
        },
        config: {
          primaryKey: 'key',
        }
      })
      if (result.success) {
        console.log('保存成功:', result.data);
        getNoteBookData();
        return true;

      } else {
        console.log('保存失败:', result.error);
        return false;
      }
    } catch (error) {
      console.error('保存失败:', error);
      return false;
    }
  }
});

const noteBookData = ref([]);

onMounted(() => {
  getNoteBookData();
  showEditor.value = true;
})

async function getNoteBookData() {
  if (!showNotebookHistory.value) return;
  window.ipcRenderer.handlePromise('query-data', {
    tableName: 'note_book',
    conditions: {
      whereStr: "createTime >= DATE('now', '-90 days')",
      limit: 100,
      orderByDesc: true,
      orderBy: 'createTime'
    }
  }).then(result => {
    if (result.success) {
      console.log('查询结果:', result.data);
      noteBookData.value = result.data;
    }
  }).catch(err => {
    console.log('查询失败:', err);
  })
}

const showNotebookHistory = ref(false);
const showNotebookHistoryFn = () => {
  if (showNotebookHistory.value) {
    showNotebookHistory.value = false;
    noteBookData.value = [];
    return;
  }
  showNotebookHistory.value = true;
  getNoteBookData();
}


function addContent() {
  console.log('新增内容:');
  key.value = uuidv4();
  editorRef.value.setContent('');
  curstatusLabel.value = '新内容'
}

function showContent(row) {
  console.log('显示内容:', row);
  key.value = row.key;
  editorRef.value.setContent(row.html);
  curstatusLabel.value = '查看内容'
}

function deleteContent(row) {
  console.log('删除内容:', row);
  window.ipcRenderer.handlePromise('delete-data', {
    tableName: 'note_book',
    condition: {
      key: row.key,
    }
  }).then(result => {
    if (result.success) {
      console.log('删除成功:', result.data);
      getNoteBookData();
    } else {
      console.log('删除失败:', result.error);
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
