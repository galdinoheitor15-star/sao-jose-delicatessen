/* =========================================================
   Site da Delicatessen São José
   Cardápio, sacola, delivery, mesa (QR), avaliações e animações.
   ========================================================= */
import { STORE, REVIEWS, REVIEWS_URL, PAYMENTS } from './config.js';
import { connect } from './data.js';
import {
  $, $$, esc, money, CATEGORIES, resolveMenu, resolveDelivery, itemsTotal, lineLabel,
  isOpen, waLink, distanceKm, reduceMotion, toast
} from './util.js';

document.documentElement.classList.remove('no-js');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const params = new URLSearchParams(location.search);
const MESA = (params.get('mesa') || '').replace(/\D/g, '').slice(0, 3) || null;

const state = {
  products: resolveMenu(null),
  delivery: resolveDelivery(null),
  cart: loadCart(),
  mode: MESA ? 'mesa' : 'delivery',
  zone: '',
  payment: 'pix',
  query: '',
  backend: null,
  lastOrder: null
};
const byId = () => new Map(state.products.map((p) => [p.id, p]));

/* ---------- Links fixos ---------- */
const hello = 'Olá, Delicatessen São José! Vim pelo site e gostaria de fazer um pedido.';
$('#heroWa').href = waLink(hello);
$('#waFloat').href = waLink(hello);
$('#cestaWa').href = waLink('Olá! Gostaria de encomendar uma cesta especial. Pode me passar as opções?');
$('#reviewsLink').href = REVIEWS_URL;
$('#mapsLink').href = STORE.mapsUrl;
$('#addr').textContent = STORE.address;
const igUrl = `https://www.instagram.com/${STORE.instagram}/`;
$('#igLink').href = igUrl;
$$('[data-ig]').forEach((a) => { a.href = igUrl; a.target = '_blank'; a.rel = 'noopener'; a.setAttribute('aria-label', 'Instagram da São José'); });

/* ---------- Aberto / fechado ---------- */
function paintOpen() {
  const pill = $('#openPill'), open = isOpen();
  pill.classList.toggle('is-closed', !open);
  pill.querySelector('span').textContent = open ? 'Aberto agora' : `Abre às ${String(STORE.hours.open).padStart(2, '0')}h`;
}
paintOpen();
setInterval(paintOpen, 60000);

/* ---------- Topo: sólido ao rolar, some ao descer ---------- */
{
  const top = $('#top');
  let lastY = scrollY, ticking = false;
  const onScroll = () => {
    const y = scrollY;
    top.classList.toggle('is-solid', y > 12);
    const drawerOpen = $('#drawer').classList.contains('is-open');
    top.classList.toggle('is-hidden', !drawerOpen && y > innerHeight * 0.9 && y > lastY + 4);
    if (y < lastY - 4 || y < innerHeight * 0.9) top.classList.remove('is-hidden');
    lastY = y; ticking = false;
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();
}

/* ---------- Texto que sobe palavra por palavra + revelações ---------- */
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.append(' '); return; }
          const w = document.createElement('span'); w.className = 'w';
          const s = document.createElement('span'); s.textContent = part; s.style.setProperty('--i', i++);
          w.append(s); frag.append(w);
        });
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    });
  };
  el.setAttribute('aria-label', el.textContent);
  walk(el);
}
$$('[data-split]').forEach(splitWords);

const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    if (e.target.matches('[data-count]')) countUp(e.target);
    $$('[data-count]', e.target).forEach(countUp);
    io.unobserve(e.target);
  });
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
function observeReveals(root = document) {
  // escalonamento dentro do mesmo grupo
  const groups = new Map();
  $$('[data-reveal]:not(.in)', root).forEach((el) => {
    const g = el.parentElement;
    const n = groups.get(g) || 0; groups.set(g, n + 1);
    el.style.setProperty('--d', `${Math.min(n, 6) * 90}ms`);
    io.observe(el);
  });
  $$('[data-split]:not(.in)', root).forEach((el) => io.observe(el));
}
observeReveals();

