/* =========================================================
   Painel da equipe
   Pedidos (novos · em preparo · prontos), observações dos clientes,
   comandas do salão e fechamento da conta com todas as formas de pagamento.
   ========================================================= */
import { connect, dayKey } from './data.js';
import { gate } from './auth-ui.js';
import { STORE, PAYMENTS } from './config.js';
import {
  $, $$, esc, money, CATEGORIES, resolveMenu, itemsTotal, lineLabel, timeAgo, hhmm, chime, toast, pixPayload
} from './util.js';

const root = $('#root');
const S = {
  be: null, user: null, view: location.hash.slice(1) || 'pedidos',
  orders: [], comandas: [], products: resolveMenu(null),
  sound: localStorage.getItem('sj:sound') !== '0',
  seen: new Set(), firstLoad: true,
  selCom: null, draft: [], pickCat: 'todos', pickQ: '',
  closeCom: null, payMethod: 'pix', people: 1
};
const unsubs = [];
const ACTIVE = ['novo', 'preparo', 'pronto'];
const SRC = { mesa: ['Mesa', 'mesa'], delivery: ['Delivery', 'delivery'], retirada: ['Retirada', 'retirada'], comanda: ['Comanda', 'mesa'], balcao: ['Balcão', 'balcao'] };
const ALERT = /(alerg|lactose|gl[uú]ten|cel[ií]ac|diab|vegan|sem a[cç][uú]car|amendoim|camar[aã]o|urgente)/i;
const PAY = Object.fromEntries(PAYMENTS.map((p) => [p.id, p.name]));

const comOrders = (cid) => S.orders.filter((o) => o.comandaId === cid && o.status !== 'cancelado');
const comItems = (cid) => comOrders(cid).flatMap((o) => o.items);
function comTotals(c) {
  const sub = itemsTotal(comItems(c.id));
  const service = c.service ? Math.round(sub * 0.1 * 100) / 100 : 0;
  const discount = Math.min(sub + service, Number(c.discount) || 0);
  const total = Math.max(0, Math.round((sub + service - discount) * 100) / 100);
  const paid = (c.payments || []).reduce((s, p) => s + p.amount, 0);
  return { sub, service, discount, total, paid, remain: Math.round((total - paid) * 100) / 100 };
}
const originChip = (o) => {
  const [label, cls] = SRC[o.source] || ['Balcão', 'balcao'];
  const extra = o.table ? ` ${o.table}` : '';
  return `<span class="chip chip--${cls}">${label}${extra}</span>`;
};

/* ---------- Início ---------- */
connect().then((be) => {
  S.be = be;
  gate(be, {
    root, title: 'Painel da equipe', needRole: 'equipe',
    onUser(u) {
      unsubs.splice(0).forEach((f) => f?.());
      S.user = u;
      if (!u) return;
      shell();
      unsubs.push(be.onMenu((p) => { S.products = resolveMenu(p); if (S.view === 'comandas') render(); }));
      unsubs.push(be.onOrders((list) => { onOrders(list); }, (e) => toast('Sem permissão para ver pedidos: ' + e.code, 'err')));
      unsubs.push(be.onComandas((list) => { S.comandas = list; autoLink(); render(); }, (e) => console.error(e)));
    }
  });
});

function onOrders(list) {
  const fresh = list.filter((o) => o.status === 'novo' && !S.seen.has(o.id));
  list.forEach((o) => S.seen.add(o.id));
  S.orders = list.sort((a, b) => a.createdAt - b.createdAt);
  if (!S.firstLoad && fresh.length) {
    if (S.sound) chime();
    toast(`Novo pedido #${fresh.map((o) => o.number).join(', #')}`);
    document.title = `(${fresh.length}) Novo pedido · São José`;
    setTimeout(() => { document.title = 'Painel da equipe · São José'; }, 6000);
  }
  S.fresh = new Set(fresh.map((o) => o.id));
  S.firstLoad = false;
  autoLink();
  render();
}

/* Pedidos feitos pelo QR da mesa entram sozinhos na comanda da mesa */
const linking = new Set();
async function autoLink() {
  for (const o of S.orders) {
    if (o.source !== 'mesa' || o.comandaId || !o.table || linking.has(o.id) || o.status === 'cancelado') continue;
    linking.add(o.id);
    try {
      let c = S.comandas.find((x) => x.status === 'aberta' && String(x.table) === String(o.table));
      if (!c) c = await S.be.createComanda({ kind: 'mesa', table: String(o.table), label: `Mesa ${o.table}` });
      if (!S.comandas.some((x) => x.id === c.id)) S.comandas.push(c);
      await S.be.updateOrder(o.id, { comandaId: c.id });
    } catch (e) { console.error(e); linking.delete(o.id); }
  }
}

