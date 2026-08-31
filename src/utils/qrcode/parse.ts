/**
 * 二维码内容反解析：标准字符串 → 结构化 QrPayload（尽力而为）。
 */
import type {
  QrPayload,
  QrPayloadType,
  WifiPayload,
  ContactPayload,
  EmailPayload,
  SmsPayload,
  TelPayload,
  GeoPayload,
  EventPayload,
} from './types';

/** 根据字符串猜测内容类型 */
export function detectType(text: string): QrPayloadType {
  const t = text.trim();
  if (t.startsWith('WIFI:')) return 'wifi';
  if (t.startsWith('BEGIN:VCARD')) return 'contact';
  if (t.startsWith('BEGIN:VEVENT')) return 'event';
  if (/^mailto:/i.test(t)) return 'email';
  if (/^SMSTO:/i.test(t) || /^smsto:/i.test(t)) return 'sms';
  if (/^tel:/i.test(t)) return 'tel';
  if (/^geo:/i.test(t)) return 'geo';
  if (/^https?:\/\//i.test(t) || /^[\w-]+:\/\//i.test(t)) return 'url';
  return 'text';
}

function unesc(v: string): string {
  return v.replace(/\\([\\;,:"])/g, '$1');
}

function parseWifi(t: string): WifiPayload {
  const body = t.slice(t.indexOf(':') + 1).replace(/;;$/, '');
  const map: Record<string, string> = {};
  body.split(';').forEach((seg) => {
    const idx = seg.indexOf(':');
    if (idx > 0) map[seg.slice(0, idx)] = unesc(seg.slice(idx + 1));
  });
  const enc = (map.T || 'nopass') as WifiPayload['encryption'];
  return {
    type: 'wifi',
    ssid: map.S || '',
    encryption: enc === 'nopass' ? 'nopass' : enc,
    password: enc === 'nopass' ? undefined : map.P,
    hidden: map.H === 'true',
  };
}

function parseContact(t: string): ContactPayload {
  const p: ContactPayload = { type: 'contact' };
  t.split('\n').forEach((line) => {
    const idx = line.indexOf(':');
    if (idx <= 0) return;
    const k = line.slice(0, idx);
    const v = line.slice(idx + 1);
    switch (k) {
      case 'N': {
        const [last, first] = v.split(';');
        p.lastName = last;
        p.firstName = first;
        break;
      }
      case 'FN':
        p.firstName = v;
        break;
      case 'ORG':
        p.org = v;
        break;
      case 'TITLE':
        p.title = v;
        break;
      case 'TEL':
        p.phone = v.replace(/.*:/, '');
        break;
      case 'EMAIL':
        p.email = v.replace(/.*:/, '');
        break;
      case 'URL':
        p.url = v;
        break;
      case 'ADR':
        p.address = v.split(';').slice(2).join(' ').trim();
        break;
      case 'NOTE':
        p.note = v;
        break;
    }
  });
  return p;
}

function parseEmail(t: string): EmailPayload {
  const m = t.match(/^mailto:([^?]+)(?:\?(.*))?$/i);
  const to = m ? decodeURIComponent(m[1]) : t.replace(/^mailto:/i, '');
  const p: EmailPayload = { type: 'email', to };
  if (m && m[2]) {
    const params = new URLSearchParams(m[2]);
    const subj = params.get('subject');
    const body = params.get('body');
    if (subj) p.subject = decodeURIComponent(subj);
    if (body) p.body = decodeURIComponent(body);
  }
  return p;
}

function parseSms(t: string): SmsPayload {
  const m = t.match(/^SMSTO:([^:]+):(.*)$/i);
  return {
    type: 'sms',
    phone: m ? m[1] : t.replace(/^SMSTO:/i, ''),
    message: m ? m[2] : '',
  };
}

function parseTel(t: string): TelPayload {
  return { type: 'tel', phone: t.replace(/^tel:/i, '').trim() };
}

function parseGeo(t: string): GeoPayload {
  const m = t.match(/^geo:(-?[\d.]+),(-?[\d.]+)/i);
  const lat = m ? parseFloat(m[1]) : 0;
  const lng = m ? parseFloat(m[2]) : 0;
  const qm = t.match(/[?&]q=([^&]+)/);
  return {
    type: 'geo',
    lat,
    lng,
    query: qm ? decodeURIComponent(qm[1]) : undefined,
  };
}

function parseEvent(t: string): EventPayload {
  const p: EventPayload = { type: 'event', title: '', start: '' };
  t.split('\n').forEach((line) => {
    const m = line.match(/^(\w+):(.*)$/);
    if (!m) return;
    const k = m[1];
    const v = m[2];
    if (k === 'SUMMARY') p.title = v;
    else if (k === 'DTSTART') p.start = v;
    else if (k === 'DTEND') p.end = v;
    else if (k === 'LOCATION') p.location = v;
    else if (k === 'DESCRIPTION') p.description = v;
  });
  return p;
}

const PARSERS: Record<QrPayloadType, (t: string) => QrPayload> = {
  text: (t) => ({ type: 'text', text: t }),
  url: (t) => ({ type: 'url', url: t }),
  wifi: parseWifi,
  contact: parseContact,
  email: parseEmail,
  sms: parseSms,
  tel: parseTel,
  geo: parseGeo,
  event: parseEvent,
};

/** 统一入口：字符串 → 结构化 QrPayload */
export function parsePayload(text: string): QrPayload {
  const type = detectType(text);
  return PARSERS[type](text);
}
