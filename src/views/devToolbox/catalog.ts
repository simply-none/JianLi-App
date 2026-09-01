/**
 * 开发工具箱 - 工具清单目录
 * 与 pdfTools 的工具目录模式一致：卡片仪表盘数据源，
 * 每项包含唯一 key、标题、描述、图标名与专属强调色。
 */

/** 单个开发工具的元信息（卡片仪表盘 + 二级标题共用） */
export interface DevToolMeta {
  /** 工具唯一标识（与 index.vue 的组件映射表 key 对应） */
  key: string;
  /** 工具中文名（卡片标题 / 二级标题） */
  title: string;
  /** 工具功能描述（卡片副文本 / 二级标题副文本） */
  desc: string;
  /** Lucide 图标名（需确保图标存在，参见导入图标规则） */
  icon: string;
  /** 卡片强调色（竖条 + 图标颜色，使用主题变量或十六进制色） */
  accent: string;
  /** 操作提示：进入该工具后二级标题下展示的使用说明（字符串或字符串数组） */
  tip?: string | string[];
}

/** 开发工具清单：JSON → 正则 → Diff → 网络 → 日期 → 单位 */
export const DEV_TOOL_CATALOG: DevToolMeta[] = [
  {
    key: 'jsonHash',
    title: 'JSON/Hash/编码',
    desc: 'JSON 格式化、压缩、转义、校验与 Hash 摘要计算',
    icon: 'Code2',
    accent: '#6366f1',
    tip: ['输入文本后点击对应按钮操作；JSON 解析失败时会在标签上显示错误原因', '「交换」可把输出结果回填为输入，方便二次处理'],
  },
  {
    key: 'regex',
    title: '正则测试',
    desc: '实时匹配高亮、捕获组详情、常用模板与回溯熔断',
    icon: 'Regex',
    accent: '#a855f7',
    tip: ['只需填写正则本体（无需两侧的 / 斜杠），flags 单独勾选或输入', '可从「常用模板」一键填入手机号、邮箱等常用正则'],
  },
  {
    key: 'diff',
    title: '文本对比',
    desc: '并排/合并/内联三视图，行/词/字符级差异与补丁应用',
    icon: 'GitCompare',
    accent: '#22c55e',
    tip: ['在左右两侧分别粘贴文本即可自动对比；可切换视图与对比粒度', '「A→JSON / B→JSON」先格式化再对比，可减少格式差异造成的噪音'],
  },
  {
    key: 'net',
    title: '网络诊断',
    desc: 'Ping、Traceroute、DNS 解析与端口连通性检测',
    icon: 'Wifi',
    accent: '#06b6d4',
    tip: ['目标填域名或 IP（如 baidu.com / 8.8.8.8），粘贴完整网址会自动提取主机名', '端口检测支持范围写法，如 3000-4000；执行中可点「停止」取消'],
  },
  {
    key: 'date',
    title: '日期计算',
    desc: '日期差、加减、工作日统计、倒计时与时间戳转换',
    icon: 'CalendarDays',
    accent: '#f59e0b',
    tip: ['选择或输入日期后结果自动计算；「填入当前时间」可快速取当前时间戳', '工作日计算默认排除周六周日'],
  },
  {
    key: 'unit',
    title: '单位换算',
    desc: '长度、重量、温度、面积、体积五类单位快速换算',
    icon: 'Ruler',
    accent: '#f43f5e',
    tip: ['输入数值后选择源单位，目标单位结果实时显示', '下方快速换算表列出该类全部单位；点「记录」可存入历史'],
  },
];