/* ---------- Estrutura ---------- */
function shell() {
  root.innerHTML = `
    <div class="app">
      <header class="bar">
        <a class="brand" href="../" title="Ver o site"><b>São José</b><small>Delicatessen</small></a>
        <nav class="bar__tabs" id="tabs">
          <button class="bar__tab" data-v="pedidos">Pedidos<b id="cPed"></b></button>
          <button class="bar__tab" data-v="obs">Observações<b id="cObs"></b></button>
          <button class="bar__tab" data-v="comandas">Comandas<b id="cCom"></b></button>
          <button class="bar__tab" data-v="fechamento">Fechamento</button>
        </nav>
        <div class="bar__right">
          ${S.be.mode === 'local' ? '<span class="mode-chip" title="Dados salvos só neste navegador">Demonstração</span>' : ''}
          <span class="clock" id="clock"></span>
          <button class="icon-btn ${S.sound ? 'is-on' : ''}" id="soundBtn" title="Som de novo pedido" aria-label="Som de novo pedido"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg></button>
          <button class="icon-btn" id="fsBtn" title="Tela cheia (TV da cozinha)" aria-label="Tela cheia"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
          <button class="btn btn--line btn--sm" id="outBtn">Sair</button>
        </div>
      </header>
      <main class="view" id="view"></main>
    </div>`;
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) go(b.dataset.v); });
  $('#soundBtn').addEventListener('click', (e) => {
    S.sound = !S.sound; localStorage.setItem('sj:sound', S.sound ? '1' : '0');
    e.currentTarget.classList.toggle('is-on', S.sound);
    if (S.sound) chime();
  });
  $('#fsBtn').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  $('#outBtn').addEventListener('click', () => S.be.signOut());
  const tick = () => { const c = $('#clock'); if (c) c.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
  tick();
  clearInterval(S.timer);
  S.timer = setInterval(() => { tick(); if (S.view === 'pedidos') render(); }, 30000);
  render();
}
function go(v) { S.view = v; history.replaceState(null, '', '#' + v); render(); window.scrollTo({ top: 0 }); }
addEventListener('hashchange', () => { S.view = location.hash.slice(1) || 'pedidos'; render(); });

function render() {
  const view = $('#view'); if (!view) return;
  $$('#tabs [data-v]').forEach((b) => b.classList.toggle('is-on', b.dataset.v === S.view));
  const novos = S.orders.filter((o) => o.status === 'novo').length;
  $('#cPed').textContent = novos || '';
  $('#cObs').textContent = S.orders.filter((o) => ACTIVE.includes(o.status) && hasNotes(o)).length || '';
  $('#cCom').textContent = S.comandas.filter((c) => c.status === 'aberta').length || '';
  // mantém o foco e o cursor de quem está digitando quando a tela atualiza sozinha
  const a = document.activeElement;
  const keep = a?.id && view.contains(a) && a.matches('input, textarea') ? { id: a.id, s: a.selectionStart, e: a.selectionEnd } : null;
  ({ pedidos: renderKanban, obs: renderNotes, comandas: renderComandas, fechamento: renderFechamento }[S.view] || renderKanban)(view);
  if (keep) {
    const el = document.getElementById(keep.id);
    if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.s, keep.e); } catch { /* */ } }
  }
}