function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const to = parseFloat(el.dataset.count), dec = +(el.dataset.decimals || 0);
  const fmt = (v) => v.toLocaleString('pt-BR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  if (reduceMotion()) { el.textContent = fmt(to); return; }
  const t0 = performance.now(), dur = 1400;
  const step = (t) => {
    const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
    el.textContent = fmt(to * e);
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ---------- Inclinação 3D nos cartões (só mouse) ---------- */
if (finePointer && !reduceMotion()) {
  $$('.tilt').forEach((el) => {
    let raf = 0;
    el.addEventListener('pointermove', (e) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        el.style.transition = 'transform 120ms linear';
        el.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg) translateZ(0)`;
      });
    });
    el.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); el.style.transition = ''; el.style.transform = ''; });
  });
}

/* ---------- Bolo 3D do topo ---------- */
{
  const stage = $('.hero__stage');
  const gl = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } })();
  if (gl && params.get('3d') !== '0') {
    const start = () => import('./hero3d.js').then((m) => m.mountCake($('#cake3d'), stage)).catch((e) => console.warn('3D indisponível', e));
    'requestIdleCallback' in window ? requestIdleCallback(start, { timeout: 900 }) : setTimeout(start, 200);
  }
}

/* ---------- Carrossel 3D dos destaques ---------- */
function buildRing() {
  const spin = $('#ringSpin');
  const feats = state.products.filter((p) => p.featured && p.active !== false && p.img).slice(0, 12);
  const n = feats.length;
  if (!n) { $('#destaques').hidden = true; return; }
  const mobile = innerWidth < 640;
  const cw = mobile ? 180 : 230;
  const radius = Math.round((cw + (mobile ? 24 : 36)) / (2 * Math.tan(Math.PI / n)));
  spin.style.setProperty('--cw', cw + 'px');
  spin.innerHTML = feats.map((p, i) => `
    <button class="ring__card" data-pid="${p.id}" style="--cw:${cw}px;transform:rotateY(${(360 / n) * i}deg) translateZ(${radius}px)">
      <img src="${p.img}" alt="" loading="lazy" decoding="async" draggable="false">
      <div><b>${esc(p.name)}</b><span>${priceLabel(p)}</span></div>
    </button>`).join('');
  spin.dataset.radius = radius;
}
{
  const ring = $('#ring'), spin = $('#ringSpin');
  let angle = 0, vel = 0, dragging = false, lastX = 0, moved = 0, visible = false, raf = 0;
  const auto = reduceMotion() ? 0 : 0.06;
  const tick = () => {
    if (!dragging) { vel *= 0.95; angle += vel + auto; }
    spin.style.transform = `translateZ(-${spin.dataset.radius || 400}px) rotateX(-6deg) rotateY(${angle}deg)`;
    raf = visible ? requestAnimationFrame(tick) : 0;
  };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }).observe(ring);
  ring.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; lastX = e.clientX; vel = 0; ring.setPointerCapture(e.pointerId); });
  ring.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
    angle += dx * 0.25; vel = dx * 0.25;
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    if (moved < 6) {
      ring.releasePointerCapture?.(e.pointerId);
      const card = document.elementFromPoint(e.clientX, e.clientY)?.closest('.ring__card');
      if (card) openProduct(card.dataset.pid);
    }
  };
  ring.addEventListener('pointerup', end);
  ring.addEventListener('pointercancel', () => { dragging = false; });
  ring.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('.ring__card')) openProduct(e.target.dataset.pid); });
}

/* ---------- Cardápio ---------- */
const priceLabel = (p) => {
  if (p.price == null) return p.unit === 'sob encomenda' ? 'Sob encomenda' : 'Consulte o preço';
  return (p.sizes?.length > 1 ? '<small>a partir de</small>' : '') + money(p.price);
};

function renderTabs() {
  const tabs = $('#tabs');
  tabs.innerHTML = '<span class="tabs__pill" aria-hidden="true"></span>' + CATEGORIES.map((c) =>
    `<button class="tab" role="tab" data-cat="${c.id}" aria-controls="cat-${c.id}">${esc(c.name)}</button>`).join('');
  tabs.addEventListener('click', (e) => {
    const b = e.target.closest('.tab'); if (!b) return;
    if (state.query) { $('#search').value = ''; state.query = ''; renderMenu(); }
    $(`#cat-${b.dataset.cat}`)?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth' });
    setTab(b.dataset.cat);
  });
}
let currentTab = '';
function setTab(id) {
  if (id === currentTab) return;
  currentTab = id;
  const tabs = $('#tabs'), pill = $('.tabs__pill', tabs);
  $$('.tab', tabs).forEach((t) => { const on = t.dataset.cat === id; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', on); });
  const b = $(`.tab[data-cat="${id}"]`, tabs);
  if (!b) return;
  pill.style.width = b.offsetWidth + 'px';
  pill.style.transform = `translateX(${b.offsetLeft}px)`;
  tabs.scrollTo({ left: b.offsetLeft - tabs.clientWidth / 2 + b.offsetWidth / 2, behavior: 'smooth' });
}

const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function cardHTML(p) {
  const off = p.active === false;
  const media = p.img
    ? `<img src="${p.img}" alt="" loading="lazy" decoding="async" onload="this.classList.add('ok')">`
    : `<span class="card__mono" aria-hidden="true">${esc(p.name[0])}</span>`;
  const action = p.price == null ? '<span class="add add--wa">Consultar</span>' : '<span class="add" aria-hidden="true">+</span>';
  return `<button class="card${off ? ' is-off' : ''}" data-pid="${p.id}" ${off ? 'aria-disabled="true"' : ''}>
    <div class="card__img">${p.featured ? '<span class="card__tag">Favorito</span>' : ''}${off ? '<span class="card__tag">Esgotado</span>' : ''}${media}</div>
    <div class="card__body">
      <h4>${esc(p.name)}</h4>
      ${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
      <div class="card__foot"><span class="price${p.price == null ? ' price--consult' : ''}">${priceLabel(p)}${p.unit && p.price != null ? ` <small>/ ${esc(p.unit)}</small>` : ''}</span>${action}</div>
    </div></button>`;
}
function renderMenu() {
  const q = norm(state.query.trim());
  const list = state.products.filter((p) => !p.hidden && (!q || norm(p.name + ' ' + (p.desc || '')).includes(q)));
  const html = CATEGORIES.map((c) => {
    const items = list.filter((p) => p.cat === c.id);
    if (!items.length) return '';
    const groups = [];
    items.forEach((p) => {
      const g = p.group || '';
      let grp = groups.find((x) => x.name === g);
      if (!grp) groups.push(grp = { name: g, items: [] });
      grp.items.push(p);
    });
    return `<section class="cat" id="cat-${c.id}" data-cat="${c.id}">
      <header class="cat__head"><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p></header>
      ${groups.map((g) => `${g.name && groups.length > 1 ? `<p class="group-title">${esc(g.name)}</p>` : ''}<div class="grid">${g.items.map(cardHTML).join('')}</div>`).join('')}
    </section>`;
  }).join('');
  $('#menuList').innerHTML = html || `<p class="empty">Nada encontrado para “${esc(state.query)}”. Tente outro nome.</p>`;
  spy();
}
let spyObs;
function spy() {
  spyObs?.disconnect();
  spyObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) setTab(e.target.dataset.cat); });
  }, { rootMargin: '-35% 0px -60% 0px' });
  $$('.cat').forEach((s) => spyObs.observe(s));
  if (!currentTab) setTab(CATEGORIES[0].id);
}
$('#menuList').addEventListener('click', (e) => {
  const c = e.target.closest('.card'); if (c && !c.classList.contains('is-off')) openProduct(c.dataset.pid, c);
});
{
  let t;
  $('#search').addEventListener('input', (e) => {
    clearTimeout(t);
    t = setTimeout(() => { state.query = e.target.value; renderMenu(); }, 140);
  });
}

