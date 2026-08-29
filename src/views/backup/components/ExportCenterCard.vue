<template>
  <div class="backup-card">
    <div class="backup-card-header">
      <LucideIcon name="FileDown" :size="18" />
      <span>数据导出中心</span>
      <div class="header-extra">
        <el-radio-group v-model="format" size="small">
          <el-radio-button value="csv">CSV（表格）</el-radio-button>
          <el-radio-button value="json">JSON（数据）</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <div class="backup-card-body">
      <!-- 模块分组表格多选 -->
      <el-collapse v-model="expandedGroups" class="group-collapse">
        <el-collapse-item v-for="group in modules.groups" :key="group.key" :name="group.key">
          <template #title>
            <div class="group-title" @click.stop>
              <el-checkbox
                :model-value="isGroupChecked(group)"
                :indeterminate="isGroupIndeterminate(group)"
                @change="(val: any) => toggleGroup(group, val)"
              />
              <span class="group-name">{{ group.label }}</span>
              <span class="group-count">{{ group.tables.length }} 表</span>
            </div>
          </template>
          <div class="table-list">
            <el-checkbox
              v-for="table in group.tables"
              :key="table.name"
              :model-value="selected.includes(table.name)"
              @change="(val: any) => toggleTable(table.name, val)"
              class="table-checkbox"
            >
              {{ table.label }}
              <span class="table-rows">（{{ table.rows }} 行{{ table.hasDateColumn ? '' : '，无日期列' }}）</span>
            </el-checkbox>
          </div>
        </el-collapse-item>
        <el-collapse-item v-if="modules.otherTables.length > 0" name="__other">
          <template #title>
            <div class="group-title" @click.stop>
              <el-checkbox
                :model-value="isOtherChecked()"
                :indeterminate="isOtherIndeterminate()"
                @change="(val: any) => toggleGroup({ key: '__other', label: '其他', tables: modules.otherTables }, val)"
              />
              <span class="group-name">其他</span>
              <span class="group-count">{{ modules.otherTables.length }} 表</span>
            </div>
          </template>
          <div class="table-list">
            <el-checkbox
              v-for="table in modules.otherTables"
              :key="table.name"
              :model-value="selected.includes(table.name)"
              @change="(val: any) => toggleTable(table.name, val)"
              class="table-checkbox"
            >
              {{ table.label }}
              <span class="table-rows">（{{ table.name }} · {{ table.rows }} 行）</span>
            </el-checkbox>
          </div>
        </el-collapse-item>
      </el-collapse>

      <!-- 日期范围（仅对含日期列的表生效） -->
      <div class="export-options">
        <div class="option-item">
          <span class="option-label">日期范围（可选，仅对含日期列的表生效）</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            value-format="YYYY-MM-DD"
            style="width: 280px"
          />
        </div>
      </div>

      <!-- 导出操作 -->
      <div class="export-actions">
        <el-button @click="handleSelectDir">
          <LucideIcon name="FolderCog" :size="14" />
          {{ saveDir || '选择导出目录' }}
        </el-button>
        <el-button type="primary" :loading="exporting" :disabled="selected.length === 0 || !saveDir" @click="handleExport">
          <LucideIcon name="FileDown" :size="14" />
          导出 {{ selected.length }} 个表
        </el-button>
        <el-button v-if="selected.length > 0" text @click="selected = []">清空选择</el-button>
      </div>

      <!-- 导出结果 -->
      <div v-if="exportFiles.length > 0" class="export-result">
        <div class="result-title">导出完成（{{ exportFiles.length }} 个文件）</div>
        <div v-for="file in exportFiles" :key="file.path" class="info-row">
          <span class="info-label">{{ file.label }}（{{ file.rows }} 行）</span>
          <span class="info-value link" @click="openLocation(file.path)">{{ file.path }}（点击打开）</span>
        </div>
      </div>

      <p class="backup-hint">
        CSV 带 BOM 头，Excel 打开中文不乱码；超长内容（如剪贴板图片数据）导出时自动截断，导出文件用于查看与分析，完整数据备份请使用「立即备份」。
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { ElMessage } from 'element-plus';
import LucideIcon from '@/components/LucideIcon.vue';
import { send } from '@/utils/common';
import type { ExportGroup, ExportFileItem } from '../types';
import { getExportModules, selectExportDir, runExport } from '../api/backupApi';

/** 导出模块清单（分组表 + 其他表） */
const modules = reactive<{ groups: ExportGroup[]; otherTables: any[] }>({
  groups: [],
  otherTables: [],
});

/** 已勾选的表名列表 */
const selected = ref<string[]>([]);
/** 导出格式：csv / json */
const format = ref<'csv' | 'json'>('csv');
/** 日期范围 [开始, 结束] */
const dateRange = ref<[string, string] | null>(null);
/** 导出目标目录 */
const saveDir = ref('');
/** 是否正在导出 */
const exporting = ref(false);
/** 导出结果文件列表 */
const exportFiles = ref<ExportFileItem[]>([]);
/** 展开的分组 */
const expandedGroups = ref<string[]>([]);