/* ---------- Pedidos ---------- */
const NEXT = {
  novo: ['preparo', 'Iniciar preparo', ''],
  preparo: ['pronto', 'Marcar pronto', 'btn--warn'],
  pronto: ['entregue', 'Entregue', 'btn--ok']
};
function ticket(o) {
  const mins = (Date.now() - o.createdAt) / 60000;
  const late = o.status !== 'pronto' && mins > 30 ? 'very-late' : o.status !== 'pronto' && mins > 15 ? 'late' : '';
  const [to, label, cls] = NEXT[o.status];
  const doneLabel = o.status === 'pronto' && o.source === 'delivery' ? 'Saiu para entrega' : label;
  const com = o.comandaId && S.comandas.find((c) => c.id === o.comandaId);
  return `<article class="ticket ${late} ${S.fresh?.has(o.id) ? 'is-new' : ''}" data-id="${o.id}">
    <div class="ticket__top"><span class="ticket__num">#${o.number}</span>${originChip(o)}${com && com.kind !== 'mesa' ? `<span class="chip">${esc(com.label)}</span>` : ''}<span class="ticket__time" title="Recebido às ${hhmm(o.createdAt)}">${timeAgo(o.createdAt)}</span></div>
    ${o.customer?.nome ? `<p class="ticket__who">${esc(o.customer.nome)}${o.customer.fone ? ` · <a href="https://wa.me/55${o.customer.fone.replace(/\D/g, '').replace(/^55/, '')}" target="_blank" rel="noopener">${esc(o.customer.fone)}</a>` : ''}</p>` : ''}
    <ul class="ticket__items">${o.items.map((it) => `<li><b>${it.qty}×</b><span>${esc(it.name)}${lineLabel(it) ? `<small>${esc(lineLabel(it))}</small>` : ''}${it.note ? `<span class="obs ${ALERT.test(it.note) ? 'alert' : ''}">⚑ ${esc(it.note)}</span>` : ''}</span></li>`).join('')}</ul>
    ${o.note ? `<p class="ticket__note ${ALERT.test(o.note) ? 'obs alert' : ''}">Obs.: ${esc(o.note)}</p>` : ''}
    ${o.source === 'delivery' ? `<p class="ticket__addr"><b>Entrega:</b> ${esc(o.customer.endereco)} · <b>${esc(o.customer.bairro)}</b><br><b>Pagamento:</b> ${esc(PAY[o.payment] || '')}${o.change ? ` · troco p/ ${money(o.change)}` : ''} · <b>${money(o.total)}</b></p>` : ''}
    ${o.source === 'retirada' ? `<p class="ticket__addr"><b>Pagamento:</b> ${esc(PAY[o.payment] || '')}${o.change ? ` · troco p/ ${money(o.change)}` : ''} · <b>${money(o.total)}</b></p>` : ''}
    <div class="ticket__actions">
      <button class="btn ${cls}" data-act="to" data-to="${to}">${doneLabel}</button>
      ${o.status !== 'novo' ? '<button class="btn btn--line btn--sm" data-act="back" title="Voltar etapa" aria-label="Voltar etapa">↶</button>' : ''}
      <button class="btn btn--line btn--sm" data-act="cancel" title="Cancelar pedido" aria-label="Cancelar pedido">✕</button>
    </div>
  </article>`;
}
function renderKanban(view) {
  const cols = [['novo', 'Novos pedidos'], ['preparo', 'Em preparo'], ['pronto', 'Prontos']];
  view.innerHTML = `<div class="kanban">${cols.map(([s, t]) => {
    const list = S.orders.filter((o) => o.status === s);
    return `<section class="col col--${s}"><header class="col__head"><i></i><h2>${t}</h2><span class="n">${list.length}</span></header>
      <div class="col__list">${list.map(ticket).join('') || `<p class="col__empty">${s === 'novo' ? 'Nenhum pedido novo. Assim que chegar, toca o sino.' : 'Nada por aqui.'}</p>`}</div></section>`;
  }).join('')}</div>
  <p class="muted" style="margin-top:14px;font-size:13px">Entregues hoje: ${S.orders.filter((o) => o.status === 'entregue').length} · Cancelados: ${S.orders.filter((o) => o.status === 'cancelado').length}</p>`;
  S.fresh = new Set();
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest('.ticket [data-act]'); if (!b) return;
  const id = b.closest('.ticket').dataset.id;
  const o = S.orders.find((x) => x.id === id); if (!o) return;
  const flow = ['novo', 'preparo', 'pronto', 'entregue'];
  let to;
  if (b.dataset.act === 'to') to = b.dataset.to;
  if (b.dataset.act === 'back') to = flow[Math.max(0, flow.indexOf(o.status) - 1)];
  if (b.dataset.act === 'cancel') { if (!confirm(`Cancelar o pedido #${o.number}?`)) return; to = 'cancelado'; }
  const card = b.closest('.ticket');
  card.style.transition = 'opacity 200ms, transform 200ms'; card.style.opacity = '0'; card.style.transform = 'scale(0.97)';
  try { await S.be.updateOrder(id, { status: to, statusAt: { ...(o.statusAt || {}), [to]: Date.now() } }); }
  catch (err) { toast('Não foi possível atualizar.', 'err'); card.style.opacity = ''; card.style.transform = ''; }
});

/* ---------- Observações ---------- */
const hasNotes = (o) => !!o.note || o.items.some((i) => i.note);
function renderNotes(view) {
  const list = S.orders.filter((o) => ACTIVE.includes(o.status) && hasNotes(o));
  view.innerHTML = `<div class="view-head"><h2>Observações dos clientes</h2><span class="muted">pedidos em aberto · alergias e restrições em vermelho</span></div>
    ${list.length ? `<div class="notes">${list.map((o) => `
      <article class="note-card">
        <div class="ticket__top"><span class="ticket__num">#${o.number}</span>${originChip(o)}<span class="st st--${o.status}">${{ novo: 'novo', preparo: 'em preparo', pronto: 'pronto' }[o.status]}</span><span class="ticket__time">${timeAgo(o.createdAt)}</span></div>
        <ul>
          ${o.items.filter((i) => i.note).map((i) => `<li><b>${i.qty}× ${esc(i.name)}</b><span class="obs ${ALERT.test(i.note) ? 'alert' : ''}">${esc(i.note)}</span></li>`).join('')}
          ${o.note ? `<li><b>Pedido todo</b><span class="obs ${ALERT.test(o.note) ? 'alert' : ''}">${esc(o.note)}</span></li>` : ''}
        </ul>
        ${o.customer?.nome ? `<small class="muted">${esc(o.customer.nome)}</small>` : ''}
      </article>`).join('')}</div>`
    : '<div class="empty-state"><h3>Sem observações agora</h3><p>Quando um cliente pedir “sem cebola” ou avisar de alergia, aparece aqui.</p></div>'}`;
}

