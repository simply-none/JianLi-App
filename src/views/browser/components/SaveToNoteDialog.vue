<template>
  <!-- 保存到笔记对话框：可归类（分类可新建），默认带入页面标题/地址/选中文本 -->
  <el-dialog
    v-model="visible"
    title="保存到笔记"
    width="460px"
    :append-to-body="true"
    :close-on-click-modal="false"
    @open="onOpen"
  >
    <div class="save-note">
      <div class="form-row">
        <span class="form-label">分类</span>
        <el-select
          v-model="category"
          filterable
          allow-create
          default-first-option
          placeholder="选择或输入新分类"
          size="default"
        >
          <el-option v-for="cat in categoryOptions" :key="cat" :label="cat" :value="cat" />
        </el-select>
      </div>
      <div class="form-row">
        <span class="form-label">标题</span>
        <el-input v-model="title" placeholder="笔记标题" maxlength="100" />
      </div>
      <div class="form-row is-top">
        <span class="form-label">内容</span>
        <el-input
          v-model="content"
          type="textarea"
          :rows="8"
          placeholder="默认包含页面地址与选中文本，可编辑"
        />
      </div>
      <p v-if="selectionTip" class="selection-tip">已带入页面选中文本（{{ selectionLen }} 字）</p>
    </div>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="saving" @click="onSave">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
/**
 * 内置浏览器 - 保存到笔记对话框
 * ------------------------------------------------------------------
 * 职责：把当前页面（地址 + 标题 + 用户选中文本）保存为一条 QuickNote 笔记，
 * 写入 note_book 表并携带 category 字段实现归类。
 * - 分类：预置分类 + 从库中 DISTINCT 读取的历史分类，支持输入新建；
 * - 内容：默认为「标题 + 地址 + 选中文本」的 Markdown 片段，可编辑；
 * - 字段约定与 QuickNote 保存逻辑一致（key/excerpt/content/html/mdText/createTime/updateTime）。
 */
import { ref } from "vue";
import { ElMessage } from "element-plus";
import useBrowser from "@/store/useBrowser";
import { getPageSelection } from "../composables/useWebviewBridge";

/** 对话框显隐（v-model:visible） */
const visible = defineModel<boolean>("visible", { default: false });

const browserStore = useBrowser();

/** 预置分类（库中有历史分类时合并展示） */
const PRESET_CATEGORIES = ["网页收藏", "技术文档", "资讯", "学习资料", "生活"];

/** 分类（可创建） */
const category = ref("网页收藏");
/** 笔记标题 */
const title = ref("");
/** 笔记内容 */
const content = ref("");
/** 选中文本长度提示 */
const selectionLen = ref(0);
/** 保存中标记 */
const saving = ref(false);
/** 分类下拉选项 */
const categoryOptions = ref<string[]>([...PRESET_CATEGORIES]);

/** 是否带入了选中文本（控制提示显隐） */
const selectionTip = ref(false);

/**
 * 从 note_book 读取历史分类（DISTINCT，列不存在时静默回退预置列表）
 */
async function loadCategories() {
  try {
    const res = await (window as any).ipcRenderer.invoke("new-sql:query", {
      tableName: "note_book",
      conditions: { SqlStr: "SELECT DISTINCT category FROM note_book WHERE category IS NOT NULL AND category <> '' LIMIT 50" },
    });
    const rows = Array.isArray(res?.data) ? res.data : Array.isArray(res?.data?.rows) ? res.data.rows : [];
    const extra = rows.map((r: any) => String(r.category)).filter((c: string) => c && !PRESET_CATEGORIES.includes(c));
    categoryOptions.value = [...PRESET_CATEGORIES, ...extra];
  } catch {
    // category 列尚不存在或查询失败：仅预置分类
    categoryOptions.value = [...PRESET_CATEGORIES];
  }
}

/**
 * 对话框打开：初始化表单（标题/地址/选中文本/分类选项）
 */
async function onOpen() {
  const tab = browserStore.activeTab;
  loadCategories();
  selectionTip.value = false;
  selectionLen.value = 0;
  title.value = tab?.title && tab.title !== "新标签页" ? tab.title : "";
  let selection = "";
  if (tab && !tab.isNewTab) {
    selection = await getPageSelection(tab.id);
  }
  if (selection.trim()) {
    selectionLen.value = selection.trim().length;
    selectionTip.value = true;
  }
  content.value = [title.value, tab?.url && tab.url !== "newtab" ? tab.url : "", selection.trim()]
    .filter(Boolean)
    .join("\n")
    .concat("\n");
}

/**
 * 保存笔记到 note_book（字段约定与 QuickNote 一致，附加 category）
 */
async function onSave() {
  if (!content.value.trim()) {
    ElMessage.warning("内容不能为空");
    return;
  }
  saving.value = true;
  try {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const time = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())} ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const plain = content.value.trim();
    const res = await (window as any).ipcRenderer.invoke("new-sql:upsert", {
      tableName: "note_book",
      data: {
        key: `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        excerpt: plain.replace(/\s+/g, " ").substring(0, 20) + "...",
        content: plain,
        html: "",
        mdText: plain,
        category: (category.value || "网页收藏").trim(),
        createTime: time,
        updateTime: time,
      },
      config: { primaryKey: "key" },
    });
    if (res?.success) {
      ElMessage.success(`已保存到笔记${category.value ? `（${category.value}）` : ""}`);
      visible.value = false;
    } else {
      ElMessage.error(`保存失败：${res?.error || "未知错误"}`);
    }
  } catch (e) {
    console.error("[browser] 保存到笔记失败:", e);
    ElMessage.error("保存失败，请重试");
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped lang="scss">
.save-note {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .form-row {
    display: flex;
    align-items: center;
    gap: 10px;

    &.is-top {
      align-items: flex-start;

      .form-label {
        margin-top: 6px;
      }
    }

    .form-label {
      width: 40px;
      flex-shrink: 0;
      font-size: 13px;
      color: var(--text-secondary);
      text-align: right;
    }

    .el-select {
      flex: 1;
    }

    .el-input {
      flex: 1;
    }
  }

  .selection-tip {
    margin: 0;
    font-size: 12px;
    color: var(--color-success, #67c23a);
  }
}
</style>
