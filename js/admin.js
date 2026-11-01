/* =========================================================
   Gerência (só dono ou gerente): produtos, preços e taxas de entrega.
   ========================================================= */
import { connect } from './data.js?v=3';
import { gate } from './auth-ui.js?v=3';
import { $, $$, esc, money, CATEGORIES, DEFAULT_PRODUCTS, resolveMenu, resolveDelivery, toast, charCounters } from './util.js?v=3';

charCounters();

const root = $('#root');
const S = { be: null, db: null, products: resolveMenu(null), settings: null, view: 'produtos', q: '', cat: '', editing: null, img: '' };
const unsubs = [];
const catName = (id) => CATEGORIES.find((c) => c.id === id)?.name || id;
const parseMoney = (s) => { const t = String(s ?? '').trim(); if (!t) return null; const v = parseFloat(t.replace(/\./g, '').replace(',', '.')); return isFinite(v) ? Math.round(v * 100) / 100 : null; };
const fmtIn = (v) => (v == null ? '' : Number(v).toFixed(2).replace('.', ','));
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

connect().then((be) => {
  S.be = be;
  gate(be, {
    root, title: 'Gerência', needRole: 'gerente',
    onUser(u) {
      unsubs.splice(0).forEach((f) => f?.());
      if (!u) return;
      shell();
      unsubs.push(be.onMenu((p) => { S.db = p; S.products = resolveMenu(p); render(); }));
      unsubs.push(be.onSettings((s) => { S.settings = s; if (S.view === 'entrega') render(); }));
    }
  });
});

/* O primeiro salvamento copia o cardápio padrão para o banco;
   daí em diante o site passa a ler o cardápio do painel. */
async function persist(product, remove = false) {
  if (!S.db) {
    const list = DEFAULT_PRODUCTS.map((p, i) => ({ active: true, order: i, ...p }));
    const i = list.findIndex((p) => p.id === product.id);
    if (remove) list.splice(i, 1);
    else if (i >= 0) list[i] = product; else list.push(product);
    await S.be.importMenu(list);
    return;
  }
  if (remove) await S.be.deleteProduct(product.id); else await S.be.saveProduct(product);
}

function shell() {
  root.innerHTML = `
    <div class="app">
      <header class="bar">
        <a class="brand" href="../" title="Ver o site"><b>São José</b><small>Delicatessen</small></a>
        <nav class="bar__tabs" id="tabs">
          <button class="bar__tab" data-v="produtos">Produtos e preços</button>
          <button class="bar__tab" data-v="entrega">Taxas de entrega</button>
        </nav>
        <div class="bar__right">
          ${S.be.mode === 'local' ? '<span class="mode-chip">Demonstração</span>' : ''}
          <a class="btn btn--line btn--sm" href="../equipe/">Painel da equipe</a>
          <button class="btn btn--line btn--sm" id="outBtn">Sair</button>
        </div>
      </header>
      <main class="view" id="view"></main>
    </div>`;
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { S.view = b.dataset.v; render(); } });
  $('#outBtn').addEventListener('click', () => S.be.signOut());
  render();
}
function render() {
  const view = $('#view'); if (!view) return;
  $$('#tabs [data-v]').forEach((b) => b.classList.toggle('is-on', b.dataset.v === S.view));
  const a = document.activeElement;
  const keep = a?.id && view.contains(a) ? { id: a.id, s: a.selectionStart } : null;
  (S.view === 'entrega' ? renderZones : renderProducts)(view);
  if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keep.s, keep.s); } catch { /* */ } } }
}