/* ---------- Comandas ---------- */
function comCard(c, sel) {
  const t = comTotals(c);
  const pending = comOrders(c.id).some((o) => ['novo', 'preparo'].includes(o.status));
  return `<button class="com ${sel ? 'is-on' : ''}" data-com="${c.id}">
    <b>${pending ? '<i class="dot" title="Itens na cozinha"></i>' : ''}${esc(c.label)}</b><span class="t">${money(t.sub)}</span>
    <small>Comanda ${c.number} · aberta ${hhmm(c.openedAt)}</small><small style="text-align:right">${comItems(c.id).reduce((s, i) => s + i.qty, 0)} itens</small>
  </button>`;
}
function renderComandas(view) {
  const open = S.comandas.filter((c) => c.status === 'aberta').sort((a, b) => a.openedAt - b.openedAt);
  if (S.selCom && !open.some((c) => c.id === S.selCom)) { S.selCom = null; S.draft = []; }
  const c = open.find((x) => x.id === S.selCom);
  view.innerHTML = `<div class="split">
    <aside class="side">
      <button class="btn btn--blue btn--lg btn--block" id="newCom">+ Nova comanda</button>
      <div class="com-list">${open.map((x) => comCard(x, x.id === S.selCom)).join('') || '<p class="col__empty">Nenhuma comanda aberta.</p>'}</div>
    </aside>
    <section>${c ? comDetail(c) : '<div class="panel empty-state"><h3>Selecione ou abra uma comanda</h3><p>Cada mesa ou cliente do balcão tem a sua. Os pedidos feitos pelo QR Code da mesa entram sozinhos.</p></div>'}</section>
  </div>`;
}
function comDetail(c) {
  const orders = comOrders(c.id);
  const t = comTotals(c);
  const draftTotal = itemsTotal(S.draft);
  const q = S.pickQ.trim().toLowerCase();
  const prods = S.products.filter((p) => p.price != null && !p.hidden && (S.pickCat === 'todos' || p.cat === S.pickCat) && (!q || p.name.toLowerCase().includes(q)));
  return `
  <div class="panel">
    <div class="panel__head"><h3>${esc(c.label)}</h3><span class="muted">Comanda ${c.number} · aberta às ${hhmm(c.openedAt)}</span><span class="grow"></span>
      <button class="btn btn--line btn--sm" data-go-close="${c.id}">Fechar conta · ${money(t.sub)}</button></div>
    ${orders.length ? `<div class="rows">${orders.flatMap((o) => o.items.map((it) => `
      <div class="row"><span class="q">${it.qty}×</span><span>${esc(it.name)}${lineLabel(it) ? `<small>${esc(lineLabel(it))}</small>` : ''}${it.note ? `<small class="obs">${esc(it.note)}</small>` : ''}</span><span class="st st--${o.status}">${o.status === 'novo' ? `#${o.number}` : o.status}</span><span class="p">${money(it.price * it.qty)}</span></div>`)).join('')}</div>`
    : '<p class="muted">Nenhum item enviado ainda.</p>'}
  </div>
  ${S.draft.length ? `<div class="panel draft">
    <div class="panel__head"><h3>Novo envio</h3><span class="grow"></span><b>${money(draftTotal)}</b></div>
    <div class="rows">${S.draft.map((it, i) => `<div class="row"><span class="q">${it.qty}×</span><span>${esc(it.name)}${lineLabel(it) ? `<small>${esc(lineLabel(it))}</small>` : ''}${it.note ? `<small class="obs">${esc(it.note)}</small>` : ''}</span><span class="p">${money(it.price * it.qty)}</span><button class="mini-x" data-rm="${i}" aria-label="Remover">×</button></div>`).join('')}</div>
    <label class="field" style="margin-top:10px"><span>Observação geral para a cozinha</span><input id="draftNote" maxlength="200" value="${esc(S.draftNote || '')}"></label>
    <button class="btn btn--blue btn--lg btn--block" style="margin-top:12px" id="sendDraft">Enviar para a cozinha</button>
  </div>` : ''}
  <div class="panel">
    <div class="picker__bar"><h3 style="margin-right:auto">Adicionar itens</h3>
      <label class="field"><input id="pkQ" type="search" placeholder="Buscar produto" value="${esc(S.pickQ)}" autocomplete="off"></label></div>
    <div class="chips" id="pkCats"><button data-pc="todos" class="${S.pickCat === 'todos' ? 'is-on' : ''}">Todos</button>${CATEGORIES.map((k) => `<button data-pc="${k.id}" class="${S.pickCat === k.id ? 'is-on' : ''}">${esc(k.name)}</button>`).join('')}</div>
    <div class="pick-grid">${prods.map((p) => `<button class="pick ${p.active === false ? 'is-off' : ''}" data-pick="${p.id}"><b>${esc(p.name)}</b><span>${p.sizes?.length > 1 ? 'a partir de ' : ''}${money(p.price)}</span></button>`).join('') || '<p class="muted">Nada encontrado.</p>'}</div>
  </div>`;
}
document.addEventListener('click', async (e) => {
  if (S.view !== 'comandas') return;
  const t = e.target;
  if (t.closest('#newCom')) { openNewCom(); return; }
  const cb = t.closest('[data-com]');
  if (cb) { if (S.selCom !== cb.dataset.com) { S.draft = []; S.draftNote = ''; } S.selCom = cb.dataset.com; render(); return; }
  const pc = t.closest('[data-pc]'); if (pc) { S.pickCat = pc.dataset.pc; render(); return; }
  const pk = t.closest('[data-pick]'); if (pk) { openPick(pk.dataset.pick); return; }
  const rm = t.closest('[data-rm]'); if (rm) { S.draft.splice(+rm.dataset.rm, 1); render(); return; }
  const gc = t.closest('[data-go-close]'); if (gc) { S.closeCom = gc.dataset.goClose; go('fechamento'); return; }
  if (t.closest('#sendDraft')) {
    const c = S.comandas.find((x) => x.id === S.selCom); if (!c || !S.draft.length) return;
    const btn = t.closest('#sendDraft'); btn.disabled = true; btn.textContent = 'Enviando…';
    try {
      const items = S.draft;
      const r = await S.be.createOrder({
        source: c.kind === 'mesa' ? 'mesa' : 'balcao', table: c.table || null, comandaId: c.id,
        customer: { nome: c.kind === 'mesa' ? '' : c.label, fone: '', endereco: '', bairro: '' },
        items, note: S.draftNote || '', payment: null, change: null, subtotal: itemsTotal(items), deliveryFee: 0, total: itemsTotal(items),
        by: S.user?.name || ''
      });
      S.draft = []; S.draftNote = '';
      toast(`Enviado para a cozinha · pedido #${r.number}`);
      render();
    } catch (err) { console.error(err); toast('Falha ao enviar. Tente de novo.', 'err'); btn.disabled = false; btn.textContent = 'Enviar para a cozinha'; }
  }
});
document.addEventListener('input', (e) => {
  if (e.target.id === 'pkQ') { S.pickQ = e.target.value; clearTimeout(S.qT); S.qT = setTimeout(render, 120); }
  if (e.target.id === 'draftNote') S.draftNote = e.target.value;
});

