<script setup lang="ts">
/**
 * 底部实时 SQL 对照条。
 *
 * 教学核心：这是「我拖的积木」与「真正的 SQL」之间的桥。
 * - C1 报错时**依然显示 SQL**（不再整块变红藏起来），错误作为附加行压在下方；
 * - C2 每行左侧有「来源节点序号」chip，鼠标悬停该行 → 画布上对应节点高亮；
 *       鼠标悬停节点（由父层传入 highlightNodeId）→ 对应 SQL 行高亮；
 * - C3 SQL 语法高亮，配色与「高级 SQL」tab 保持一致。
 */
import { computed } from "vue";
import type { SqlLine } from "../compiler";

const props = defineProps<{
  lines: SqlLine[];
  errors: string[];
  /** 当前悬停的行号（父层持有，用于与节点联动） */
  activeLineNo: number | null;
  /** 当前需要高亮的节点 id（来自悬停节点或悬停行） */
  highlightNodeId: string | null;
}>();

const emit = defineEmits<{ (e: "hover-line", no: number | null): void }>();

const hasErrors = computed(() => props.errors.length > 0);
const hasSql = computed(() => props.lines.length > 0);

/** 每行按来源节点决定是否高亮 */
function isLineHighlighted(line: SqlLine): boolean {
  if (props.activeLineNo === line.no) return true;
  return props.highlightNodeId != null && line.nodeId === props.highlightNodeId;
}

// ---- C3 语法高亮：与高级 SQL tab 同色系 ----
const KEYWORDS = "SELECT|DISTINCT|FROM|WHERE|GROUP BY|ORDER BY|LIMIT|OFFSET|AS|AND|DESC|ASC";

interface Token {
  text: string;
  cls: string;
}

const tokenRe = new RegExp(
  `("(?:[^"]|"")*")` + // 1 标识符（双引号，含转义）
    `|\\b(${KEYWORDS})\\b` + // 2 关键字
    `|\\b(\\d+(?:\\.\\d+)?)\\b` + // 3 数字
    `|(\\?)` + // 4 参数占位
    `|(\\u2014\\u2014.*$)`, // 5 注释（保留扩展位）
  "gi"
);

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  tokenRe.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = tokenRe.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), cls: "p" });
    if (m[1]) out.push({ text: m[1], cls: "id" });
    else if (m[2]) out.push({ text: m[2], cls: "k" });
    else if (m[3]) out.push({ text: m[3], cls: "n" });
    else if (m[4]) out.push({ text: m[4], cls: "ph" });
    else if (m[5]) out.push({ text: m[5], cls: "c" });
    last = tokenRe.lastIndex;
  }
  if (last < text.length) out.push({ text: text.slice(last), cls: "p" });
  return out;
}
</script>

<template>
  <div class="sql-preview" :class="{ invalid: hasErrors }">
    <div class="sp-head">
      <span class="preview-badge">实时 SQL</span>
      <span class="sp-note">左边序号 = 画布上的步骤号，鼠标放上去可以互相高亮</span>
      <span v-if="hasErrors" class="sp-err-count">{{ errors.length }} 处待处理</span>
    </div>

    <!-- C1：SQL 永远可见（哪怕报错），这是「积木 ⇔ SQL」的对照锚点 -->
    <div v-if="hasSql" class="sp-code">
      <div
        v-for="line in lines"
        :key="line.no"
        class="sp-line"
        :class="{ hl: isLineHighlighted(line) }"
        @mouseenter="emit('hover-line', line.no)"
        @mouseleave="emit('hover-line', null)"
      >
        <span class="sp-no">{{ line.no }}</span>
        <span class="sp-text">
          <template v-for="(tk, i) in tokenize(line.text)" :key="i">
            <span :class="tk.cls">{{ tk.text }}</span>
          </template>
        </span>
      </div>
    </div>
    <div v-else class="sp-empty">还没有可以生成的 SQL —— 先把「数据源」选好表</div>

    <!-- 错误作为附加行，不覆盖 SQL -->
    <div v-if="hasErrors" class="sp-errors">
      <span v-for="(e, i) in errors" :key="i" class="sp-error-item">{{ e }}</span>
    </div>
  </div>
</template>

<style scoped lang="scss">
.sql-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 12px 9px;
  background: #1e283c;
  border-radius: 8px;
  box-sizing: border-box;
  border-left: 3px solid transparent;

  &.invalid {
    border-left-color: #f2b95c;
  }
}

.sp-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-badge {
  flex-shrink: 0;
  padding: 1px 8px;
  border-radius: 10px;
  background: var(--color-primary);
  color: #fff;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
}

.sp-note {
  flex: 1;
  min-width: 0;
  font-size: 10px;
  color: #8496b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sp-err-count {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 9px;
  background: rgba(242, 185, 92, 0.18);
  color: #f2b95c;
  font-size: 10px;
  font-weight: 600;
}

.sp-code {
  display: flex;
  flex-direction: column;
}

.sp-line {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 1px 4px;
  border-radius: 4px;
  cursor: default;
  transition: background 0.12s;

  &.hl {
    background: rgba(108, 92, 231, 0.22);
  }
}

.sp-no {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  font-family: Consolas, "Courier New", monospace;
  font-size: 10px;
  color: #5f7099;
  user-select: none;
}

.sp-text {
  font-family: Consolas, "Courier New", monospace;
  font-size: 11.5px;
  line-height: 1.55;
  color: #c4d2f0;
  white-space: pre-wrap;
  word-break: break-all;
}

/* C3：与高级 SQL tab 同源配色 */
.k {
  color: #f2b95c;
  font-weight: 600;
}
.id {
  color: #7ed0a8;
}
.n {
  color: #c4d2f0;
}
.ph {
  color: #ffd479;
  font-weight: 700;
}
.c {
  color: #8496b8;
}
.p {
  color: #c4d2f0;
}

.sp-empty {
  font-size: 11px;
  color: #8496b8;
}

.sp-errors {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 5px;
  border-top: 1px solid rgba(242, 185, 92, 0.25);
}

.sp-error-item {
  font-size: 10.5px;
  color: #f8d9a0;
  line-height: 1.5;

  &::before {
    content: "· ";
    color: #f2b95c;
  }
}
</style>
