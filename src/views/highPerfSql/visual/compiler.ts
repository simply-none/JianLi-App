/**
 * 图 → SQL 编译器（纯函数，无 Vue / IPC 依赖，可单测）
 *
 * 教学约定：
 * - 链路必须从唯一 FROM 节点出发，沿连线按 FROM → WHERE → GROUP BY → SELECT 顺序编译；
 * - 值一律参数化（?），标识符一律双引号包裹，防注入与关键字冲突；
 * - 每个节点可单独编译出「截至该节点」的部分查询，供数据探针统计行数；
 * - INSERT 节点挂在 SELECT 之后：INSERT INTO 目标表 (输出列) SELECT ...，在事务中执行。
 */
import type { PipelineNodeData, NodeKind } from "./types";
import { KIND_META } from "./types";

/** 双引号包裹标识符 */
function qid(name: string): string {
  return `"${String(name).replace(/"/g, '""')}"`;
}

const ALLOWED_OPS = ["=", "!=", ">", "<", ">=", "<=", "LIKE"];

interface GraphNode {
  id: string;
  data: PipelineNodeData;
}

interface GraphEdge {
  source: string;
  target: string;
}

interface ChainStep {
  id: string;
  data: PipelineNodeData;
}

/**
 * 从 FROM 节点沿连线走出主链（每步只沿一条出边；分叉时取第一条并忽略其余）。
 * 返回按执行顺序排列的步骤数组。
 */
function walkChain(fromId: string, nodes: Map<string, GraphNode>, edges: GraphEdge[]): ChainStep[] {
  const outgoing = new Map<string, string[]>();
  for (const e of edges) {
    if (!outgoing.has(e.source)) outgoing.set(e.source, []);
    outgoing.get(e.source)!.push(e.target);
  }

  const chain: ChainStep[] = [];
  const visited = new Set<string>([fromId]);
  let cur: string | undefined = fromId;

  while (cur) {
    const node = nodes.get(cur);
    if (node) chain.push({ id: cur, data: node.data });
    const nextIds: string[] = outgoing.get(cur) || [];
    cur = undefined;
    for (const nid of nextIds) {
      if (!visited.has(nid)) {
        visited.add(nid);
        cur = nid;
        break;
      }
    }
  }
  return chain;
}

/** 校验链上节点顺序符合 KIND_META.order（INSERT 除外，单独处理） */
function orderErrors(chain: ChainStep[]): CompileIssue[] {
  const errors: CompileIssue[] = [];
  let prevOrder = -1;
  for (const step of chain) {
    if (step.data.kind === "insert") continue;
    const order = KIND_META[step.data.kind].order;
    if (order < prevOrder) {
      errors.push({
        message: `节点顺序不对：「${KIND_META[step.data.kind].humanLabel}」应该排在更前面`,
        nodeId: step.id,
      });
    }
    prevOrder = Math.max(prevOrder, order);
  }
  return errors;
}

/** WHERE 条件片段（含参数收集） */
function conditionFragments(data: PipelineNodeData, params: any[]): string[] {
  const frags: string[] = [];
  for (const cond of data.conditions || []) {
    if (!cond.field) continue;
    const op = ALLOWED_OPS.includes(cond.op) ? cond.op : "=";
    frags.push(`${qid(cond.field)} ${op} ?`);
    params.push(cond.value);
  }
  return frags;
}

/** SELECT 输出列清单；显式列 + 聚合列，均可能为空 */
function outputList(data: PipelineNodeData): { frags: string[]; cols: string[] } {
  const frags: string[] = [];
  const cols: string[] = [];
  for (const col of data.selectCols || []) {
    if (!col) continue;
    frags.push(qid(col));
    cols.push(col);
  }
  for (const agg of data.aggregates || []) {
    if (!agg.expr) continue;
    const alias = agg.alias || agg.expr;
    frags.push(`${agg.expr} AS ${qid(alias)}`);
    cols.push(alias);
  }
  return { frags, cols };
}