/* ---------- Produto: opções, tamanho, observação ---------- */
const sheet = $('#productSheet');
let sheetP = null, sheetQty = 1, sheetOrigin = null;
function openProduct(pid, originEl) {
  const p = byId().get(pid); if (!p) return;
  if (p.price == null) {
    window.open(waLink(`Olá! Gostaria de saber o preço e a disponibilidade de: ${p.name}${p.unit ? ` (${p.unit})` : ''}.`), '_blank', 'noopener');
    return;
  }
  sheetP = p; sheetQty = 1; sheetOrigin = originEl || null;
  $('#psCat').textContent = CATEGORIES.find((c) => c.id === p.cat)?.name || '';
  $('#psName').textContent = p.name;
  $('#psDesc').textContent = p.desc || '';
  $('#psMedia').innerHTML = p.img ? `<img src="${p.img}" alt="${esc(p.name)}">` : '';
  $('#psMedia').hidden = !p.img;
  $('#psNote').value = '';
  $('#psSizes').innerHTML = p.sizes?.length ? `<fieldset class="opts"><legend>Tamanho</legend>${p.sizes.map((s, i) =>
    `<label class="opt"><input type="radio" name="size" value="${i}" ${i === p.sizes.length - 1 ? 'checked' : ''}><span>${esc(s.n)} <small>${money(s.p)}</small></span></label>`).join('')}</fieldset>` : '';
  const multi = p.multi || 0;
  $('#psOpts').innerHTML = p.options?.length ? `<fieldset class="opts" data-multi="${multi}"><legend>${multi ? `Escolha até ${multi}` : 'Escolha uma opção'}</legend>${p.options.map((o, i) =>
    `<label class="opt"><input type="${multi ? 'checkbox' : 'radio'}" name="opt" value="${esc(o)}" ${!multi && i === 0 ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</fieldset>` : '';
  paintSheet();
  sheet.showModal();
  sheet.querySelector('.ps__body').scrollTop = 0;
}
function sheetUnit() {
  const p = sheetP; if (!p) return 0;
  if (p.sizes?.length) { const i = +($('input[name=size]:checked', sheet)?.value ?? p.sizes.length - 1); return p.sizes[i].p; }
  return p.price;
}
function paintSheet() {
  $('#psQty').textContent = sheetQty;
  $('#psTotal').textContent = money(sheetUnit() * sheetQty);
}
sheet.addEventListener('change', (e) => {
  const fs = e.target.closest('[data-multi]');
  if (fs && +fs.dataset.multi) {
    const checked = $$('input:checked', fs);
    if (checked.length > +fs.dataset.multi) { e.target.checked = false; toast(`Escolha no máximo ${fs.dataset.multi}.`); }
  }
  paintSheet();
});
sheet.addEventListener('click', (e) => {
  const q = e.target.closest('[data-q]');
  if (q) { sheetQty = Math.max(1, Math.min(50, sheetQty + +q.dataset.q)); paintSheet(); }
  if (e.target === sheet) closeSheet();
});
function closeSheet() {
  if (!sheet.open) return;
  sheet.classList.add('closing');
  setTimeout(() => { sheet.classList.remove('closing'); sheet.close(); }, reduceMotion() ? 0 : 240);
}
sheet.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(); });
$('#productForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.submitter;
  if (!btn || btn.value !== 'add') { closeSheet(); return; }
  const p = sheetP;
  const size = p.sizes?.length ? p.sizes[+($('input[name=size]:checked', sheet)?.value ?? 0)].n : '';
  const opts = $$('input[name=opt]:checked', sheet).map((i) => i.value);
  addToCart({ pid: p.id, name: p.name, price: sheetUnit(), qty: sheetQty, size, opts, note: $('#psNote').value.trim(), img: p.img || '' });
  flyToBag(p.img, $('#psMedia img') || sheetOrigin);
  closeSheet();
});

/* ---------- Sacola ---------- */
function loadCart() { try { return JSON.parse(localStorage.getItem('sj:cart') || '[]'); } catch { return []; } }
function saveCart() { try { localStorage.setItem('sj:cart', JSON.stringify(state.cart)); } catch { /* */ } paintBag(); }
function addToCart(item) {
  const key = (i) => [i.pid, i.size, (i.opts || []).join('|'), i.note].join('§');
  const same = state.cart.find((i) => key(i) === key(item));
  if (same) same.qty += item.qty; else state.cart.push(item);
  saveCart();
  toast(`${item.qty}× ${item.name} na sacola`);
}
const cartCount = () => state.cart.reduce((s, i) => s + i.qty, 0);
function paintBag() {
  const n = cartCount();
  const badge = $('#bagCount');
  badge.hidden = !n; badge.textContent = n;
  document.body.classList.toggle('has-bag', n > 0);
  let bar = $('.bag-bar');
  if (!bar) {
    bar = document.createElement('button');
    bar.className = 'bag-bar'; bar.type = 'button';
    bar.addEventListener('click', openDrawer);
    document.body.append(bar);
  }
  bar.innerHTML = `<span>${n} ${n === 1 ? 'item' : 'itens'} · ver sacola</span><b>${money(itemsTotal(state.cart))}</b>`;
  if ($('#drawer').classList.contains('is-open')) renderDrawer();
}
function flyToBag(src, fromEl) {
  const bag = $('#bagBtn');
  bag.classList.remove('bump'); void bag.offsetWidth; bag.classList.add('bump');
  if (!src || !fromEl || reduceMotion()) return;
  const a = fromEl.getBoundingClientRect(), b = bag.getBoundingClientRect();
  const img = new Image(); img.src = src; img.className = 'fly'; document.body.append(img);
  const sx = a.left + a.width / 2 - 32, sy = a.top + a.height / 2 - 32;
  const ex = b.left + b.width / 2 - 32, ey = b.top + b.height / 2 - 32;
  img.animate([
    { transform: `translate(${sx}px, ${sy}px) scale(1.4)`, opacity: 1 },
    { transform: `translate(${(sx + ex) / 2}px, ${Math.min(sy, ey) - 120}px) scale(0.9)`, opacity: 1, offset: 0.5 },
    { transform: `translate(${ex}px, ${ey}px) scale(0.2)`, opacity: 0.3 }
  ], { duration: 750, easing: 'cubic-bezier(0.5, 0, 0.3, 1)' }).onfinish = () => img.remove();
  setTimeout(() => img.remove(), 1200); // aba em segundo plano pode não terminar a animação
  img.style.left = '0'; img.style.top = '0';
}

const drawer = $('#drawer');
function openDrawer() {
  renderDrawer();
  drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  setTimeout(() => $('.drawer__panel .sheet__x').focus({ preventScroll: true }), 50);
}
function closeDrawer() {
  drawer.classList.remove('is-open'); drawer.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  stopTrack?.();
}
$('#bagBtn').addEventListener('click', openDrawer);
drawer.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) closeDrawer(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer(); });

const form = { nome: '', fone: '', rua: '', numero: '', ref: '', troco: '', obs: '' };
function renderDrawer() {
  const body = $('#bagBody'), foot = $('#bagFoot');
  if (state.lastOrder) return renderDone();
  if (!state.cart.length) {
    body.innerHTML = `<div class="bag-empty"><h4>Sua sacola está vazia</h4><p>Que tal começar por um café com tapioca?</p></div>`;
    foot.innerHTML = `<button class="btn btn--ink" style="width:100%" data-close>Ver cardápio</button>`;
    return;
  }
  const d = state.delivery;
  const modes = MESA ? [['mesa', `Mesa ${MESA}`], ['retirada', 'Retirada']] : [['delivery', 'Delivery'], ['retirada', 'Retirada']];
  const lines = state.cart.map((it, i) => `
    <div class="line">
      ${it.img ? `<img src="${it.img}" alt="">` : `<span class="mono">${esc(it.name[0])}</span>`}
      <div><h5>${esc(it.name)}</h5>${lineLabel(it) ? `<small>${esc(lineLabel(it))}</small>` : ''}${it.note ? `<small class="note">“${esc(it.note)}”</small>` : ''}</div>
      <div class="qty"><button data-li="${i}" data-d="-1" aria-label="Menos">−</button><output>${it.qty}</output><button data-li="${i}" data-d="1" aria-label="Mais">+</button></div>
      <div class="line__price"><small>${money(it.price)} cada</small><b>${money(it.price * it.qty)}</b></div>
    </div>`).join('');
  const zoneOpts = d.zones.map((z) => `<option value="${z.id}" ${state.zone === z.id ? 'selected' : ''}>${esc(z.name)} · ${money(z.fee)}</option>`).join('');
  const deliveryFields = state.mode === 'delivery' ? `
    <label class="field"><span>Bairro</span><select data-f="zone" required><option value="">Selecione</option>${zoneOpts}</select></label>
    <div class="row">
      <label class="field"><span>Rua</span><input data-f="rua" value="${esc(form.rua)}" autocomplete="address-line1" required></label>
      <label class="field"><span>Número</span><input data-f="numero" value="${esc(form.numero)}" inputmode="numeric" required></label>
    </div>
    <label class="field"><span>Complemento / referência</span><input data-f="ref" value="${esc(form.ref)}" placeholder="Apto, bloco, ponto de referência"></label>` : '';
  const payFields = state.mode === 'mesa' ? '' : `
    <label class="field"><span>Pagamento ${state.mode === 'delivery' ? 'na entrega' : 'na retirada'}</span>
      <select data-f="payment">${PAYMENTS.map((p) => `<option value="${p.id}" ${state.payment === p.id ? 'selected' : ''}>${p.name}</option>`).join('')}</select></label>
    ${state.payment === 'dinheiro' ? `<label class="field"><span>Troco para quanto?</span><input data-f="troco" value="${esc(form.troco)}" inputmode="decimal" placeholder="Ex.: 100"></label>` : ''}`;
  body.innerHTML = `
    ${MESA ? `<span class="mesa-flag">Você está na mesa ${MESA}: o pedido vai direto para a cozinha</span>` : ''}
    ${lines}
    <div class="seg" style="--n:${modes.length}">${modes.map(([id, l]) => `<button type="button" data-mode="${id}" class="${state.mode === id ? 'is-on' : ''}">${l}</button>`).join('')}</div>
    <div class="form">
      <div class="row">
        <label class="field"><span>Seu nome</span><input data-f="nome" value="${esc(form.nome)}" autocomplete="name" required></label>
        <label class="field"><span>WhatsApp</span><input data-f="fone" value="${esc(form.fone)}" inputmode="tel" autocomplete="tel" placeholder="(81) 9…" ${state.mode === 'mesa' ? '' : 'required'}></label>
      </div>
      ${deliveryFields}
      ${payFields}
      <label class="field"><span>Observações do pedido</span><textarea data-f="obs" rows="2" maxlength="200" placeholder="Alergias, ponto da carne, horário…">${esc(form.obs)}</textarea></label>
    </div>`;
  paintSummary();
}
function totals() {
  const sub = itemsTotal(state.cart);
  const z = state.delivery.zones.find((x) => x.id === state.zone);
  const fee = state.mode === 'delivery' ? (z?.fee || 0) : 0;
  return { sub, fee, total: sub + fee, zone: z };
}
function paintSummary() {
  const { sub, fee, total, zone } = totals();
  const d = state.delivery;
  const short = state.mode === 'delivery' && sub < d.minOrder;
  $('#bagFoot').innerHTML = `
    <div class="sum">
      <div><span>Subtotal</span><span>${money(sub)}</span></div>
      ${state.mode === 'delivery' ? `<div><span>Entrega${zone ? ` · ${esc(zone.name)}` : ''}</span><span>${zone ? money(fee) : '—'}</span></div>` : ''}
      <div class="total"><span>Total</span><span>${money(total)}</span></div>
    </div>
    ${short ? `<p class="muted" style="font-size:13px;margin-bottom:10px">Pedido mínimo para delivery: ${money(d.minOrder)}.</p>` : ''}
    <button class="btn btn--ink" style="width:100%" id="sendOrder" ${short ? 'disabled' : ''}>
      ${state.mode === 'mesa' ? 'Enviar para a cozinha' : 'Finalizar pelo WhatsApp'}
    </button>`;
  $('#sendOrder').addEventListener('click', submitOrder);
}
$('#bagBody').addEventListener('click', (e) => {
  const q = e.target.closest('[data-li]');
  if (q) {
    const it = state.cart[+q.dataset.li];
    it.qty += +q.dataset.d;
    if (it.qty <= 0) state.cart.splice(+q.dataset.li, 1);
    saveCart(); return;
  }
  const m = e.target.closest('[data-mode]');
  if (m) { state.mode = m.dataset.mode; renderDrawer(); }
});
$('#bagBody').addEventListener('input', (e) => {
  const f = e.target.dataset.f; if (!f) return;
  if (f === 'zone') { state.zone = e.target.value; paintSummary(); return; }
  if (f === 'payment') { state.payment = e.target.value; renderDrawer(); return; }
  form[f] = e.target.value;
});

function waMessage(o) {
  const L = [];
  L.push(`*Pedido #${o.number} · Delicatessen São José*`);
  L.push(o.source === 'delivery' ? '🛵 Delivery' : o.source === 'mesa' ? `🍽️ Mesa ${o.table}` : '🛍️ Retirada no balcão');
  L.push('');
  o.items.forEach((it) => {
    L.push(`${it.qty}× ${it.name}${lineLabel(it) ? ` (${lineLabel(it)})` : ''} — ${money(it.price * it.qty)}`);
    if (it.note) L.push(`   _obs: ${it.note}_`);
  });
  L.push('');
  L.push(`Subtotal: ${money(o.subtotal)}`);
  if (o.source === 'delivery') L.push(`Entrega (${o.customer.bairro}): ${money(o.deliveryFee)}`);
  L.push(`*Total: ${money(o.total)}*`);
  L.push('');
  L.push(`Nome: ${o.customer.nome}`);
  if (o.customer.fone) L.push(`WhatsApp: ${o.customer.fone}`);
  if (o.source === 'delivery') L.push(`Endereço: ${o.customer.endereco}, ${o.customer.bairro}`);
  if (o.payment) L.push(`Pagamento: ${PAYMENTS.find((p) => p.id === o.payment)?.name}${o.change ? ` (troco para ${money(o.change)})` : ''}`);
  if (o.note) L.push(`Obs.: ${o.note}`);
  return L.join('\n');
}

async function submitOrder() {
  const btn = $('#sendOrder');
  const need = $$('#bagBody [required]').find((el) => !el.value.trim());
  if (need) { need.focus(); need.closest('.field')?.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 280 }); toast('Preencha os campos destacados.', 'err'); return; }
  if (!state.cart.length) return;
  const { sub, fee, total, zone } = totals();
  const order = {
    source: state.mode, table: state.mode === 'mesa' ? MESA : null,
    customer: {
      nome: form.nome.trim().slice(0, 80), fone: form.fone.trim().slice(0, 30),
      endereco: state.mode === 'delivery' ? `${form.rua.trim()}, ${form.numero.trim()}${form.ref.trim() ? ` · ${form.ref.trim()}` : ''}` : '',
      bairro: zone?.name || ''
    },
    items: state.cart.map(({ pid, name, price, qty, size, opts, note }) => ({ pid, name, price, qty, size: size || '', opts: opts || [], note: note || '' })),
    note: form.obs.trim().slice(0, 200),
    payment: state.mode === 'mesa' ? null : state.payment,
    change: state.payment === 'dinheiro' && state.mode !== 'mesa' ? parseFloat(String(form.troco).replace(',', '.')) || null : null,
    subtotal: sub, deliveryFee: fee, total
  };
  // abre a aba do WhatsApp já no clique (evita bloqueio de pop-up)
  const waWin = state.mode !== 'mesa' ? window.open('', '_blank') : null;
  btn.disabled = true; btn.textContent = 'Enviando…';
  let res = { id: null, number: '—' };
  try {
    if (state.backend) res = await state.backend.createOrder(order);
  } catch (err) {
    console.error(err);
    if (state.mode === 'mesa') { toast('Não foi possível enviar. Chame um atendente.', 'err'); btn.disabled = false; btn.textContent = 'Tentar de novo'; return; }
  }
  const full = { ...order, ...res };
  const link = waLink(waMessage(full));
  if (waWin) { try { waWin.location.href = link; } catch { /* */ } }
  state.lastOrder = { ...full, waLink: link, waOpened: !!waWin };
  state.cart = []; saveCart();
  renderDrawer();
}

