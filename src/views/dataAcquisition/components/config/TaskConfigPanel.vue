<template>
  <div class="task-config-panel">
    <!-- 置顶：完整任务配置说明（可折叠，默认折叠） -->
    <ConfigGuide />
    <!-- 步骤 1：打开网页（起始 URL + 页面等待） -->
    <div class="flow-step">
      <div class="step-title">① 打开网页</div>
      <el-form label-width="92px" size="small" class="base-form">
        <el-form-item label="任务名">
          <el-input v-model="config.name" placeholder="任务名称（保存的唯一标识）" />
        </el-form-item>
        <el-form-item label="起始 URL">
          <el-input v-model="config.url" placeholder="https://example.com/list（URL 模板支持 {page} 占位符）" />
        </el-form-item>
        <el-form-item label="数据源">
          <el-radio-group v-model="config.source">
            <el-radio-button value="dom">页面规则（DOM）</el-radio-button>
            <el-radio-button value="network">接口捕获（XHR/Fetch）</el-radio-button>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <el-collapse class="config-collapse">
        <el-collapse-item title="页面等待（网页加载完成判定）" name="wait">
          <el-form label-width="92px" size="small">
            <el-form-item label="加载策略">
              <el-select v-model="config.wait!.until" class="narrow">
                <el-option label="DOM 就绪（快）" value="domcontentloaded" />
                <el-option label="页面加载 load" value="load" />
                <el-option label="网络空闲2" value="networkidle2" />
                <el-option label="网络空闲0（慢）" value="networkidle0" />
              </el-select>
            </el-form-item>
            <el-form-item label="特征选择器">
              <el-input v-model="config.wait!.selector" placeholder="该元素出现才继续（可选）" />
            </el-form-item>
            <el-form-item label="选择器超时">
              <el-input-number v-model="config.wait!.selectorTimeout" :min="1000" :max="60000" :step="1000" />
            </el-form-item>
            <el-form-item label="网络缓冲(ms)">
              <el-input-number v-model="config.wait!.settleMs" :min="0" :max="10000" :step="100" />
            </el-form-item>
          </el-form>
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 步骤 2：模拟浏览操作（导航到目标页面，可选） -->
    <div class="flow-step">
      <div class="step-title">② 模拟浏览操作（可选）</div>
      <div class="step-hint">
        像人一样操作浏览器：输入关键词、点击链接、登录、滚动等，
        用于从起始页一步步导航到目标页面；<b>步骤全部执行完后才会进行第③步提取</b>
      </div>
      <el-collapse class="config-collapse">
        <el-collapse-item title="交互步骤" name="actions">
          <ActionPanel :actions="config.actions!" />
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 步骤 3：配置提取（针对最终页面） -->
    <div class="flow-step">
      <div class="step-title">③ 提取结果（针对最终页面）</div>
      <div class="step-hint">
        记录容器与字段规则/接口捕获都作用在<b>交互步骤执行完后的最终页面</b>上，
        与起始网页无关；调试快照（cache-data/步骤N_*.html）即提取时的页面现场
      </div>

      <template v-if="config.source === 'dom'">
        <el-form label-width="92px" size="small" class="base-form">
          <el-form-item label="记录容器">
            <el-input
              v-model="config.itemSelector"
              placeholder="列表容器选择器，如 .item（留空为整页扁平模式）"
              title="每个容器产出一条记录，字段选择器在容器内相对匹配；必须存在于最终页面"
            />
          </el-form-item>
        </el-form>
        <!-- 提取结果编辑器：记录字段 + 可选提取项容器（点击芯片切换，默认展示第一个） -->
        <ExtractEditor :config="config" />
      </template>
      <template v-else>
        <div class="capture-panel">
          <div class="panel-title">接口捕获设置</div>
          <el-form label-width="92px" size="small">
            <el-form-item label="URL 正则">
              <el-input
                v-model="config.capture!.urlPattern"
                placeholder="如 /api\\/list（匹配接口地址，仅捕获 JSON 响应）"
              />
            </el-form-item>
            <el-form-item label="请求方法">
              <el-select v-model="config.capture!.method" clearable placeholder="不限" class="narrow">
                <el-option label="GET" value="GET" />
                <el-option label="POST" value="POST" />
                <el-option label="PUT" value="PUT" />
              </el-select>
            </el-form-item>
            <el-form-item label="数据路径">
              <el-input
                v-model="config.capture!.dataPath"
                placeholder="如 data.list（响应 JSON 内的记录数组路径，留空取整个响应）"
              />
            </el-form-item>
            <el-form-item label="捕获上限">
              <el-input-number v-model="config.capture!.maxCount" :min="1" :max="500" />
            </el-form-item>
          </el-form>
        </div>
      </template>
    </div>

    <!-- 步骤 4：分页采集更多（可选） -->
    <div class="flow-step">
      <div class="step-title">④ 分页采集更多（可选）</div>
      <div class="step-hint">提取一轮后自动翻页，对每个列表页重复「等待 → 提取」直到达到最大页数</div>
      <el-collapse class="config-collapse">
        <el-collapse-item title="分页设置" name="pagination">
          <PaginationPanel :pagination="config.pagination!" />
        </el-collapse-item>
      </el-collapse>
    </div>

    <!-- 其他高级选项 -->
    <el-collapse class="config-collapse">
      <el-collapse-item title="反爬与登录" name="anti">
        <AntiCrawlPanel :anti="config.antiCrawl!" />
      </el-collapse-item>

      <el-collapse-item title="输出选项" name="output">
        <el-form label-width="92px" size="small">
          <el-form-item label="HTML 快照">
            <el-switch v-model="config.output!.htmlSnapshot" title="每页渲染后 DOM 保存到 cache-data 文件夹" />
          </el-form-item>
          <el-form-item label="整页截图">
            <el-switch v-model="config.output!.screenshot" title="每页截图保存到 cache-data 文件夹" />
          </el-form-item>
          <el-form-item label="最大记录数">
            <el-input-number
              :model-value="config.output!.maxRecords"
              :min="0"
              :max="1000000"
              :step="100"
              @update:model-value="(v: number) => (config.output!.maxRecords = v)"
              title="0 表示不限制，达到上限自动停止"
            />
          </el-form-item>
        </el-form>
      </el-collapse-item>

      <el-collapse-item title="JSON 配置（高级）" name="json">
        <div class="json-actions">
          <el-button size="small" @click="loadJson">从 JSON 应用</el-button>
          <span class="json-tip">支持手工编辑完整配置（replace/split 等高级变换在此配置）</span>
        </div>
        <el-input
          v-model="jsonText"
          type="textarea"
          :rows="12"
          class="json-editor"
          spellcheck="false"
          placeholder="完整配置 JSON"
        />
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
/**
 * 任务配置面板
 * ------------------------------------------------------------------
 * 任务配置编辑入口：基础信息（名称/URL/数据源/记录容器）、
 * 字段规则编辑器、接口捕获设置，以及折叠的高级配置
 * （页面等待/交互步骤/分页/反爬与登录/输出选项/JSON 高级编辑）。
 * 全部子面板引用透传直接修改 config 对象。
 */
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { ScrapeConfig } from '../../types'
import ExtractEditor from './ExtractEditor.vue'
import ActionPanel from './ActionPanel.vue'
import PaginationPanel from './PaginationPanel.vue'
import AntiCrawlPanel from './AntiCrawlPanel.vue'
import ConfigGuide from './ConfigGuide.vue'

