/* =========================================================
   Bolo 3D do topo — Three.js, geometria procedural (sem modelos externos).
   Monta camada por camada na entrada, gira devagar, segue o mouse
   e reage à rolagem. Só renderiza quando está na tela.
   ========================================================= */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function mountCake(canvas, stage) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile = matchMedia('(max-width: 900px)').matches || navigator.maxTouchPoints > 1;
  const SEG = mobile ? 48 : 96;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, alpha: true, powerPreference: 'high-performance' });
  let dprCap = mobile ? 1.5 : 2;
  renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 2.9, 9);
  camera.lookAt(0, 1.25, 0);

  const key = new THREE.DirectionalLight(0xfff1dd, 1.6);
  key.position.set(3, 6, 4);
  scene.add(key, new THREE.HemisphereLight(0xeaf2ff, 0xd8c3a5, 0.55));

  /* ---------- Materiais ---------- */
  const M = {
    porcelain: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.12 }),
    cream: new THREE.MeshStandardMaterial({ color: 0xf6ecdc, roughness: 0.55 }),
    creamDark: new THREE.MeshStandardMaterial({ color: 0xefe1ca, roughness: 0.6 }),
    ribbon: new THREE.MeshPhysicalMaterial({ color: 0x0a6aab, roughness: 0.35, sheen: 1, sheenColor: new THREE.Color(0x6fb6ea), sheenRoughness: 0.4 }),
    navy: new THREE.MeshStandardMaterial({ color: 0x1b2238, roughness: 0.4 }),
    choco: new THREE.MeshPhysicalMaterial({ color: 0x3a1f14, roughness: 0.22, clearcoat: 0.8, clearcoatRoughness: 0.2 }),
    berry: new THREE.MeshPhysicalMaterial({ color: 0xc0182a, roughness: 0.3, clearcoat: 0.6 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.6 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd6a85c, metalness: 0.9, roughness: 0.3 })
  };

  const root = new THREE.Group();
  scene.add(root);
  const parts = []; // { obj, delay, from } para a animação de montagem

  /* ---------- Prato com pé ---------- */
  const stand = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.62, 0.09, SEG), M.porcelain);
  plate.position.y = 0.5;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1.72, 0.035, 10, SEG), M.porcelain);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.55;
  const stem = new THREE.Mesh(new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0), new THREE.Vector2(0.75, 0), new THREE.Vector2(0.72, 0.05), new THREE.Vector2(0.3, 0.16),
    new THREE.Vector2(0.18, 0.3), new THREE.Vector2(0.17, 0.42), new THREE.Vector2(0.4, 0.47), new THREE.Vector2(0, 0.47)
  ], SEG / 2), M.porcelain);
  stand.add(plate, rim, stem);
  root.add(stand);
  parts.push({ obj: stand, delay: 0, dy: -0.6, scale: 0.85 });

  /* ---------- Andar de baixo, com fita azul da marca ---------- */
  const tier1 = new THREE.Group();
  const t1 = new THREE.Mesh(new THREE.CylinderGeometry(1.28, 1.28, 0.95, SEG), M.cream);
  t1.position.y = 0.55 + 0.475;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(1.295, 1.295, 0.22, SEG, 1, true), M.ribbon);
  band.position.y = 0.55 + 0.2;
  const bow = new THREE.Group();
  const loopGeo = new THREE.TorusGeometry(0.13, 0.045, 10, 24);
  const l1 = new THREE.Mesh(loopGeo, M.ribbon); l1.position.x = -0.12; l1.scale.set(1.2, 0.8, 0.5);
  const l2 = l1.clone(); l2.position.x = 0.12;
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), M.ribbon);
  bow.add(l1, l2, knot);
  bow.position.set(0, 0.55 + 0.2, 1.31);
  // pérolas na base
  const pearlGeo = new THREE.SphereGeometry(0.055, 12, 8);
  const pearls = new THREE.InstancedMesh(pearlGeo, M.porcelain, 64);
  const tmp = new THREE.Object3D();
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    tmp.position.set(Math.cos(a) * 1.3, 0.6, Math.sin(a) * 1.3);
    tmp.updateMatrix(); pearls.setMatrixAt(i, tmp.matrix);
  }
  tier1.add(t1, band, bow, pearls);
  root.add(tier1);
  parts.push({ obj: tier1, delay: 0.18, dy: 2.2 });

  /* ---------- Andar de cima com calda de chocolate escorrendo ---------- */
  const tier2 = new THREE.Group();
  const base2 = 0.55 + 0.95;
  const t2 = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 0.86, 0.72, SEG), M.creamDark);
  t2.position.y = base2 + 0.36;
  // tampa de chocolate
  const capTop = base2 + 0.72;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.885, 0.885, 0.06, SEG), M.choco);
  cap.position.y = capTop + 0.01;
  // gotas: cilindro aberto com a borda de baixo deslocada por ruído angular
  const dripGeo = new THREE.CylinderGeometry(0.875, 0.875, 0.5, SEG * 2, 6, true);
  const pos = dripGeo.attributes.position;
  const v = new THREE.Vector3();
  const dripLen = (a) => {
    const s = Math.sin(a * 7) * 0.5 + Math.sin(a * 13 + 1.3) * 0.3 + Math.sin(a * 23 + 0.4) * 0.2;
    return 0.06 + Math.max(0, s) * 0.42;
  };
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x);
    const t = (0.25 - v.y) / 0.5; // 0 no topo, 1 embaixo
    const y = -t * dripLen(a);
    const bulge = Math.sin(Math.min(1, t) * Math.PI) * 0.012;
    pos.setXYZ(i, v.x * (1 + bulge), y, v.z * (1 + bulge));
  }
  dripGeo.computeVertexNormals();
  const drip = new THREE.Mesh(dripGeo, M.choco);
  drip.position.y = capTop + 0.01;
  drip.scale.y = 0.001;
  tier2.add(t2, cap, drip);
  root.add(tier2);
  parts.push({ obj: tier2, delay: 0.36, dy: 2.4 });

  /* ---------- Morangos e folhinhas ---------- */
  const berryGeo = new THREE.LatheGeometry([
    new THREE.Vector2(0, -0.2), new THREE.Vector2(0.06, -0.17), new THREE.Vector2(0.11, -0.08), new THREE.Vector2(0.135, 0.02),
    new THREE.Vector2(0.13, 0.09), new THREE.Vector2(0.09, 0.14), new THREE.Vector2(0, 0.15)
  ], 18);
  const seedGeo = new THREE.SphereGeometry(0.008, 4, 3);
  const leafGeo = new THREE.ConeGeometry(0.035, 0.12, 4);
  const toppers = new THREE.Group();
  const berrySpots = [[0, 0, 0, 0.3], [0.38, 0.06, 0.6], [-0.36, -0.2, -0.5], [0.05, 0.4, 2.2], [-0.12, -0.42, 1.2]];
  const berries = [];
  berrySpots.forEach(([x, z, rot], i) => {
    const g = new THREE.Group();
    const b = new THREE.Mesh(berryGeo, M.berry);
    b.rotation.z = Math.PI; // ponta para cima
    g.add(b);
    const seeds = new THREE.InstancedMesh(seedGeo, M.gold, 18);
    for (let s = 0; s < 18; s++) {
      const a = s * 2.4, h = -0.1 + (s % 6) * 0.04;
      const r = 0.12 - Math.abs(h) * 0.25;
      tmp.position.set(Math.cos(a) * r, -h, Math.sin(a) * r);
      tmp.updateMatrix(); seeds.setMatrixAt(s, tmp.matrix);
    }
    g.add(seeds);
    for (let k = 0; k < 5; k++) {
      const lf = new THREE.Mesh(leafGeo, M.leaf);
      const a = (k / 5) * Math.PI * 2;
      lf.position.set(Math.cos(a) * 0.06, -0.15, Math.sin(a) * 0.06);
      lf.rotation.set(Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9);
      g.add(lf);
    }
    const s = i === 0 ? 1.35 : 1;
    g.scale.setScalar(s);
    g.position.set(x, capTop + 0.17 * s, z);
    g.rotation.set(i ? 0.5 : 0, rot, i ? 0.35 : 0);
    toppers.add(g);
    berries.push(g);
    parts.push({ obj: g, delay: 0.75 + i * 0.09, dy: 1.6, spin: true });
  });
  // plaquinha "SJ" em chocolate
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 32), M.navy);
  tag.rotation.set(Math.PI / 2 - 0.35, 0, 0);
  tag.position.set(0.32, capTop + 0.2, 0.5);
  toppers.add(tag);
  parts.push({ obj: tag, delay: 1.2, dy: 1.2 });
  root.add(toppers);

  /* ---------- Confeitos flutuando ao redor ---------- */
  const N = mobile ? 40 : 90;
  const sprGeo = new THREE.CapsuleGeometry(0.018, 0.07, 3, 6);
  const palette = [0x0a6aab, 0xf3d9b8, 0xc0182a, 0xffffff, 0xd6a85c];
  const sprinkles = new THREE.InstancedMesh(sprGeo, new THREE.MeshStandardMaterial({ roughness: 0.4 }), N);
  const seeds = [];
  const col = new THREE.Color();
  for (let i = 0; i < N; i++) {
    seeds.push({ r: 1.9 + Math.random() * 1.4, a: Math.random() * Math.PI * 2, y: 0.3 + Math.random() * 2.6, s: 0.15 + Math.random() * 0.35, rx: Math.random() * 6, ry: Math.random() * 6 });
    sprinkles.setColorAt(i, col.setHex(palette[i % palette.length]));
  }
  scene.add(sprinkles);

  /* ---------- Sombra de contato (textura radial, sem shadow map) ---------- */
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d');
  const grad = sg.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(27,34,56,0.38)'); grad.addColorStop(1, 'rgba(27,34,56,0)');
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002;
  scene.add(shadow);

  /* ---------- Tamanho ---------- */
  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  /* ---------- Interação ---------- */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!mobile) {
    addEventListener('pointermove', (e) => {
      pointer.tx = (e.clientX / innerWidth - 0.5) * 2;
      pointer.ty = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }
  let scrollK = 0;
  const hero = stage.closest('.hero');
  addEventListener('scroll', () => { scrollK = Math.min(1, Math.max(0, scrollY / (hero.offsetHeight || 1))); }, { passive: true });

  // arrastar para girar (dedo ou mouse)
  let spinVel = 0, dragX = null;
  canvas.addEventListener('pointerdown', (e) => { dragX = e.clientX; });
  addEventListener('pointerup', () => { dragX = null; });
  canvas.addEventListener('pointermove', (e) => {
    if (dragX == null || e.pointerType === 'touch') return;
    spinVel += (e.clientX - dragX) * 0.004; dragX = e.clientX;
  });

  /* ---------- Loop ---------- */
  const easeOutBack = (t) => { const c1 = 1.5, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const t0 = performance.now();
  const INTRO = reduced ? 0 : 1.9;
  parts.forEach((p) => { p.base = p.obj.position.clone(); p.baseScale = p.obj.scale.clone(); p.baseRot = p.obj.rotation.y; });

  let visible = true, raf = 0, last = performance.now(), slow = 0, frames = 0, angle = -0.5;
  function frame(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = (now - t0) / 1000;

    // montagem
    parts.forEach((p) => {
      const k = INTRO ? clamp01((t - p.delay) / 0.9) : 1;
      const e = easeOutBack(k);
      p.obj.position.y = p.base.y + (1 - e) * p.dy;
      const s = p.scale ? p.scale + (1 - p.scale) * e : 1;
      p.obj.scale.set(p.baseScale.x * s, p.baseScale.y * s, p.baseScale.z * s);
      p.obj.visible = k > 0;
      if (p.spin) p.obj.rotation.y = p.baseRot + (1 - e) * 3;
    });
    drip.scale.y = INTRO ? Math.max(0.001, easeOutBack(clamp01((t - 0.95) / 1.1))) : 1;

    // giro + mouse + rolagem
    pointer.x += (pointer.tx - pointer.x) * 0.06;
    pointer.y += (pointer.ty - pointer.y) * 0.06;
    spinVel *= 0.94;
    angle += (reduced ? 0 : 0.18 * dt) + spinVel;
    root.rotation.y = angle + pointer.x * 0.35 + scrollK * 1.4;
    root.rotation.x = pointer.y * 0.08 + scrollK * 0.15;
    root.position.y = -scrollK * 0.6;
    berries.forEach((b, i) => { b.position.y += Math.sin(t * 1.6 + i) * 0.0006; });

    // confeitos orbitando
    for (let i = 0; i < N; i++) {
      const s = seeds[i];
      const a = s.a + t * s.s * (reduced ? 0 : 0.35);
      tmp.position.set(Math.cos(a) * s.r, s.y + Math.sin(t * s.s + i) * 0.12 - scrollK * 0.8, Math.sin(a) * s.r);
      tmp.rotation.set(s.rx + t * s.s, s.ry + t * 0.4, 0);
      const appear = INTRO ? clamp01((t - 1.1 - (i % 10) * 0.05) / 0.6) : 1;
      tmp.scale.setScalar(appear);
      tmp.updateMatrix();
      sprinkles.setMatrixAt(i, tmp.matrix);
    }
    sprinkles.instanceMatrix.needsUpdate = true;

    renderer.render(scene, camera);

    // qualidade adaptativa: se o aparelho sofrer, baixa a resolução
    frames++;
    if (dt > 1 / 40) slow++;
    if (frames === 90) {
      if (slow > 45 && dprCap > 1) { dprCap = Math.max(1, dprCap - 0.5); renderer.setPixelRatio(Math.min(devicePixelRatio, dprCap)); resize(); }
      frames = 0; slow = 0;
    }
    if (visible && !document.hidden) raf = requestAnimationFrame(frame);
  }
  const kick = () => { if (!raf && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }, { threshold: 0 }).observe(stage);
  document.addEventListener('visibilitychange', kick);
  renderer.compile(scene, camera);
  raf = requestAnimationFrame(frame);
  requestAnimationFrame(() => stage.classList.add('is-ready'));
}
