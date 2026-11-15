/* App de corridas — cliente (passageiro e motorista). JavaScript puro, sem build. */
(() => {
  'use strict';
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const km = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
  const mins = (s) => `${Math.max(1, Math.round(s / 60))} min`;
  const stars = (r) => (r ? `★ ${r.toFixed(1).replace('.', ',')}` : 'Novo');
  const fmtPhone = (p) => (p ? p.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : '');
  const fmtDate = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const initial = (n) => esc((n || '?').trim()[0].toUpperCase());

  const S = {
    token: localStorage.getItem('token'),
    user: null, ride: null, config: { appName: 'Corridas' },
    pos: null, // última posição do GPS
    gpsError: false,
    draft: { pickup: null, dest: null, field: 'dest', quote: null, payment: 'cash', pickupAuto: true },
    online: false, offers: new Map(), declined: new Set(), summary: null,
    authView: { name: 'welcome' },
    done: null, // corrida recém-concluída aguardando avaliação / aviso final
  };
  let socket = null, map = null, layers = {}, lastFitKey = '', tickTimer = null, wakeLock = null;

  // ------------------------------------------------------------ API
  async function api(method, path, body) {
    let res;
    try {
      res = await fetch(path, {
        method,
        headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(S.token ? { Authorization: `Bearer ${S.token}` } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new Error('Sem conexão. Verifique sua internet.');
    }
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && S.user) { signOut(true); throw new Error('Sessão expirada. Entre novamente.'); }
    if (!res.ok) { const err = new Error(data.error || 'Algo deu errado. Tente novamente.'); err.status = res.status; throw err; }
    return data;
  }
  let toastTimer;
  function toast(msg, isErr) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = `toast${isErr ? ' err' : ''}`;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 4500 : 3000);
  }
  const fail = (e) => toast(e.message || String(e), true);
  async function busy(btn, fn) {
    if (btn) btn.disabled = true;
    try { return await fn(); } catch (e) { fail(e); } finally { if (btn && btn.isConnected) btn.disabled = false; }
  }

  // ------------------------------------------------------------ entrada / cadastro
  function renderAuth() {
    const v = S.authView;
    const name = esc(S.config.appName);
    let panel = '';
    if (v.name === 'welcome') {
      panel = `
        <h2 class="title">Como você quer usar?</h2>
        <div class="choice">
          <button data-action="auth-go" data-view="register" data-role="passenger"><span class="ico">🙋</span><span><b>Quero pedir corridas</b><span class="muted small">Cadastro rápido de passageiro</span></span></button>
          <button data-action="auth-go" data-view="register" data-role="driver"><span class="ico">🚗</span><span><b>Quero ser motorista</b><span class="muted small">Qualquer carro, de qualquer ano, em bom estado</span></span></button>
        </div>
        <button class="btn dark" data-action="auth-go" data-view="login">Já tenho conta — Entrar</button>`;
    } else if (v.name === 'login') {
      panel = `
        <h2 class="title">Entrar</h2>
        <form data-form="login" novalidate>
          <label class="field"><span>Celular com DDD</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 91234-5678" required></label>
          <label class="field"><span>Senha</span><input name="password" type="password" autocomplete="current-password" required></label>
          <p class="error" data-error></p>
          <button class="btn" type="submit">Entrar</button>
        </form>
        <button class="linkbtn" data-action="auth-go" data-view="welcome">Criar uma conta</button>`;
    } else {
      const drv = v.role === 'driver';
      panel = `
        <div class="tabs">
          <button class="${drv ? '' : 'on'}" data-action="auth-go" data-view="register" data-role="passenger">Passageiro</button>
          <button class="${drv ? 'on' : ''}" data-action="auth-go" data-view="register" data-role="driver">Motorista</button>
        </div>
        <form data-form="register" novalidate>
          <label class="field"><span>Nome completo</span><input name="name" autocomplete="name" maxlength="60" required></label>
          <label class="field"><span>Celular com DDD</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="(11) 91234-5678" required></label>
          <label class="field"><span>Crie uma senha (mínimo 6 caracteres)</span><input name="password" type="password" autocomplete="new-password" minlength="6" required></label>
          ${drv ? `
          <h2 class="title" style="margin-top:18px">Seu veículo</h2>
          <p class="muted small" style="margin:-8px 0 12px">Aceitamos carros de qualquer ano, desde que estejam em bom estado.</p>
          <div class="row">
            <label class="field"><span>Marca</span><input name="car_brand" placeholder="Ex.: Fiat" maxlength="30" required></label>
            <label class="field"><span>Modelo</span><input name="car_model" placeholder="Ex.: Uno" maxlength="40" required></label>
          </div>
          <div class="row">
            <label class="field"><span>Ano</span><input name="car_year" type="number" inputmode="numeric" placeholder="Ex.: 2008" required></label>
            <label class="field"><span>Cor</span><input name="car_color" placeholder="Ex.: Prata" maxlength="20" required></label>
          </div>
          <div class="row">
            <label class="field"><span>Placa</span><input name="car_plate" placeholder="ABC1D23" maxlength="8" autocapitalize="characters" required></label>
            <label class="field"><span>Nº da CNH</span><input name="cnh" inputmode="numeric" maxlength="11" required></label>
          </div>
          <label class="photo-pick">
            <img data-preview hidden alt="">
            <span><b>Foto do veículo</b><br><span class="muted small">Ajuda na aprovação do cadastro</span></span>
            <input type="file" name="photo" accept="image/*" hidden>
          </label>
          <label class="check"><input type="checkbox" name="car_ok"><span>Declaro que o veículo está em bom estado de conservação, com documentação e itens de segurança em dia.</span></label>` : ''}
          <label class="check"><input type="checkbox" name="accept_terms"><span>Li e aceito os <a href="/termos" target="_blank" rel="noopener">Termos de Uso</a> e a <a href="/privacidade" target="_blank" rel="noopener">Política de Privacidade</a>.</span></label>
          <p class="error" data-error></p>
          <button class="btn" type="submit">${drv ? 'Cadastrar como motorista' : 'Criar conta'}</button>
        </form>
        <button class="linkbtn" data-action="auth-go" data-view="login">Já tenho conta</button>`;
    }
    $('#auth').innerHTML = `
      <div class="hero">
        <div class="logo"><i>🚗</i>${name}</div>
        <h1>Sua corrida, do seu jeito.</h1>
        <p>Peça um carro em poucos toques ou dirija com o seu e ganhe por corrida.</p>
      </div>
      <div class="panel"><div class="panel-inner">${panel}</div></div>`;
  }

  function fileToJpeg(file, max = 1000) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k);
        c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.72));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Não foi possível ler a foto.')); };
      img.src = url;
    });
  }

  async function submitAuth(form) {
    const f = Object.fromEntries(new FormData(form));
    const errEl = $('[data-error]', form);
    const btn = $('button[type=submit]', form);
    errEl.textContent = '';
    btn.disabled = true;
    try {
      let out;
      if (form.dataset.form === 'login') {
        out = await api('POST', '/api/login', { phone: f.phone, password: f.password });
      } else {
        const body = { role: S.authView.role, name: f.name, phone: f.phone, password: f.password, accept_terms: form.accept_terms.checked };
        if (S.authView.role === 'driver') {
          Object.assign(body, { car_brand: f.car_brand, car_model: f.car_model, car_year: Number(f.car_year), car_color: f.car_color, car_plate: f.car_plate, cnh: f.cnh, car_ok: form.car_ok.checked });
          if (form.photo.files[0]) body.car_photo = await fileToJpeg(form.photo.files[0]);
        }
        out = await api('POST', '/api/register', body);
      }
      S.token = out.token;
      localStorage.setItem('token', S.token);
      S.user = out.user;
      await enterApp();
    } catch (e) {
      errEl.textContent = e.message;
      btn.disabled = false;
    }
  }

  function signOut(silent) {
    if (!silent && S.token) fetch('/api/logout', { method: 'POST', headers: { Authorization: `Bearer ${S.token}` } }).catch(() => {});
    localStorage.removeItem('token');
    localStorage.removeItem('drvOnline');
    S.token = null; S.user = null; S.ride = null; S.done = null; S.online = false; S.offers.clear();
    S.draft = { pickup: null, dest: null, field: 'dest', quote: null, payment: 'cash', pickupAuto: true };
    if (socket) { socket.disconnect(); socket = null; }
    releaseWake();
    closeOverlays();
    $('#main').hidden = true;
    $('#auth').hidden = false;
    S.authView = { name: 'welcome' };
    renderAuth();
  }

  // ------------------------------------------------------------ mapa
  const icon = (cls, html = '', size = 30, anchor) => L.divIcon({ className: '', html: `<div class="mk ${cls}">${html}</div>`, iconSize: [size, size], iconAnchor: anchor || [size / 2, size / 2] });
  function initMap() {
    if (map) return;
    map = L.map('map', { zoomControl: false, attributionControl: true }).setView([-14.24, -51.93], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
    layers.nearby = L.layerGroup().addTo(map);
    map.on('click', onMapClick);
  }
  function setMarker(key, latlng, ic) {
    if (!latlng) { if (layers[key]) { layers[key].remove(); layers[key] = null; } return; }
    const ll = [latlng.lat, latlng.lng];
    if (layers[key]) layers[key].setLatLng(ll);
    else layers[key] = L.marker(ll, { icon: ic, interactive: false, keyboard: false }).addTo(map);
  }
  function setRoute(path) {
    if (layers.route) { layers.route.remove(); layers.route = null; }
    if (path && path.length > 1) layers.route = L.polyline(path, { color: '#0f172a', weight: 5, opacity: 0.85 }).addTo(map);
  }
  function fit(points, key) {
    const pts = points.filter(Boolean).map((p) => [p.lat, p.lng]);
    if (!pts.length || key === lastFitKey) return;
    lastFitKey = key;
    const pad = Math.min($('#sheet').offsetHeight, window.innerHeight * 0.7) + 30;
    const wide = window.innerWidth >= 760;
    const opts = wide ? { paddingTopLeft: [460, 80], paddingBottomRight: [40, 40], maxZoom: 16 } : { paddingTopLeft: [40, 90], paddingBottomRight: [40, pad], maxZoom: 16 };
    if (pts.length === 1) map.setView(pts[0], 16);
    else map.fitBounds(pts, opts);
  }
  function updateMap() {
    if (!map) return;
    const r = S.ride, d = S.draft;
    const isDriver = S.user.role === 'driver';
    setMarker('me', S.pos, icon('mk-me', '', 18));
    if (r) {
      setMarker('a', r.pickup, icon('mk-pin a', '', 30, [15, 30]));
      setMarker('b', r.dest, icon('mk-pin b', '', 30, [15, 30]));
      setRoute(r.path);
      setMarker('car', !isDriver && r.driver ? r.driver.loc : null, icon('mk-car', '🚗', 38));
      layers.nearby.clearLayers();
      const carPos = isDriver ? S.pos : r.driver && r.driver.loc;
      if (r.status === 'accepted' || r.status === 'arrived') fit([r.pickup, carPos], `${r.id}-${r.status}-${carPos ? 1 : 0}`);
      else fit([r.pickup, r.dest], `${r.id}-${r.status}`);
    } else {
      setMarker('car', null);
      if (isDriver) { setMarker('a', null); setMarker('b', null); setRoute(null); if (S.pos) fit([S.pos], 'me'); return; }
      setMarker('a', d.pickup, icon('mk-pin a', '', 30, [15, 30]));
      setMarker('b', d.dest, icon('mk-pin b', '', 30, [15, 30]));
      setRoute(d.quote ? d.quote.path : null);
      if (d.pickup && d.dest) fit([d.pickup, d.dest], `q-${d.pickup.lat},${d.pickup.lng}-${d.dest.lat},${d.dest.lng}`);
      else if (d.pickup) fit([d.pickup], `p-${d.pickup.lat.toFixed(4)},${d.pickup.lng.toFixed(4)}`);
    }
  }
  async function onMapClick(e) {
    if (S.user.role !== 'passenger' || S.ride || S.done || S.draft.quote) return;
    const p = { lat: e.latlng.lat, lng: e.latlng.lng, addr: 'Local marcado no mapa' };
    const field = S.draft.field;
    setPlace(field, p);
    try {
      const { addr } = await api('GET', `/api/geo/reverse?lat=${p.lat}&lng=${p.lng}`);
      if (addr && S.draft[field] === p) { p.addr = addr; render(); }
    } catch { /* mantém o rótulo genérico */ }
  }

  // ------------------------------------------------------------ localização
  let lastLocSent = 0;
  function startGps() {
    if (!navigator.geolocation) { S.gpsError = true; return; }
    navigator.geolocation.watchPosition((g) => {
      const first = !S.pos;
      S.pos = { lat: g.coords.latitude, lng: g.coords.longitude };
      S.gpsError = false;
      if (first) onFirstFix();
      sendLoc(false);
      updateMap();
    }, () => { S.gpsError = true; if (!S.pos) render(); }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    setInterval(() => sendLoc(true), 20000); // mantém o motorista "vivo" mesmo parado
  }
  function sendLoc(force) {
    if (!S.user || S.user.role !== 'driver' || !S.pos || !socket || !socket.connected) return;
    if (!S.online && !S.ride) return;
    const t = Date.now();
    if (!force && t - lastLocSent < 3000) return;
    lastLocSent = t;
    socket.emit('loc', S.pos);
  }
  async function onFirstFix() {
    if (S.user.role === 'driver') {
      if (localStorage.getItem('drvOnline') === '1' && S.user.status === 'active' && !S.online) setOnline(true, true);
      render();
      return;
    }
    const d = S.draft;
    if (!S.ride && !d.pickup && d.pickupAuto) {
      const p = { ...S.pos, addr: 'Minha localização atual' };
      d.pickup = p;
      render();
      loadNearby();
      try {
        const { addr } = await api('GET', `/api/geo/reverse?lat=${p.lat}&lng=${p.lng}`);
        if (addr && S.draft.pickup === p) { p.addr = addr; render(); }
      } catch { /* ok */ }
    }
  }
  async function loadNearby() {
    if (!S.user || S.user.role !== 'passenger' || S.ride || !map) return;
    const c = S.draft.pickup || S.pos;
    if (!c) return;
    try {
      const { drivers } = await api('GET', `/api/drivers/nearby?lat=${c.lat}&lng=${c.lng}`);
      layers.nearby.clearLayers();
      if (!S.ride) drivers.forEach((p) => L.marker([p.lat, p.lng], { icon: icon('mk-car sm', '🚗', 26), interactive: false, keyboard: false }).addTo(layers.nearby));
    } catch { /* ok */ }
  }

  // ------------------------------------------------------------ passageiro: pedido
  function setPlace(field, p) {
    const d = S.draft;
    d[field] = p;
    if (field === 'pickup') d.pickupAuto = false;
    d.quote = null;
    if (d.pickup && d.dest) { d.field = 'dest'; quote(); } else { d.field = d.pickup ? 'dest' : 'pickup'; }
    render();
  }
  async function quote() {
    const d = S.draft;
    const { pickup, dest } = d;
    try {
      const qt = await api('POST', '/api/estimate', { pickup, dest });
      if (d.pickup === pickup && d.dest === dest) { d.quote = qt; render(); }
    } catch (e) {
      if (d.dest === dest) { d.dest = null; render(); }
      fail(e);
    }
  }
  let searchTimer, searchSeq = 0;
  function onSearchInput(input) {
    const field = input.dataset.field;
    S.draft.field = field;
    document.querySelectorAll('.place').forEach((el) => el.classList.toggle('on', el.dataset.field === field));
    clearTimeout(searchTimer);
    const text = input.value.trim();
    const box = $('#results');
    if (text.length < 3) { box.innerHTML = ''; return; }
    searchTimer = setTimeout(async () => {
      const seq = ++searchSeq;
      const near = S.pos || S.draft.pickup;
      try {
        const out = await api('GET', `/api/geo/search?q=${encodeURIComponent(text)}${near ? `&lat=${near.lat}&lng=${near.lng}` : ''}`);
        if (seq !== searchSeq || !box.isConnected) return;
        S.results = out.results;
        box.innerHTML = out.results.length
          ? out.results.map((r, i) => `<button data-action="pick-result" data-i="${i}" data-field="${field}">📍 ${esc(r.addr)}</button>`).join('')
          : `<p class="hint">${out.unavailable ? 'Busca indisponível no momento.' : 'Nenhum endereço encontrado.'} Toque no mapa para marcar o local.</p>`;
      } catch { /* ignora */ }
    }, 450);
  }

  // ------------------------------------------------------------ motorista
  async function setOnline(on, silent) {
    try {
      if (on) {
        if (!S.pos) throw new Error('Ative a localização (GPS) do aparelho para ficar online.');
        await api('POST', '/api/driver/online', { online: true, ...S.pos });
        S.online = true;
        localStorage.setItem('drvOnline', '1');
        keepAwake();
        primeAudio();
        loadOffers();
      } else {
        S.online = false;
        localStorage.removeItem('drvOnline');
        S.offers.clear();
        releaseWake();
        await api('POST', '/api/driver/online', { online: false });
      }
    } catch (e) {
      if (!silent) fail(e);
    }
    render();
  }
  async function loadOffers() {
    if (!S.user || S.user.role !== 'driver' || !S.online || S.ride) return;
    try {
      const { offers } = await api('GET', '/api/driver/offers');
      const before = S.offers.size;
      S.offers = new Map(offers.filter((o) => !S.declined.has(o.id)).map((o) => [o.id, o]));
      if (S.offers.size !== before) render();
    } catch { /* ok */ }
  }
  async function loadSummary() {
    if (!S.user || S.user.role !== 'driver') return;
    try { S.summary = await api('GET', '/api/driver/summary'); render(); } catch { /* ok */ }
  }
  let audioCtx;
  function primeAudio() {
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); if (audioCtx.state === 'suspended') audioCtx.resume(); } catch { /* sem áudio */ }
  }
  function alertSound() {
    if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
    if (!audioCtx) return;
    [0, 0.25, 0.5].forEach((t, i) => {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.25, audioCtx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + t + 0.2);
      o.connect(g).connect(audioCtx.destination);
      o.start(audioCtx.currentTime + t);
      o.stop(audioCtx.currentTime + t + 0.22);
    });
  }
  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch { /* ok */ }
  }
  function releaseWake() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

  // ------------------------------------------------------------ telas (painel inferior)
  const tripHtml = (r) => `<div class="trip"><div><i class="dot"></i><span>${esc(r.pickup.addr)}</span></div><div><i class="dot dest"></i><span>${esc(r.dest.addr)}</span></div></div>`;
  const payLabel = (p) => (p === 'pix' ? 'Pix' : 'Dinheiro');
  const contactHtml = (phone) => (phone ? `<div class="row"><a class="btn ghost small" href="tel:+55${esc(phone)}">📞 Ligar</a><a class="btn ghost small" href="https://wa.me/55${esc(phone)}" target="_blank" rel="noopener">💬 WhatsApp</a></div>` : '');
  const navHtml = (p) => `<div class="row"><a class="btn ghost small" href="https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=driving" target="_blank" rel="noopener">🧭 Google Maps</a><a class="btn ghost small" href="https://waze.com/ul?ll=${p.lat},${p.lng}&navigate=yes" target="_blank" rel="noopener">🧭 Waze</a></div>`;
  const starsHtml = () => `<div class="stars" id="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-action="rate" data-n="${n}" aria-label="${n} estrela${n > 1 ? 's' : ''}">★</button>`).join('')}</div>`;

  function passengerSheet() {
    const r = S.ride, d = S.draft, done = S.done;
    if (done) {
      if (done.status === 'completed') {
        return `<h2>Você chegou! 🎉</h2>
          <div class="price"><span class="muted">Total a pagar (${payLabel(done.payment)})</span><b>${money(done.fare_cents)}</b></div>
          ${done.payment === 'pix' && done.driver && done.driver.pix_key ? `<div class="pinbox"><span class="small">Chave Pix do motorista</span><b style="font-size:1.05rem;letter-spacing:0;padding:0;word-break:break-all">${esc(done.driver.pix_key)}</b><button class="btn ghost small" style="margin-top:8px" data-action="copy" data-text="${esc(done.driver.pix_key)}">Copiar chave</button></div>` : ''}
          <p class="center muted">Como foi a viagem com ${esc(done.driver ? done.driver.name.split(' ')[0] : 'o motorista')}?</p>
          ${starsHtml()}
          <button class="btn ghost" data-action="done-close">Pular</button>`;
      }
      const msg = done.status === 'expired' ? ['Nenhum motorista disponível', 'Não encontramos motoristas por perto agora. Tente novamente em instantes.']
        : done.cancelled_by === 'driver' ? ['O motorista cancelou', 'Sentimos muito. Você pode pedir outra corrida agora mesmo.']
        : ['Corrida cancelada', 'Sua corrida foi cancelada.'];
      return `<h2>${msg[0]}</h2><p class="sub">${msg[1]}</p><button class="btn" data-action="done-close" data-retry="1">Pedir de novo</button>`;
    }
    if (r) {
      const drv = r.driver;
      const drvHtml = drv ? `
        <div class="person"><div class="avatar">${initial(drv.name)}</div>
          <div class="info"><b>${esc(drv.name)}</b><span class="muted small">${stars(drv.rating)} · ${esc(drv.car_brand)} ${esc(drv.car_model)} ${esc(drv.car_year)} · ${esc(drv.car_color)}</span></div>
          <span class="plate">${esc(drv.car_plate)}</span></div>` : '';
      if (r.status === 'searching') {
        return `<div class="spinner"></div><h2 class="center">Procurando motorista…</h2>
          <p class="sub center">Avisando os motoristas por perto. <span id="countdown"></span></p>
          ${tripHtml(r)}
          <div class="price"><span class="muted">${payLabel(r.payment)}</span><b>${money(r.fare_cents)}</b></div>
          <button class="btn danger" data-action="cancel-ride">Cancelar pedido</button>`;
      }
      if (r.status === 'accepted' || r.status === 'arrived') {
        return `<span class="status-chip ${r.status === 'arrived' ? 'go' : 'warn'}">${r.status === 'arrived' ? 'Motorista no local' : 'Motorista a caminho'}</span>
          <h2>${r.status === 'arrived' ? 'Seu motorista chegou!' : 'Seu motorista está chegando'}</h2>
          ${drvHtml}
          ${drv && drv.car_photo ? `<img class="carphoto" src="${esc(drv.car_photo)}" alt="Foto do veículo">` : ''}
          <div class="pinbox"><span class="small">Diga este código ao motorista para iniciar</span><b>${esc(r.pin)}</b></div>
          <div class="stack">${contactHtml(drv && drv.phone)}
          <button class="btn danger small" data-action="cancel-ride">Cancelar corrida</button></div>`;
      }
      if (r.status === 'in_progress') {
        const text = encodeURIComponent(`Estou em uma corrida pelo ${S.config.appName} com ${drv.name}, ${drv.car_brand} ${drv.car_model} ${drv.car_color}, placa ${drv.car_plate}. Destino: ${r.dest.addr}.`);
        return `<span class="status-chip go">Em viagem</span><h2>A caminho do destino</h2>
          ${drvHtml}${tripHtml(r)}
          <div class="price"><span class="muted">${payLabel(r.payment)} · ${km(r.distance_m)}</span><b>${money(r.fare_cents)}</b></div>
          <a class="btn ghost small" href="https://wa.me/?text=${text}" target="_blank" rel="noopener">🛡️ Compartilhar viagem</a>`;
      }
    }
    if (d.pickup && d.dest) {
      const qt = d.quote;
      return `<h2>Confirme sua corrida</h2>${tripHtml(d)}
        ${qt ? `
          <div class="price"><span class="muted">${km(qt.distance_m)} · ${mins(qt.duration_s)}${qt.approx ? ' (aprox.)' : ''}</span><b>${money(qt.fare_cents)}</b></div>
          <div class="pay"><button class="${d.payment === 'cash' ? 'on' : ''}" data-action="pay" data-p="cash">💵 Dinheiro</button><button class="${d.payment === 'pix' ? 'on' : ''}" data-action="pay" data-p="pix">⚡ Pix</button></div>
          <p class="hint" style="margin-bottom:10px">${qt.drivers_nearby ? `${qt.drivers_nearby} motorista${qt.drivers_nearby > 1 ? 's' : ''} por perto` : 'Nenhum motorista online por perto agora — você pode pedir mesmo assim.'} · Pagamento direto ao motorista.</p>
          <div class="stack"><button class="btn" data-action="request-ride">Pedir corrida</button>` : '<div class="spinner"></div><p class="hint">Calculando rota e valor…</p><div class="stack">'}
        <button class="btn ghost small" data-action="edit-trip">Alterar endereços</button></div>`;
    }
    const place = (field, label, val) => `<div class="place ${d.field === field ? 'on' : ''}" data-field="${field}"><i class="dot ${field === 'dest' ? 'dest' : ''}"></i>
      <input data-field="${field}" data-search placeholder="${label}" value="${esc(val ? val.addr : '')}" autocomplete="off" enterkeyhint="search" aria-label="${label}">
      ${val ? `<button data-action="clear-place" data-field="${field}" aria-label="Limpar">✕</button>` : ''}</div>`;
    return `<h2>Para onde vamos, ${esc(S.user.name.split(' ')[0])}?</h2>
      ${place('pickup', 'Local de embarque', d.pickup)}
      ${place('dest', 'Digite o destino', d.dest)}
      <div class="results" id="results"></div>
      <p class="hint">${S.gpsError && !d.pickup ? 'Não conseguimos sua localização. Digite o embarque ou toque no mapa.' : 'Digite o endereço ou toque no mapa para marcar o local.'}</p>`;
  }

  function driverSheet() {
    const r = S.ride, done = S.done, u = S.user;
    if (done) {
      if (done.status === 'completed') {
        return `<h2>Corrida finalizada ✅</h2>
          <div class="price"><span class="muted">Receba em ${payLabel(done.payment)}</span><b>${money(done.fare_cents)}</b></div>
          ${done.payment === 'pix' && !u.pix_key ? '<p class="hint" style="margin-bottom:8px">Cadastre sua chave Pix em Menu › Minha conta para ela aparecer ao passageiro.</p>' : ''}
          <p class="center muted">Avalie ${esc(done.passenger.name.split(' ')[0])}</p>${starsHtml()}
          <button class="btn ghost" data-action="done-close">Pular</button>`;
      }
      return `<h2>O passageiro cancelou</h2><p class="sub">Você continua online para novas corridas.</p><button class="btn" data-action="done-close">Ok</button>`;
    }
    if (r) {
      const p = r.passenger;
      const who = `<div class="person"><div class="avatar">${initial(p.name)}</div><div class="info"><b>${esc(p.name)}</b><span class="muted small">${stars(p.rating)} · ${payLabel(r.payment)}</span></div><b>${money(r.fare_cents)}</b></div>`;
      if (r.status === 'accepted') {
        return `<span class="status-chip warn">Buscar passageiro</span>${who}${tripHtml(r)}
          <div class="stack">${navHtml(r.pickup)}${contactHtml(p.phone)}
          <button class="btn green" data-action="step" data-step="arrived">Cheguei ao local</button>
          <button class="btn danger small" data-action="cancel-ride">Cancelar corrida</button></div>`;
      }
      if (r.status === 'arrived') {
        return `<span class="status-chip go">No local de embarque</span>${who}
          <p class="sub">Peça ao passageiro o código de 4 dígitos para iniciar.</p>
          <input class="pin-input" id="pin" inputmode="numeric" maxlength="4" placeholder="••••" autocomplete="off" aria-label="Código do passageiro">
          <div class="stack"><button class="btn green" data-action="step" data-step="start">Iniciar corrida</button>
          ${contactHtml(p.phone)}
          <button class="btn danger small" data-action="cancel-ride">Cancelar corrida</button></div>`;
      }
      if (r.status === 'in_progress') {
        return `<span class="status-chip go">Em viagem</span>${who}${tripHtml(r)}
          <div class="stack">${navHtml(r.dest)}
          <button class="btn green" data-action="step" data-step="finish">Finalizar corrida</button></div>`;
      }
    }
    if (u.status === 'pending') {
      return `<span class="status-chip warn">Cadastro em análise</span><h2>Falta pouco, ${esc(u.name.split(' ')[0])}!</h2>
        <p class="sub">Estamos conferindo seus dados e o estado do veículo (${esc(u.car_brand)} ${esc(u.car_model)} ${esc(u.car_year)}, placa ${esc(u.car_plate)}). Assim que for aprovado, você já pode ficar online.</p>
        ${u.car_photo ? '' : '<button class="btn ghost" data-action="open-account">Enviar foto do veículo</button>'}`;
    }
    const s = S.summary;
    const kpis = s ? `<div class="kpis"><div><b>${money(s.today.fare)}</b><span>Ganhos de hoje</span></div><div><b>${s.today.n}</b><span>Corridas hoje</span></div></div>` : '';
    if (!S.online) {
      return `<h2>Você está offline</h2><p class="sub">Fique online para receber pedidos de corrida perto de você.</p>${kpis}
        <button class="btn green" data-action="go-online">Ficar online</button>
        ${S.gpsError ? '<p class="hint" style="margin-top:8px">Ative a localização (GPS) e permita o acesso para ficar online.</p>' : ''}`;
    }
    const offers = [...S.offers.values()];
    return `${offers.length ? `<h2>${offers.length > 1 ? 'Novos pedidos' : 'Novo pedido'}</h2>` : `<h2>Você está online</h2><p class="sub">Aguardando pedidos por perto… Mantenha o app aberto.</p>${kpis}`}
      ${offers.map((o) => `<div class="offer fresh">
        <div class="top"><b>${money(o.fare_cents)}</b><span class="muted small">${payLabel(o.payment)} · ${km(o.distance_m)} · ${mins(o.duration_s)}</span></div>
        <p class="small muted" style="margin-bottom:6px">${esc(o.passenger.name)} · ${stars(o.passenger.rating)}${o.to_pickup_m != null ? ` · a ${km(o.to_pickup_m)} de você` : ''}</p>
        ${tripHtml(o)}
        <div class="row"><button class="btn ghost small" data-action="decline" data-id="${o.id}">Recusar</button><button class="btn green small" data-action="accept" data-id="${o.id}">Aceitar</button></div>
      </div>`).join('')}
      <button class="btn ghost small" data-action="go-offline">Ficar offline</button>`;
  }

  function render() {
    if (!S.user) return;
    // não redesenha enquanto a pessoa digita um endereço ou o código
    const active = document.activeElement;
    const typing = active && $('#sheet').contains(active) && active.tagName === 'INPUT';
    const key = sheetKey();
    if (typing && key === render.lastKey) { updateMap(); return; }
    render.lastKey = key;
    $('#sheet').innerHTML = `<div class="sheet-inner">${S.user.role === 'driver' ? driverSheet() : passengerSheet()}</div>`;
    const pill = $('#brandPill');
    pill.textContent = S.user.role === 'driver' ? (S.online ? 'Online' : 'Offline') : S.config.appName;
    pill.classList.toggle('on', S.user.role === 'driver' && S.online);
    tick();
    requestAnimationFrame(updateMap);
  }
  function sheetKey() {
    const d = S.draft, r = S.ride;
    return [S.done && S.done.status, r && r.status, r && r.id, !!d.quote, !!(d.pickup && d.dest), S.online, S.user.status].join('|');
  }
  function tick() {
    clearInterval(tickTimer);
    const el = $('#countdown');
    if (!el || !S.ride) return;
    const upd = () => {
      const left = Math.max(0, Math.round((S.ride.created_at + S.ride.search_timeout_s * 1000 - Date.now()) / 1000));
      if (el.isConnected) el.textContent = `(${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')})`;
    };
    upd();
    tickTimer = setInterval(upd, 1000);
  }

  // ------------------------------------------------------------ atualizações de corrida
  function applyRide(r) {
    const active = ['searching', 'accepted', 'arrived', 'in_progress'].includes(r.status);
    if (active) {
      const prev = S.ride;
      S.ride = r;
      S.done = null;
      if (S.user.role === 'passenger' && prev && prev.id === r.id && prev.status !== r.status) {
        if (r.status === 'accepted') { toast('Motorista encontrado!'); if (navigator.vibrate) navigator.vibrate(200); }
        if (r.status === 'arrived') { toast('Seu motorista chegou!'); if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }
      }
    } else {
      if (S.ride && S.ride.id !== r.id) return;
      const mineCancel = r.status === 'cancelled' && r.cancelled_by === S.user.role;
      S.ride = null;
      S.done = mineCancel ? null : r;
      if (r.status === 'completed' && S.user.role === 'driver') loadSummary();
      if (S.user.role === 'driver') { S.offers.clear(); loadOffers(); }
    }
    lastFitKey = '';
    render();
  }
  function connectSocket() {
    if (socket) socket.disconnect();
    socket = io({ auth: { token: S.token }, transports: ['websocket', 'polling'] });
    socket.on('connect', async () => {
      // ao (re)conectar, sincroniza o estado com o servidor
      try {
        const me = await api('GET', '/api/me');
        S.user = me.user;
        if (me.ride) applyRide(me.ride);
        else if (S.ride) { S.ride = null; render(); }
        if (S.user.role === 'driver' && (S.online || S.ride) && S.pos && S.user.status === 'active') {
          await api('POST', '/api/driver/online', { online: true, ...S.pos }).catch(() => {});
          sendLoc(true);
          loadOffers();
        }
      } catch { /* tenta de novo na próxima conexão */ }
    });
    socket.on('connect_error', (e) => { if (e.message === 'unauthorized') signOut(true); });
    socket.on('ride:update', applyRide);
    socket.on('driver:loc', (p) => {
      if (S.ride && S.ride.id === p.ride_id && S.ride.driver) { S.ride.driver.loc = { lat: p.lat, lng: p.lng }; updateMap(); }
    });
    socket.on('offer:new', (o) => {
      if (!S.online || S.ride || S.declined.has(o.id)) return;
      S.offers.set(o.id, o);
      alertSound();
      render();
    });
    socket.on('offer:gone', ({ id }) => { if (S.offers.delete(id)) render(); });
    socket.on('account:update', async ({ status }) => {
      if (status === 'blocked') { signOut(true); toast('Sua conta foi bloqueada. Fale com o suporte.', true); return; }
      S.user.status = status;
      if (status === 'active') toast('Cadastro aprovado! Você já pode ficar online. 🎉');
      else { S.online = false; }
      render();
    });
  }

  // ------------------------------------------------------------ menu e páginas
  function closeOverlays() { $('#drawer').hidden = true; $('#page').hidden = true; }
  function openMenu() {
    const u = S.user;
    $('#drawer').innerHTML = `<nav>
      <div class="who"><div class="person" style="margin:0"><div class="avatar">${initial(u.name)}</div><div class="info"><b>${esc(u.name)}</b><span class="muted small">${u.role === 'driver' ? 'Motorista' : 'Passageiro'} · ${stars(u.rating)}</span></div></div></div>
      <button data-action="open-history">🕘 Minhas corridas</button>
      ${u.role === 'driver' ? '<button data-action="open-earnings">💰 Ganhos</button>' : ''}
      <button data-action="open-account">👤 Minha conta</button>
      ${S.config.support_whatsapp ? `<a href="https://wa.me/55${esc(S.config.support_whatsapp)}" target="_blank" rel="noopener">💬 Suporte</a>` : ''}
      <a href="/termos" target="_blank" rel="noopener">📄 Termos de Uso</a>
      <a href="/privacidade" target="_blank" rel="noopener">🔒 Privacidade</a>
      <div class="spacer"></div>
      <button data-action="logout" style="color:#b91c1c">Sair da conta</button>
    </nav>`;
    $('#drawer').hidden = false;
  }
  function openPage(title, body) {
    $('#drawer').hidden = true;
    $('#page').innerHTML = `<header><button data-action="close-page" aria-label="Voltar">‹</button><h2>${esc(title)}</h2></header><div class="body">${body}</div>`;
    $('#page').hidden = false;
    $('#page').scrollTop = 0;
  }
  const STATUS = { completed: 'Concluída', cancelled: 'Cancelada', expired: 'Sem motorista' };
  async function openHistory() {
    openPage('Minhas corridas', '<div class="spinner"></div>');
    try {
      const { rides } = await api('GET', '/api/rides/history');
      const drv = S.user.role === 'driver';
      $('#page .body').innerHTML = rides.length ? rides.map((r) => `<div class="card">
        <div class="line"><b>${fmtDate(r.created_at)}</b><b>${r.status === 'completed' ? money(r.fare_cents) : ''}</b></div>
        <p class="small muted" style="margin:2px 0 6px">${STATUS[r.status]} · ${payLabel(r.payment)} · ${km(r.distance_m)}${drv ? ` · ${esc(r.passenger.name)}` : r.driver ? ` · ${esc(r.driver.name)} (${esc(r.driver.car_plate)})` : ''}</p>
        ${tripHtml(r)}</div>`).join('') : '<p class="center muted" style="margin-top:40px">Você ainda não fez nenhuma corrida.</p>';
    } catch (e) { fail(e); }
  }
  async function openEarnings() {
    openPage('Ganhos', '<div class="spinner"></div>');
    try {
      const s = await api('GET', '/api/driver/summary');
      S.summary = s;
      $('#page .body').innerHTML = `
        <div class="kpis"><div><b>${money(s.today.fare)}</b><span>Hoje (${s.today.n} corrida${s.today.n === 1 ? '' : 's'})</span></div><div><b>${money(s.total.fare)}</b><span>Total (${s.total.n} corridas)</span></div></div>
        <div class="card"><div class="line"><span>Taxa do app a repassar</span><b>${money(s.commission_due_cents)}</b></div>
        <p class="small muted" style="margin-top:6px">Você recebe o valor da corrida direto do passageiro. A taxa do aplicativo é acertada com a administração.</p></div>`;
    } catch (e) { fail(e); }
  }
  function openAccount() {
    const u = S.user;
    const drv = u.role === 'driver';
    openPage('Minha conta', `
      <form data-form="account" novalidate>
        <label class="field"><span>Nome</span><input name="name" value="${esc(u.name)}" maxlength="60"></label>
        <label class="field"><span>Celular</span><input value="${esc(fmtPhone(u.phone))}" disabled></label>
        ${drv ? `
        <label class="field"><span>Chave Pix (mostrada ao passageiro no fim da corrida)</span><input name="pix_key" value="${esc(u.pix_key)}" maxlength="80" placeholder="CPF, celular, e-mail ou chave aleatória"></label>
        <div class="card"><b>${esc(u.car_brand)} ${esc(u.car_model)} ${esc(u.car_year)}</b><p class="small muted">${esc(u.car_color)} · placa ${esc(u.car_plate)}</p></div>
        <label class="photo-pick"><img data-preview ${u.car_photo ? `src="${esc(u.car_photo)}"` : 'hidden'} alt=""><span><b>${u.car_photo ? 'Trocar foto do veículo' : 'Enviar foto do veículo'}</b></span><input type="file" name="photo" accept="image/*" hidden></label>` : ''}
        <h2 class="title" style="margin-top:18px;font-size:1.05rem">Trocar senha (opcional)</h2>
        <label class="field"><span>Senha atual</span><input name="current_password" type="password" autocomplete="current-password"></label>
        <label class="field"><span>Nova senha</span><input name="password" type="password" autocomplete="new-password"></label>
        <p class="error" data-error></p>
        <button class="btn" type="submit">Salvar</button>
      </form>`);
  }
  async function submitAccount(form) {
    const f = Object.fromEntries(new FormData(form));
    const errEl = $('[data-error]', form), btn = $('button[type=submit]', form);
    errEl.textContent = '';
    btn.disabled = true;
    try {
      const body = { name: f.name };
      if (S.user.role === 'driver') {
        body.pix_key = f.pix_key;
        if (form.photo.files[0]) body.car_photo = await fileToJpeg(form.photo.files[0]);
      }
      if (f.password) { body.password = f.password; body.current_password = f.current_password; }
      S.user = (await api('PUT', '/api/me', body)).user;
      closeOverlays();
      toast('Dados salvos.');
      render.lastKey = '';
      render();
    } catch (e) { errEl.textContent = e.message; btn.disabled = false; }
  }

  // ------------------------------------------------------------ eventos
  const actions = {
    'auth-go': (el) => { S.authView = { name: el.dataset.view, role: el.dataset.role || 'passenger' }; renderAuth(); $('#auth').scrollTop = 0; },
    menu: openMenu,
    locate: () => { if (S.pos) map.setView([S.pos.lat, S.pos.lng], 16); else toast('Localização indisponível. Ative o GPS.', true); },
    logout: () => { if (S.ride) return toast('Finalize ou cancele a corrida antes de sair.', true); if (S.online) api('POST', '/api/driver/online', { online: false }).catch(() => {}); signOut(); },
    'close-page': closeOverlays,
    'open-history': openHistory, 'open-earnings': openEarnings, 'open-account': openAccount,
    'pick-result': (el) => { const r = S.results[Number(el.dataset.i)]; if (r) setPlace(el.dataset.field, { ...r }); },
    'clear-place': (el) => { const f = el.dataset.field; S.draft[f] = null; S.draft.quote = null; S.draft.field = f; if (f === 'pickup') S.draft.pickupAuto = false; render(); const i = $(`input[data-field=${f}]`); if (i) i.focus(); },
    'edit-trip': () => { S.draft.dest = null; S.draft.quote = null; S.draft.field = 'dest'; lastFitKey = ''; render(); },
    pay: (el) => { S.draft.payment = el.dataset.p; render.lastKey = ''; render(); },
    'request-ride': (el) => busy(el, async () => {
      const d = S.draft;
      const { ride } = await api('POST', '/api/rides', { pickup: d.pickup, dest: d.dest, payment: d.payment });
      d.dest = null; d.quote = null;
      applyRide(ride);
    }),
    'cancel-ride': (el) => {
      if (!S.ride || !confirm('Cancelar esta corrida?')) return;
      busy(el, async () => { const { ride } = await api('POST', `/api/rides/${S.ride.id}/cancel`); applyRide(ride); toast('Corrida cancelada.'); });
    },
    rate: (el) => {
      const n = Number(el.dataset.n), ride = S.done;
      document.querySelectorAll('#stars button').forEach((b, i) => b.classList.toggle('on', i < n));
      setTimeout(async () => {
        try { await api('POST', `/api/rides/${ride.id}/rate`, { stars: n }); toast('Obrigado pela avaliação!'); } catch { /* ok */ }
        if (S.done === ride) actions['done-close']();
      }, 350);
    },
    'done-close': () => { S.done = null; lastFitKey = ''; render(); if (S.user.role === 'passenger') loadNearby(); },
    copy: async (el) => { try { await navigator.clipboard.writeText(el.dataset.text); toast('Chave copiada.'); } catch { toast('Copie manualmente a chave.', true); } },
    'go-online': (el) => busy(el, () => setOnline(true)),
    'go-offline': (el) => busy(el, () => setOnline(false)),
    decline: (el) => { const id = Number(el.dataset.id); S.declined.add(id); S.offers.delete(id); render(); },
    accept: (el) => busy(el, async () => {
      const id = Number(el.dataset.id);
      try { const { ride } = await api('POST', `/api/rides/${id}/accept`); S.offers.clear(); applyRide(ride); }
      catch (e) { S.offers.delete(id); render(); throw e; }
    }),
    step: (el) => busy(el, async () => {
      const step = el.dataset.step;
      const body = step === 'start' ? { pin: $('#pin').value } : undefined;
      if (step === 'finish' && !confirm('Finalizar a corrida?')) return;
      const { ride } = await api('POST', `/api/rides/${S.ride.id}/${step}`, body);
      applyRide(ride);
    }),
  };
  document.addEventListener('click', (e) => {
    if (e.target.id === 'drawer') { $('#drawer').hidden = true; return; }
    const el = e.target.closest('[data-action]');
    if (el && actions[el.dataset.action]) { e.preventDefault(); actions[el.dataset.action](el); }
  });
  document.addEventListener('submit', (e) => {
    e.preventDefault();
    const kind = e.target.dataset.form;
    if (kind === 'login' || kind === 'register') submitAuth(e.target);
    if (kind === 'account') submitAccount(e.target);
  });
  document.addEventListener('input', (e) => { if (e.target.matches('[data-search]')) onSearchInput(e.target); });
  document.addEventListener('focusin', (e) => {
    if (!e.target.matches('[data-search]')) return;
    S.draft.field = e.target.dataset.field;
    document.querySelectorAll('.place').forEach((el) => el.classList.toggle('on', el.dataset.field === S.draft.field));
    e.target.select();
  });
  document.addEventListener('change', async (e) => {
    if (e.target.name !== 'photo' || !e.target.files[0]) return;
    const img = $('[data-preview]', e.target.closest('.photo-pick'));
    img.src = URL.createObjectURL(e.target.files[0]);
    img.hidden = false;
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !S.user) return;
    if (S.online) keepAwake();
    if (socket && !socket.connected) socket.connect();
    loadOffers();
  });

  // ------------------------------------------------------------ início
  async function enterApp() {
    $('#auth').hidden = true;
    $('#main').hidden = false;
    initMap();
    map.invalidateSize();
    render();
    connectSocket();
    if (!enterApp.started) {
      enterApp.started = true;
      startGps();
      setInterval(loadOffers, 12000);
      setInterval(loadNearby, 20000);
    } else if (S.pos) onFirstFix();
    if (S.user.role === 'driver') loadSummary();
  }
  async function boot() {
    try { S.config = await api('GET', '/api/config'); } catch { /* usa padrão */ }
    document.title = S.config.appName;
    if (S.token) {
      try {
        const me = await api('GET', '/api/me');
        if (me.user.role === 'admin') throw new Error('admin');
        S.user = me.user;
        S.ride = me.ride;
        await enterApp();
        return;
      } catch (e) {
        if (!e.status && e.message !== 'admin') {
          // sem internet: mantém a sessão e deixa tentar de novo
          $('#auth').hidden = false;
          $('#auth').innerHTML = '<div class="hero"><h1>Sem conexão</h1><p>Verifique sua internet e tente novamente.</p><br><button class="btn" onclick="location.reload()">Tentar de novo</button></div>';
          return;
        }
        localStorage.removeItem('token');
        S.token = null;
      }
    }
    $('#auth').hidden = false;
    renderAuth();
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
  boot();
})();
