<template>
  <div class="todo-mini-window"  @dblclick="cycleTheme">
    <div class="mouse-controls">
      <div class="mouse-left" @mousemove="disableMouseClickThroughFn"></div>
      <div class="mouse-right" @mousemove="disableMouseClickThroughFn"></div>
    </div>

    <div class="content-area">
      <div class="todo-header" @dblclick="cycleTheme">
        <span class="todo-title">待办</span>
        <span class="todo-count">{{ pendingTodos.length }}</span>
      </div>

      <div class="todo-input-wrapper">
        <LucideIcon name="Plus" class="input-icon" />
        <input
          v-model="newTodoTitle"
          type="text"
          placeholder="添加待办..."
          class="todo-input"
          @keyup.enter="addNewTodo"
          @focus="disableMouseClickThroughFn"
        />
      </div>

      <div class="todo-list" ref="todoListRef">
        <div
          v-for="todo in pendingTodos"
          :key="todo.key"
          class="todo-item"
          @click="toggleTodo(todo)"
        >
          <div class="todo-left">
            <div class="checkbox" :class="{ checked: todo.completed === 1 }">
              <LucideIcon v-if="todo.completed === 1" name="Check" class="check-icon" />
            </div>
            <span class="todo-text">{{ todo.title }}</span>
          </div>
          <div class="todo-right">
            <span v-if="todo.dueDate" class="todo-due-date" :class="formatDueDate(todo.dueDate).status">
              <LucideIcon name="Clock" class="due-date-icon" />
              {{ formatDueDate(todo.dueDate).text }}
            </span>
            <span class="priority-dot" :class="todo.priority"></span>
          </div>
          
          <div class="todo-tooltip" v-if="todo.description">
            <div class="tooltip-desc">{{ todo.description }}</div>
          </div>
        </div>

        <div v-if="pendingTodos.length === 0" class="empty-todo">
          <LucideIcon name="CheckCircle" class="empty-icon" />
          <span>暂无待办</span>
        </div>
      </div>

      <div class="todo-footer">
        <span class="footer-hint">双击切换主题</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import LucideIcon from '@/components/LucideIcon.vue';
import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import { ElMessage, ElMessageBox } from 'element-plus';

interface TodoItem {
  key: string;
  title: string;
  description: string;
  tags: string;
  completed: number;
  completedTime: string;
  priority: string;
  dueDate: string;
  createTime: string;
  updateTime: string;
}

const allTodos = ref<TodoItem[]>([]);
const newTodoTitle = ref('');
const todoListRef = ref(null);

const themes = [
  'coral', 'mint', 'sky', 'lavender', 'sakura',
  'amber', 'white', 'dark', 'gray', 'aurora'
];

const pendingTodos = computed(() => {
  return allTodos.value
    .filter(t => t.completed == 0)
    .sort((a, b) => {
      const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
      return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
    });
});

const cycleTheme = () => {
  console.log('Theme cycle');
  const currentSkin = document.documentElement.getAttribute('data-skin') || 'white';
  const idx = themes.indexOf(currentSkin);
  const nextTheme = themes[(idx + 1) % themes.length];

  applyTheme(nextTheme);
  saveConfig('skin', nextTheme);
};

const applyTheme = (theme: string) => {
  if (theme === 'white') {
    document.documentElement.removeAttribute('data-skin');
  } else {
    document.documentElement.setAttribute('data-skin', theme);
  }
};

const saveConfig = (key: string, value: string) => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', 'window-mode:todo');
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {});
    config[key] = value;
    window.ipcRenderer.sendSync('set-store', 'window-mode:todo', JSON.stringify(config));
    window.ipcRenderer.send('sync-data-to-other-window', {
      todoMiniWindowConfig: { ...config },
    });
  } catch (e) {
    console.log('保存配置失败:', e);
  }
};

const loadConfig = () => {
  try {
    const configStr = window.ipcRenderer.sendSync('get-store', 'window-mode:todo');
    const config = configStr && typeof configStr === 'string' ? JSON.parse(configStr) : (configStr || {});
    if (config.skin) {
      applyTheme(config.skin);
    }
  } catch (e) {
    console.log('加载配置失败:', e);
  }
};