/** 组件属性（引用透传，原地修改） */
const props = defineProps<{
  /** 任务配置对象 */
  config: ScrapeConfig;
}>()

/** JSON 编辑器文本 */
const jsonText = ref('')

/**
 * 同步当前配置到 JSON 编辑器（配置对象变化时刷新）
 */
function syncJson(): void {
  try {
    jsonText.value = JSON.stringify(props.config, null, 2)
  } catch {
    jsonText.value = ''
  }
}

/**
 * 把 JSON 编辑器内容应用回配置对象（覆盖合并，非法 JSON 提示）
 */
function loadJson(): void {
  try {
    const parsed = JSON.parse(jsonText.value)
    Object.assign(props.config, parsed)
    ElMessage.success('JSON 配置已应用')
  } catch (err) {
    ElMessage.error(`JSON 解析失败：${(err as Error).message}`)
  }
}

watch(() => props.config, syncJson, { immediate: true, deep: false })
</script>

<style scoped>
.task-config-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
/* 浏览器流程步骤卡片：①打开网页 → ②浏览操作 → ③提取 → ④分页 */
.flow-step {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  background: var(--el-fill-color-extra-light);
}
.step-title {
  font-weight: 600;
  font-size: 13px;
}
.step-hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}
.base-form {
  max-width: 720px;
}
.narrow {
  width: 220px;
}
.capture-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.panel-title {
  font-weight: 600;
  font-size: 13px;
}
.config-collapse {
  max-width: 860px;
}
.json-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.json-tip {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
.json-editor {
  font-family: Consolas, Monaco, monospace;
  font-size: 12px;
}
</style>