/* nova comanda */
const ncModal = $('#newComModal');
function openNewCom() {
  $('#ncMesa').value = ''; $('#ncNome').value = '';
  ncModal.showModal(); setTimeout(() => $('#ncMesa').focus(), 30);
}
$('#ncKind').addEventListener('change', () => {
  const mesa = $('input[name=nck]:checked').value === 'mesa';
  $('#ncMesaF').hidden = !mesa; $('#ncNomeF').hidden = mesa;
});
$('#newComForm').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault();
  const kind = $('input[name=nck]:checked').value;
  const mesa = $('#ncMesa').value.replace(/\D/g, ''), nome = $('#ncNome').value.trim();
  if (kind === 'mesa' && !mesa) { $('#ncMesa').focus(); return; }
  if (kind !== 'mesa' && !nome) { $('#ncNome').focus(); return; }
  if (kind === 'mesa') {
    const ex = S.comandas.find((c) => c.status === 'aberta' && String(c.table) === mesa);
    if (ex) { ncModal.close(); S.selCom = ex.id; render(); toast(`A mesa ${mesa} já tem comanda aberta.`); return; }
  }
  const c = await S.be.createComanda(kind === 'mesa' ? { kind, table: mesa, label: `Mesa ${mesa}` } : { kind, table: null, label: nome });
  ncModal.close();
  if (!S.comandas.some((x) => x.id === c.id)) S.comandas.push(c);
  S.selCom = c.id; S.draft = []; render();
});