/* ---------- Produtos ---------- */
function renderProducts(view) {
  const q = S.q.trim().toLowerCase();
  const list = S.products.filter((p) => (!S.cat || p.cat === S.cat) && (!q || p.name.toLowerCase().includes(q)));
  view.innerHTML = `
    <div class="view-head"><h2>Produtos e preços</h2><span class="muted">${S.products.length} produtos · as mudanças aparecem no site na hora</span><span class="grow"></span>
      <button class="btn btn--blue" id="newProd">+ Novo produto</button></div>
    <div class="picker__bar">
      <label class="field"><input id="fQ" type="search" maxlength="60" placeholder="Buscar produto" value="${esc(S.q)}" autocomplete="off"></label>
      <label class="field" style="flex:0 0 220px"><select id="fCat"><option value="">Todas as categorias</option>${CATEGORIES.map((c) => `<option value="${c.id}" ${S.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
    </div>
    <div class="table-wrap"><table class="table">
      <thead><tr><th></th><th>Produto</th><th>Preço (R$)</th><th class="hide-sm">Disponível</th><th class="hide-sm">Destaque</th><th></th></tr></thead>
      <tbody>${list.map((p) => `<tr data-id="${p.id}">
        <td>${p.img ? `<img src="${p.img.startsWith('data:') || p.img.startsWith('http') ? p.img : '../' + p.img}" alt="" loading="lazy">` : `<span class="mono">${esc(p.name[0])}</span>`}</td>
        <td><b>${esc(p.name)}</b><br><small class="muted">${esc(catName(p.cat))}${p.group ? ` · ${esc(p.group)}` : ''}</small></td>
        <td>${p.sizes?.length ? `<button class="btn btn--line btn--sm" data-edit>${p.sizes.length} tamanhos · ${money(Math.min(...p.sizes.map((s) => s.p)))}+</button>` : `<input class="price-in" data-price maxlength="10" value="${fmtIn(p.price)}" inputmode="decimal" placeholder="consulta" aria-label="Preço de ${esc(p.name)}">`}</td>
        <td class="hide-sm"><label class="switch"><input type="checkbox" data-active ${p.active !== false ? 'checked' : ''} aria-label="Disponível"><span></span></label></td>
        <td class="hide-sm"><label class="switch"><input type="checkbox" data-feat ${p.featured ? 'checked' : ''} aria-label="Destaque"><span></span></label></td>
        <td style="white-space:nowrap"><button class="btn btn--line btn--sm" data-edit>Editar</button> <button class="btn btn--ghost btn--sm" data-del>Excluir</button></td>
      </tr>`).join('')}</tbody>
    </table></div>
    ${list.length ? '' : '<p class="empty-state">Nenhum produto encontrado.</p>'}
    <p style="margin-top:20px"><button class="btn btn--ghost btn--sm" id="resetMenu">Restaurar o cardápio original</button></p>`;
}
document.addEventListener('input', (e) => {
  if (e.target.id === 'fQ') { S.q = e.target.value; clearTimeout(S.t); S.t = setTimeout(render, 150); }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.id === 'fCat') { S.cat = t.value; render(); return; }
  const tr = t.closest('tr[data-id]'); if (!tr) return;
  const p = S.products.find((x) => x.id === tr.dataset.id); if (!p) return;
  try {
    if (t.matches('[data-price]')) {
      const v = parseMoney(t.value);
      await persist({ ...p, price: v });
      t.classList.add('saved'); setTimeout(() => t.classList.remove('saved'), 900);
      toast(`${p.name}: ${v == null ? 'sob consulta' : money(v)}`);
    }
    if (t.matches('[data-active]')) { await persist({ ...p, active: t.checked }); toast(`${p.name} ${t.checked ? 'disponível' : 'marcado como esgotado'}`); }
    if (t.matches('[data-feat]')) await persist({ ...p, featured: t.checked });
  } catch (err) { console.error(err); toast('Não foi possível salvar (sem permissão ou sem espaço).', 'err'); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('[data-price]')) e.target.blur(); });
document.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.closest('#newProd')) { openEditor(null); return; }
  if (t.closest('#resetMenu')) {
    if (!confirm('Voltar ao cardápio original? Produtos novos e preços alterados serão perdidos.')) return;
    await S.be.resetMenu(); toast('Cardápio original restaurado'); return;
  }
  const tr = t.closest('tr[data-id]');
  if (tr && t.closest('[data-edit]')) { openEditor(S.products.find((x) => x.id === tr.dataset.id)); return; }
  if (tr && t.closest('[data-del]')) {
    const p = S.products.find((x) => x.id === tr.dataset.id);
    if (!confirm(`Excluir "${p.name}" do cardápio?`)) return;
    await persist(p, true); toast('Produto excluído');
  }
  if (S.view === 'entrega') zonesClick(e);
});

/* ---------- Editor ---------- */
const ed = $('#edModal');
function sizeRow(s = { n: '', p: '' }) {
  return `<div><input placeholder="Tamanho (ex.: Grande)" maxlength="30" value="${esc(s.n)}" data-sn><input placeholder="Preço" inputmode="decimal" maxlength="10" value="${s.p === '' ? '' : fmtIn(s.p)}" data-sp><button type="button" class="mini-x" data-rmsize aria-label="Remover tamanho">×</button></div>`;
}
function openEditor(p) {
  S.editing = p;
  S.img = p?.img || '';
  $('#edTitle').textContent = p ? 'Editar produto' : 'Novo produto';
  $('#edCat').innerHTML = CATEGORIES.map((c) => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  $('#edName').value = p?.name || '';
  $('#edCat').value = p?.cat || S.cat || CATEGORIES[0].id;
  $('#edGroup').value = p?.group || '';
  $('#edDesc').value = p?.desc || '';
  $('#edPrice').value = p?.sizes?.length ? '' : fmtIn(p?.price);
  $('#edUnit').value = p?.unit || '';
  $('#edSizes').innerHTML = (p?.sizes || []).map(sizeRow).join('');
  $('#edOpts').value = (p?.options || []).join(', ');
  $('#edMulti').value = String(p?.multi || 0);
  $('#edActive').checked = p ? p.active !== false : true;
  $('#edFeat').checked = !!p?.featured;
  $('#edDel').hidden = !p;
  paintImg();
  ed.showModal();
}
function paintImg() {
  const src = S.img ? (S.img.startsWith('data:') || S.img.startsWith('http') ? S.img : '../' + S.img) : '';
  $('#edImgPrev').innerHTML = src ? `<img src="${src}" alt="">` : '<span class="mono">Sem foto</span>';
  $('#edImgRm').hidden = !S.img;
}
$('#edDel').addEventListener('click', async () => {
  const p = S.editing; if (!p || !confirm(`Excluir "${p.name}" do cardápio?`)) return;
  try { await persist(p, true); ed.close(); toast('Produto excluído'); } catch { toast('Não foi possível excluir.', 'err'); }
});
$('#edAddSize').addEventListener('click', () => $('#edSizes').insertAdjacentHTML('beforeend', sizeRow()));
$('#edSizes').addEventListener('click', (e) => { if (e.target.closest('[data-rmsize]')) e.target.closest('div').remove(); });
$('#edImgRm').addEventListener('click', () => { S.img = ''; paintImg(); });
$('#edFile').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  try { S.img = await shrink(f); paintImg(); } catch { toast('Não foi possível ler a imagem.', 'err'); }
  e.target.value = '';
});
/* Reduz a foto para 600px em WebP (fica leve para o site e para o banco) */
function shrink(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 600 / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      let out = c.toDataURL('image/webp', 0.72);
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.75);
      res(out);
    };
    img.onerror = rej;
    img.src = URL.createObjectURL(file);
  });
}
$('#edForm').addEventListener('submit', async (e) => {
  if (e.submitter?.value !== 'ok') return;
  e.preventDefault();
  const name = $('#edName').value.trim();
  if (!name) { $('#edName').focus(); return; }
  const sizes = $$('#edSizes > div').map((d) => ({ n: $('[data-sn]', d).value.trim(), p: parseMoney($('[data-sp]', d).value) })).filter((s) => s.n && s.p != null);
  const old = S.editing;
  let id = old?.id || slug(name) || 'produto';
  if (!old) { let n = 2; const base = id; while (S.products.some((p) => p.id === id)) id = `${base}-${n++}`; }
  const prod = {
    ...(old || {}),
    id, name, cat: $('#edCat').value, desc: $('#edDesc').value.trim(),
    price: sizes.length ? Math.min(...sizes.map((s) => s.p)) : parseMoney($('#edPrice').value),
    active: $('#edActive').checked, featured: $('#edFeat').checked,
    order: old?.order ?? (Math.max(0, ...S.products.map((p) => p.order ?? 0)) + 1)
  };
  const group = $('#edGroup').value.trim(); group ? prod.group = group : delete prod.group;
  const unit = $('#edUnit').value.trim(); unit ? prod.unit = unit : delete prod.unit;
  sizes.length ? prod.sizes = sizes : delete prod.sizes;
  const opts = $('#edOpts').value.split(',').map((s) => s.trim()).filter(Boolean);
  opts.length ? prod.options = opts : delete prod.options;
  const multi = +$('#edMulti').value; multi && opts.length ? prod.multi = multi : delete prod.multi;
  S.img ? prod.img = S.img : delete prod.img;
  try {
    await persist(prod);
    ed.close();
    toast(old ? 'Produto atualizado' : 'Produto cadastrado');
  } catch (err) { console.error(err); toast('Não foi possível salvar. A foto pode estar grande demais.', 'err'); }
});

/* ---------- Taxas de entrega ---------- */
function renderZones(view) {
  const d = resolveDelivery(S.settings);
  view.innerHTML = `
    <div class="view-head"><h2>Taxas de entrega</h2><span class="muted">bairros atendidos, valores e regras do delivery</span></div>
    <div class="panel" style="max-width:760px">
      <div class="grid2" style="grid-template-columns:repeat(3,1fr)">
        <label class="field"><span>Pedido mínimo (R$)</span><input id="zMin" inputmode="decimal" maxlength="10" value="${fmtIn(d.minOrder)}"></label>
        <label class="field"><span>Raio máximo (km)</span><input id="zRad" inputmode="decimal" maxlength="5" value="${d.radiusKm}"></label>
        <label class="field"><span>Tempo médio</span><input id="zEta" maxlength="30" value="${esc(d.eta)}"></label>
      </div>
      <div class="rows" id="zRows" style="margin-top:16px">${d.zones.map((z) => `<div class="row" style="grid-template-columns:1fr 120px 34px"><input class="price-in" style="width:100%;text-align:left" data-zn maxlength="40" value="${esc(z.name)}"><input class="price-in" data-zf maxlength="10" value="${fmtIn(z.fee)}" inputmode="decimal"><button class="mini-x" data-zrm aria-label="Remover bairro">×</button></div>`).join('')}</div>
      <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
        <button class="btn btn--line" id="zAdd">+ Bairro</button><span style="flex:1"></span>
        <button class="btn" id="zSave">Salvar taxas</button>
      </div>
    </div>`;
}
function zonesClick(e) {
  const t = e.target;
  if (t.closest('#zAdd')) { $('#zRows').insertAdjacentHTML('beforeend', '<div class="row" style="grid-template-columns:1fr 120px 34px"><input class="price-in" style="width:100%;text-align:left" data-zn maxlength="40" placeholder="Nome do bairro"><input class="price-in" data-zf inputmode="decimal" maxlength="10" placeholder="0,00"><button class="mini-x" data-zrm aria-label="Remover bairro">×</button></div>'); $('#zRows .row:last-child [data-zn]').focus(); }
  if (t.closest('[data-zrm]')) t.closest('.row').remove();
  if (t.closest('#zSave')) {
    const zones = $$('#zRows .row').map((r) => ({ name: $('[data-zn]', r).value.trim(), fee: parseMoney($('[data-zf]', r).value) ?? 0 })).filter((z) => z.name).map((z) => ({ id: slug(z.name), ...z }));
    const delivery = { zones, minOrder: parseMoney($('#zMin').value) ?? 0, radiusKm: parseFloat(String($('#zRad').value).replace(',', '.')) || 5, eta: $('#zEta').value.trim() || '35–55 min' };
    S.be.saveSettings({ delivery }).then(() => toast('Taxas de entrega salvas')).catch(() => toast('Não foi possível salvar.', 'err'));
  }
}
