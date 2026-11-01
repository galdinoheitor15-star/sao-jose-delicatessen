/* Utilidades compartilhadas por site, equipe e admin. */
import { CATEGORIES, PRODUCTS } from './menu-data.js?v=3';
import { DELIVERY, STORE } from './config.js?v=3';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export const money = (v) => BRL.format(Number(v) || 0);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export { CATEGORIES };
export const DEFAULT_PRODUCTS = PRODUCTS;

/* Cardápio vigente: o do painel (se já importado) ou o padrão. */
export function resolveMenu(dbProducts) {
  const list = (dbProducts && dbProducts.length ? dbProducts : PRODUCTS).map((p) => ({ active: true, ...p }));
  return list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
export function resolveDelivery(settings) {
  return { ...DELIVERY, ...(settings?.delivery || {}) };
}

/* Preço de uma linha do pedido */
export const lineTotal = (it) => (Number(it.price) || 0) * (it.qty || 1);
export const itemsTotal = (items) => items.reduce((s, it) => s + lineTotal(it), 0);
export const lineLabel = (it) => [it.size, ...(it.opts || [])].filter(Boolean).join(' · ');

/* Horário */
export function isOpen(now = new Date()) {
  const h = now.getHours() + now.getMinutes() / 60;
  return h >= STORE.hours.open && h < STORE.hours.close;
}

export const waLink = (text) => `https://wa.me/${STORE.whatsapp}?text=${encodeURIComponent(text)}`;

export const timeAgo = (t) => {
  const m = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;
};
export const hhmm = (t) => new Date(t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

/* Distância em km (haversine) */
export function distanceKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/* Pix "copia e cola" (BR Code estático, padrão do Banco Central) */
export function pixPayload({ key, name, city, amount, txid = '***' }) {
  const f = (id, v) => id + String(v.length).padStart(2, '0') + v;
  const clean = (s, n) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().slice(0, n);
  const mai = f('00', 'br.gov.bcb.pix') + f('01', key);
  let p = f('00', '01') + f('26', mai) + f('52', '0000') + f('53', '986') +
    (amount ? f('54', Number(amount).toFixed(2)) : '') + f('58', 'BR') +
    f('59', clean(name, 25)) + f('60', clean(city, 15)) + f('62', f('05', txid)) + '6304';
  let crc = 0xffff;
  for (let i = 0; i < p.length; i++) {
    crc ^= p.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
  }
  return p + (crc & 0xffff).toString(16).toUpperCase().padStart(4, '0');
}

/* Bip curto para pedidos novos (sem arquivo de áudio) */
let actx;
export function chime() {
  try {
    actx ??= new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime;
    [880, 1318.5].forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.16);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.16 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.16 + 0.5);
      o.connect(g).connect(actx.destination);
      o.start(t + i * 0.16); o.stop(t + i * 0.16 + 0.55);
    });
  } catch { /* sem áudio */ }
}

/* Contador "n/limite" nos campos de texto livre marcados com data-chars */
export function charCounters() {
  const paint = (el) => {
    let c = el.nextElementSibling;
    if (!c?.classList.contains('chars')) { c = document.createElement('small'); c.className = 'chars'; el.after(c); }
    const max = el.maxLength, n = el.value.length;
    c.textContent = `${n}/${max}`;
    c.classList.toggle('near', n >= max * 0.9);
  };
  const on = (e) => { if (e.target.matches?.('[data-chars]')) paint(e.target); };
  document.addEventListener('input', on);
  document.addEventListener('focusin', on);
}

export function toast(msg, kind = '') {
  let host = document.getElementById('toasts');
  if (!host) { host = document.createElement('div'); host.id = 'toasts'; host.setAttribute('aria-live', 'polite'); document.body.append(host); }
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.textContent = msg;
  host.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 2600);
}
