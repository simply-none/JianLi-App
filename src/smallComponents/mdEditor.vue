<template>
  <draggableContainer v-bind="computedPosition" @update="updateFn">
    <div class="my-editor" @contextmenu.stop="contextmenuFn" :class="['me-' + theme]">
      <div class="my-editor-ops">
        <div class="meo-item" data-el="1" :style="{
          ...(props.data[1] || {}),
        }">
          <div class="meo-item-title" @click="showMornFn">主题</div>
          <el-select class="meo-item-content"  v-show="showMore" v-model="theme" placeholder="请选择主题" @change="changeTheme">
            <el-option v-for="item in themeOps" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="meo-item"  v-show="showMore" data-el="1" :style="{
          ...(props.data[1] || {}),
        }">
          <div class="meo-item-title">代码主题</div>
          <el-select class="meo-item-content" v-model="previewTheme" placeholder="请选择主题">
            <el-option v-for="item in previewThemeOps" :key="item" :label="item" :value="item" />
          </el-select>
        </div>
        <div class="meo-item meo-item-right" data-el="1" :style="{
          ...(props.data[1] || {}),
        }">
          <el-popover placement="right" :width="800" trigger="click" ref="meoNoteRef" @show="getNoteBookData"
            popper-class="meo-note">
            <template #reference>
              <el-button plain color="#3883fa" :dark="theme == 'dark' ? true : false"
                style="margin-right: 16px">加载数据</el-button>
            </template>
            <el-table :data="noteBookData" :max-height="360">
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
                  <el-button type="primary" size="small" v-if="scope.row.mdText"
                    @click="showContent(scope.row)">加载</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-popover>
          <el-button plain color="#3883fa" :dark="theme == 'dark' ? true : false" @click="saveNoteBook">保存</el-button>
        </div>
      </div>
      <div data-el="2" class="my-editor-split" :style="{
        ...(props.data[2] || {}),
      }">
        <MdEditor ref="editorRef" v-model="text" :theme="theme" :previewTheme="previewTheme" :preview="false" @on-save="onSave" />
      </div>
    </div>
  </draggableContainer>
</template>

<script setup>
import { ref, reactive, watch, computed, onMounted, onUnmounted, toRaw } from 'vue';
import { storeToRefs } from 'pinia';

import useGlobalSetting from '@/store/useGlobalSetting';
import useWorkOrRestStore from '@/store/useWorkOrReset';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { MdEditor } from 'md-editor-v3';
import 'md-editor-v3/lib/style.css';
import { ElMessage } from 'element-plus';
import { formatDate, getMonthRange, groupByDate } from '@/utils/time';

import draggableContainer from '@/components/draggableContainer.vue';

const props = defineProps({
  data: {
    type: Object,
    default: () => {
      return {};
    }
  },
})

const emit = defineEmits(['rightClick', 'update'])
const initPosition = {
  x: 0,
  y: 0,
  width: 200,
  height: 200,
}

const computedPosition = computed({
  get() {
    const p = JSON.parse(JSON.stringify(props.data || { position: initPosition }))
    console.warn(p, 'p')
    return p.position || initPosition;
  },
  set() { }
})

function updateFn(position) {
  console.log(position, 'position')
  computedPosition.value = {
    ...toRaw(computedPosition.value || {}),
    ...toRaw(position || {}),
  }
  console.log(computedPosition.value, 'computedPosition')
  emit('update', {
    ...toRaw(computedPosition.value || {}),
    ...toRaw(position || {}),
  })
}

function contextmenuFn(event) {
  const target = event.target;
  // 获取target所有的data-*属性
  const data = target.dataset;
  // 获取target所有的css样式
  const style = {
    ...window.getComputedStyle(target)
  }
  // 排除style中键为数字的属性
  for (let key in style) {
    if (!isNaN(key)) {
      delete style[key];
    }
  }
  console.log(data, 'data')
  console.log(style, 'style', Object.keys(style))

  emit('rightClick', {
    el: data.el,
    data: style,
  })
}

const showMore = ref(false)
const showMornFn = () => {
  showMore.value = !showMore.value
}

const previewTheme = ref('default')

// 'default' | 'github' | 'vuepress' | 'mk-cute' | 'smart-blue' | 'cyanosis'
const previewThemeOps = [
  'default',
  'github',
  'vuepress',
  'mk-cute',
  'smart-blue',
  'cyanosis',
]

const theme = ref(localStorage.getItem('editor-theme') || 'light')

const themeOps = ['light', 'dark']

function changeTheme (val) {
  localStorage.setItem('editor-theme', val)
}

const curNote = ref({})
const text = ref(curNote.value.mdText || '')
watch(() => curNote.value, (val) => {
  text.value = val.mdText || ''
}, {
  deep: true,
})

const meoNoteRef = ref()

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
      limit: 20,
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

const noteBookData = ref([])

async function getNoteBookData() {
  console.log('加载数据')
  fetchNoteData({
    days: 360,
    startDate: formatDate(new Date()).dateStr
  }).then(data => {
    noteBookData.value = data;
  })
}

function showContent(row) {
  console.log('显示内容:', row);
  curNote.value = row;
  meoNoteRef.value.hide()
}

const onSave = (v, h) => {
  console.log(v);
  h.then(async (html) => {
    try {
      let result = await window.ipcRenderer.handlePromise('set-data', {
        tableName: 'note_book',
        data: {
          ...curNote.value,
          key: curNote.value.key || uuidv4(),
          excerpt: (v || '').substring(0, 20) + '...',
          mdText: v,
          html: html,
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
        return true;

      } else {
        ElMessage.error('保存失败:' + result.error);
        return false;
      }
    } catch (error) {
      ElMessage.error('保存失败:' + error);
      return false;
    }
  });
};

let editorRef = ref()
async function saveNoteBook(v, h) {
  editorRef.value?.triggerSave();
}

</script>

<style lang="scss">
.meo-note {
  width: 600px;
}
</style>
<style lang="scss" scoped>
.my-editor {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 10px 20px;
  color: #6b686845;
  display: flex;
  flex-direction: column;
  gap: 6px;
  backdrop-filter: blur(6px);
}

.my-editor-ops {
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  gap: 1em;
  flex-wrap: wrap;

  .meo-item {
    flex: 1;
    display: inline-block;
    flex-direction: row;
    align-items: center;
    gap: 3px;

    &-right {
      flex: 0;
      width: 180px;
      display: flex;
      flex-direction: row;
      .el-button+.el-button {
        margin-left: 0;
      }
    }

    &-title {
      text-align: right;
      display: inline-block;
    }

    &-content {
      display: inline-block;
      width: 200px;
    }
  }
}

.me-light {
  color: #333;
  background-color: #fff;

  :deep(.el-select__wrapper) {
    background-color: #fff;
    box-shadow: 0 0 0 1px #d7d7d7 inset;
  }
}

.me-dark {
  color: #737373;

  :deep(.el-select__wrapper) {
    background-color: #1f1f1f;
    box-shadow: 0 0 0 1px #5c5c5c inset;
  }

  :deep(.md-editor-preview) {
    color: #6e6e6e;
  }
}

.md-editor-dark,
.md-editor-modal-container {
  --md-color: #909090;
  --md-bk-color: #1c1c1c1c;;
}
</style>  