let stopTrack = null;
function renderDone() {
  const o = state.lastOrder;
  const steps = [['novo', 'Pedido recebido'], ['preparo', 'Em preparo'], ['pronto', o.source === 'delivery' ? 'Saiu para entrega' : 'Pronto']];
  $('#bagBody').innerHTML = `
    <div class="done">
      <div class="done__check"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h4>Pedido #${o.number} enviado!</h4>
      <p class="muted">${o.source === 'mesa' ? `Já está na cozinha. É só aguardar na mesa ${o.table}.` : 'Confirme o envio na conversa do WhatsApp que abrimos para você.'}</p>
      ${o.id ? `<ol class="track" id="track">${steps.map(([k, l]) => `<li data-s="${k}"><i></i>${l}</li>`).join('')}</ol>` : ''}
    </div>`;
  $('#bagFoot').innerHTML = `
    ${o.source !== 'mesa' ? `<a class="btn btn--ink" style="width:100%;margin-bottom:10px" href="${o.waLink}" target="_blank" rel="noopener">${o.waOpened ? 'Abrir o WhatsApp de novo' : 'Enviar no WhatsApp'}</a>` : ''}
    <button class="btn btn--line" style="width:100%" id="newOrder">Fazer outro pedido</button>`;
  $('#newOrder').addEventListener('click', () => { state.lastOrder = null; stopTrack?.(); closeDrawer(); });
  if (o.id && state.backend?.onOrder) {
    stopTrack?.();
    stopTrack = state.backend.onOrder(o.id, (cur) => {
      if (!cur) return;
      const order = ['novo', 'preparo', 'pronto', 'entregue'];
      const at = order.indexOf(cur.status);
      $$('#track li').forEach((li) => li.classList.toggle('on', order.indexOf(li.dataset.s) <= at));
    });
  }
}

