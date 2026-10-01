/**
 * 任务依赖图：把 todo_list 转成有向无环图（DAG）
 *
 * 设计要点：
 * - 每个待办一个节点；parentIds 里每个父 → 一条 父→子 边（依赖从父流向子）。
 * - 去重边；环检测：若「子」是「父」的祖先，则该边成环，跳过（避免 dagre 成环崩）。
 * - computeCriticalPath：未完成任务（非 completed / 非 cancelled）构成的最长依赖链高亮。
 * - 纯逻辑、零 Vue / 零 IPC，可直接用 typescript.transpileModule 抽出来跑断言。
 */
import type { TodoItem } from '../../types';
import { isOverdueItem } from '../../utils/time';
import { MarkerType } from '@vue-flow/core';

export interface TodoDepNodeData {
  key: string;
  title: string;
  /** effectiveStatus 推导后的有效状态 */
  status: string;
  priority: string;
  dueDate: string;
  isOverdue: boolean;
  isSubtask: boolean;
  parentCount: number;
  childCount: number;
}

export interface DepNode {
  id: string;
  type: 'todoDep';
  position: { x: number; y: number };
  data: TodoDepNodeData;
}

export interface DepEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  markerEnd: { type: MarkerType };
}

export interface BuildResult {
  nodes: DepNode[];
  edges: DepEdge[];
}

/** parentIds 容错：内存里应是 string[]，但落库往返/异常可能混进 JSON 字符串；统一归一避免 .filter/.map 抛错 */
export function toParentIdArray(v: unknown): string[] {
  if (Array.isArray(v)) return (v as unknown[]).filter((x) => typeof x === 'string') as string[];
  if (typeof v === 'string' && v.trim()) {
    try {
      const arr = JSON.parse(v);
      if (Array.isArray(arr)) return (arr as unknown[]).filter((x) => typeof x === 'string') as string[];
    } catch {
      /* 非 JSON 字符串，忽略 */
    }
  }
  return [];
}

/** 把待办列表构建为依赖图节点与边 */
export function buildGraph(todos: TodoItem[], effectiveStatus: (t: TodoItem) => string): BuildResult {
  const byKey = new Map(todos.map((t) => [t.key, t]));

  const nodes: DepNode[] = todos.map((t) => {
    const status = effectiveStatus(t);
    const parentIds = toParentIdArray(t.parentIds);
    return {
      id: t.key,
      type: 'todoDep',
      position: { x: 0, y: 0 },
      data: {
        key: t.key,
        title: t.title || '未命名任务',
        status,
        priority: t.priority || 'medium',
        dueDate: t.dueDate || '',
        isOverdue: isOverdueItem(t.dueDate, status === 'completed'),
        isSubtask: !!parentIds.length,
        parentCount: parentIds.length,
        childCount: 0,
      },
    };
  });

  // 父链向上查找：检测 child 是否是 p 的祖先（成环）
  const parentsOf = (k: string) => toParentIdArray(byKey.get(k)?.parentIds);
  function isAncestor(maybeAncestor: string, node: string): boolean {
    const stack = [...parentsOf(node)];
    const visited = new Set<string>();
    while (stack.length) {
      const cur = stack.pop() as string;
      if (cur === maybeAncestor) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      stack.push(...parentsOf(cur));
    }
    return false;
  }

  const seen = new Set<string>();
  const edges: DepEdge[] = [];
  for (const t of todos) {
    const child = t.key;
    for (const p of parentsOf(child)) {
      if (!byKey.has(p)) continue; // 父不存在则忽略
      const pairKey = `${p}->${child}`;
      if (seen.has(pairKey)) continue;
      if (isAncestor(child, p)) continue; // 成环，跳过
      seen.add(pairKey);
      edges.push({
        id: `e-${p}-${child}`,
        source: p,
        target: child,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }
  }

  // 统计子任务数（父节点的 childCount）
  const childCount = new Map<string, number>();
  for (const e of edges) childCount.set(e.source, (childCount.get(e.source) || 0) + 1);
  for (const n of nodes) n.data.childCount = childCount.get(n.id) || 0;

  return { nodes, edges };
}

export interface CriticalPath {
  nodes: Set<string>;
  edges: Set<string>;
}

/**
 * 关键路径：未完成任务（非 completed / 非 cancelled）构成的最长依赖链。
 * 返回需要高亮的节点与边集合（拓扑相关，与坐标无关）。
 */
export function computeCriticalPath(nodes: DepNode[], edges: DepEdge[]): CriticalPath {
  const children = new Map<string, string[]>();
  for (const e of edges) {
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source)!.push(e.target);
  }
  const unfinished = (id: string) => {
    const n = nodes.find((x) => x.id === id);
    return !!n && n.data.status !== 'completed' && n.data.status !== 'cancelled';
  };
  const memo = new Map<string, number>();
  const longest = (id: string): number => {
    if (memo.has(id)) return memo.get(id)!;
    const kids = (children.get(id) || []).filter(unfinished);
    let best = 1;
    for (const k of kids) best = Math.max(best, 1 + longest(k));
    memo.set(id, best);
    return best;
  };

  // 父关系：target -> 所有 source
  const parentsOf = (id: string): string[] =>
    edges.filter((e) => e.target === id).map((e) => e.source);

  // 关键路径起点：未完成任务，且其所有父任务都已结束（或没有父任务）。
  // 这样当祖任务已完成、后代仍在进行时，仍能把未完成的尾部链高亮出来。
  let root: string | null = null;
  let bestLen = 0;
  for (const n of nodes) {
    if (!unfinished(n.id)) continue;
    const pars = parentsOf(n.id);
    const allParentsDone = pars.every((p) => !unfinished(p));
    if (pars.length === 0 || allParentsDone) {
      const l = longest(n.id);
      if (l > bestLen) {
        bestLen = l;
        root = n.id;
      }
    }
  }

  const pathNodes = new Set<string>();
  const pathEdges = new Set<string>();
  if (root) {
    let cur = root;
    pathNodes.add(cur);
    for (;;) {
      const kids = (children.get(cur) || []).filter(unfinished);
      if (!kids.length) break;
      let nxt = kids[0];
      let nxtLen = -1;
      for (const k of kids) {
        const l = longest(k);
        if (l > nxtLen) {
          nxtLen = l;
          nxt = k;
        }
      }
      pathEdges.add(`e-${cur}-${nxt}`);
      pathNodes.add(nxt);
      cur = nxt;
    }
  }
  return { nodes: pathNodes, edges: pathEdges };
}
