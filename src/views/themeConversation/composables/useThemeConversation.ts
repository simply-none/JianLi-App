/**
 * 主题对话 - 组合式状态管理（模块级单例）
 * ------------------------------------------------------------------
 * 所有组件（主题列表 / 工具栏 / 对话列表 / 输入框 / 引用弹窗）共享同一份状态，
 * 因此把状态与数据库操作收敛到此组合式函数中。
 *
 * 设计要点：
 * - 状态为模块级单例，同一渲染窗口内任意组件 import 后拿到的是同一份数据；
 *   后续新增「小窗模式」时，只需在新窗口中 import 本模块并调用 init()，即可复用全部逻辑与组件。
 * - 数据库操作统一走 db.ts（newSql.ts 的 new-sql:* 通道）。
 * - 引用关系用 JSON 字符串数组存储，支持「引用一个或多个」「一个对话被多次引用」。
 */
import { ref, computed } from 'vue';
import moment from 'moment';
import { dbQuery, dbInsert, dbUpdate, dbDelete, dbExecute } from '../db';
import { TABLE, TAG_SCOPE } from '../types';

/* ============================ 工具函数 ============================ */

/** 把数据库中的 JSON 字符串数组安全地解析为字符串数组 */
function parseArr(value: any): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  try {
    const arr = JSON.parse(value);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

/** 当前时间字符串，格式与项目其它模块保持一致（YYYY-MM-DD HH:mm:ss，本地时区） */
function nowStr(): string {
  return moment().format('YYYY-MM-DD HH:mm:ss');
}

/* ============================ 共享状态 ============================ */

const themes = ref<any[]>([]);                 // 全部对话主题
const themeCounts = ref<Record<number, number>>({}); // 各主题下的对话数量
const tags = ref<any[]>([]);                   // 全部标签
const currentThemeId = ref<number | null>(null); // 当前选中的主题 id
const conversations = ref<any[]>([]);          // 当前主题下的全部对话
const loading = ref(false);

const searchKeyword = ref('');                 // 搜索关键字（主题字段 / 对话内容字段 / 标签）
const activeTagFilter = ref<string>('');       // 按标签筛选（标签分类），存标签 id

const searchResults = ref<any[]>([]);          // 搜索结果（跨主题）

/** 引用抽屉：展示被引用的历史对话信息 */
const referenceDrawer = ref<{ open: boolean; title: string; items: any[] }>({
  open: false,
  title: '',
  items: [],
});

/**
 * 输入框草稿态：待发送新对话所引用的历史对话 id 列表。
 * 集中存放，便于「气泡右下角引用按钮 / 右键引用 / 多选批量引用」多种入口汇入同一处，
 * 发送新对话时一并带上；发送后清空。
 */
const pendingRefIds = ref<string[]>([]);

/** 多选模式开关（底部「多选」按钮控制） */
const multiselect = ref(false);

/** 多选模式下选中的对话 id 列表 */
const selectedIds = ref<string[]>([]);

/** 高亮定位：点击引用弹窗中的某条对话后，中间列表滚动到该项并高亮 */
const highlightConvId = ref<number | null>(null);
/** 自增信号：即使重复点击同一条对话，也能重新触发定位与高亮 */
const highlightTick = ref(0);

/* ============================ 计算属性 ============================ */

/** 是否处于搜索/筛选状态 */
const isSearching = computed(() => !!searchKeyword.value.trim() || !!activeTagFilter.value);

/** 实际展示的对话列表：搜索时展示跨主题结果，否则展示当前主题对话 */
const displayConversations = computed(() => {
  if (isSearching.value) return searchResults.value;
  return conversations.value;
});

/**
 * 被引用的对话 id 集合：
 * 遍历当前展示列表，收集所有 reference 目标 id。
 * 用于让「被引用」的对话呈现不同样式。
 */
const referencedIds = computed(() => {
  const set = new Set<string>();
  displayConversations.value.forEach((c: any) => {
    parseArr(c.ref_ids).forEach((rid) => set.add(String(rid)));
  });
  return set;
});

/* ============================ 主题相关 ============================ */

async function loadThemes() {
  const rows = await dbQuery({
    tableName: TABLE.THEME,
    orderBy: 'update_time',
    orderByDesc: true,
  });
  themes.value = rows;
  // 若当前没有选中主题，默认选中最近更新的一个
  if (currentThemeId.value == null && rows.length) {
    currentThemeId.value = rows[0].id;
  }
  await loadThemeCounts();
  return rows;
}

/** 统计每个主题下的对话数量（用于左侧列表角标） */
async function loadThemeCounts() {
  try {
    const rows = await dbExecute(
      `SELECT theme_id, COUNT(*) as cnt FROM ${TABLE.CONVERSATION} GROUP BY theme_id`
    );
    const map: Record<number, number> = {};
    rows.forEach((r: any) => {
      map[Number(r.theme_id)] = Number(r.cnt);
    });
    themeCounts.value = map;
  } catch {
    themeCounts.value = {};
  }
}

async function loadTags() {
  tags.value = await dbQuery({
    tableName: TABLE.TAG,
    orderBy: 'id',
    orderByDesc: false,
  });
}

/** 选中某个主题并加载其对话 */
async function selectTheme(id: number) {
  currentThemeId.value = id;
  searchKeyword.value = '';
  activeTagFilter.value = '';
  await loadConversations(id);
}

/** 加载某主题下的全部对话（按创建时间升序，聊天气泡从旧到新排列） */
async function loadConversations(themeId: number = currentThemeId.value as number) {
  if (!themeId) {
    conversations.value = [];
    return [];
  }
  const rows = await dbQuery({
    tableName: TABLE.CONVERSATION,
    conditions: { theme_id: themeId },
    orderBy: 'create_time',
    orderByDesc: false,
  });
  conversations.value = rows;
  return rows;
}

/** 新建主题 */
async function createTheme(title: string, tagIds: string[] = []) {
  const t = nowStr();
  const res = await dbInsert(TABLE.THEME, {
    title,
    tags: JSON.stringify(tagIds),
    create_time: t,
    update_time: t,
    remark: '',
  });
  const item = { id: res.lastID, title, tags: JSON.stringify(tagIds), create_time: t, update_time: t, remark: '' };
  themes.value.unshift(item);
  currentThemeId.value = item.id;
  await loadConversations(item.id);
  return item;
}

/** 更新主题（标题 / 标签 / 备注） */
async function updateTheme(id: number, patch: { title?: string; tags?: string[]; remark?: string }) {
  const data: any = { update_time: nowStr() };
  if (patch.title !== undefined) data.title = patch.title;
  if (patch.remark !== undefined) data.remark = patch.remark;
  if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
  await dbUpdate(TABLE.THEME, data, { id });
  await loadThemes();
  if (currentThemeId.value === id) await loadConversations(id);
}

/** 删除主题（同时删除其下全部对话） */
async function deleteTheme(id: number) {
  await dbDelete(TABLE.CONVERSATION, { theme_id: id });
  await dbDelete(TABLE.THEME, { id });
  await loadThemes();
  if (currentThemeId.value === id) {
    currentThemeId.value = themes.value.length ? themes.value[0].id : null;
    if (currentThemeId.value) await loadConversations(currentThemeId.value);
  }
}

/* ============================ 对话相关 ============================ */

/** 新建对话 */
async function createConversation(payload: {
  content: string;
  references?: string[];
  tags?: string[];
  annotateTime?: string;
  pinned?: string;
}) {
  const themeId = currentThemeId.value;
  if (!themeId) throw new Error('请先选择或创建一个主题');
  const t = nowStr();
  const data = {
    theme_id: themeId,
    content: payload.content,
    // 注意：列名 ref_ids（避免用保留字 references 触发 SQLITE_ERROR）
    ref_ids: JSON.stringify(payload.references || []),
    tags: JSON.stringify(payload.tags || []),
    create_time: t,
    annotate_time: payload.annotateTime || '',
    pinned: payload.pinned || '0',
    is_deleted: '0',
  };
  const res = await dbInsert(TABLE.CONVERSATION, data);
  const item = { id: res.lastID, ...data };
  conversations.value.push(item);
  // 同步刷新主题的更新时间
  await dbUpdate(TABLE.THEME, { update_time: t }, { id: themeId });
  await loadThemeCounts();
  return item;
}

/** 更新对话 */
async function updateConversation(id: number, patch: any) {
  const data: any = { ...patch };
  if (patch.tags !== undefined) data.tags = JSON.stringify(patch.tags);
  // 引用列 ref_ids 必须存字符串：兼容「references」与「ref_ids」两种传入形式
  if (patch.references !== undefined) data.ref_ids = JSON.stringify(patch.references);
  else if (patch.ref_ids !== undefined && Array.isArray(patch.ref_ids)) {
    data.ref_ids = JSON.stringify(patch.ref_ids);
  }
  await dbUpdate(TABLE.CONVERSATION, data, { id });
  const idx = conversations.value.findIndex((c) => c.id === id);
  if (idx >= 0) conversations.value[idx] = { ...conversations.value[idx], ...data };
}

/** 删除对话（软删除，便于后续追溯历史） */
async function deleteConversation(id: number) {
  await dbDelete(TABLE.CONVERSATION, { id });
  conversations.value = conversations.value.filter((c) => c.id !== id);
  await loadThemeCounts();
}

/* ============================ 标签相关 ============================ */

/** 新建标签 */
async function createTag(name: string, color: string, scope: string = TAG_SCOPE.CONVERSATION) {
  const res = await dbInsert(TABLE.TAG, { name, color, scope, create_time: nowStr() });
  const item = { id: res.lastID, name, color, scope, create_time: nowStr() };
  tags.value.push(item);
  return item;
}

/** 修改标签（重命名 / 改色）。引用该标签的主题与对话仅存 id，因此无需回写 */
async function updateTag(id: number, patch: { name?: string; color?: string }) {
  const data: any = {};
  if (patch.name !== undefined) data.name = patch.name;
  if (patch.color !== undefined) data.color = patch.color;
  await dbUpdate(TABLE.TAG, data, { id });
  await loadTags();
}

/** 删除标签，并从其关联的主题 / 对话的 tags 字段中移除该标签引用 */
async function deleteTag(id: number) {
  await dbDelete(TABLE.TAG, { id });
  // 主题 tags 字段移除
  const themeRows = await dbQuery({ tableName: TABLE.THEME });
  for (const th of themeRows) {
    const ids = parseArr(th.tags).filter((x) => x !== String(id));
    await dbUpdate(TABLE.THEME, { tags: JSON.stringify(ids) }, { id: th.id });
  }
  // 对话 tags 字段移除
  const convRows = await dbQuery({ tableName: TABLE.CONVERSATION });
  for (const cv of convRows) {
    const ids = parseArr(cv.tags).filter((x) => x !== String(id));
    await dbUpdate(TABLE.CONVERSATION, { tags: JSON.stringify(ids) }, { id: cv.id });
  }
  await loadTags();
  await loadThemes();
  if (currentThemeId.value) await loadConversations(currentThemeId.value);
}

function getTagById(id: any) {
  return tags.value.find((t) => t.id === Number(id));
}
function tagName(id: any): string {
  const t = getTagById(id);
  return t ? t.name : '';
}
function tagColor(id: any): string {
  const t = getTagById(id);
  return t ? t.color : '#94a3b8';
}

/* ============================ 搜索（主题字段 / 对话内容 / 标签） ============================ */

/**
 * 执行搜索：跨主题检索对话内容、标签、主题标题，并支持按标签 id 精确筛选。
 * 结果按创建时间倒序，便于快速回溯。
 */
async function runSearch() {
  const kw = searchKeyword.value.trim();
  const tagFilter = activeTagFilter.value;
  if (!kw && !tagFilter) {
    searchResults.value = [];
    return;
  }

  let sql = `SELECT c.*, t.title as theme_title FROM ${TABLE.CONVERSATION} c
             LEFT JOIN ${TABLE.THEME} t ON c.theme_id = t.id
             WHERE 1=1`;
  const params: any[] = [];

  if (kw) {
    // 关键字匹配：对话内容、主题标题，以及名称包含关键字的标签
    const matchedTagIds = tags.value
      .filter((t) => t.name.includes(kw))
      .map((t) => String(t.id));
    sql += ` AND (c.content LIKE ? OR t.title LIKE ?`;
    params.push(`%${kw}%`, `%${kw}%`);
    if (matchedTagIds.length) {
      const tagConds = matchedTagIds.map(() => `c.tags LIKE ?`).join(' OR ');
      sql += ` OR ${tagConds}`;
      matchedTagIds.forEach((id) => params.push(`%"${id}"%`));
    }
    sql += `)`;
  }

  if (tagFilter) {
    // 标签筛选：对话 tags 字段为 JSON 数组，如 ["3","5"]
    sql += ` AND c.tags LIKE ?`;
    params.push(`%"${tagFilter}"%`);
  }

  sql += ` ORDER BY c.create_time DESC`;
  searchResults.value = await dbExecute(sql, params);
}

function clearSearch() {
  searchKeyword.value = '';
  activeTagFilter.value = '';
  searchResults.value = [];
}

/* ============================ 引用相关 ============================ */

/** 按 id 查询单条对话（跨主题，用于弹窗回填历史对话信息） */
async function getConversationById(id: number) {
  const rows = await dbQuery({ tableName: TABLE.CONVERSATION, conditions: { id } });
  return rows[0] || null;
}

/** 打开引用抽屉，展示某条对话引用的全部历史对话 */
async function showReferenceTargets(conv: any) {
  const ids = parseArr(conv.ref_ids);
  const items: any[] = [];
  for (const id of ids) {
    const found = conversations.value.find((c) => c.id === Number(id));
    items.push(found || (await getConversationById(Number(id))));
  }
  referenceDrawer.value = {
    open: true,
    title: `引用的历史对话（${items.filter(Boolean).length}）`,
    items: items.filter(Boolean),
  };
}

/** 打开引用抽屉，展示「引用了本条对话」的全部来源对话 */
async function showReferencedBy(conv: any) {
  const rows = await dbExecute(
    `SELECT c.*, t.title as theme_title FROM ${TABLE.CONVERSATION} c
     LEFT JOIN ${TABLE.THEME} t ON c.theme_id = t.id
     WHERE c.ref_ids LIKE ?`,
    [`%"${conv.id}"%`]
  );
  referenceDrawer.value = {
    open: true,
    title: `被 ${rows.length} 条对话引用`,
    items: rows,
  };
}

function closeReferenceDrawer() {
  referenceDrawer.value = { ...referenceDrawer.value, open: false };
}

/** 直接展示单条对话详情（如点击输入框中的引用 chip） */
function showConversationDetail(conv: any) {
  referenceDrawer.value = {
    open: true,
    title: '历史对话详情',
    items: conv ? [conv] : [],
  };
}

/**
 * 从引用弹窗「定位」某条对话：确保该对话出现在中间列表（必要时切换主题 / 退出搜索），
 * 关闭弹窗后让列表滚动到该项并高亮，便于从引用关系中回溯原始对话。
 */
async function locateConversation(id: number) {
  const numId = Number(id);
  const existing = displayConversations.value.find((c) => c.id === numId);
  let conv = existing;
  if (!conv) conv = await getConversationById(numId);
  if (!conv) return;

  // 若目标对话不在当前展示列表中，需先把它纳入列表（切换主题或退出搜索重载）
  if (!existing) {
    const themeId = conv.theme_id != null ? Number(conv.theme_id) : currentThemeId.value;
    if (themeId != null && themeId !== currentThemeId.value) {
      await selectTheme(themeId);
    } else {
      clearSearch();
      await loadConversations(currentThemeId.value as number);
    }
  }

  // 关闭弹窗，让列表可见；随后由 ConversationList 监听 highlightTick 滚动并高亮
  closeReferenceDrawer();
  highlightConvId.value = numId;
  highlightTick.value++;
}

/* ============================ 草稿引用 / 多选 ============================ */

/** 把一条历史对话加入输入框草稿引用（去重） */
function addPendingRef(id: number | string) {
  const sid = String(id);
  if (!pendingRefIds.value.includes(sid)) pendingRefIds.value.push(sid);
}

/** 批量加入草稿引用（多选批量引用场景） */
function addPendingRefs(ids: Array<number | string>) {
  ids.forEach((id) => {
    const sid = String(id);
    if (!pendingRefIds.value.includes(sid)) pendingRefIds.value.push(sid);
  });
}

/** 从草稿引用中移除某条 */
function removePendingRef(id: number | string) {
  const sid = String(id);
  pendingRefIds.value = pendingRefIds.value.filter((x) => x !== sid);
}

/** 清空草稿引用（发送新对话后调用） */
function clearPendingRefs() {
  pendingRefIds.value = [];
}

/** 进入 / 退出多选模式（退出时自动清空已选，避免脏状态） */
function toggleMultiselect() {
  multiselect.value = !multiselect.value;
  if (!multiselect.value) selectedIds.value = [];
}

/** 切换某条对话的选中态（多选模式下） */
function toggleSelect(id: number | string) {
  const sid = String(id);
  const i = selectedIds.value.indexOf(sid);
  if (i >= 0) selectedIds.value.splice(i, 1);
  else selectedIds.value.push(sid);
}

/** 清空多选选择 */
function clearSelection() {
  selectedIds.value = [];
}

/* ============================ 初始化 ============================ */

/**
 * 确保三张业务表及其列存在。
 * newSql 在首次访问表时会用默认列（name/value/created_at）建表，
 * 为避免「表已建但业务列尚未存在」导致查询/统计报错，这里在初始化时
 * 用 ALTER TABLE 补齐各业务列（列已存在时忽略错误，幂等安全）。
 */
async function ensureSchema() {
  // 先触发建表（若无则按 newSql 默认列创建）
  await dbQuery({ tableName: TABLE.THEME, limit: 1 });
  await dbQuery({ tableName: TABLE.CONVERSATION, limit: 1 });
  await dbQuery({ tableName: TABLE.TAG, limit: 1 });

  const alters = [
    `ALTER TABLE ${TABLE.THEME} ADD COLUMN title TEXT`,
    `ALTER TABLE ${TABLE.THEME} ADD COLUMN tags TEXT`,
    `ALTER TABLE ${TABLE.THEME} ADD COLUMN create_time TEXT`,
    `ALTER TABLE ${TABLE.THEME} ADD COLUMN update_time TEXT`,
    `ALTER TABLE ${TABLE.THEME} ADD COLUMN remark TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN theme_id TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN content TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN ref_ids TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN tags TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN create_time TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN annotate_time TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN pinned TEXT`,
    `ALTER TABLE ${TABLE.CONVERSATION} ADD COLUMN is_deleted TEXT`,
    `ALTER TABLE ${TABLE.TAG} ADD COLUMN name TEXT`,
    `ALTER TABLE ${TABLE.TAG} ADD COLUMN color TEXT`,
    `ALTER TABLE ${TABLE.TAG} ADD COLUMN scope TEXT`,
    `ALTER TABLE ${TABLE.TAG} ADD COLUMN create_time TEXT`,
  ];
  for (const sql of alters) {
    try {
      await dbExecute(sql);
    } catch {
      // 列已存在时 SQLite 报 duplicate column name，忽略即可
    }
  }

  /**
   * 数据迁移：早期版本曾用 SQLite 保留字 `references` 作为列名，
   * 该列从未成功写入（INSERT 直接报 SQLITE_ERROR），但部分旧库可能已建出空列。
   * 这里把旧列 `references` 的数据迁到 `ref_ids` 后保留旧列（不删除，
   * 因老版本 SQLite 不支持 DROP COLUMN，删除会报错）。旧列无数据则忽略。
   */
  try {
    await dbExecute(
      `UPDATE ${TABLE.CONVERSATION} SET ref_ids = "references"
       WHERE "references" IS NOT NULL AND "references" <> ''
         AND (ref_ids IS NULL OR ref_ids = '')`
    );
  } catch {
    // 旧列不存在时忽略
  }
}

/** 初始化：建表补列 -> 加载主题与标签 -> 选中第一个主题 */
async function init() {
  loading.value = true;
  try {
    await ensureSchema();
    await Promise.all([loadThemes(), loadTags()]);
    if (currentThemeId.value) await loadConversations(currentThemeId.value);
  } finally {
    loading.value = false;
  }
}

export function useThemeConversation() {
  return {
    // 状态
    themes,
    themeCounts,
    tags,
    currentThemeId,
    conversations,
    loading,
    searchKeyword,
    activeTagFilter,
    searchResults,
    isSearching,
    displayConversations,
    referencedIds,
    referenceDrawer,
    // 草稿引用 / 多选（引用按钮 / 右键 / 多选共用）
    pendingRefIds,
    multiselect,
    selectedIds,
    highlightConvId,
    highlightTick,
    addPendingRef,
    addPendingRefs,
    removePendingRef,
    clearPendingRefs,
    toggleMultiselect,
    toggleSelect,
    clearSelection,
    // 主题
    init,
    loadThemes,
    loadTags,
    selectTheme,
    loadConversations,
    loadThemeCounts,
    createTheme,
    updateTheme,
    deleteTheme,
    // 对话
    createConversation,
    updateConversation,
    deleteConversation,
    // 标签
    createTag,
    updateTag,
    deleteTag,
    getTagById,
    tagName,
    tagColor,
    // 搜索
    runSearch,
    clearSearch,
    // 引用
    getConversationById,
    showReferenceTargets,
    showReferencedBy,
    showConversationDetail,
    locateConversation,
    closeReferenceDrawer,
    // 工具
    parseArr,
  };
}
