<template>
  <div class="notebook-container">
    <header class="notebook-header">
      <div class="header-left">
        <h1 class="page-title">笔记本</h1>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="addContent">
          <LucideIcon name="Plus" />
          新建笔记
        </el-button>
        <el-button type="primary" @click="getNoteBookData">
          <LucideIcon name="ListCollapse" />
          展示所有笔记
        </el-button>
      </div>
    </header>

    <div class="notebook-body">
      <div class="sidebar-list">
        <aside class="calendar-sidebar">
          <div class="sidebar-section">
            <div class="section-header">
              <button @click="prevMonth" class="nav-btn">
                <LucideIcon name="ArrowLeft" />
              </button>
              <span class="month-title">{{ currentMonthLabel }}</span>
              <button @click="nextMonth" class="nav-btn">
                <LucideIcon name="ArrowRight" />
              </button>
            </div>
            <div class="weekdays">
              <span v-for="day in weekdays" :key="day">{{ day }}</span>
            </div>
            <div class="calendar-grid">
              <div v-for="(day, index) in calendarDays" :key="index" class="calendar-day" :class="{
                'other-month': !day.currentMonth,
                'today': day.isToday,
                'selected': day.dateStr === selectedDate,
                'has-note': day.noteCount > 0
              }" @click="selectDate(day)">
                <span class="day-number">{{ day.day }}</span>
                <span v-if="day.noteCount > 0" class="note-dot"></span>
              </div>
            </div>
          </div>
        </aside>

        <section class="notes-list">
          <div class="list-header">
            <h2 class="list-title">笔记列表</h2>
            <span class="note-count">{{ noteBookData.length }} 条</span>
          </div>

          <div class="notes-scroll">
            <div v-for="(note, index) in noteBookData" :key="note.key || index" class="note-card"
              :class="{ active: curNote.key && curNote.key === note.key }" @click="showContent(note)">
              <div class="card-header">
                <span class="note-time">{{ formatTime(note.updateTime) }}</span>
                <button @click.stop="deleteContent(note)" class="delete-btn">
                  <LucideIcon name="Trash" />
                </button>
              </div>
              <div class="card-body">
                <p class="note-excerpt">{{ note.excerpt || '无摘要' }}</p>
              </div>
              <div class="card-footer">
                <span class="note-date">{{ formatDateLabel(note.updateTime) }}</span>
              </div>
            </div>

            <div v-if="noteBookData.length === 0" class="empty-notes">
              <div class="empty-icon">
                <LucideIcon name="FileText" />
              </div>
              <p>暂无笔记</p>
              <button @click="addContent">创建第一条笔记</button>
            </div>
          </div>
        </section>
      </div>

      <main class="editor-section">
        <div class="editor-header">
          <div class="editor-title">
            <LucideIcon name="Pencil" />
            <span>{{ curstatusLabel }}</span>
          </div>
          <div class="editor-actions">
            <el-button type="warning" @click="addContent">
              <LucideIcon name="BookmarkPlus" />
              新建
            </el-button>
            <el-button type="primary" @click="saveNoteBook">
              <LucideIcon name="BookMarked" />
              保存
            </el-button>
          </div>
        </div>
        <div class="editor-container">
          <umo-editor v-if="showEditor" ref="editorRef" :options="options" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { formatDate, getMonthRange, groupByDate } from '@/utils/time';
import umoEditor from './umoEditor.vue';

const showEditor = ref(false);
const key = ref(uuidv4());
const curNote = ref({})
const editorRef = ref(null);
const curstatusLabel = ref('新内容')

const options = ref({
  onSave: async (content, page, document) => {
    window.ipcRenderer.handlePromise('set-data', {
      tableName: 'note_book',
      data: {
        ...curNote.value,
        key: curNote.value.key || key.value,
        excerpt: editorRef.value?.getContentExcerpt?.() || '',
        html: content.html,
        createTime: curNote.value.createTime || moment().format('YYYY-MM-DD HH:mm:ss'),
        updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      },
      config: {
        primaryKey: 'key',
      }
    }).then(result => {
      if (result.success) {
        ElMessage.success('保存成功');
        curNote.value = {}
        panelChange(new Date());
        return true;
      } else {
        ElMessage.error('保存失败:' + result.error);
        return false;
      }
    }).catch(err => {
      ElMessage.error('保存失败:' + err);
      return false;
    })
  }
});

async function saveNoteBook() {
  if (!editorRef.value) {
    ElMessage.error('编辑器未初始化');
    return false;
  }
  let content = editorRef.value.getContent('html');
  window.ipcRenderer.handlePromise('set-data', {
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
  }).then(result => {
    if (result.success) {
      panelChange(new Date());
      ElMessage.success('保存成功');
      curNote.value = {}
      return true;
    } else {
      ElMessage.error('保存失败:' + result.error);
      return false;
    }
  }).catch(err => {
    ElMessage.error('保存失败:' + err);
    return false;
  })
}