/* escolher item com tamanho/opções/observação */
const pm = $('#pickModal');
let pmP = null, pmQty = 1;
function openPick(id) {
  pmP = S.products.find((p) => p.id === id); if (!pmP) return;
  pmQty = 1;
  $('#pmName').textContent = pmP.name;
  $('#pmSizes').innerHTML = pmP.sizes?.length ? `<div class="opts">${pmP.sizes.map((s, i) => `<label class="opt"><input type="radio" name="pms" value="${i}" ${i === pmP.sizes.length - 1 ? 'checked' : ''}><span>${esc(s.n)} · ${money(s.p)}</span></label>`).join('')}</div>` : '';
  $('#pmOpts').innerHTML = pmP.options?.length ? `<div class="opts">${pmP.options.map((o, i) => `<label class="opt"><input type="${pmP.multi ? 'checkbox' : 'radio'}" name="pmo" value="${esc(o)}" ${!pmP.multi && i === 0 ? 'checked' : ''}><span>${esc(o)}</span></label>`).join('')}</div>` : '';
  $('#pmNote').value = '';
  $('#pmQty').textContent = 1;
  // item simples: adiciona direto, sem perguntar
  if (!pmP.sizes?.length && !pmP.options?.length && !e2.shiftKey) { addDraft(); return; }
  pm.showModal();
}
const e2 = { shiftKey: false };
document.addEventListener('pointerdown', (e) => { e2.shiftKey = e.shiftKey; }, true);
pm.addEventListener('click', (e) => { const q = e.target.closest('[data-q]'); if (q) { pmQty = Math.max(1, pmQty + +q.dataset.q); $('#pmQty').textContent = pmQty; } });
$('#pickForm').addEventListener('submit', (e) => { if (e.submitter?.value === 'ok') addDraft(); });
function addDraft() {
  const p = pmP;
  const si = $('input[name=pms]:checked'); const size = p.sizes?.length ? p.sizes[+(si?.value ?? 0)] : null;
  const opts = $$('input[name=pmo]:checked').map((i) => i.value);
  const item = { pid: p.id, name: p.name, price: size ? size.p : p.price, qty: pmQty, size: size?.n || '', opts, note: $('#pmNote').value.trim() };
  const same = S.draft.find((d) => d.pid === item.pid && d.size === item.size && d.opts.join() === item.opts.join() && d.note === item.note);
  if (same) same.qty += item.qty; else S.draft.push(item);
  render();
}