async function fetchTodos() {
  try {
    const result = await window.ipcRenderer.handlePromise('new-sql:execute', {
      sql: 'SELECT * FROM todo_list WHERE completed = 0 ORDER BY priority ASC, updateTime DESC',
      params: [],
    });

    if (result.success) {
      const data = (result.data || []).rows || [];
      console.log(data, 'data')
      allTodos.value = data
    }
  } catch (error) {
    console.error('获取待办失败:', error);
  }
}

async function addNewTodo() {
  const title = newTodoTitle.value.trim();
  if (!title) return;

  const todoData: TodoItem = {
    key: uuidv4(),
    title,
    description: '',
    tags: '[]',
    completed: 0,
    completedTime: '',
    priority: 'medium',
    dueDate: '',
    createTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
  };

  const result = await window.ipcRenderer.handlePromise('new-sql:upsert', {
    tableName: 'todo_list',
    data: todoData,
    config: { primaryKey: 'key' },
  });

  if (result.success) {
    allTodos.value.unshift(todoData);
    newTodoTitle.value = '';
    window.ipcRenderer.send('sync-data-to-other-window', { todoUpdated: true });
  }
}

async function toggleTodo(todo: TodoItem) {
  try {
    await ElMessageBox.confirm(
      `确定要将"${todo.title}"标记为已完成吗？`,
      '确认完成',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    );

    const todoData = {
      ...todo,
      completed: 1,
      completedTime: moment().format('YYYY-MM-DD HH:mm:ss'),
      updateTime: moment().format('YYYY-MM-DD HH:mm:ss'),
    };

    const result = await window.ipcRenderer.handlePromise('new-sql:upsert', {
      tableName: 'todo_list',
      data: todoData,
      config: { primaryKey: 'key' },
    });

    if (result.success) {
      const index = allTodos.value.findIndex(t => t.key === todo.key);
      if (index > -1) {
        allTodos.value.splice(index, 1);
      }
      window.ipcRenderer.send('sync-data-to-other-window', { todoUpdated: true });
      ElMessage.success('已标记为完成');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('操作失败:', error);
    }
  }
}

function formatDueDate(dueDate: string): { text: string; status: string } {
  const now = moment();
  const due = moment(dueDate);
  
  if (due.isSame(now, 'day')) {
    return { text: `今天 ${due.format('HH:mm')}`, status: 'today' };
  } else if (due.isSame(moment(now).add(1, 'day'), 'day')) {
    return { text: `明天 ${due.format('HH:mm')}`, status: 'tomorrow' };
  } else if (due.isBefore(now)) {
    return { text: `已过期 ${due.format('MM-DD HH:mm')}`, status: 'overdue' };
  } else {
    return { text: due.format('MM-DD HH:mm'), status: 'future' };
  }
}

function parseTags(tags: string): string[] {
  try {
    const parsed = JSON.parse(tags);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

const enableMouseClickThroughFn = () => {
  window.ipcRenderer.send('enable-mouse-click-through', 'todoMiniWindow');
};

const disableMouseClickThroughFn = () => {
  window.ipcRenderer.send('disable-mouse-click-through', 'todoMiniWindow');
};

window.ipcRenderer.on('sync-data-to-other-window', (event: any, arg: any) => {
  if (arg && arg.todoUpdated) {
    fetchTodos();
  }
});

onMounted(() => {
  loadConfig();
  fetchTodos();

  setInterval(() => {
    fetchTodos();
  }, 5000);
});
</script>

<style lang="scss">
:root {
  --jianli-global-font: "";
  --jianli-global-font-EN: "";
}

html, body {
  font-family: var(--jianli-global-font-EN), var(--jianli-global-font);
}
</style>

<style lang="scss" scoped>
.todo-mini-window {
  // 禁止复制
  user-select: none;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 8px;
  background: var(--skin-bg);
  border-radius: 0.8em;
  backdrop-filter: blur(10px);
  display: flex;
  flex-direction: column;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
  font-size: clamp(12px, 3vmin, 16px);
  border: 1px solid var(--skin-border);
}

.mouse-controls {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;

  .mouse-left,
  .mouse-right {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 8%;
    max-width: 16px;
    min-width: 8px;
    pointer-events: auto;
    cursor: default;
  }

  .mouse-left {
    left: 0;
  }

  .mouse-right {
    right: 0;
  }
}

.content-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  z-index: 1;
  min-height: 0;
  cursor: pointer;
}

.todo-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--skin-border);
  margin-bottom: 8px;
  -webkit-app-region: drag;

  .todo-title {
    font-size: 1.3em;
    font-weight: 600;
    color: var(--skin-text-primary);
  }

  .todo-count {
    background: var(--skin-dot);
    color: #fff;
    font-size: 0.9em;
    padding: 2px 8px;
    border-radius: 10px;
    font-weight: 500;
  }
}

