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

/**
 * 节点种类元信息。
 *
 * 教学取向：界面上优先说「人话」（humanLabel / desc），SQL 关键字（label）降级为副标。
 * 用户不必先懂 FROM/WHERE 才能用，而是先看懂「从哪张表取数」「只保留符合条件的行」。
 */
export const KIND_META: Record<
  NodeKind,
  {
    /** SQL 关键字（副标，展示在中文名下方） */
    label: string;
    /** 人话名称（主标，界面上主要显示这个） */
    humanLabel: string;
    /** 这一步在做什么（一句人话，用于属性面板说明卡） */
    desc: string;
    /** 空态文案：节点已放置但还没配置时显示，解释「现在等于没写」 */
    emptyHint: string;
    color: string;
    softBg: string;
    order: number;
  }
> = {
  from: {
    label: "FROM",
    humanLabel: "数据源",
    desc: "决定从哪张表开始取数。整条流水线只能有一张来源表。",
    emptyHint: "还没选表",
    color: "#2F6BFF",
    softBg: "#F2F6FF",
    order: 0,
  },
  where: {
    label: "WHERE",
    humanLabel: "筛选条件",
    desc: "只保留满足条件的行，不满足的会被丢掉。条件之间是「并且」的关系。",
    emptyHint: "没设条件 · 不筛选",
    color: "#6C5CE7",
    softBg: "#F4F2FE",
    order: 1,
  },
  groupBy: {
    label: "GROUP BY",
    humanLabel: "分组统计",
    desc: "把行按某一列归并成组，配合聚合函数（SUM / COUNT）就能做汇总。",
    emptyHint: "没选分组列",
    color: "#0EA5E9",
    softBg: "#EFF9FE",
    order: 2,
  },
  select: {
    label: "SELECT",
    humanLabel: "输出列",
    desc: "决定最后拿出哪些列。留空表示「全部列」。",
    emptyHint: "输出全部列",
    color: "#15A04E",
    softBg: "#EFFAF3",
    order: 3,
  },
  insert: {
    label: "INSERT",
    humanLabel: "写回表",
    desc: "把上面算出来的结果存进另一张表。这是写操作，需要单独开启并二次确认。",
    emptyHint: "还没选写回目标",
    color: "#F59E0B",
    softBg: "#FEF9EF",
    order: 4,
  },
};

/**
 * 节点「未配置」判定：true 表示这一步当前不产生任何实际效果。
 * 用于在画布上给节点加虚线灰边 + 显示 emptyHint，让用户一眼看出「哪块还没写完」。
 */
export function nodeEmpty(data: PipelineNodeData): boolean {
  switch (data.kind) {
    case "from":
      return !data.table;
    case "where":
      return !(data.conditions || []).some((c) => c.field);
    case "groupBy":
      return !(data.groupByCols || []).filter(Boolean).length;
    case "select":
      // SELECT 留空 = 全部列，属于合法且有意义的默认行为，不算「没写完」
      return false;
    case "insert":
      return !data.targetTable;
  }
}

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