/* ---------- Delivery: bairros, localização e mapa ---------- */
function renderDelivery() {
  const d = state.delivery;
  $('#zoneSelect').innerHTML = '<option value="">Selecione o bairro</option>' + d.zones.map((z) => `<option value="${z.id}">${esc(z.name)}</option>`).join('') + '<option value="outro">Meu bairro não está na lista</option>';
  $('#zonesList').innerHTML = d.zones.map((z) => `<li>${esc(z.name)}<b>${money(z.fee)}</b></li>`).join('');
  $('#etaTxt').textContent = d.eta;
  $('#minTxt').textContent = money(d.minOrder);
  mapCircle?.setRadius(d.radiusKm * 1000);
}
$('#zoneSelect').addEventListener('change', (e) => {
  const z = state.delivery.zones.find((x) => x.id === e.target.value);
  const box = $('#zoneResult');
  if (z) {
    state.zone = z.id;
    box.innerHTML = `<div class="res res--ok"><b>Entregamos no ${esc(z.name)}!</b> Taxa de ${money(z.fee)} · ${esc(state.delivery.eta)}.</div>`;
  } else if (e.target.value === 'outro') {
    box.innerHTML = `<div class="res res--no">Fale com a gente no <a href="${waLink('Olá! Vocês entregam no meu bairro?')}" target="_blank" rel="noopener">WhatsApp</a> que verificamos para você.</div>`;
  } else box.innerHTML = '';
});
$('#geoBtn').addEventListener('click', () => {
  const box = $('#zoneResult');
  if (!navigator.geolocation) { box.innerHTML = '<div class="res res--no">Seu navegador não informa a localização. Escolha o bairro na lista.</div>'; return; }
  box.innerHTML = '<div class="res">Localizando…</div>';
  navigator.geolocation.getCurrentPosition((pos) => {
    const me = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const km = distanceKm(STORE.coords, me);
    const ok = km <= state.delivery.radiusKm;
    box.innerHTML = ok
      ? `<div class="res res--ok"><b>Você está a ${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km da loja: entregamos aí!</b> Escolha o bairro para ver a taxa.</div>`
      : `<div class="res res--no">Você está a ${km.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km, fora do nosso raio de ${state.delivery.radiusKm} km. Chame no <a href="${waLink('Olá! Estou um pouco longe, vocês conseguem entregar?')}" target="_blank" rel="noopener">WhatsApp</a>.</div>`;
    mapMe?.(me);
  }, () => { box.innerHTML = '<div class="res res--no">Não conseguimos sua localização. Escolha o bairro na lista.</div>'; }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
});
let mapCircle = null, mapMe = null;
new IntersectionObserver(([e], obs) => {
  if (!e.isIntersecting) return;
  obs.disconnect();
  const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
  document.head.append(css);
  const s = document.createElement('script'); s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
  s.onload = () => {
    const L = window.L, c = [STORE.coords.lat, STORE.coords.lng];
    const map = L.map('map', { scrollWheelZoom: false, zoomControl: true, attributionControl: true }).setView(c, 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© OpenStreetMap · © CARTO', maxZoom: 19 }).addTo(map);
    mapCircle = L.circle(c, { radius: state.delivery.radiusKm * 1000, color: '#0a6aab', weight: 1.5, fillColor: '#0a6aab', fillOpacity: 0.08 }).addTo(map);
    const icon = L.divIcon({ className: '', html: '<div style="width:22px;height:22px;border-radius:50%;background:#1b2238;border:4px solid #fff;box-shadow:0 4px 12px rgba(0,0,0,.35)"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker(c, { icon }).addTo(map).bindPopup('<b>Delicatessen São José</b><br>Av. Agamenon Magalhães, 285');
    map.fitBounds(mapCircle.getBounds(), { padding: [10, 10] });
    let meMarker;
    mapMe = (p) => { meMarker?.remove(); meMarker = L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f8a5b', fillOpacity: 1 }).addTo(map); map.fitBounds(L.latLngBounds([c, [p.lat, p.lng]]).pad(0.4)); };
  };
  document.head.append(s);
}, { rootMargin: '400px' }).observe($('#map'));

/* ---------- Avaliações ---------- */
$('#reviews').innerHTML = REVIEWS.map((r) => `
  <article class="review" data-reveal>
    <span class="stars" aria-label="${r.stars} de 5 estrelas">${'★'.repeat(r.stars)}</span>
    <blockquote>${esc(r.text)}</blockquote>
    <footer><span class="av" aria-hidden="true">${esc(r.name[0])}</span><div><b>${esc(r.name)}</b><small>${esc(r.meta)} · ${esc(r.when)}</small></div></footer>
  </article>`).join('');
observeReveals($('#reviews'));

/* ---------- Início ---------- */
renderTabs();
renderMenu();
buildRing();
renderDelivery();
paintBag();
if (MESA) {
  toast(`Bem-vindo! Você está na mesa ${MESA}.`);
}

connect().then((be) => {
  state.backend = be;
  be.onMenu((products) => {
    if (!products) return;
    state.products = resolveMenu(products);
    renderMenu(); buildRing();
  });
  be.onSettings((s) => { state.delivery = resolveDelivery(s); renderDelivery(); });
}).catch((e) => console.warn('Sem conexão com o painel; pedidos seguem pelo WhatsApp.', e));
