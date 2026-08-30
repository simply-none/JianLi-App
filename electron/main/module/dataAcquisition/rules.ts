/**
 * 【数据获取】规则抽取引擎
 * ------------------------------------------------------------------
 * JSON 规则描述式抽取（IPC 不传函数的破解方案）：
 * 1. 选择器解析交给 Puppeteer 原生 $/$$（天然支持 P 选择器：
 *    text/xxx、xpath//xxx、aria/xxx、>>> 穿透 Shadow DOM）
 * 2. 取值函数为页面内静态函数，attr 参数由规则驱动
 * 3. 变换管道在 Node 端执行（trim/replace/number/date/split）
 * 4. 列表模式（itemSelector）：每个容器产出一条记录
 *    扁平模式（无 itemSelector）：整页产出一条记录，multiple 规则产出数组
 */
import type puppeteer from "puppeteer";
import type { FieldRule, TransformStep, CaptureConfig, ItemGroup } from "./types.ts";

/** 页面内取值函数（在浏览器上下文执行，禁止引用外部变量） */
function getElValue(el: Element, attr: string): string {
  const a = attr || "text";
  if (a === "text") return ((el as HTMLElement).innerText ?? el.textContent ?? "").trim();
  if (a === "textContent") return (el.textContent ?? "").trim();
  if (a === "html" || a === "innerHTML") return el.innerHTML;
  if (a === "outerHTML") return el.outerHTML;
  if (a === "value") return (el as HTMLInputElement).value ?? el.getAttribute("value") ?? "";
  // href/src 用属性特性取绝对地址（getAttribute 会拿到相对路径）
  if (a === "href" || a === "src") return (el as any)[a] || el.getAttribute(a) || "";
  return el.getAttribute(a) ?? "";
}

/**
 * 应用变换管道（Node 端按序执行）
 * @param value 原始值
 * @param transforms 变换步骤列表
 * @returns 变换后的值（date/number 产出非字符串类型）
 */
export function applyTransforms(value: string, transforms?: TransformStep[]): any {
  let v: any = value;
  for (const t of transforms || []) {
    try {
      switch (t.type) {
        case "trim":
          v = String(v ?? "").trim();
          break;
        case "replace":
          v = String(v ?? "").replace(new RegExp(t.pattern, t.flags || "g"), t.replacement);
          break;
        case "number": {
          const n = parseFloat(String(v ?? "").replace(/[^\d.\-+eE]/g, ""));
          v = Number.isNaN(n) ? "" : n;
          break;
        }
        case "date": {
          const d = new Date(v);
          v = Number.isNaN(d.getTime())
            ? v
            : formatLocalDate(d, t.format || "YYYY-MM-DD HH:mm:ss");
          break;
        }
        case "split": {
          const parts = String(v ?? "").split(t.separator);
          v = t.index === undefined ? parts.filter(Boolean) : parts[t.index] ?? "";
          break;
        }
      }
    } catch {
      // 单个变换失败保留上一结果，不中断整条记录
    }
  }
  return v;
}

/**
 * 本地日期格式化（YYYY/MM/DD/HH/mm/ss 占位符替换）
 * @param d 日期对象
 * @param format 格式模板
 * @returns 格式化字符串
 */
function formatLocalDate(d: Date, format: string): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return format
    .replace("YYYY", String(d.getFullYear()))
    .replace("MM", pad(d.getMonth() + 1))
    .replace("DD", pad(d.getDate()))
    .replace("HH", pad(d.getHours()))
    .replace("mm", pad(d.getMinutes()))
    .replace("ss", pad(d.getSeconds()));
}

/**
 * 按规则抽取单条记录的字段值
 * @param scope 作用域句柄（页面或元素容器）
 * @param rule 字段规则
 * @returns 抽取并变换后的字段值
 */
async function extractField(
  scope: puppeteer.Page | puppeteer.ElementHandle<Element>,
  rule: FieldRule
): Promise<any> {
  const attr = rule.attr || "text";
  if (rule.multiple) {
    const elements = await scope.$$(rule.selector);
    const values: any[] = [];
    for (const el of elements) {
      const raw = await el.evaluate(getElValue, attr);
      values.push(applyTransforms(raw, rule.transforms));
    }
    return values;
  }
  const el = await scope.$(rule.selector);
  if (!el) {
    return "";
  }
  const raw = await el.evaluate(getElValue, attr);
  return applyTransforms(raw, rule.transforms);
}

/**
 * 在指定作用域内收集一个提取项容器组的全部子项
 * （命中多少个子项容器就产出多少条，返回全部而非第一个）
 * @param scope 抽取作用域（页面或记录容器元素）
 * @param group 提取项容器组配置
 * @returns 子项记录数组（每个子项容器一条，可能为空数组）
 */
async function extractGroupItems(scope: puppeteer.Page | puppeteer.ElementHandle, group: ItemGroup): Promise<any[]> {
  // 过滤无效规则：字段名与选择器必填
  const rules = (group.rules || []).filter((r) => r.field && r.selector);
  const elements = await scope.$$(group.selector);
  const out: any[] = [];
  for (const el of elements) {
    const record: Record<string, any> = {};
    for (const rule of rules) {
      record[rule.field] = await extractField(el, rule);
    }
    out.push(record);
  }
  return out;
}

/**
 * 判断记录值是否为空（空串/null/空数组视为空）
 * @param v 记录字段值
 * @returns 为空时返回 true
 */
function isEmptyValue(v: any): boolean {
  return v === "" || v === null || v === undefined || (Array.isArray(v) && !v.length);
}