/* ---------- Fechamento ---------- */
function renderFechamento(view) {
  const open = S.comandas.filter((c) => c.status === 'aberta').sort((a, b) => a.openedAt - b.openedAt);
  const closed = S.comandas.filter((c) => c.status === 'fechada').sort((a, b) => b.closedAt - a.closedAt);
  const c = S.comandas.find((x) => x.id === S.closeCom);

  // caixa do dia
  const byMethod = {};
  closed.forEach((x) => (x.payments || []).forEach((p) => { byMethod[p.method] = (byMethod[p.method] || 0) + p.amount; }));
  const ext = S.orders.filter((o) => ['delivery', 'retirada'].includes(o.source) && o.status === 'entregue');
  ext.forEach((o) => { byMethod[o.payment] = (byMethod[o.payment] || 0) + o.total; });
  const totalDay = Object.values(byMethod).reduce((s, v) => s + v, 0);

  view.innerHTML = `
    <div class="view-head"><h2>Fechamento da conta</h2><span class="muted">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</span></div>
    <div class="cash">
      <div class="sum"><small>Caixa do dia</small><b>${money(totalDay)}</b></div>
      ${PAYMENTS.map((p) => `<div><small>${p.name}</small><b>${money(byMethod[p.id] || 0)}</b></div>`).join('')}
      <div><small>Contas fechadas</small><b>${closed.length}</b></div>
      <div><small>Delivery/retirada entregues</small><b>${ext.length}</b></div>
    </div>
    <div class="split">
      <aside class="side">
        <p class="muted" style="font-weight:600">Comandas abertas</p>
        <div class="com-list">${open.map((x) => comCard(x, x.id === S.closeCom)).join('') || '<p class="col__empty">Nenhuma comanda aberta.</p>'}</div>
        ${closed.length ? `<p class="muted" style="font-weight:600;margin-top:10px">Fechadas hoje</p>
        <div class="com-list">${closed.map((x) => `<button class="com ${x.id === S.closeCom ? 'is-on' : ''}" data-cl="${x.id}"><b>${esc(x.label)}</b><span class="t">${money(x.total || 0)}</span><small>Fechada ${hhmm(x.closedAt)}</small><small style="text-align:right">${(x.payments || []).map((p) => PAY[p.method]).join(' + ')}</small></button>`).join('')}</div>` : ''}
      </aside>
      <section>${c ? closeDetail(c) : '<div class="panel empty-state"><h3>Escolha uma comanda</h3><p>Confira os itens, aplique taxa de serviço ou desconto, divida entre as pessoas e registre os pagamentos.</p></div>'}</section>
    </div>`;
  drawPix();
}
function closeDetail(c) {
  const t = comTotals(c);
  const isClosed = c.status === 'fechada';
  const items = {};
  comItems(c.id).forEach((it) => {
    const k = it.name + '§' + lineLabel(it) + '§' + it.price;
    items[k] ??= { ...it, qty: 0 };
    items[k].qty += it.qty;
  });
  const pending = comOrders(c.id).filter((o) => ['novo', 'preparo'].includes(o.status)).length;
  const people = Math.max(1, S.people);
  const remain = Math.max(0, t.remain);
  return `
  <div class="panel">
    <div class="panel__head"><h3>${esc(c.label)}</h3><span class="muted">Comanda ${c.number} · aberta às ${hhmm(c.openedAt)}${isClosed ? ` · fechada às ${hhmm(c.closedAt)}` : ''}</span><span class="grow"></span>
      <button class="btn btn--line btn--sm" id="printBtn">Imprimir conta</button></div>
    ${pending ? `<p class="chip chip--warn" style="margin-bottom:10px">${pending} envio(s) ainda na cozinha</p>` : ''}
    <div class="rows">${Object.values(items).map((it) => `<div class="row"><span class="q">${it.qty}×</span><span>${esc(it.name)}${lineLabel(it) ? `<small>${esc(lineLabel(it))}</small>` : ''}</span><span class="muted" style="font-size:13px">${money(it.price)}</span><span class="p">${money(it.price * it.qty)}</span></div>`).join('') || '<p class="muted">Sem itens.</p>'}</div>
    <div class="totals">
      <div><span>Subtotal</span><span>${money(t.sub)}</span></div>
      <div><label class="check"><input type="checkbox" id="svc" ${c.service ? 'checked' : ''} ${isClosed ? 'disabled' : ''}> Taxa de serviço (10%)</label><span>${money(t.service)}</span></div>
      <div><span>Desconto (R$)</span><input class="inline-input" id="disc" inputmode="decimal" value="${t.discount ? String(t.discount).replace('.', ',') : ''}" placeholder="0,00" ${isClosed ? 'disabled' : ''}></div>
      <div class="big"><span>Total</span><span>${money(t.total)}</span></div>
      <div><span>Dividir por <input class="inline-input" style="width:60px;text-align:center" id="people" inputmode="numeric" value="${people}"> pessoa(s)</span><b>${money(t.total / people)} cada</b></div>
    </div>
  </div>
  <div class="panel">
    <h3 style="margin-bottom:12px">Pagamentos</h3>
    ${isClosed ? '' : `
    <div class="methods" id="methods">${PAYMENTS.map((p) => `<button class="method ${S.payMethod === p.id ? 'is-on' : ''}" data-m="${p.id}">${p.name}</button>`).join('')}</div>
    <div class="pay-line">
      <label class="field"><span>Valor ${S.payMethod === 'dinheiro' ? 'a pagar' : ''}</span><input id="payAmt" inputmode="decimal" value="${remain ? (people > 1 ? Math.min(remain, Math.ceil((t.total / people) * 100) / 100) : remain).toFixed(2).replace('.', ',') : ''}"></label>
      ${S.payMethod === 'dinheiro' ? '<label class="field"><span>Recebido em dinheiro</span><input id="payGot" inputmode="decimal" placeholder="Ex.: 100,00"></label>' : ''}
      <button class="btn btn--lg" id="addPay">Registrar</button>
    </div>
    <p id="trocoTxt" class="muted" style="margin-top:6px"></p>
    ${S.payMethod === 'pix' ? (STORE.pix.key ? `<div class="pix-box"><div id="pixQr"></div><div style="flex:1"><b>Pix copia e cola</b><textarea id="pixCode" readonly></textarea><button class="btn btn--line btn--sm" id="copyPix">Copiar código</button></div></div>` : '<p class="muted" style="margin-top:8px;font-size:13px">Para mostrar o QR Code do Pix aqui, cadastre a chave Pix da loja em <code>js/config.js</code>.</p>') : ''}`}
    <ul class="pays">${(c.payments || []).map((p, i) => `<li><span>${PAY[p.method]}</span><span>${money(p.amount)}${p.change ? ` <small class="muted">(troco ${money(p.change)})</small>` : ''}</span>${isClosed ? '' : `<button class="mini-x" data-rmpay="${i}" aria-label="Remover pagamento">×</button>`}</li>`).join('')}</ul>
    <div class="remain ${t.remain <= 0.004 ? 'paid' : 'due'}"><span>${t.remain <= 0.004 ? 'Conta paga' : 'Falta pagar'}</span><span>${money(Math.max(0, t.remain))}</span></div>
    ${isClosed ? '<button class="btn btn--line btn--block" style="margin-top:12px" id="reopen">Reabrir comanda</button>' : `<button class="btn btn--ok btn--lg btn--block" style="margin-top:12px" id="closeBtn" ${t.remain > 0.004 || !t.sub ? 'disabled' : ''}>Fechar conta</button>
    ${!t.sub ? '<button class="btn btn--ghost btn--block" style="margin-top:6px" id="discardCom">Descartar comanda vazia</button>' : ''}`}
  </div>`;
}
const parseMoney = (s) => { const v = parseFloat(String(s || '').replace(/\./g, '').replace(',', '.')); return isFinite(v) ? Math.round(v * 100) / 100 : 0; };
function drawPix() {
  const box = $('#pixQr'); const c = S.comandas.find((x) => x.id === S.closeCom);
  if (!box || !c || !window.qrcode) return;
  const amt = parseMoney($('#payAmt')?.value);
  const code = pixPayload({ ...STORE.pix, amount: amt, txid: `COMANDA${c.number}` });
  const qr = window.qrcode(0, 'M'); qr.addData(code); qr.make();
  box.innerHTML = qr.createImgTag(4, 0);
  $('#pixCode').value = code;
}
document.addEventListener('click', async (e) => {
  if (S.view !== 'fechamento') return;
  const t = e.target;
  const cb = t.closest('[data-com],[data-cl]');
  if (cb) { S.closeCom = cb.dataset.com || cb.dataset.cl; S.people = 1; render(); return; }
  const c = S.comandas.find((x) => x.id === S.closeCom); if (!c) return;
  const m = t.closest('[data-m]'); if (m) { S.payMethod = m.dataset.m; render(); return; }
  if (t.closest('#addPay')) {
    const amt = parseMoney($('#payAmt').value);
    if (!amt) { $('#payAmt').focus(); return; }
    let change = 0;
    if (S.payMethod === 'dinheiro') {
      const got = parseMoney($('#payGot')?.value);
      if (got && got < amt) { toast('Valor recebido menor que o valor a pagar.', 'err'); return; }
      change = got ? Math.round((got - amt) * 100) / 100 : 0;
    }
    const payments = [...(c.payments || []), { method: S.payMethod, amount: amt, change: change || 0, at: Date.now() }];
    await S.be.updateComanda(c.id, { payments });
    if (change) toast(`Troco: ${money(change)}`);
    return;
  }
  const rp = t.closest('[data-rmpay]');
  if (rp) { const payments = [...(c.payments || [])]; payments.splice(+rp.dataset.rmpay, 1); await S.be.updateComanda(c.id, { payments }); return; }
  if (t.closest('#closeBtn')) {
    const tt = comTotals(c);
    await S.be.updateComanda(c.id, { status: 'fechada', closedAt: Date.now(), closedDay: dayKey(), subtotal: tt.sub, serviceValue: tt.service, total: tt.total, by: S.user?.name || '' });
    // itens que ainda estavam como "pronto" saem do painel
    await Promise.all(comOrders(c.id).filter((o) => o.status === 'pronto').map((o) => S.be.updateOrder(o.id, { status: 'entregue', statusAt: { ...(o.statusAt || {}), entregue: Date.now() } })));
    toast(`${c.label}: conta fechada · ${money(tt.total)}`);
    return;
  }
  if (t.closest('#reopen')) { await S.be.updateComanda(c.id, { status: 'aberta', closedAt: null, closedDay: null }); return; }
  if (t.closest('#discardCom')) { await S.be.updateComanda(c.id, { status: 'fechada', closedAt: Date.now(), closedDay: dayKey(), total: 0, discarded: true }); S.closeCom = null; return; }
  if (t.closest('#printBtn')) { printReceipt(c); return; }
  if (t.closest('#copyPix')) { navigator.clipboard?.writeText($('#pixCode').value).then(() => toast('Código Pix copiado')); }
});
document.addEventListener('change', async (e) => {
  if (S.view !== 'fechamento') return;
  const c = S.comandas.find((x) => x.id === S.closeCom); if (!c) return;
  if (e.target.id === 'svc') await S.be.updateComanda(c.id, { service: e.target.checked });
  if (e.target.id === 'disc') await S.be.updateComanda(c.id, { discount: parseMoney(e.target.value) });
  if (e.target.id === 'people') { S.people = Math.max(1, Math.min(30, parseInt(e.target.value, 10) || 1)); render(); }
});
document.addEventListener('input', (e) => {
  if (S.view !== 'fechamento') return;
  if (e.target.id === 'payAmt') drawPix();
  if (e.target.id === 'payGot' || e.target.id === 'payAmt') {
    const amt = parseMoney($('#payAmt').value), got = parseMoney($('#payGot')?.value);
    $('#trocoTxt').textContent = got > amt ? `Troco: ${money(got - amt)}` : '';
  }
});