/** 单节点在画布上展示的 SQL 片段（与编译产物同源，仅用于展示） */
export function nodeFragment(data: PipelineNodeData): string {
  switch (data.kind) {
    case "from":
      return data.table ? `FROM ${qid(data.table)}` : "FROM（未选表）";
    case "where": {
      const conds = (data.conditions || []).filter((c) => c.field);
      if (conds.length === 0) return "WHERE（无条件）";
      const first = conds[0];
      const shown =
        first.op === "LIKE" ? `${first.field} LIKE '${first.value}'` : `${first.field} ${first.op} '${first.value}'`;
      return conds.length > 1 ? `WHERE ${shown} +${conds.length - 1}` : `WHERE ${shown}`;
    }
    case "groupBy": {
      const cols = (data.groupByCols || []).filter(Boolean);
      return cols.length ? `GROUP BY ${cols.join(", ")}` : "GROUP BY（未选列）";
    }
    case "select": {
      const { frags } = outputList(data);
      return frags.length ? `SELECT ${frags.join(", ")}` : "SELECT *";
    }
    case "insert":
      return data.targetTable ? `INSERT INTO ${data.targetTable}` : "INSERT INTO（未选表）";
  }
}

/**
 * 节点卡片上的「人话摘要」：不写 SQL，直接说这一步现在是什么状态。
 * 与 nodeFragment（真 SQL 片段）分工：摘要给新手，片段给想看 SQL 的人。
 */
export function nodeSummary(data: PipelineNodeData): string {
  switch (data.kind) {
    case "from":
      return data.table ? `来自「${data.table}」` : KIND_META.from.emptyHint;
    case "where": {
      const conds = (data.conditions || []).filter((c) => c.field);
      if (conds.length === 0) return KIND_META.where.emptyHint;
      const first = conds[0];
      const tail = conds.length > 1 ? ` 等 ${conds.length} 个条件` : "";
      return `只留 ${first.field} ${first.op} ${first.value || "?"}${tail}`;
    }
    case "groupBy": {
      const cols = (data.groupByCols || []).filter(Boolean);
      return cols.length ? `按「${cols.join("、")}」归并` : KIND_META.groupBy.emptyHint;
    }
    case "select":
      return (data.selectCols || []).filter(Boolean).length
        ? `只输出「${(data.selectCols || []).filter(Boolean).join("、")}」`
        : KIND_META.select.emptyHint;
    case "insert":
      return data.targetTable ? `存进「${data.targetTable}」` : KIND_META.insert.emptyHint;
  }
}