.todo-input-wrapper {
  position: relative;
  margin-bottom: 8px;

  .input-icon {
    position: absolute;
    left: 8px;
    top: 50%;
    transform: translateY(-50%);
    color: var(--skin-text-primary);
    font-size: 16px;
    opacity: 0.6;
  }

  .todo-input {
    width: 100%;
    padding: 8px 8px 8px 28px;
    border: 1px solid var(--skin-border);
    border-radius: 0.4em;
    background: rgba(255, 255, 255, 0.1);
    color: var(--skin-text-primary);
    font-size: 1em;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;

    &::placeholder {
      color: var(--skin-text-primary);
      opacity: 0.5;
    }

    &:focus {
      border-color: var(--skin-dot);
    }
  }
}

.todo-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;

  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--skin-border);
    border-radius: 2px;
  }
}

.todo-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 0.4em;
  cursor: pointer;
  transition: background 0.2s;
  position: relative;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    
    .todo-tooltip {
      opacity: 1;
      visibility: visible;
      transform: translateX(-50%) translateY(-8px);
    }
  }

  .todo-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .checkbox {
    width: 12px;
    height: 12px;
    border: 1.5px solid var(--skin-border);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all 0.2s;

    &.checked {
      background: var(--skin-dot);
      border-color: var(--skin-dot);
    }

    .check-icon {
      color: #fff;
      font-size: 10px;
    }
  }

  .todo-text {
    font-size: 1em;
    color: var(--skin-text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
  }

  .todo-right {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }

  .todo-due-date {
    display: flex;
    align-items: center;
    gap: 3px;
    font-size: 0.85em;

    .due-date-icon {
      font-size: 12px;
    }

    &.today {
      color: #3b82f6;
    }

    &.tomorrow {
      color: #22c55e;
    }

    &.overdue {
      color: #ef4444;
    }

    &.future {
      color: var(--skin-text-secondary);
    }
  }

  .priority-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;

    &.high {
      background: #ef4444;
    }

    &.medium {
      background: #f59e0b;
    }

    &.low {
      background: #22c55e;
    }
  }

  .todo-tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background: var(--skin-bg);
    border: 1px solid var(--skin-border);
    border-radius: 0.4em;
    padding: 8px 12px;
    min-width: 150px;
    max-width: 250px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    opacity: 0;
    visibility: hidden;
    transition: all 0.2s ease;
    z-index: 100;
    pointer-events: none;

    &::after {
      content: '';
      position: absolute;
      top: 100%;
      left: 50%;
      transform: translateX(-50%);
      border: 6px solid transparent;
      border-top-color: var(--skin-bg);
    }

    .tooltip-desc {
      font-size: 0.95em;
      color: var(--skin-text-primary);
      line-height: 1.4;
      white-space: pre-wrap;
      word-break: break-word;
    }
  }
}

.empty-todo {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px 0;
  color: var(--skin-text-primary);
  opacity: 0.6;

  .empty-icon {
    font-size: 28px;
    margin-bottom: 8px;
  }

  span {
    font-size: 0.95em;
  }
}

.todo-footer {
  padding-top: 8px;
  border-top: 1px solid var(--skin-border);
  margin-top: 8px;
  -webkit-app-region: drag;

  .footer-hint {
    font-size: 0.85em;
    color: var(--skin-text-primary);
    opacity: 0.5;
  }
}
</style>