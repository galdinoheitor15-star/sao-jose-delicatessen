/* =========================================================
   Camada de dados — Firebase (produção) ou modo demonstração.
   O site, o painel da equipe e o admin usam a mesma interface:
     onMenu, saveProduct, deleteProduct, importMenu, resetMenu,
     onSettings, saveSettings,
     createOrder, onOrders, updateOrder,
     onComandas, createComanda, updateComanda,
     onAuth, signIn, signOut
   ========================================================= */
import { FIREBASE_CONFIG, MANAGER_EMAILS, DEMO_PINS } from './config.js?v=3';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2';
export const dayKey = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

let backendPromise;
export function connect() {
  backendPromise ??= FIREBASE_CONFIG ? firebaseBackend(FIREBASE_CONFIG) : Promise.resolve(localBackend());
  return backendPromise;
}

/* ---------------- Modo demonstração (navegador) ---------------- */
function localBackend() {
  const K = { products: 'sj:products', settings: 'sj:settings', orders: 'sj:orders', comandas: 'sj:comandas', counter: 'sj:counter', comCounter: 'sj:comcounter' };
  const read = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const write = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { console.warn('Armazenamento cheio', e); throw e; }
    emit(k);
  };
  const subs = new Map();
  const bc = 'BroadcastChannel' in window ? new BroadcastChannel('sj-sync') : null;
  function emit(k, remote) {
    (subs.get(k) || []).forEach((fn) => fn());
    if (!remote) bc?.postMessage(k);
  }
  bc && (bc.onmessage = (e) => emit(e.data, true));
  window.addEventListener('storage', (e) => e.key && emit(e.key, true));
  const watch = (k, fn) => {
    if (!subs.has(k)) subs.set(k, []);
    subs.get(k).push(fn);
    fn();
    return () => subs.set(k, subs.get(k).filter((f) => f !== fn));
  };

  // limpa pedidos/comandas com mais de 3 dias
  const cutoff = Date.now() - 3 * 864e5;
  try {
    const o = read(K.orders, []); const fo = o.filter((x) => x.createdAt > cutoff);
    if (fo.length !== o.length) localStorage.setItem(K.orders, JSON.stringify(fo));
    const c = read(K.comandas, []); const fc = c.filter((x) => x.status === 'aberta' || x.openedAt > cutoff);
    if (fc.length !== c.length) localStorage.setItem(K.comandas, JSON.stringify(fc));
  } catch { /* sem storage */ }

  const nextNumber = (key) => {
    const c = read(key, { day: '', n: 0 });
    const n = c.day === dayKey() ? c.n + 1 : 1;
    localStorage.setItem(key, JSON.stringify({ day: dayKey(), n }));
    return n;
  };
  const patchIn = (key, id, patch) => {
    const list = read(key, []);
    const i = list.findIndex((x) => x.id === id);
    if (i < 0) return;
    list[i] = { ...list[i], ...patch };
    write(key, list);
  };

  let user = null;
  try { user = JSON.parse(sessionStorage.getItem('sj:user') || 'null'); } catch { /* */ }
  const authSubs = [];

  return {
    mode: 'local',
    onMenu(cb) { return watch(K.products, () => cb(read(K.products, null))); },
    async saveProduct(p) {
      const list = read(K.products, null);
      if (!list) throw new Error('Importe o cardápio antes de editar.');
      const i = list.findIndex((x) => x.id === p.id);
      if (i < 0) list.push(p); else list[i] = p;
      write(K.products, list);
    },
    async deleteProduct(id) { write(K.products, (read(K.products, []) || []).filter((x) => x.id !== id)); },
    async importMenu(products) { write(K.products, products); },
    async resetMenu() { localStorage.removeItem(K.products); emit(K.products); },
    onSettings(cb) { return watch(K.settings, () => cb(read(K.settings, null))); },
    async saveSettings(s) { write(K.settings, { ...read(K.settings, {}), ...s }); },

    async createOrder(order) {
      const number = nextNumber(K.counter);
      const o = { ...order, id: uid(), number, status: 'novo', createdAt: Date.now(), day: dayKey(), statusAt: { novo: Date.now() } };
      write(K.orders, [...read(K.orders, []), o]);
      return { id: o.id, number };
    },
    onOrders(cb) { return watch(K.orders, () => cb(read(K.orders, []).filter((o) => o.day === dayKey() || o.status !== 'entregue'))); },
    onOrder(id, cb) { return watch(K.orders, () => cb(read(K.orders, []).find((o) => o.id === id) || null)); },
    async updateOrder(id, patch) { patchIn(K.orders, id, patch); },

    onComandas(cb) { return watch(K.comandas, () => cb(read(K.comandas, []).filter((c) => c.status === 'aberta' || c.closedDay === dayKey()))); },
    async createComanda(c) {
      const number = nextNumber(K.comCounter);
      const doc = { payments: [], service: true, discount: 0, ...c, id: uid(), number, status: 'aberta', openedAt: Date.now() };
      write(K.comandas, [...read(K.comandas, []), doc]);
      return doc;
    },
    async updateComanda(id, patch) { patchIn(K.comandas, id, patch); },

    onAuth(cb) { authSubs.push(cb); cb(user); return () => {}; },
    async signIn(role, pin) {
      if (DEMO_PINS[role] !== pin) throw new Error('PIN incorreto.');
      user = { name: role === 'gerente' ? 'Gerente' : 'Equipe', role };
      sessionStorage.setItem('sj:user', JSON.stringify(user));
      authSubs.forEach((f) => f(user));
    },
    async signOut() { user = null; sessionStorage.removeItem('sj:user'); authSubs.forEach((f) => f(null)); }
  };
}