export interface CompileInput {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** 主查询（SELECT）编译产物 */
export interface CompiledSelect {
  sql: string;
  params: any[];
  outputCols: string[];
}

/**
 * 一条编译问题（错误）。
 * nodeId 让界面能定位到出问题的节点；fix 让「一键修复」知道该做什么。
 */
export interface CompileIssue {
  message: string;
  /** 相关节点（用于点击错误高亮对应节点） */
  nodeId?: string;
  /**
   * 可自动修复的动作描述。
   * - "remove-extra-from"：多余的 FROM 节点（保留链上的第一个）
   * - "pick-table"：新加一个 FROM 并提示选表（无处可修时不给 fix）
   */
  fix?: "remove-extra-from";
}

/** SQL 中的一行及其来源节点，供「点 SQL 高亮节点 / 点节点高亮 SQL」双向联动 */
export interface SqlLine {
  /** 行号（1-based，仅用于展示） */
  no: number;
  text: string;
  /** 该行由哪个节点产生（无则为 undefined，如括号、缩进续行） */
  nodeId?: string;
}

/** 整图编译产物：ok=false 时只保证 errors 有值 */
export interface CompileResult {
  ok: boolean;
  errors: string[];
  /** 结构化问题清单（与 errors 同源，多带 nodeId / fix） */
  issues: CompileIssue[];
  /** 主查询 SQL 拆行 + 来源节点映射（ok=false 时可能为空） */
  lineMap: SqlLine[];
  select?: CompiledSelect;
  insertSql?: string;
  insertParams?: any[];
  targetTable?: string;
}

/**
 * 编译整张图。不抛异常，问题集中在 issues 里返回，方便画布上直接展示与定位。
 */
export function compilePipeline({ nodes, edges }: CompileInput): CompileResult {
  const issues: CompileIssue[] = [];
  const nodeMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));

  const empty: Pick<CompileResult, "lineMap"> = { lineMap: [] };

  const fromNodes = nodes.filter((n) => n.data.kind === "from");
  if (fromNodes.length === 0) {
    issues.push({ message: "还没有「数据源」节点：请从左侧积木箱拖入一个「数据源」" });
  }
  if (fromNodes.length > 1) {
    // 多余的 FROM 节点可一键清理：保留排在最前的（通常就是链首），删掉其余
    issues.push({
      message: `有 ${fromNodes.length} 个「数据源」节点，但只能有一个 —— 多余的会干扰编译`,
      fix: "remove-extra-from",
    });
  }
  if (fromNodes.length !== 1) {
    return { ok: false, errors: issues.map((i) => i.message), issues, ...empty };
  }

  const from = fromNodes[0];
  if (!from.data.table) {
    issues.push({ message: "「数据源」还没选表：在右侧属性面板里挑一张", nodeId: from.id });
  }

  const chain = walkChain(from.id, nodeMap, edges).filter((s) => s.data.kind !== "insert");
  issues.push(...orderErrors(chain));

  const selectNode = chain.find((s) => s.data.kind === "select");
  if (!selectNode) {
    const disconnected = nodes.filter((n) => n.data.kind === "select" && !chain.some((c) => c.id === n.id));
    issues.push({
      message: disconnected.length
        ? "「输出列」节点还没有连上流水线：从上一个节点拉一条线过来"
        : "缺少「输出列」节点：一条完整流水线必须以它结尾",
      nodeId: disconnected[0]?.id,
    });
  }

  const insertNode = nodes.map((n) => n.data).find((d) => d.kind === "insert");
  if (insertNode && !insertNode.targetTable) {
    const insertGraphNode = nodes.find((n) => n.data.kind === "insert");
    issues.push({ message: "「写回表」还没选目标表", nodeId: insertGraphNode?.id });
  }

  if (issues.length > 0) {
    return { ok: false, errors: issues.map((i) => i.message), issues, ...empty };
  }

  // ---- 组装 SELECT（逐行记录来源节点，供双向联动）----
  const params: any[] = [];
  const lines: SqlLine[] = [];
  const pushLine = (text: string, nodeId?: string) => {
    lines.push({ no: lines.length + 1, text, nodeId });
  };

  const chainNoSelect = chain.filter((s) => s.data.kind !== "select");
  const whereSteps = chainNoSelect.filter((s) => s.data.kind === "where");
  const groupStep = chainNoSelect.find((s) => s.data.kind === "groupBy");
  const { frags: outFrags, cols } = outputList(selectNode!.data);

  const selectList = outFrags.length ? outFrags.join(", ") : "*";
  pushLine(`SELECT ${selectList}`, selectNode!.id);
  pushLine(`FROM ${qid(from.data.table!)}`, from.id);

  const whereFrags: string[] = [];
  for (const w of whereSteps) {
    // WHERE 的每个条件都归属其来源 WHERE 节点；关键字行与条件行同源
    const before = whereFrags.length;
    whereFrags.push(...conditionFragments(w.data, params));
    const added = whereFrags.slice(before);
    if (added.length === 0) continue;
    if (before === 0) pushLine(`WHERE ${added[0]}`, w.id);
    else pushLine(`  AND ${added[0]}`, w.id);
    for (const extra of added.slice(1)) pushLine(`  AND ${extra}`, w.id);
  }

  const groupCols = (groupStep?.data.groupByCols || []).filter(Boolean);
  if (groupCols.length) {
    pushLine(`GROUP BY ${groupCols.map(qid).join(", ")}`, groupStep!.id);
  }

  if (selectNode!.data.orderByCol) {
    pushLine(`ORDER BY ${qid(selectNode!.data.orderByCol)}${selectNode!.data.orderByDesc ? " DESC" : ""}`, selectNode!.id);
  }
  if (selectNode!.data.limit != null && (selectNode!.data.limit as number) > 0) {
    pushLine(`LIMIT ${Math.floor(selectNode!.data.limit as number)}`, selectNode!.id);
  }

  const sql = lines.map((l) => l.text).join("\n");
  const select: CompiledSelect = { sql, params, outputCols: cols };

  // ---- 写回语句（存在 INSERT 节点时）----
  let insertSql: string | undefined;
  let insertParams: any[] | undefined;
  if (insertNode) {
    if (cols.length === 0) {
      const insertGraphNode = nodes.find((n) => n.data.kind === "insert");
      issues.push({
        message: "写回需要先指定输出列：在「输出列」节点里填上要写出哪些列（不能是全部列 *）",
        nodeId: selectNode?.id ?? insertGraphNode?.id,
      });
      return { ok: false, errors: issues.map((i) => i.message), issues, select, lineMap: lines };
    }
    insertSql = `INSERT INTO ${qid(insertNode.targetTable!)} (${cols.map(qid).join(", ")})\n${sql}`;
    insertParams = params;
  }

  return {
    ok: true,
    errors: [],
    issues: [],
    select,
    lineMap: lines,
    insertSql,
    insertParams,
    targetTable: insertNode?.targetTable,
  };
}