function printReceipt(c) {
  const t = comTotals(c);
  const r = $('#receipt');
  const line = (a, b) => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${a}</span><span>${b}</span></div>`;
  r.innerHTML = `
    <div style="text-align:center"><b>DELICATESSEN SÃO JOSÉ</b><br>${esc(STORE.addressShort)}<br>${esc(STORE.phoneLabel)}</div><hr>
    <div>${esc(c.label)} · Comanda ${c.number}<br>${new Date().toLocaleString('pt-BR')}</div><hr>
    ${comItems(c.id).map((it) => line(`${it.qty}x ${esc(it.name)}${lineLabel(it) ? ` (${esc(lineLabel(it))})` : ''}`, money(it.price * it.qty))).join('')}<hr>
    ${line('Subtotal', money(t.sub))}${t.service ? line('Serviço 10%', money(t.service)) : ''}${t.discount ? line('Desconto', '-' + money(t.discount)) : ''}
    ${line('<b>TOTAL</b>', `<b>${money(t.total)}</b>`)}
    ${(c.payments || []).map((p) => line(PAY[p.method], money(p.amount))).join('')}
    <hr><div style="text-align:center">Obrigado pela preferência!<br>@${STORE.instagram}</div>`;
  r.hidden = false;
  window.print();
  setTimeout(() => { r.hidden = true; }, 500);
}