const noteBookData = ref([]);

onMounted(() => {
  panelChange(new Date());
  showEditor.value = true;
})

const curDate = ref(new Date());
const curMonthGroupNote = ref({});

const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

const currentMonth = ref(moment());

const currentMonthLabel = computed(() => {
  return currentMonth.value.format('YYYY年M月');
});

const calendarDays = computed(() => {
  const year = currentMonth.value.year();
  const month = currentMonth.value.month();
  const firstDay = moment({ year, month, day: 1 });
  const lastDay = moment(firstDay).endOf('month');
  const startDay = firstDay.day();
  const totalDays = lastDay.date();

  const days = [];
  const today = moment();

  for (let i = startDay - 1; i >= 0; i--) {
    const day = moment(firstDay).subtract(i + 1, 'day');
    days.push({
      day: day.date(),
      dateStr: day.format('YYYY-MM-DD'),
      currentMonth: false,
      isToday: day.isSame(today, 'day'),
      noteCount: curMonthGroupNote.value[day.format('YYYY-MM-DD')]?.length || 0
    });
  }

  for (let i = 1; i <= totalDays; i++) {
    const day = moment({ year, month, day: i });
    days.push({
      day: i,
      dateStr: day.format('YYYY-MM-DD'),
      currentMonth: true,
      isToday: day.isSame(today, 'day'),
      noteCount: curMonthGroupNote.value[day.format('YYYY-MM-DD')]?.length || 0
    });
  }

  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    const day = moment(lastDay).add(i, 'day');
    days.push({
      day: day.date(),
      dateStr: day.format('YYYY-MM-DD'),
      currentMonth: false,
      isToday: day.isSame(today, 'day'),
      noteCount: curMonthGroupNote.value[day.format('YYYY-MM-DD')]?.length || 0
    });
  }
  console.log(days, 'days in calendarDays');
  return days;
});

const selectedDate = ref(moment().format('YYYY-MM-DD'));

watch(curDate, (newV) => {
  noteBookData.value = curMonthGroupNote.value[formatDate(newV).dateStr] || []
});

watch(selectedDate, (newDate) => {
  noteBookData.value = curMonthGroupNote.value[newDate] || [];
});

function prevMonth() {
  currentMonth.value = moment(currentMonth.value).subtract(1, 'month');
}

function nextMonth() {
  currentMonth.value = moment(currentMonth.value).add(1, 'month');
}

function selectDate(day) {
  if (selectedDate.value !== day.dateStr) {
    selectedDate.value = day.dateStr;
  }
  const newMonth = moment(day.dateStr);
  if (!currentMonth.value.isSame(newMonth, 'month')) {
    currentMonth.value = newMonth;
  }
}

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
    console.log(newData, 'newData in panelChange')
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

  let sql = 'SELECT * FROM note_book';
  const params = [];
  const whereClauses = [];

  if (specificDate) {
    whereClauses.push('createTime BETWEEN ? AND datetime(?, "+1 day")');
    params.push(specificDate, specificDate);
  } else if (startDate && endDate) {
    whereClauses.push('createTime BETWEEN ? AND ?');
    params.push(startDate, endDate);
  } else {
    whereClauses.push("createTime >= DATE('now', '-? days')");
    params.push(days);
  }

  if (whereClauses.length > 0) {
    sql += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  sql += ' ORDER BY createTime ASC LIMIT 100';

  return window.ipcRenderer.handlePromise('new-sql:execute', {
    sql,
    params,
  }).then(result => {
    if (result.success) {
      return result.data?.rows || [];
    }
    return [];
  }).catch(err => {
    ElMessage.error('查询失败:' + err);
    return [];
  });
}

function formatTime(time) {
  if (!time) return '--';
  return moment(time).format('HH:mm');
}

function formatDateLabel(time) {
  if (!time) return '--';
  const date = moment(time);
  const today = moment();
  const yesterday = moment().subtract(1, 'day');

  if (date.isSame(today, 'day')) return '今天';
  if (date.isSame(yesterday, 'day')) return '昨天';
  if (date.isSame(today, 'week')) return date.format('周ddd');
  return date.format('M月D日');
}

const showNotebookHistory = ref(false);
async function getNoteBookData() {
  if (!showNotebookHistory.value) {
    fetchNoteData({
      days: 360,
      startDate: formatDate(new Date()).dateStr
    }).then(data => {
      noteBookData.value = data;
      curMonthGroupNote.value = groupByDate(data);
    })
    showNotebookHistory.value = true;
  } else {
    showNotebookHistory.value = false;
  }
}

