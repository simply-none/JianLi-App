/**
 * 思维导图 —— 类型定义（纯类型，无运行时依赖）。
 *
 * 设计要点：**树是唯一真源；坐标默认是派生数据**。
 * 节点只存「语义结构」，坐标由 `utils/layout.ts` 现算现用 ——
 * 所以换布局算法（鱼骨图 / 组织结构图 / 径向）时历史数据零迁移。
 *
 * 唯一例外是 `MindNode.pos`（见下方说明）：用户**手动拖过**的节点会把坐标固定下来，
 * 布局算法遇到它就尊重该坐标。这是一个**可选**字段，缺省即「自动排版」，
 * 因此老数据零迁移、也能一键还原（`tree.clearPositions()`）。
 */

/**
 * 布局方向：
 * - `both`  根居中，子树左右分叉（经典思维导图）
 * - `right` 全部向右（逻辑图）
 * - `left`  全部向左（`right` 的镜像）
 * - `down`  根在上、层级向下展开（组织架构图 / 树形图）
 * - `fishbone` 鱼骨图：根在主干左端，一层子节点交替挂上下两侧
 * - `timeline` 时间轴：根为起点，一层节点沿主轴排开、上下交错
 *
 * ⚠️ 后两种只改**布局算法与连线造型**，不动数据结构 —— 它们同样是「树 = 唯一真源，
 *    坐标是派生」这条底线的产物，所以老数据零迁移（见 utils/layout.ts）。
 */
export type MindLayoutDir = 'both' | 'right' | 'left' | 'down' | 'fishbone' | 'timeline'

/** 节点相对根的侧向，决定左右类布局下的 Handle 落点（`down` 布局不使用） */
export type MindSide = 'left' | 'right'

/**
 * 主题色板 key —— **只存 key，不存颜色值**（分支色 / 背景色 / 文字色共用这一套）。
 * 具体颜色由渲染端映射到色板变量（`--mm-tone-*` 实色 / `--mm-tone-*-soft` 低透铺底），
 * 全部用主题令牌 color-mix 派生，于是 26 套主题自动适配，
 * 也不会把某个主题的色号写死进数据库。
 */
export type MindColorKey = 'blue' | 'teal' | 'green' | 'amber' | 'coral' | 'purple'

/** 分支色 = 主题色板 key（语义别名：读代码时一眼看出「这是这一支的颜色」） */
export type MindBranchColor = MindColorKey

/** 画布坐标（左上角，单位 px） */
export interface MindPoint {
  x: number
  y: number
}

/**
 * 视口坐标下的矩形（右键菜单的「节点锚点」）。
 *
 * 与 `MindPoint` 的区别有两处：一是**视口**坐标（`clientX/Y` 那一套）而非画布坐标，
 * 二是矩形而非点 —— 菜单越界翻转时要贴着节点的**边缘**展开，只给一个点不够用。
 */
export interface MindMenuAnchor {
  left: number
  top: number
  right: number
  bottom: number
}

/** 树节点（唯一真源：语义 + 可选的「手动固定坐标」） */
export interface MindNode {
  /** 节点 id，形如 `n_lx2k9_3`，仅在本图内唯一 */
  id: string
  /** 节点文本 */
  text: string
  /** 折叠标记：为 true 时其**整棵子树**不参与渲染与布局 */
  collapsed?: boolean
  /**
   * 备注：长文本，只展示不参与布局。
   * ⚠️ 因此节点上只用一个绝对定位的浮标提示「有备注」，备注内容不影响节点尺寸估算。
   */
  note?: string
  /** 分支色 key；整棵子树默认继承，子节点可覆盖 */
  color?: MindBranchColor
  /**
   * 节点**背景色** key —— 覆盖层级默认底色（根 / 一级节点本来各有一层主色淡底）。
   *
   * 与 `color`（分支色）是**两个独立维度**：
   *   - 分支色管「描边 + 左缘色条」，且沿子树继承；
   *   - 背景色只管这一个节点的底色，**不继承**（颜色是局部强调，继承会很快糊成一片）。
   * 渲染时取低透铺底变量（`--mm-tone-*-soft`），保证压在上面的文字仍然可读。
   */
  bgColor?: MindColorKey
  /**
   * 节点**文字色** key —— 覆盖主题默认文字色，同样不继承。
   * ⚠️ 与背景色是两个独立维度：选了同色系会让对比度变低，交给用户自己权衡
   *    （预设色都由主题令牌派生，深浅主题下各自拿到一组合适的明度）。
   */
  textColor?: MindColorKey
  /**
   * **节点图标**：单个 emoji（最多 4 个码点，用 `Array.from` 数的），显示在文本左侧。
   *
   * 为什么是 emoji 而不是图标库 key：零 UI 成本就能覆盖 80% 的「我想给这一支加个标记」，
   * 而图标选择器（几百个 Lucide 名字 + 搜索）是一个独立的功能量级。
   * 字段本身是普通字符串，将来换成图标 key 也只是语义替换，不影响结构。
   *
   * ⚠️ 宽度要参与首帧尺寸估算（见 `utils/measure.ts`），否则图标一出现布局就会偏。
   */
  icon?: string
  /**
   * **节点链接**：只允许 `http:` / `https:`（协议白名单）。
   *
   * 白名单是必须的：节点文本来自导入的 JSON / Markdown，若放行 `javascript:`，
   * 点一下徽标就等于在渲染进程里执行了他人写入的脚本。
   * 非法值在 `normalizeDocData` 里直接丢弃（不是回落成空串）。
   */
  link?: string
  /**
   * **手动固定坐标**（左上角，画布坐标系）。
   *
   * 只有被用户拖动过的节点才有这个字段。存在时：
   *   1. `utils/layout.ts` 直接采用它，不再自动摆这个节点；
   *   2. 它自己的子节点**相对它**摆放 ⇒ 拖动父节点时子树跟着走，符合直觉。
   *
   * 为什么不把它做成「节点永久记住位置」：只有被手动摆过的节点才多占十几个字节，
   * 其余节点仍然完全由算法决定 ⇒ 加节点 / 折叠 / 换布局时不会出现「一堆散落的旧坐标」。
   *
   * ⚠️ 旧数据没有这个字段，读出来就是自动排版；`clearPositions()` 可一键全部还原。
   */
  pos?: MindPoint
  /** 子节点（顺序即渲染顺序） */
  children: MindNode[]
}