/* ---------------- Firebase ---------------- */
async function firebaseBackend(cfg) {
  const [{ initializeApp }, fs, au] = await Promise.all([
    import(`${FB}/firebase-app.js`), import(`${FB}/firebase-firestore.js`), import(`${FB}/firebase-auth.js`)
  ]);
  const app = initializeApp(cfg);
  const db = fs.getFirestore(app);
  const auth = au.getAuth(app);
  const { doc, collection, onSnapshot, query, where, runTransaction, setDoc, updateDoc, deleteDoc, writeBatch, getDocs } = fs;

  const counterTx = (name) => runTransaction(db, async (tx) => {
    const ref = doc(db, 'config', name);
    const c = await tx.get(ref);
    const d = c.exists() ? c.data() : { day: '', n: 0 };
    const n = d.day === dayKey() ? d.n + 1 : 1;
    tx.set(ref, { day: dayKey(), n });
    return n;
  });

  return {
    mode: 'firebase',
    onMenu(cb) {
      return onSnapshot(collection(db, 'products'), (s) => cb(s.empty ? null : s.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byOrder)), () => cb(null));
    },
    saveProduct(p) { const { id, ...rest } = p; return setDoc(doc(db, 'products', id), rest); },
    deleteProduct(id) { return deleteDoc(doc(db, 'products', id)); },
    async importMenu(products) {
      for (let i = 0; i < products.length; i += 400) {
        const b = writeBatch(db);
        products.slice(i, i + 400).forEach(({ id, ...rest }) => b.set(doc(db, 'products', id), rest));
        await b.commit();
      }
    },
    async resetMenu() {
      const s = await getDocs(collection(db, 'products'));
      for (let i = 0; i < s.docs.length; i += 400) {
        const b = writeBatch(db);
        s.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref));
        await b.commit();
      }
    },
    onSettings(cb) { return onSnapshot(doc(db, 'config', 'settings'), (s) => cb(s.exists() ? s.data() : null), () => cb(null)); },
    saveSettings(s) { return setDoc(doc(db, 'config', 'settings'), s, { merge: true }); },

    async createOrder(order) {
      const number = await counterTx('counter');
      const ref = doc(collection(db, 'orders'));
      await setDoc(ref, { ...order, number, status: 'novo', createdAt: Date.now(), day: dayKey(), statusAt: { novo: Date.now() } });
      return { id: ref.id, number };
    },
    onOrders(cb, onErr) {
      return onSnapshot(query(collection(db, 'orders'), where('day', '==', dayKey())), (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr);
    },
    onOrder(id, cb) { return onSnapshot(doc(db, 'orders', id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), () => cb(null)); },
    updateOrder(id, patch) { return updateDoc(doc(db, 'orders', id), patch); },

    onComandas(cb, onErr) {
      let open = [], closed = [];
      const emit = () => cb([...open, ...closed]);
      const u1 = onSnapshot(query(collection(db, 'comandas'), where('status', '==', 'aberta')), (s) => { open = s.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); }, onErr);
      const u2 = onSnapshot(query(collection(db, 'comandas'), where('closedDay', '==', dayKey())), (s) => { closed = s.docs.map((d) => ({ id: d.id, ...d.data() })); emit(); }, onErr);
      return () => { u1(); u2(); };
    },
    async createComanda(c) {
      const number = await counterTx('comcounter');
      const ref = doc(collection(db, 'comandas'));
      const data = { payments: [], service: true, discount: 0, ...c, number, status: 'aberta', openedAt: Date.now() };
      await setDoc(ref, data);
      return { id: ref.id, ...data };
    },
    updateComanda(id, patch) { return updateDoc(doc(db, 'comandas', id), patch); },

    onAuth(cb) {
      return au.onAuthStateChanged(auth, (u) => cb(u ? { name: u.email, email: u.email, role: MANAGER_EMAILS.includes(u.email) ? 'gerente' : 'equipe' } : null));
    },
    signIn(email, pw) { return au.signInWithEmailAndPassword(auth, email, pw); },
    signOut() { return au.signOut(auth); }
  };
}
