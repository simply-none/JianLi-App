/**
 * 记账功能 - 常量与类型定义
 *
 * 说明：
 * - AccountingCategory：一条分类配置（支出 / 收入），含图标、主题色与匹配关键词。
 * - DEFAULT_CATEGORIES：预置分类种子，基于常见记账场景穷举（餐饮/交通/购物/居住/娱乐/
 *   医疗/教育/通讯/人情 等支出，工资/奖金/理财/兼职/红包/退款 等收入）。分类与关键字
 *   持久化到 SQLite（accounting_categories / accounting_keywords 两表），首次启动若表为空
 *   则批量写入默认数据，用户可在「分类管理」中增删改。
 * - AccountingRecord：一条记账记录，落 SQLite 表 accounting_records。
 */

/** 分类类型：支出 / 收入 */
export type AccountingType = 'expense' | 'income'

/** 单条分类配置 */
export interface AccountingCategory {
  /** 分类名称，唯一标识（同时作为 accounting_categories 表主键） */
  name: string
  /** 支出或收入 */
  type: AccountingType
  /** Lucide 图标名（需在 components/LucideIcon.vue 的 nameMap 中注册） */
  icon: string
  /** 主题强调色（十六进制） */
  color: string
  /** 自动匹配关键词：备注/商户名包含任一关键词即命中该分类 */
  keywords: string[]
  /** 排序序号（仅用于列表顺序，可选） */
  sort?: number
}

/** 单条记账记录 */
export interface AccountingRecord {
  /** 自增主键（插入时无需传） */
  id?: number
  /** 支出 / 收入 */
  type: AccountingType
  /** 金额（元，正数） */
  amount: number
  /** 分类名称，须存在于分类配置 */
  category: string
  /** 备注 / 商户名 */
  note: string
  /** 支付账户：微信 / 支付宝 / 银行卡 / 现金（可选） */
  account?: string
  /** 记账日期 YYYY-MM-DD */
  record_date: string
  /** 创建时间 YYYY-MM-DD HH:mm:ss（插入时由 DB 写入） */
  created_at?: string
}

/** SQLite 表名 */
export const ACCOUNTING_TABLE = 'accounting_records'
/** 分类表名（分类配置持久化到数据库，而非 electron-store） */
export const ACCOUNTING_CATEGORIES_TABLE = 'accounting_categories'
/** 关键字表名（每个分类下的自动匹配关键词，独立成表，便于增删改与关联） */
export const ACCOUNTING_KEYWORDS_TABLE = 'accounting_keywords'

/** 预置分类种子（穷举常见消费 / 收入分类及关键词） */
export const DEFAULT_CATEGORIES: AccountingCategory[] = [
  // ============ 支出 ============
  {
    name: '餐饮',
    type: 'expense',
    icon: 'UtensilsCrossed',
    color: '#FF7A45',
    keywords: ['餐', '饭', '吃', '菜', '食', '奶茶', '咖啡', '外卖', '火锅', '午饭', '晚饭', '早餐', '美团', '饿了么', '餐厅', '宵夜', '零食', '水果', '饮料', '酒', '烧烤', '小吃', '食堂', '面', '粥', '面包', '蛋糕', '超市'],
  },
  {
    name: '交通',
    type: 'expense',
    icon: 'Car',
    color: '#3B82F6',
    keywords: ['地铁', '公交', '打车', '出租', '滴滴', '高铁', '火车', '机票', '加油', '停车', '汽油', '违章', '过路费', '单车', '共享单车', '网约车', '车票', '油费', '汽车'],
  },
  {
    name: '购物',
    type: 'expense',
    icon: 'ShoppingBag',
    color: '#F59E0B',
    keywords: ['买', '购', '淘宝', '京东', '拼多多', '天猫', '衣服', '鞋', '包', '化妆品', '日用品', '超市', '百货', '服饰', '家居', '数码', '电器', '唯品会'],
  },
  {
    name: '居住',
    type: 'expense',
    icon: 'Home',
    color: '#10B981',
    keywords: ['房租', '房贷', '水电', '物业', '燃气', '装修', '网费', '宽带', '取暖', '维修', '物业费'],
  },
  {
    name: '娱乐',
    type: 'expense',
    icon: 'Gamepad2',
    color: '#A855F7',
    keywords: ['电影', '游戏', '会员', '视频', '音乐', 'KTV', '旅游', '演出', '演唱会', '酒吧', '游乐', '密室', '桌游', '健身', '充值', '门票', '展览', '运动'],
  },
  {
    name: '医疗',
    type: 'expense',
    icon: 'HeartPulse',
    color: '#EF4444',
    keywords: ['药', '医院', '体检', '诊', '保健', '牙', '眼科', '挂号', '口罩', '门诊', '住院', '疫苗', '看病'],
  },
  {
    name: '教育',
    type: 'expense',
    icon: 'BookOpen',
    color: '#06B6D4',
    keywords: ['书', '课', '学', '培训', '教育', '辅导', '考试', '学费', '网课', '教材', '资料', '考证', '学习'],
  },
  {
    name: '通讯',
    type: 'expense',
    icon: 'Smartphone',
    color: '#6366F1',
    keywords: ['话费', '充值', '流量', '手机费', '通讯'],
  },
  {
    name: '人情社交',
    type: 'expense',
    icon: 'Gift',
    color: '#EC4899',
    keywords: ['红包', '礼物', '请客', '随礼', '份子', '人情', '礼金', '聚会', '请吃饭', '送礼'],
  },
  {
    name: '其他支出',
    type: 'expense',
    icon: 'CircleEllipsis',
    color: '#6B7280',
    keywords: [],
  },

  // ============ 收入 ============
  {
    name: '工资',
    type: 'income',
    icon: 'Wallet',
    color: '#22C55E',
    keywords: ['工资', '薪水', '薪资', '月薪', '发工资', '薪酬', '工钱'],
  },
  {
    name: '奖金',
    type: 'income',
    icon: 'Trophy',
    color: '#FBBF24',
    keywords: ['奖金', '年终奖', '分红', '提成', '奖励', '绩效', '加薪'],
  },
  {
    name: '投资理财',
    type: 'income',
    icon: 'TrendingUp',
    color: '#14B8A6',
    keywords: ['理财', '利息', '收益', '股息', '基金', '股票', '投资', '回报', '证券'],
  },
  {
    name: '兼职外快',
    type: 'income',
    icon: 'Briefcase',
    color: '#8B5CF6',
    keywords: ['兼职', '外快', '接单', '私活', '副业', '稿费', '打赏'],
  },
  {
    name: '红包礼金',
    type: 'income',
    icon: 'HandCoins',
    color: '#F472B6',
    keywords: ['收红包', '压岁钱', '礼金', '收到红包', '中奖', '红包'],
  },
  {
    name: '退款',
    type: 'income',
    icon: 'RotateCcw',
    color: '#0EA5E9',
    keywords: ['退款', '退货', '退钱', '返现'],
  },
  {
    name: '其他收入',
    type: 'income',
    icon: 'CircleEllipsis',
    color: '#64748B',
    keywords: [],
  },
]
