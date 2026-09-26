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
function orderErrors(chain: ChainStep[]): string[] {
  const errors: string[] = [];
  let prevOrder = -1;
  for (const step of chain) {
    if (step.data.kind === "insert") continue;
    const order = KIND_META[step.data.kind].order;
    if (order < prevOrder) {
      errors.push(`节点顺序错误：${KIND_META[step.data.kind].label} 应出现在链路更靠前的位置`);
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

/** 整图编译产物：ok=false 时只保证 errors 有值 */
export interface CompileResult {
  ok: boolean;
  errors: string[];
  select?: CompiledSelect;
  insertSql?: string;
  insertParams?: any[];
  targetTable?: string;
}

/**
 * 编译整张图。不抛异常，错误集中在 errors 里返回，方便画布上直接展示。
 */
export function compilePipeline({ nodes, edges }: CompileInput): CompileResult {
  const errors: string[] = [];
  const nodeMap = new Map<string, GraphNode>(nodes.map((n) => [n.id, n]));

  const fromNodes = nodes.filter((n) => n.data.kind === "from");
  if (fromNodes.length === 0) errors.push("缺少 FROM 节点：请从子句库添加一个数据源表");
  if (fromNodes.length > 1) errors.push("FROM 节点只能有一个（多表联查请用视图或 SQL 控制台）");
  if (fromNodes.length !== 1) return { ok: false, errors };

  const from = fromNodes[0];
  if (!from.data.table) errors.push("FROM 节点未选择数据源表");

  const chain = walkChain(from.id, nodeMap, edges).filter((s) => s.data.kind !== "insert");
  errors.push(...orderErrors(chain));

  const selectNode = chain.find((s) => s.data.kind === "select");
  if (!selectNode) errors.push("缺少 SELECT 节点：链路需要以 SELECT 输出结尾");

  const insertNode = nodes.map((n) => n.data).find((d) => d.kind === "insert");
  if (insertNode && !insertNode.targetTable) errors.push("INSERT 节点未选择写回目标表");

  if (errors.length > 0) return { ok: false, errors };

  // ---- 组装 SELECT ----
  const params: any[] = [];

  const chainNoSelect = chain.filter((s) => s.data.kind !== "select");
  const whereSteps = chainNoSelect.filter((s) => s.data.kind === "where");
  const groupStep = chainNoSelect.find((s) => s.data.kind === "groupBy");
  const { frags: outFrags, cols } = outputList(selectNode!.data);

  const selectList = outFrags.length ? outFrags.join(", ") : "*";

  let sql = `SELECT ${selectList}\nFROM ${qid(from.data.table!)}`;

  const whereFrags: string[] = [];
  for (const w of whereSteps) whereFrags.push(...conditionFragments(w.data, params));
  if (whereFrags.length) sql += `\nWHERE ${whereFrags.join("\n  AND ")}`;

  const groupCols = (groupStep?.data.groupByCols || []).filter(Boolean);
  if (groupCols.length) sql += `\nGROUP BY ${groupCols.map(qid).join(", ")}`;

  if (selectNode!.data.orderByCol) {
    sql += `\nORDER BY ${qid(selectNode!.data.orderByCol)}${selectNode!.data.orderByDesc ? " DESC" : ""}`;
  }
  if (selectNode!.data.limit != null && (selectNode!.data.limit as number) > 0) {
    sql += `\nLIMIT ${Math.floor(selectNode!.data.limit as number)}`;
  }

  const select: CompiledSelect = { sql, params, outputCols: cols };

  // ---- 写回语句（存在 INSERT 节点时）----
  let insertSql: string | undefined;
  let insertParams: any[] | undefined;
  if (insertNode) {
    if (cols.length === 0) {
      errors.push("写回需要显式输出列：请在 SELECT 节点填写输出列或聚合列（不能为 *）");
      return { ok: false, errors, select };
    }
    insertSql = `INSERT INTO ${qid(insertNode.targetTable!)} (${cols.map(qid).join(", ")})\n${sql}`;
    insertParams = params;
  }

  return { ok: true, errors: [], select, insertSql, insertParams, targetTable: insertNode?.targetTable };
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
  if (!sourceKind || !targetKind) return "连线两端必须是流水线节点";
  if (targetKind === "from") return "FROM 是数据源头，不能接收输入";
  if (sourceKind === "insert") return "INSERT 是终点，不能继续向后连线";
  if (KIND_META[targetKind].order <= KIND_META[sourceKind].order && !(sourceKind === "where" && targetKind === "where")) {
    return `连线方向应符合执行顺序：${KIND_META[sourceKind].label} → ${KIND_META[targetKind].label} 不合法`;
  }
  return null;
}
