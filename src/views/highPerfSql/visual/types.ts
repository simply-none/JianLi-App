/**
 * 可视化流水线（SQL 教学模式）类型定义
 *
 * 设计原则：节点 = 真实 SQL 子句（FROM / WHERE / GROUP BY / SELECT / INSERT），
 * 图 → SQL 由 compiler.ts 确定性编译；节点上展示的文案与底部「实时 SQL」同源。
 */

export type NodeKind = "from" | "where" | "groupBy" | "select" | "insert";

/** WHERE 条件项（值一律参数化，不拼进 SQL 字符串） */
export interface PipelineCondition {
  field: string;
  /** = != > < >= <= LIKE */
  op: string;
  value: string;
}

/** 聚合列，如 { expr: 'SUM(金额)', alias: '总金额' } */
export interface PipelineAggregate {
  expr: string;
  alias: string;
}

/** 流水线节点携带的数据（挂在 VueFlow node.data 上） */
export interface PipelineNodeData {
  kind: NodeKind;
  /** from：数据源表名 */
  table?: string;
  /** where：条件列表（AND 连接） */
  conditions?: PipelineCondition[];
  /** groupBy：分组列 */
  groupByCols?: string[];
  /** select：普通输出列 */
  selectCols?: string[];
  /** select：聚合输出列 */
  aggregates?: PipelineAggregate[];
  /** select：排序与限量（教学上属于 SELECT 子句的一部分） */
  orderByCol?: string;
  orderByDesc?: boolean;
  limit?: number | null;
  /** insert：写回目标表 */
  targetTable?: string;
  /** 运行时探针状态（不由用户编辑） */
  probe?: ProbeState;
}

export interface ProbeState {
  status: "idle" | "running" | "ok" | "error";
  rows?: number;
  ms?: number;
  error?: string;
}

/** 编译产物 */
export interface CompiledSelect {
  sql: string;
  params: any[];
  /** 输出列名（有显式输出时），供写回列对齐 */
  outputCols: string[];
}

export interface CompileResult {
  ok: boolean;
  errors: string[];
  /** 主查询（FROM→WHERE→GROUP BY→SELECT 链） */
  select?: CompiledSelect;
  /** 若存在 INSERT 节点：写回语句（在事务中执行） */
  insertSql?: string;
  insertParams?: any[];
  /** 写回目标表 */
  targetTable?: string;
}

/** 节点种类元信息（颜色 / 标签 / 顺序），SqlClauseNode 与 NodeLibrary 共用 */
export const KIND_META: Record<
  NodeKind,
  { label: string; color: string; softBg: string; order: number }
> = {
  from: { label: "FROM", color: "#2F6BFF", softBg: "#F2F6FF", order: 0 },
  where: { label: "WHERE", color: "#6C5CE7", softBg: "#F4F2FE", order: 1 },
  groupBy: { label: "GROUP BY", color: "#0EA5E9", softBg: "#EFF9FE", order: 2 },
  select: { label: "SELECT", color: "#15A04E", softBg: "#EFFAF3", order: 3 },
  insert: { label: "INSERT", color: "#F59E0B", softBg: "#FEF9EF", order: 4 },
};

/** 默认节点数据（NodeLibrary 添加节点时用） */
export function defaultNodeData(kind: NodeKind): PipelineNodeData {
  switch (kind) {
    case "from":
      return { kind, table: "" };
    case "where":
      return { kind, conditions: [{ field: "", op: "=", value: "" }] };
    case "groupBy":
      return { kind, groupByCols: [] };
    case "select":
      return { kind, selectCols: [], aggregates: [], orderByCol: "", orderByDesc: false, limit: null };
    case "insert":
      return { kind, targetTable: "" };
  }
}