onMounted(loadModules);

/**
 * 加载导出模块清单（默认展开第一个分组）
 *
 * @returns {Promise<void>}
 */
async function loadModules(): Promise<void> {
  try {
    const res = await getExportModules();
    if (res.ok) {
      modules.groups = res.groups || [];
      modules.otherTables = res.otherTables || [];
      if (modules.groups.length > 0) expandedGroups.value = [modules.groups[0].key];
    } else {
      ElMessage.error('加载导出清单失败：' + (res.error || '未知错误'));
    }
  } catch (err: any) {
    ElMessage.error('加载导出清单失败：' + (err?.message || String(err)));
  }
}

/**
 * 判断分组内全部表是否都被勾选
 *
 * @param {ExportGroup} group - 分组
 * @returns {boolean} 是否全选
 */
function isGroupChecked(group: ExportGroup): boolean {
  return group.tables.every((t) => selected.value.includes(t.name));
}

/**
 * 判断分组内是否部分勾选（半选态）
 *
 * @param {ExportGroup} group - 分组
 * @returns {boolean} 是否半选
 */
function isGroupIndeterminate(group: ExportGroup): boolean {
  const count = group.tables.filter((t) => selected.value.includes(t.name)).length;
  return count > 0 && count < group.tables.length;
}

/**
 * 「其他」分组的全选/半选状态
 *
 * @returns {boolean} 是否全选
 */
function isOtherChecked(): boolean {
  return modules.otherTables.every((t) => selected.value.includes(t.name));
}

/**
 * 「其他」分组的半选状态
 *
 * @returns {boolean} 是否半选
 */
function isOtherIndeterminate(): boolean {
  const count = modules.otherTables.filter((t) => selected.value.includes(t.name)).length;
  return count > 0 && count < modules.otherTables.length;
}

/**
 * 切换单个表的勾选状态
 *
 * @param {string} tableName - 表名
 * @param {any} checked - 是否勾选
 * @returns {void}
 */
function toggleTable(tableName: string, checked: any): void {
  if (checked && !selected.value.includes(tableName)) {
    selected.value.push(tableName);
  } else if (!checked) {
    selected.value = selected.value.filter((t) => t !== tableName);
  }
}

/**
 * 切换整个分组的勾选/取消勾选
 *
 * @param {ExportGroup} group - 分组
 * @param {any} checked - 是否勾选
 * @returns {void}
 */
function toggleGroup(group: ExportGroup, checked: any): void {
  for (const t of group.tables) {
    toggleTable(t.name, checked ? true : false);
  }
}

/**
 * 弹出目录选择框
 *
 * @returns {Promise<void>}
 */
async function handleSelectDir(): Promise<void> {
  const dir = await selectExportDir();
  if (dir) saveDir.value = dir;
}

/**
 * 执行导出并展示结果
 *
 * @returns {Promise<void>}
 */
async function handleExport(): Promise<void> {
  exporting.value = true;
  exportFiles.value = [];
  try {
    const res = await runExport({
      tables: selected.value,
      format: format.value,
      dateStart: dateRange.value?.[0],
      dateEnd: dateRange.value?.[1],
      saveDir: saveDir.value,
    });
    if (res.ok) {
      exportFiles.value = res.files || [];
      ElMessage.success(`导出完成，共 ${exportFiles.value.length} 个文件`);
    } else {
      ElMessage.error('导出失败：' + (res.error || '未知错误'));
    }
  } catch (err: any) {
    ElMessage.error('导出失败：' + (err?.message || String(err)));
  } finally {
    exporting.value = false;
  }
}

/**
 * 在资源管理器中定位导出文件
 *
 * @param {string} filePath - 文件绝对路径
 * @returns {void}
 */
function openLocation(filePath: string): void {
  send('open-file-in-assets-manager', { path: filePath });
}
</script>

<style scoped lang="scss">
@use '../styles/backup-shared.scss';

.group-collapse {
  border: none;

  :deep(.el-collapse-item__header) {
    background: transparent;
    border-bottom: 1px solid var(--border-subtle);
    height: 44px;
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 12px;
  }

  .group-title {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;

    .group-name {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .group-count {
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}

.table-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 20px;
  padding: 8px 12px;

  .table-checkbox {
    margin-right: 0;

    .table-rows {
      font-size: 12px;
      color: var(--text-muted);
    }
  }
}

.export-options {
  margin-top: 16px;

  .option-item {
    display: flex;
    align-items: center;
    gap: 12px;

    .option-label {
      font-size: 13px;
      color: var(--text-secondary);
    }
  }
}

.export-actions {
  display: flex;
  align-items: center;
  margin-top: 16px;

  .el-button:first-child {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.export-result {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);

  .result-title {
    margin-bottom: 10px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
  }

  .info-value.link {
    color: var(--color-primary);
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  }
}
</style>
