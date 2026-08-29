/**
 * 网络请求工作台 - 类型定义
 * ------------------------------------------------------------------
 * 统一维护请求配置 / 响应记录 / 历史 / 集合 / 环境变量 / WebSocket 等类型，
 * 供页面组件与 composables 共用。
 */

/** HTTP 请求方法（全量支持） */
export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS';

/** 请求体类型 */
export type BodyType = 'none' | 'form-data' | 'x-www-form-urlencoded' | 'raw' | 'binary';

/** raw 文本子类型 */
export type RawType = 'json' | 'text' | 'xml' | 'html';

/** 认证类型 */
export type AuthType = 'none' | 'bearer' | 'basic' | 'api-key';

/** 键值对行（查询参数 / 请求头 / urlencoded 通用） */
export interface KeyValueItem {
  /** 前端生成的唯一 id（uuid），便于 keyed 渲染 */
  id: string;
  /** 参数名 */
  key: string;
  /** 参数值 */
  value: string;
  /** 是否启用（禁用行不参与请求，对齐 Postman 复选框） */
  enabled: boolean;
}

/** form-data 行（在键值对基础上区分文本行 / 文件行） */
export interface FormDataRow extends KeyValueItem {
  /** 行类型：text=文本，file=文件 */
  rowType: 'text' | 'file';
  /** 文件行的绝对路径 */
  filePath: string;
}

/** 认证配置 */
export interface AuthConfig {
  /** 认证类型 */
  type: AuthType;
  /** Bearer Token */
  token: string;
  /** Basic 用户名 */
  username: string;
  /** Basic 密码 */
  password: string;
  /** ApiKey 参数名 */
  apiKeyName: string;
  /** ApiKey 值 */
  apiKeyValue: string;
  /** ApiKey 位置：header 或 query */
  apiKeyIn: 'header' | 'query';
}

/** 请求设置（超时 / 重定向 / SSL） */
export interface RequestSettings {
  /** 超时时间（毫秒），0 表示默认 30000 */
  timeout: number;
  /** 是否跟随重定向 */
  followRedirects: boolean;
  /** 是否校验 SSL 证书 */
  validateSsl: boolean;
}

/** 前置/后置脚本配置 */
export interface ScriptConfig {
  /** 前置脚本（发送前执行，可读写环境变量、修改请求） */
  pre: string;
  /** 后置脚本（收到响应后执行，可断言） */
  post: string;
}

/** 完整请求配置（历史/集合落库的核心 JSON，改动需向后兼容） */
export interface RequestConfig {
  /** 请求方法 */
  method: RequestMethod;
  /** 请求地址（支持 {{变量}} 占位） */
  url: string;
  /** 查询参数行 */
  params: KeyValueItem[];
  /** 请求头行 */
  headers: KeyValueItem[];
  /** 请求体类型 */
  bodyType: BodyType;
  /** raw 子类型 */
  rawType: RawType;
  /** raw 文本内容 */
  rawBody: string;
  /** form-data 行列表 */
  formData: FormDataRow[];
  /** x-www-form-urlencoded 行列表 */
  urlEncoded: KeyValueItem[];
  /** binary 文件路径 */
  binaryFilePath: string;
  /** 认证配置 */
  auth: AuthConfig;
  /** 请求设置 */
  settings: RequestSettings;
  /** 前置/后置脚本 */
  scripts: ScriptConfig;
}

/** 响应记录（渲染端展示用，不做持久化） */
export interface ResponseRecord {
  /** HTTP 状态码 */
  status: number;
  /** 状态文本 */
  statusText: string;
  /** 耗时（毫秒） */
  time: number;
  /** 响应大小（字节） */
  size: number;
  /** 响应头 */
  headers: Record<string, string>;
  /** 响应体（JSON 解析结果或文本） */
  body: any;
  /** content-type */
  contentType: string;
  /** 响应体是否为合法 JSON（决定默认用 JSON 树还是纯文本展示） */
  isJson: boolean;
  /** 请求失败的错误信息（网络错误时非空） */
  error: string;
  /** 产生该响应的请求地址（变量替换后的真实 URL） */
  requestUrl: string;
  /** 响应时间戳 */
  createdAt: number;
  /** 原始响应 base64（主进程返回，供保存二进制响应到磁盘） */
  base64?: string;
}

/** 断言/测试结果项 */
export interface TestResult {
  /** 断言名称 */
  name: string;
  /** 是否通过 */
  passed: boolean;
  /** 失败信息（通过时为空） */
  message: string;
}

/** 历史记录行（对应表 net_request_history） */
export interface HistoryItem {
  /** 自增主键 */
  id: number;
  /** 请求方法 */
  method: string;
  /** 请求地址 */
  url: string;
  /** 响应状态码（未发出/失败为 0） */
  status: number;
  /** 耗时（毫秒） */
  time: number;
  /** 响应大小（字节） */
  size: number;
  /** 创建时间戳（毫秒） */
  createdAt: number;
  /** 完整请求配置 JSON */
  config: RequestConfig;
}

/** 集合节点类型 */
export type CollectionNodeType = 'folder' | 'request';

/** 集合节点（对应表 net_request_collection 一行，children 为构建树时的内存字段） */
export interface CollectionNode {
  /** 自增主键 */
  id: number;
  /** 父节点 id（0 = 根级） */
  parentId: number;
  /** 节点类型：folder=文件夹，request=请求 */
  nodeType: CollectionNodeType;
  /** 显示名称 */
  name: string;
  /** 请求方法（仅 request 节点） */
  method: string;
  /** 请求地址（仅 request 节点） */
  url: string;
  /** 完整请求配置 JSON（仅 request 节点） */
  config: RequestConfig | null;
  /** 排序值（同层内从小到大） */
  sort: number;
  /** 更新时间戳（毫秒） */
  updatedAt: number;
  /** 子节点（仅内存中构建树时使用，不入库） */
  children: CollectionNode[];
}

/** 环境变量行 */
export interface EnvVar {
  /** 前端生成的唯一 id */
  id: string;
  /** 变量名（用于 {{变量名}} 占位） */
  key: string;
  /** 变量值 */
  value: string;
  /** 是否启用 */
  enabled: boolean;
}

/** 环境对象（对应表 net_request_env 一行） */
export interface Environment {
  /** 自增主键 */
  id: number;
  /** 环境名称（dev / test / prod ...） */
  name: string;
  /** 变量列表 */
  vars: EnvVar[];
  /** 是否当前激活环境（同一时刻仅一个） */
  isActive: boolean;
  /** 更新时间戳（毫秒） */
  updatedAt: number;
}

/** WebSocket 事件消息（主进程 net-request:ws-event 推送） */
export interface WsEvent {
  /** 连接标识 */
  id: string;
  /** 事件类型：open=已连接，message=收到消息，send=已发送，close=已关闭，error=错误 */
  type: 'open' | 'message' | 'send' | 'close' | 'error';
  /** 消息内容 */
  data: string;
  /** 时间戳（毫秒） */
  time: number;
}

/** WebSocket 消息展示项（在 WsMessageList 中展示） */
export interface WsMessageItem {
  /** 前端唯一 id */
  id: string;
  /** 方向：in=收到，out=发送，sys=状态 */
  direction: 'in' | 'out' | 'sys';
  /** 内容 */
  data: string;
  /** 时间戳（毫秒） */
  time: number;
}
