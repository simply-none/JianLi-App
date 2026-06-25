<template>
  <div class="json-tree">
    <div v-for="(value, key) in filteredData" :key="String(key)" class="json-node">
      <div class="json-node-row" @click="shouldExpand(value) && toggleExpand(key)">
        <div class="json-node-left">
          <span class="expand-icon" :class="{ expanded: isExpanded(key) }">
            <el-icon v-if="shouldExpand(value)"><ArrowRight /></el-icon>
            <span v-else class="empty-space"></span>
          </span>
          <span class="json-key">{{ formatKey(key, value) }}</span>
        </div>
        <div class="json-node-right">
          <span v-if="isObject(displayValue(value))" class="json-value json-object">Object</span>
          <span v-else-if="Array.isArray(displayValue(value))" class="json-value json-array">Array[{{ displayValue(value).length }}]</span>
          <span v-else class="json-value" :class="getValueClass(displayValue(value))">{{ formatValue(displayValue(value)) }}</span>
        </div>
      </div>
      <div v-if="shouldExpand(value) && isExpanded(key)" class="json-node-children">
        <JsonTree :data="prepareValue(value)" :path="getPath(key)" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ArrowRight } from '@element-plus/icons-vue';

const props = defineProps<{
  data: ObjectType;
  path?: string;
}>();

const expandedKeys = ref<string[]>([]);

const ignoredKeys = ['key', 'whereStr', 'orderByDesc', 'orderBy'];

function parseJson(value: any): any {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function isKeyValuePair(parsed: any): boolean {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return false;
  }
  const keys = Object.keys(parsed);
  return keys.includes('key') && keys.includes('value');
}

function displayValue(value: any): any {
  const parsed = parseJson(value);
  if (isKeyValuePair(parsed)) {
    return parseJson(parsed.value);
  }
  return parsed;
}

function shouldExpand(value: any): boolean {
  const val = displayValue(value);
  return isObject(val) || Array.isArray(val);
}

function prepareValue(value: any): any {
  const parsed = parseJson(value);
  
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'key' in parsed) {
    const result: ObjectType = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (!ignoredKeys.includes(k)) {
        result[k] = v;
      }
    }
    return result;
  }
  
  return parsed;
}

const filteredData = computed(() => {
  if (!props.data) return {};
  
  if (Array.isArray(props.data)) {
    return props.data;
  }
  
  const result: ObjectType = {};
  for (const [key, value] of Object.entries(props.data)) {
    if (!ignoredKeys.includes(key)) {
      result[key] = value;
    }
  }
  return result;
});

function isObject(value: any): boolean {
  console.log(value, 'value');
  if (Object.prototype.toString.call(value) === '[object Object]' && 'key' in value && 'value' in value) {
    // 同时包含key和value属性
    return false
  }
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getPath(key: string | number | symbol): string {
  const keyStr = String(key);
  if (props.path) {
    return `${props.path}.${keyStr}`;
  }
  return keyStr;
}

function isExpanded(key: string | number | symbol): boolean {
  return expandedKeys.value.includes(getPath(key));
}

function toggleExpand(key: string | number | symbol) {
  const fullPath = getPath(key);
  const index = expandedKeys.value.indexOf(fullPath);
  if (index === -1) {
    expandedKeys.value.push(fullPath);
  } else {
    expandedKeys.value.splice(index, 1);
  }
}

function formatKey(key: string | number | symbol, value: any): string {
  if (typeof key === 'number') {
    const parsed = parseJson(value);
    if (parsed && typeof parsed === 'object' && 'key' in parsed) {
      return `"${parsed.key}"`;
    }
    return String(key);
  }
  if (typeof key === 'symbol') {
    return `"${String(key).replace(/^Symbol\((.*)\)$/, '$1')}"`;
  }
  return `"${key}"`;
}

function getValueClass(value: any): string {
  if (Object.prototype.toString.call(value) === '[object Object]' && 'key' in value && 'value' in value) return 'json-string';
  if (typeof value === 'string') return 'json-string';
  if (typeof value === 'number') return 'json-number';
  if (typeof value === 'boolean') return 'json-boolean';
  if (value === null) return 'json-null';
  return '';
}

function formatValue(value: any): string {
  if (typeof value === 'string') return `"${value}"`;
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value.toString();
  return value.toString();
}
</script>

<style scoped lang="scss">
.json-tree {
  padding-left: 0;
}

.json-node {
  margin-bottom: 2px;
}

.json-node-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 13px;
  line-height: 1.5;
  transition: background-color 0.15s ease;

  &:hover {
    background: var(--bg-hover);
  }
}

.json-node-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.json-node-right {
  flex: 1;
  text-align: right;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.expand-icon {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  flex-shrink: 0;

  &.expanded {
    transform: rotate(90deg);
  }

  .el-icon {
    font-size: 11px;
    color: var(--text-muted);
  }
}

.empty-space {
  width: 14px;
}

.json-key {
  color: #2c3e50;
  font-weight: 500;
  flex-shrink: 0;
}

.json-value {
  &.json-string {
    color: #27ae60;
  }

  &.json-number {
    color: #3498db;
  }

  &.json-boolean {
    color: #9b59b6;
  }

  &.json-null {
    color: #95a5a6;
  }

  &.json-object {
    color: #e74c3c;
    font-style: italic;
  }

  &.json-array {
    color: #e67e22;
    font-style: italic;
  }
}

.json-node-children {
  padding-left: 24px;
  border-left: 1px solid var(--border-subtle);
  margin-left: 6px;
}
</style>