/**
 * 编译「截至某个节点」的部分查询，供数据探针用：
 * 返回 `SELECT COUNT(*) AS cnt FROM (部分查询)`。
 * FROM 节点直接数表行数；INSERT / SELECT 之外的节点同样取链上前缀。
 */
export function probeCountSql(nodeId: string, { nodes, edges }: CompileInput): { sql: string; params: any[] } | null {
  const nodeMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));
  const target = nodeMap.get(nodeId);
  if (!target) return null;

  const fromNodes = nodes.filter((n) => n.data.kind === "from");
  if (fromNodes.length !== 1) return null;
  const fromTable = fromNodes[0].data.table;
  if (!fromTable) return null;
  const from = fromNodes[0];

  if (target.data.kind === "from") {
    return { sql: `SELECT COUNT(*) AS cnt FROM ${qid(fromTable)}`, params: [] };
  }

  const chain = walkChain(from.id, nodeMap, edges).filter((s) => s.data.kind !== "insert");
  const idx = chain.findIndex((s) => s.id === nodeId);
  if (idx < 0) return null;

  const prefix = chain.slice(0, idx + 1).filter((s) => s.data.kind !== "select");
  const params: any[] = [];

  let inner = `SELECT * FROM ${qid(fromTable)}`;
  const whereFrags: string[] = [];
  for (const s of prefix) {
    if (s.data.kind === "where") whereFrags.push(...conditionFragments(s.data, params));
  }
  if (whereFrags.length) inner += ` WHERE ${whereFrags.join(" AND ")}`;

  // 探针统计的是「流经该节点的行数」：GROUP BY 之后的节点按分组数计
  const hasGroup = prefix.some((s) => s.data.kind === "groupBy");
  if (hasGroup) {
    const groupStep = prefix.find((s) => s.data.kind === "groupBy");
    const groupCols = (groupStep?.data.groupByCols || []).filter(Boolean);
    if (groupCols.length) inner += ` GROUP BY ${groupCols.map(qid).join(", ")}`;
    return { sql: `SELECT COUNT(*) AS cnt FROM (${inner})`, params };
  }

  return { sql: `SELECT COUNT(*) AS cnt FROM (${inner})`, params };
}

/** 校验连线合法性（画布 onConnect 前调用）；返回错误消息，null 表示允许 */
export function connectionError(
  sourceKind: NodeKind | undefined,
  targetKind: NodeKind | undefined
): string | null {
  if (!sourceKind || !targetKind) return "连线的两端都必须是流水线里的节点";
  if (targetKind === "from") {
    return "「数据源」是起点，不能再接收别人连过来的线";
  }
  if (sourceKind === "insert") {
    return "「写回表」是终点，后面不用再接东西了";
  }
  if (KIND_META[targetKind].order <= KIND_META[sourceKind].order && !(sourceKind === "where" && targetKind === "where")) {
    return `连线方向反了：数据要先经过「${KIND_META[sourceKind].humanLabel}」，再到「${KIND_META[targetKind].humanLabel}」`;
  }
  return null;
}
