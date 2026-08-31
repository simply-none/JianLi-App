/**
 * 二维码能力层 —— 公共类型定义
 * ------------------------------------------------------------------
 * 本层为「可复用的二维码公共能力」，供任意业务模块（二维码页、习惯打卡、
 * 名片、Wi-Fi 分享等）调用，不依赖任何 UI 组件。
 */

/** 支持的二维码内容类型（9 种） */
export type QrPayloadType =
  | 'text' // 纯文本
  | 'url' // 网址
  | 'wifi' // Wi-Fi 连接
  | 'contact' // 联系人（vCard）
  | 'email' // 邮件
  | 'sms' // 短信
  | 'tel' // 电话
  | 'geo' // 地理位置
  | 'event'; // 日历事件（VEVENT）

/** 各类型对应的结构化入参（拼装为二维码字符串前的中间表示） */
export interface TextPayload {
  type: 'text';
  text: string;
}
export interface UrlPayload {
  type: 'url';
  url: string;
}
export interface WifiPayload {
  type: 'wifi';
  ssid: string;
  password?: string;
  encryption?: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}
export interface ContactPayload {
  type: 'contact';
  firstName?: string;
  lastName?: string;
  org?: string;
  title?: string;
  phone?: string;
  email?: string;
  url?: string;
  address?: string;
  note?: string;
}
export interface EmailPayload {
  type: 'email';
  to: string;
  subject?: string;
  body?: string;
}
export interface SmsPayload {
  type: 'sms';
  phone: string;
  message?: string;
}
export interface TelPayload {
  type: 'tel';
  phone: string;
}
export interface GeoPayload {
  type: 'geo';
  lat: number;
  lng: number;
  query?: string;
}
export interface EventPayload {
  type: 'event';
  title: string;
  /** 支持 YYYY-MM-DD HH:mm:ss 或 YYYYMMDDTHHmmss 形式 */
  start: string;
  end?: string;
  location?: string;
  description?: string;
}

export type QrPayload =
  | TextPayload
  | UrlPayload
  | WifiPayload
  | ContactPayload
  | EmailPayload
  | SmsPayload
  | TelPayload
  | GeoPayload
  | EventPayload;

/** 二维码容错级别 */
export type QrErrorCorrection = 'L' | 'M' | 'Q' | 'H';

/** 圆点样式（qr-code-styling dotsOptions.type 子集） */
export type QrDotType =
  | 'dots'
  | 'rounded'
  | 'classy'
  | 'classy-rounded'
  | 'square'
  | 'extra-rounded';

/** 定位角方块样式 */
export type QrCornersSquareType = 'dot' | 'square' | 'extra-rounded';
/** 定位角圆点样式 */
export type QrCornersDotType = 'dot' | 'square';

/** 渐变描述（用于前景色 / 背景色） */
export interface QrGradient {
  gradientType?: 'linear' | 'radial';
  rotation?: number;
  colorStops: { offset: number; color: string }[];
}

/** 二维码视觉样式（持久化到 qr_history.style / qr_template.style） */
export interface QrStyleOptions {
  errorCorrectionLevel?: QrErrorCorrection;
  /** 安静区边距（px） */
  margin?: number;
  /**
   * 码点码眼联动形状（复用 6 个原生码点类型）。
   * 选中后引擎会同时设定 dotsType / cornersSquareType / cornersDotType，
   * 实现「码点码眼一起变」的需求。
   */
  shape?: QrDotType;
  dotsType?: QrDotType;
  dotsColor?: string;
  dotsGradient?: QrGradient;
  cornersSquareType?: QrCornersSquareType;
  cornersSquareColor?: string;
  /** 码外眼（定位角方块）渐变，优先级高于 cornersSquareColor */
  cornersSquareGradient?: QrGradient;
  cornersDotType?: QrCornersDotType;
  /** 码内眼（定位角圆心点）颜色 */
  cornersDotColor?: string;
  /** 码内眼（定位角圆心点）渐变，优先级高于 cornersDotColor */
  cornersDotGradient?: QrGradient;
  background?: string;
  backgroundGradient?: QrGradient;
  /** logo 图片 dataURL（可选，默认无） */
  logo?: string;
  /** logo 形状：square 方形 / rounded 圆角 / circle 圆形，默认 square */
  logoShape?: 'square' | 'rounded' | 'circle';
  /** logo 占二维码宽高比例（0.1-0.4），默认 0.25 */
  logoSize?: number;
  /** logo 位置：center 居中 / bottom-right 右下角，默认 center */
  logoPosition?: 'center' | 'bottom-right';
  /** logo 边框投影，默认 false */
  logoShadow?: boolean;
}

/** 单条二维码历史记录（qr_history 表行映射） */
export interface QrHistoryRecord {
  key: string;
  /** 来源标识：'qrCode' 页面 | 其它业务模块名，用于区分 */
  source: string;
  type: QrPayloadType;
  /** 二维码原始文本（生成时直接用原文，编码修正由 engine 内部完成） */
  content: string;
  style?: QrStyleOptions | null;
  note?: string;
  created_at: string;
}

/** 二维码模板（qr_template 表行映射） */
export interface QrTemplate {
  key: string;
  name: string;
  source: string;
  type: QrPayloadType;
  content: string;
  style?: QrStyleOptions | null;
  created_at: string;
}

/** 生成结果 */
export interface QrRenderResult {
  /** PNG base64（供保存 / 复制 / 渲染） */
  dataUrl: string;
  raw: Blob | null;
}

/** 识别结果 */
export interface QrDecodeResult {
  ok: boolean;
  /** 解码出的原始文本（已 UTF-8 还原） */
  data?: string;
  /** 推测的内容类型 */
  type?: QrPayloadType;
  /** 结构化解析结果（若可识别） */
  payload?: QrPayload;
  error?: string;
}