/** 一份导图文档的图数据（序列化后存进 `mindmap.data` 列） */
export interface MindDocData {
  /** 结构版本号，便于将来做数据迁移 */
  version: number
  /** 布局方向 */
  layout: MindLayoutDir
  /** 根节点 */
  root: MindNode
  /**
   * **全图字体族**（CSS `font-family` 值，可以带引号与逗号回退链）。
   *
   * 为什么是**文档级**而不是全局设置 / localStorage：
   *   「这份导图用什么字体」属于**内容版式**，与树、布局同级 —— 同一份图在别人机器上
   *   打开应该长得一样，导出的 JSON 也该把它带走（对比 MiniMap 开关：那是「这台机器上
   *   我喜欢怎么看」，所以走 localStorage）。
   *
   * 未设 = 跟随应用全局字体（节点**不覆盖** `font-family`，直接继承）。
   * ⚠️ 老数据没有该字段 ⇒ **零迁移**；`null` / 空串 / 非字符串在 `normalizeDocData` 里
   *    一律丢弃（而不是回落成某个具体字体名，那会把用户的全局字体悄悄改掉）。
   */
  fontFamily?: string
  /**
   * **全图基准字号（px）** = 二级及更深层级节点的字号；根 / 一级相对它各加一个固定增量
   * （见 `constants.fontSizeOf`），以保持「根 > 一级 > 其余」的层次感。
   *
   * 同样放在文档级（理由同 `fontFamily`）。未设 = `DEFAULT_FONT_SIZE`（13），
   * 且 `fontSizeOf(level, 13)` 与「三档写死 15 / 13.5 / 13」逐像素一致 ⇒ 零迁移。
   *
   * ⚠️ 改它会让每个节点的**实测尺寸**都变 ⇒ 必须重排。重排由画布的 `watch(revision)`
   *    自动触发（见 `useMindGraph.sync`）；改字号会重渲染节点，vue-flow 自带的
   *    ResizeObserver 随之把新尺寸刷回 store，第二段布局读到的就是新值
   *    （真库实测见坑 54 与 `C:\src\tmp\mm_fontsync_test.cjs`）。
   */
  fontSize?: number
}

/** 表 `mindmap` 的一行（数值列由 sqlite 直接给 number，文本列给 string） */
export interface MindDocRecord {
  id: number
  name: string
  type: string
  /** 树 JSON 字符串 */
  data: string
  create_time?: string
  update_time?: string
}

/** 当前打开的文档状态（含数据库 id） */
export interface MindDocState {
  /** 数据库主键；未保存过为 undefined */
  id?: number
  /** 文档名（保存时落库） */
  name: string
  /** 图数据 */
  data: MindDocData
}

/** 节点尺寸（画布实测值或首帧估算值） */
export interface MindSize {
  width: number
  height: number
}

/** 布局结果：节点 id → 左上角坐标 */
export type MindPositions = Record<string, MindPoint>

/**
 * 传给自定义节点的 data 负载。
 * ⚠️ 是**渲染快照**（由树现算），不是状态本体 —— 改它不会影响树。
 */
export type MindFlowNodeData = {
  /** 节点文本 */
  text: string
  /** 可见树深度（根 = 0），用于字号与缩进 */
  level: number
  /** 相对根的侧向，决定左右类布局的 Handle 落点 */
  side: MindSide
  /** 当前布局方向：`down` 时节点改用上下 Handle、折叠钮移到下边缘 */
  dir: MindLayoutDir
  /** 是否根节点 */
  isRoot: boolean
  /** 是否有子节点（决定是否显示折叠按钮） */
  hasChildren: boolean
  /** 是否已折叠 */
  collapsed: boolean
  /** 继承到的分支色 key（自身未设时向上继承父级；都没有则 undefined） */
  branch?: MindBranchColor
  /** 节点自定义背景色 key（未设 = 用层级默认底色）；不继承 */
  bg?: MindColorKey
  /** 节点自定义文字色 key（未设 = 用主题默认文字色）；不继承 */
  fg?: MindColorKey
  /** 节点图标（emoji，单字符或短序列）；未设则不渲染 */
  icon?: string
  /** 是否有链接（决定是否显示链接徽标） */
  hasLink: boolean
  /** 链接地址（徽标 title 显示完整 URL） */
  link?: string
  /** 是否有备注（决定是否显示浮标） */
  hasNote: boolean
  /**
   * 拖动中成为「换父候选」时为 true —— 仅用于给节点加一圈高亮环。
   * ⚠️ 这是**瞬时渲染状态**，由 `useMindGraph` 在拖动过程中改写，
   *    不进树、不落库、不进撤销栈。
   */
  dropTarget?: boolean
}

/** 扁平平铺后的可见节点（供画布建节点/边使用） */
export interface MindFlatNode {
  /** 自身 */
  node: MindNode
  /** 父节点 id；根节点为 undefined */
  parentId?: string
  /** 深度：根 = 0 */
  level: number
}