/**
 * 在当前页面上执行规则抽取（列表模式 / 扁平模式自动分流）
 * 记录 = 记录级字段 + 各提取项容器组的子项数组（子项返回全部而非第一个）
 * @param page 目标页面
 * @param config 任务配置（使用 itemSelector/rules/groups）
 * @returns 抽取出的记录数组（可能为空数组）
 */
export async function extractRecords(page: puppeteer.Page, config: {
  itemSelector?: string;
  rules: FieldRule[];
  groups?: ItemGroup[];
}): Promise<any[]> {
  // 过滤无效规则：字段名与选择器均为必填，避免 querySelector('') 抛
  // "The provided selector is empty"（新建任务默认带一条空规则，极易触发）
  const rules = (config.rules || []).filter((r) => r.field && r.selector);
  // 过滤有效提取项容器组：组名与选择器必填（项容器可选，可为空）
  const groups = (config.groups || []).filter((g) => g.name && g.selector);
  // 记录级规则与提取项容器至少要有一个，否则无从抽取
  if (!rules.length && !groups.length) {
    throw new Error(
      "没有有效的抽取配置：请填写字段规则（字段名与选择器必填），或添加至少一个提取项容器（组名与选择器必填）"
    );
  }
  // 列表模式：遍历记录容器，容器内按字段选择器相对抽取
  if (config.itemSelector) {
    const items = await page.$$(config.itemSelector);
    // 容器匹配 0 个时给出可定位的明确错误，而不是笼统的"未采集到任何记录"
    if (!items.length) {
      throw new Error(
        `记录容器 '${config.itemSelector}' 匹配到 0 个元素：请核对该选择器是否存在于当前页面` +
          `（可打开 cache-data/步骤N_*.html 调试快照比对）；若要抓取整页字段，请清空「记录容器」改用扁平模式`
      );
    }
    const records: any[] = [];
    for (const item of items) {
      const record: Record<string, any> = {};
      // 记录级字段
      for (const rule of rules) {
        record[rule.field] = await extractField(item, rule);
      }
      // 提取项容器组：每条记录内收集全部子项（数组）
      for (const group of groups) {
        record[group.name] = await extractGroupItems(item, group);
      }
      records.push(record);
    }
    // 容器有元素但内容全部取空时提示定位（常见于相对选择器与容器不匹配）
    const allEmpty = records.every((rec) => Object.values(rec).every(isEmptyValue));
    if (allEmpty) {
      const selectors = [...rules.map((r) => r.selector), ...groups.map((g) => g.selector)].join("、");
      throw new Error(
        `记录容器 '${config.itemSelector}' 命中 ${items.length} 个元素，但字段/项容器选择器全部取到空值：${selectors}` +
          `。请确认选择器是相对容器内部的路径，而非容器自身的绝对选择器`
      );
    }
    return records;
  }
  // 扁平模式：整页一条记录（multiple 规则与提取项容器产出数组）
  const record: Record<string, any> = {};
  for (const rule of rules) {
    record[rule.field] = await extractField(page, rule);
  }
  for (const group of groups) {
    record[group.name] = await extractGroupItems(page, group);
  }
  return [record];
}

/* ------------------------------------------------------------------ */
/* XHR/Fetch 接口捕获                                                   */
/* ------------------------------------------------------------------ */

/** 捕获到的接口响应（body 为解析后的 JSON） */
export interface CapturedResponse {
  /** 响应 URL */
  url: string;
  /** 解析后的 JSON 体 */
  body: any;
  /** 捕获时间戳 */
  at: number;
}

/**
 * 在页面上挂载接口捕获监听（仅捕获 content-type 含 json 的 XHR/Fetch 响应）
 * @param page 目标页面
 * @param cap 捕获配置
 * @returns 捕获缓冲区（引用透传，任务结束时读取）
 */
export function attachCapture(page: puppeteer.Page, cap: CaptureConfig): CapturedResponse[] {
  const buffer: CapturedResponse[] = [];
  const max = cap.maxCount || 50;
  let pattern: RegExp;
  try {
    pattern = new RegExp(cap.urlPattern);
  } catch {
    return buffer; // 非法正则直接放弃捕获（不阻断主流程）
  }
  page.on("response", async (res) => {
    if (buffer.length >= max) return;
    try {
      const req = res.request();
      const type = (res.headers()["content-type"] || "").toLowerCase();
      if (!type.includes("json")) return;
      if (!pattern.test(res.url())) return;
      if (cap.method && req.method().toUpperCase() !== cap.method.toUpperCase()) return;
      const body = await res.json().catch(() => null);
      if (body !== null && body !== undefined) {
        buffer.push({ url: res.url(), body, at: Date.now() });
      }
    } catch {
      // 单条响应解析失败忽略，不影响其它捕获
    }
  });
  return buffer;
}

/**
 * 从捕获响应中按 dataPath 提取记录
 * @param captured 捕获到的响应列表
 * @param dataPath 数据路径（如 data.list，点号分隔；空则取整个 body）
 * @returns 记录数组（路径命中数组直接展开；命中对象包装为单条；无命中返回空数组）
 */
export function captureToRecords(captured: CapturedResponse[], dataPath?: string): any[] {
  const records: any[] = [];
  for (const item of captured) {
    let value: any = item.body;
    if (dataPath) {
      for (const key of dataPath.split(".")) {
        if (value === null || value === undefined) break;
        value = value[key];
      }
    }
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      records.push(...value);
    } else {
      records.push(value);
    }
  }
  return records;
}
