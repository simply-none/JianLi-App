/**
 * 二维码内容拼装：9 种结构化类型 → 标准字符串。
 * 反向反解析见 parse.ts。
 */
import type {
  QrPayload,
  QrPayloadType,
  TextPayload,
  UrlPayload,
  WifiPayload,
  ContactPayload,
  EmailPayload,
  SmsPayload,
  TelPayload,
  GeoPayload,
  EventPayload,
} from './types';

/** 转义协议分隔符，避免 ; , : \ " 破坏格式 */
function esc(value: string): string {
  return value.replace(/([\\;,:"])/g, '\\$1');
}

/** 纯文本 */
export function buildText(p: TextPayload): string {
  return p.text;
}

/** 网址（缺省补 https://） */
export function buildUrl(p: UrlPayload): string {
  const url = p.url.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (/^[\w-]+:\/\//i.test(url)) return url; // 其它 scheme
  return 'https://' + url;
}

/** Wi-Fi：WIFI:S:<ssid>;T:<auth>;P:<pwd>;H:<hidden>;; */
export function buildWifi(p: WifiPayload): string {
  const enc: WifiPayload['encryption'] =
    p.encryption && p.encryption !== 'nopass'
      ? p.encryption
      : p.password
        ? 'WPA'
        : 'nopass';
  const parts = [`S:${esc(p.ssid)}`];
  if (enc !== 'nopass') {
    parts.push(`T:${enc}`);
    parts.push(`P:${esc(p.password || '')}`);
  } else {
    parts.push('T:nopass');
  }
  if (p.hidden) parts.push('H:true');
  return `WIFI:${parts.join(';')};;`;
}

/** 联系人（vCard 3.0） */
export function buildContact(p: ContactPayload): string {
  const lines: string[] = ['BEGIN:VCARD', 'VERSION:3.0'];
  const name = [p.lastName || '', p.firstName || ''].filter(Boolean).join(';');
  if (name) {
    lines.push(`N:${name}`);
    lines.push(`FN:${(p.firstName || '') + ' ' + (p.lastName || '')}`.trim());
  }
  if (p.org) lines.push(`ORG:${p.org}`);
  if (p.title) lines.push(`TITLE:${p.title}`);
  if (p.phone) lines.push(`TEL;TYPE=CELL:${p.phone}`);
  if (p.email) lines.push(`EMAIL;TYPE=INTERNET:${p.email}`);
  if (p.url) lines.push(`URL:${p.url}`);
  if (p.address) lines.push(`ADR;TYPE=HOME:;;${p.address};;;;`);
  if (p.note) lines.push(`NOTE:${p.note}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

/** 邮件：mailto:to?subject=&body= */
export function buildEmail(p: EmailPayload): string {
  const params: string[] = [];
  if (p.subject) params.push('subject=' + encodeURIComponent(p.subject));
  if (p.body) params.push('body=' + encodeURIComponent(p.body));
  const q = params.length ? '?' + params.join('&') : '';
  return `mailto:${p.to}${q}`;
}

/** 短信：SMSTO:phone:message */
export function buildSms(p: SmsPayload): string {
  return `SMSTO:${p.phone}:${p.message || ''}`;
}

/** 电话：tel:phone */
export function buildTel(p: TelPayload): string {
  return `tel:${p.phone}`;
}

/** 地理位置：geo:lat,lng?q=... */
export function buildGeo(p: GeoPayload): string {
  const q = p.query
    ? `?q=${encodeURIComponent(p.query)}`
    : `?q=${p.lat},${p.lng}`;
  return `geo:${p.lat},${p.lng}${q}`;
}

/** 日历事件：VEVENT */
export function buildEvent(p: EventPayload): string {
  const fmt = (s: string) => {
    const m = s.replace(/[-: ]/g, '');
    return m.length >= 14 ? m.slice(0, 14) : m;
  };
  const lines: string[] = ['BEGIN:VEVENT'];
  lines.push(`SUMMARY:${p.title}`);
  lines.push(`DTSTART:${fmt(p.start)}`);
  if (p.end) lines.push(`DTEND:${fmt(p.end)}`);
  if (p.location) lines.push(`LOCATION:${p.location}`);
  if (p.description) lines.push(`DESCRIPTION:${p.description}`);
  lines.push('END:VEVENT');
  return lines.join('\n');
}

const BUILDERS: Record<QrPayloadType, (p: any) => string> = {
  text: buildText,
  url: buildUrl,
  wifi: buildWifi,
  contact: buildContact,
  email: buildEmail,
  sms: buildSms,
  tel: buildTel,
  geo: buildGeo,
  event: buildEvent,
};

/** 统一入口：结构化 QrPayload → 二维码字符串 */
export function buildPayload(p: QrPayload): string {
  return BUILDERS[p.type](p);
}
