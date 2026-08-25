// 批量重命名 / 转移共享规则引擎
// 抽出自 fileRename.vue，供「文件重命名」与「文件转移(转移后重命名)」复用。

import type { DateRule, RandomRule, CleanRule, TrimRule } from './types';

// 文件夹条目（与主进程 list-folder 返回结构一致；渲染进程无 node，纯前端计算）
export interface ListFolderItem {
  name: string; // 文件名（含扩展名）
  path: string; // 完整路径
  isDir: boolean; // 是否为目录
  ext: string; // 扩展名（含点，目录为空串）
  size: number; // 字节数（目录为 0）
  mtime: number; // 修改时间（毫秒）
  ctime: number; // 状态变更时间（毫秒，Windows 上接近创建时间）
  birthtime: number; // 创建时间（毫秒，部分平台可能为 0）
  index?: number; // 过滤后全局序号（0 起），供分页预览按序编号
}

// 各规则子对象类型
export interface SearchRule {
  enabled: boolean;
  find: string;
  replace: string;
  regex: boolean;
  case: boolean;
}
export interface SeqRule {
  enabled: boolean;
  start: number;
  step: number;
  digits: number;
  sep: string;
  pos: 'prefix' | 'suffix';
}
export interface ExtRule {
  mode: 'keep' | 'set';
  value: string;
}

// 完整规则集合（与 fileRename.vue 的 rules reactive 对象结构一致）
export interface RenameRules {
  search: SearchRule;
  prefix: string;
  suffix: string;
  seq: SeqRule;
  caseMode: 'keep' | 'upper' | 'lower' | 'title';
  ext: ExtRule;
  date: DateRule;
  random: RandomRule;
  clean: CleanRule;
  trim: TrimRule;
}

// 默认规则（未启用任何规则时 computeNewName 返回原名）
export function createDefaultRules(): RenameRules {
  return {
    search: { enabled: false, find: '', replace: '', regex: false, case: false },
    prefix: '',
    suffix: '',
    seq: { enabled: false, start: 1, step: 1, digits: 2, sep: '_', pos: 'prefix' },
    caseMode: 'keep',
    ext: { mode: 'keep', value: '' },
    date: { enabled: false, mode: 'mtime', format: 'YYYY-MM-DD', pos: 'prefix', sep: '_' },
    random: { enabled: false, kind: 'uuid', length: 8, pos: 'prefix', sep: '_' },
    clean: { enabled: false, ops: [], specified: '' },
    trim: { enabled: false, mode: 'keepStart', n: 5 },
  };
}

// 渲染进程无 node path：本地文件名工具
export function getExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(i) : '';
}
export function getBase(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 && i < name.length - 1 ? name.slice(0, i) : name;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function toTitleCase(s: string): string {
  return s.replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

// 占位符：YYYY(年) YY(两位年) MM(月) DD(日) HH(24时) hh(12时) mm(分) ss(秒)
// 中文「年月日时分秒」等非占位符原样保留，故可直接写 YYYY年MM月DD日 等
export function formatDate(ts: number, fmt: string): string {
  const d = new Date(ts);
  if (!isFinite(ts)) return ''; // 时间戳非法时返回空，避免 NaN 污染文件名
  const pad = (n: number, l = 2) => String(n).padStart(l, '0');
  const Y = d.getFullYear();
  return fmt
    .replace(/YYYY/g, String(Y))
    .replace(/YY/g, String(Y).slice(-2))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/hh/g, pad(d.getHours() % 12 || 12))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()));
}

export function genRandom(kind: 'uuid' | 'alnum' | 'alpha' | 'digit', length: number): string {
  if (kind === 'uuid') return (crypto as any).randomUUID ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2);
  const alpha = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digit = '0123456789';
  const pool = kind === 'digit' ? digit : kind === 'alpha' ? alpha : alpha + digit;
  let s = '';
  for (let i = 0; i < Math.max(1, length); i++) s += pool[Math.floor(Math.random() * pool.length)];
  return s;
}

// 计算单个文件的新文件名（index 用于序号；日期/随机各自独立生成）
export function computeNewName(f: ListFolderItem, index: number, rules: RenameRules): string {
  let base = getBase(f.name);
  const ext = getExt(f.name);
  const r = rules;

  // 1. 查找替换（作用于文件名主体）
  if (r.search.enabled && r.search.find) {
    const rep = r.search.replace;
    if (r.search.regex) {
      try {
        const re = new RegExp(r.search.find, r.search.case ? 'g' : 'gi');
        base = base.replace(re, rep);
      } catch {
        // 非法正则：忽略
      }
    } else if (r.search.case) {
      base = base.split(r.search.find).join(rep);
    } else {
      base = base.replace(new RegExp(escapeRegExp(r.search.find), 'gi'), rep);
    }
  }

  // 2. 大小写
  if (r.caseMode === 'upper') base = base.toUpperCase();
  else if (r.caseMode === 'lower') base = base.toLowerCase();
  else if (r.caseMode === 'title') base = toTitleCase(base);

  // 3. 字符清理
  if (r.clean.enabled) {
    let s = base;
    if (r.clean.ops.includes('spaceToUnderscore')) s = s.replace(/\s+/g, '_');
    if (r.clean.ops.includes('removeSpaces')) s = s.replace(/\s+/g, '');
    if (r.clean.ops.includes('removeDigits')) s = s.replace(/\d+/g, '');
    if (r.clean.ops.includes('removeBrackets')) s = s.replace(/[\(\[\{][\s\S]*?[\)\]\}]/g, '');
    if (r.clean.ops.includes('removeSpecified') && r.clean.specified) {
      const set = r.clean.specified.split('').map(escapeRegExp).join('');
      if (set) s = s.replace(new RegExp('[' + set + ']', 'g'), '');
    }
    base = s;
  }

  // 4. 按位置截取
  if (r.trim.enabled && r.trim.n > 0) {
    const n = r.trim.n;
    if (r.trim.mode === 'keepStart') base = base.slice(0, n);
    else if (r.trim.mode === 'keepEnd') base = base.slice(-n);
    else if (r.trim.mode === 'removeStart') base = base.slice(n);
    else if (r.trim.mode === 'removeEnd') base = base.slice(0, Math.max(0, base.length - n));
  }

  // 5. 前后缀（包裹整体）
  base = (r.prefix || '') + base + (r.suffix || '');

  // 6. 序号（插入到主体，位置可选）
  if (r.seq.enabled) {
    const n = (r.seq.start || 0) + index * (r.seq.step || 1);
    const seqStr = String(n).padStart(Math.max(0, r.seq.digits || 0), '0');
    const sep = r.seq.sep || '';
    base = r.seq.pos === 'prefix' ? seqStr + sep + base : base + sep + seqStr;
  }

  // 7. 日期片段（按文件时间生成，分隔符恒在主体与日期之间）
  if (r.date.enabled) {
    const ts = r.date.mode === 'ctime' ? f.ctime : f.mtime;
    const seg = formatDate(ts, r.date.format);
    const sep = r.date.sep || '';
    base = r.date.pos === 'prefix' ? seg + sep + base : base + sep + seg;
  }

  // 8. 随机片段（去标识化）
  if (r.random.enabled) {
    const seg = genRandom(r.random.kind, r.random.length);
    const sep = r.random.sep || '';
    base = r.random.pos === 'prefix' ? seg + sep + base : base + sep + seg;
  }

  // 9. 扩展名
  let finalExt = ext;
  if (r.ext.mode === 'set') {
    const v = (r.ext.value || '').trim();
    finalExt = v ? (v.startsWith('.') ? v : '.' + v) : '';
  }
  return base + finalExt;
}