function addContent() {
  key.value = uuidv4();
  curNote.value = {}
  if (editorRef.value) {
    editorRef.value.setContent('');
  }
  curstatusLabel.value = '新内容'
}

function showContent(row) {
  key.value = row.key;
  curNote.value = row;
  if (editorRef.value) {
    editorRef.value.setContent(row.html || '');
  }
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
.notebook-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
}

.notebook-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border-subtle);

  .header-left {
    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
  }

  .header-right {
    display: flex;
    gap: 12px;
  }
}

.notebook-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.sidebar-list {
  flex: 1;
  width: 0;
}

.calendar-sidebar {
  width: 100%;
  box-sizing: border-box;
  background: var(--bg-card);
  border-right: 1px solid var(--border-subtle);
  padding: 16px;
  overflow: auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;


  .sidebar-section {
    flex: 1;
    width: 50%;
    max-width: 360px;
    min-width: 220px;
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;

      .nav-btn {
        width: 32px;
        height: 32px;
        border: none;
        background: transparent;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-secondary);
        transition: all 0.2s ease;

        &:hover {
          background: var(--bg-hover);
          color: var(--text-primary);
        }

        .el-icon {
          font-size: 16px;
        }
      }

      .month-title {
        font-size: 16px;
        font-weight: 600;
        color: var(--text-primary);
      }
    }

    .weekdays {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      text-align: center;
      margin-bottom: 8px;

      span {
        font-size: 12px;
        color: var(--text-muted);
        font-weight: 500;
      }
    }

    .calendar-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 4px;

      .calendar-day {
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s ease;
        position: relative;

        .day-number {
          font-size: 13px;
          color: var(--text-primary);
        }

        .note-dot {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: var(--color-primary);
          margin-top: 2px;
        }

        &.other-month {
          .day-number {
            color: var(--text-muted);
          }
        }

        &.today {
          background: var(--color-primary);

          .day-number {
            color: #fff;
          }
        }

        &.selected {
          background: var(--color-primary-light);
          border: 1px solid var(--color-primary);
        }

        &.has-note:not(.today):not(.selected) {
          background: var(--bg-hover);
        }

        &:hover:not(.other-month) {
          background: var(--bg-hover);
        }
      }
    }
  }
}

.notes-list {
  flex: 1;
  background: var(--bg-secondary);
  border-right: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;

  .list-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px;
    border-bottom: 1px solid var(--border-subtle);

    .list-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }

    .note-count {
      font-size: 13px;
      color: var(--text-muted);
      background: var(--bg-hover);
      padding: 4px 10px;
      border-radius: 10px;
    }
  }

  .notes-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 12px;

    .note-card {
      background: var(--bg-card);
      border-radius: var(--radius-card);
      padding: 14px;
      margin-bottom: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;

      &:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-card);
        border-color: var(--border-subtle);
      }

      &.active {
        border-color: var(--color-primary);
        background: var(--color-primary-light);
      }

      .card-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .note-time {
          font-size: 12px;
          color: var(--text-muted);
          font-family: 'SF Mono', Monaco, monospace;
        }

        .delete-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: transparent;
          border-radius: 4px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          opacity: 0;
          transition: all 0.2s ease;

          &:hover {
            background: rgba(239, 68, 68, 0.1);
            color: #ef4444;
          }
        }

        .note-card:hover & .delete-btn {
          opacity: 1;
        }
      }

      .card-body {
        margin-bottom: 8px;

        .note-excerpt {
          font-size: 14px;
          color: var(--text-primary);
          line-height: 1.5;
          margin: 0;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      }

      .card-footer {
        .note-date {
          font-size: 12px;
          color: var(--text-muted);
        }
      }
    }

    .empty-notes {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 40px 20px;
      text-align: center;

      .empty-icon {
        width: 48px;
        height: 48px;
        border-radius: 50%;
        background: var(--bg-hover);
        display: flex;
        align-items: center;
        justify-content: center;
        margin-bottom: 12px;

        .el-icon {
          font-size: 24px;
          color: var(--text-muted);
        }
      }

      p {
        font-size: 14px;
        color: var(--text-muted);
        margin: 0 0 16px;
      }

      button {
        padding: 8px 20px;
        background: var(--color-primary);
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s ease;

        &:hover {
          opacity: 0.9;
        }
      }
    }
  }
}

.editor-section {
  flex: 2;
  width: 0;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);

  .editor-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 20px;
    background: var(--bg-card);
    border-bottom: 1px solid var(--border-subtle);

    .editor-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);

      .el-icon {
        color: var(--color-primary);
      }
    }

    .editor-actions {
      display: flex;
      gap: 8px;
    }
  }

  .editor-container {
    flex: 1;
    overflow: auto;
  }
}
</style>