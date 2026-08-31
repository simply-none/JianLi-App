/**
 * 二维码内容表单配置（L3 页面复用）
 * ------------------------------------------------------------------
 * 9 种内容类型 → 各自的字段 schema + 默认值 + 拼装函数。
 * 生成页据此动态渲染表单；拼装统一委托能力层 buildPayload()，
 * 保证「表单 → 标准字符串」与解析、识别逻辑一致。
 */
import type { QrPayload, QrPayloadType } from '@/utils/qrcode';
import { buildPayload } from '@/utils/qrcode';

export type QrFieldType =
  | 'text'
  | 'textarea'
  | 'password'
  | 'number'
  | 'select'
  | 'checkbox'
  | 'date';

export interface QrFieldDef {
  /** 对应 QrPayload 的字段名 */
  key: string;
  label: string;
  type: QrFieldType;
  placeholder?: string;
  required?: boolean;
  hint?: string;
  /** select 型选项 */
  options?: { label: string; value: string }[];
  /** 数字/日期的默认值占位（仅 UI 提示） */
  default?: any;
}

export interface QrTypeForm {
  type: QrPayloadType;
  label: string;
  icon: string;
  /** 字段列表（按展示顺序） */
  fields: QrFieldDef[];
  /** 生成默认表单值 */
  defaults: () => Record<string, any>;
  /** 由表单值组装为结构化 QrPayload */
  build: (v: Record<string, any>) => QrPayload;
}

const encOptions = [
  { label: 'WPA/WPA2', value: 'WPA' },
  { label: 'WEP', value: 'WEP' },
  { label: '无密码', value: 'nopass' },
];

export const QR_FORMS: QrTypeForm[] = [
  {
    type: 'text',
    label: '文本',
    icon: 'FileText',
    fields: [{ key: 'text', label: '文本内容', type: 'textarea', required: true, placeholder: '输入任意文本' }],
    defaults: () => ({ text: '' }),
    build: (v) => ({ type: 'text', text: v.text ?? '' }),
  },
  {
    type: 'url',
    label: '网址',
    icon: 'Link',
    fields: [{ key: 'url', label: '网址', type: 'text', required: true, placeholder: 'example.com 或 https://...' }],
    defaults: () => ({ url: '' }),
    build: (v) => ({ type: 'url', url: v.url ?? '' }),
  },
  {
    type: 'wifi',
    label: 'Wi-Fi',
    icon: 'Wifi',
    fields: [
      { key: 'ssid', label: '网络名称 (SSID)', type: 'text', required: true },
      { key: 'password', label: '密码', type: 'password' },
      { key: 'encryption', label: '加密方式', type: 'select', options: encOptions, default: 'WPA' },
      { key: 'hidden', label: '隐藏网络', type: 'checkbox', default: false },
    ],
    defaults: () => ({ ssid: '', password: '', encryption: 'WPA', hidden: false }),
    build: (v) => ({
      type: 'wifi',
      ssid: v.ssid ?? '',
      password: v.password || undefined,
      encryption: v.encryption ?? 'nopass',
      hidden: !!v.hidden,
    }),
  },
  {
    type: 'contact',
    label: '名片',
    icon: 'Contact',
    fields: [
      { key: 'firstName', label: '名', type: 'text' },
      { key: 'lastName', label: '姓', type: 'text' },
      { key: 'org', label: '公司/组织', type: 'text' },
      { key: 'title', label: '职位', type: 'text' },
      { key: 'phone', label: '电话', type: 'text' },
      { key: 'email', label: '邮箱', type: 'text' },
      { key: 'url', label: '网站', type: 'text' },
      { key: 'address', label: '地址', type: 'text' },
      { key: 'note', label: '备注', type: 'textarea' },
    ],
    defaults: () => ({
      firstName: '', lastName: '', org: '', title: '', phone: '', email: '', url: '', address: '', note: '',
    }),
    build: (v) => ({
      type: 'contact',
      firstName: v.firstName || undefined,
      lastName: v.lastName || undefined,
      org: v.org || undefined,
      title: v.title || undefined,
      phone: v.phone || undefined,
      email: v.email || undefined,
      url: v.url || undefined,
      address: v.address || undefined,
      note: v.note || undefined,
    }),
  },
  {
    type: 'email',
    label: '邮件',
    icon: 'Mail',
    fields: [
      { key: 'to', label: '收件人', type: 'text', required: true },
      { key: 'subject', label: '主题', type: 'text' },
      { key: 'body', label: '正文', type: 'textarea' },
    ],
    defaults: () => ({ to: '', subject: '', body: '' }),
    build: (v) => ({ type: 'email', to: v.to ?? '', subject: v.subject || undefined, body: v.body || undefined }),
  },
  {
    type: 'sms',
    label: '短信',
    icon: 'MessageSquarePlus',
    fields: [
      { key: 'phone', label: '手机号', type: 'text', required: true },
      { key: 'message', label: '短信内容', type: 'textarea' },
    ],
    defaults: () => ({ phone: '', message: '' }),
    build: (v) => ({ type: 'sms', phone: v.phone ?? '', message: v.message || undefined }),
  },
  {
    type: 'tel',
    label: '电话',
    icon: 'Smartphone',
    fields: [{ key: 'phone', label: '电话号码', type: 'text', required: true }],
    defaults: () => ({ phone: '' }),
    build: (v) => ({ type: 'tel', phone: v.phone ?? '' }),
  },
  {
    type: 'geo',
    label: '地理位置',
    icon: 'MapPin',
    fields: [
      { key: 'lat', label: '纬度', type: 'number', required: true },
      { key: 'lng', label: '经度', type: 'number', required: true },
      { key: 'query', label: '地点名称 (可选)', type: 'text' },
    ],
    defaults: () => ({ lat: '', lng: '', query: '' }),
    build: (v) => ({
      type: 'geo',
      lat: Number(v.lat) || 0,
      lng: Number(v.lng) || 0,
      query: v.query || undefined,
    }),
  },
  {
    type: 'event',
    label: '日历事件',
    icon: 'Calendar',
    fields: [
      { key: 'title', label: '标题', type: 'text', required: true },
      { key: 'start', label: '开始时间', type: 'date', required: true, hint: '格式 YYYY-MM-DD HH:mm:ss' },
      { key: 'end', label: '结束时间', type: 'date', hint: '格式 YYYY-MM-DD HH:mm:ss' },
      { key: 'location', label: '地点', type: 'text' },
      { key: 'description', label: '描述', type: 'textarea' },
    ],
    defaults: () => ({ title: '', start: '', end: '', location: '', description: '' }),
    build: (v) => ({
      type: 'event',
      title: v.title ?? '',
      start: v.start ?? '',
      end: v.end || undefined,
      location: v.location || undefined,
      description: v.description || undefined,
    }),
  },
];

const FORM_MAP = new Map(QR_FORMS.map((f) => [f.type, f]));

/** 按类型取表单配置 */
export function getForm(type: QrPayloadType): QrTypeForm {
  return FORM_MAP.get(type)!;
}

/** 由类型 + 表单值直接生成二维码字符串 */
export function buildFromForm(type: QrPayloadType, values: Record<string, any>): string {
  const payload = getForm(type).build(values);
  return buildPayload(payload);
}
