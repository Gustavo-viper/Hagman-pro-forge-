/* Painel administrativo */
(() => {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (c) => (c / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = (t) => new Date(t).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  const fmtPhone = (p) => (p ? p.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3') : '');
  const STATUS = { active: 'Ativo', pending: 'Aguardando aprovação', blocked: 'Bloqueado' };
  const RIDE = { searching: 'Procurando motorista', accepted: 'Motorista a caminho', arrived: 'Motorista no local', in_progress: 'Em viagem', completed: 'Concluída', cancelled: 'Cancelada', expired: 'Sem motorista' };
  let token = sessionStorage.getItem('adminToken'), tab = 'overview', socket, liveMap = null, liveLayer = null, liveTimer = null, liveFitted = false;
  const ACTIVE = ['searching', 'accepted', 'arrived', 'in_progress'];

  async function api(method, path, body) {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: body ? JSON.stringify(body) : undefined });
    if (res.status === 401 || res.status === 403) { logout(); throw new Error('Sessão expirada.'); }
    const isJson = (res.headers.get('content-type') || '').includes('json');
    if (res.ok && !isJson) return res; // arquivos (backup, foto da CNH)
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Erro.');
    return data;
  }
  function toast(msg, err) {
    const t = $('#toast');
    t.textContent = msg; t.className = `toast${err ? ' err' : ''}`; t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => { t.hidden = true; }, 3000);
  }
  function logout() {
    sessionStorage.removeItem('adminToken'); token = null;
    if (socket) socket.disconnect();
    $('#panel').hidden = true; $('#login').hidden = false;
  }

  const views = {
    async overview() {
      const o = await api('GET', '/api/admin/overview');
      $('#pendingBadge').textContent = o.drivers_pending ? `(${o.drivers_pending})` : '';
      return `<div class="grid">
        <div><b>${o.drivers_pending}</b><span>Motoristas aguardando aprovação</span></div>
        <div><b>${o.resets_pending}</b><span>Pedidos de nova senha</span></div>
        <div><b>${o.drivers_online}</b><span>Motoristas online agora</span></div>
        <div><b>${o.rides_active}</b><span>Corridas em andamento</span></div>
        <div><b>${o.drivers}</b><span>Motoristas ativos</span></div>
        <div><b>${o.passengers}</b><span>Passageiros cadastrados</span></div>
      </div>
      <h2 class="title">Hoje</h2>
      <div class="grid"><div><b>${o.today.n}</b><span>Corridas concluídas</span></div><div><b>${money(o.today.fare)}</b><span>Valor das corridas</span></div><div><b>${money(o.today.fee)}</b><span>Sua taxa (comissão)</span></div></div>
      <h2 class="title">Total</h2>
      <div class="grid"><div><b>${o.total.n}</b><span>Corridas concluídas</span></div><div><b>${money(o.total.fare)}</b><span>Valor das corridas</span></div><div><b>${money(o.total.fee)}</b><span>Comissão gerada</span></div><div><b>${money(Math.max(0, o.total.fee - o.commission_received_cents))}</b><span>Comissão a receber dos motoristas</span></div></div>
      <div class="card"><b>Backup</b><p class="small muted" style="margin:4px 0 10px">Baixe uma cópia completa do banco de dados (cadastros e corridas). Guarde em local seguro: contém dados pessoais.</p>
      <button class="btn ghost small" style="width:auto" data-backup>⬇️ Baixar backup</button></div>`;
    },
    async drivers() {
      const { users } = await api('GET', '/api/admin/users?role=driver');
      if (!users.length) return '<p class="muted center">Nenhum motorista cadastrado ainda.</p>';
      return users.map((u) => `<div class="card u">
        ${u.car_photo ? `<a href="${esc(u.car_photo)}" target="_blank" rel="noopener"><img src="${esc(u.car_photo)}" alt="Foto do veículo"></a>` : '<img alt="" title="Sem foto">'}
        <div class="info">
          <b>${esc(u.name)}</b> <span class="tag ${u.status}">${STATUS[u.status]}</span> ${u.online ? '<span class="tag active">online</span>' : ''} ${resetTag(u)}
          <p class="small">${esc(u.car_brand)} ${esc(u.car_model)} ${esc(u.car_year)} · ${esc(u.car_color)} · placa <b>${esc(u.car_plate)}</b></p>
          <p class="small muted">${esc(fmtPhone(u.phone))} · CNH ${esc(u.cnh)} · desde ${fmtDate(u.created_at)}${u.rating ? ` · ★ ${u.rating}` : ''}</p>
          <p class="small muted">${u.rides} corridas · ${money(u.fare_cents)} em corridas · comissão a receber: <b>${money(u.commission_due_cents)}</b></p>
          <div class="acts">
            ${u.status !== 'active' ? `<button class="btn green small" data-status="active" data-id="${u.id}">${u.status === 'pending' ? 'Aprovar' : 'Desbloquear'}</button>` : ''}
            ${u.status !== 'blocked' ? `<button class="btn danger small" data-status="blocked" data-id="${u.id}">${u.status === 'pending' ? 'Recusar' : 'Bloquear'}</button>` : ''}
            ${u.commission_due_cents > 0 ? `<button class="btn ghost small" data-paid="${u.id}">Marcar comissão como recebida</button>` : ''}
            ${u.has_cnh_photo ? `<button class="btn ghost small" data-cnh="${u.id}">Ver CNH</button>` : '<span class="small muted" style="align-self:center">Sem foto da CNH</span>'}
            <button class="btn ghost small" data-reset="${u.id}">Nova senha</button>
            <a class="btn ghost small" href="https://wa.me/55${esc(u.phone)}" target="_blank" rel="noopener">WhatsApp</a>
          </div>
        </div></div>`).join('');
    },
    async passengers() {
      const { users } = await api('GET', '/api/admin/users?role=passenger');
      if (!users.length) return '<p class="muted center">Nenhum passageiro cadastrado ainda.</p>';
      return users.map((u) => `<div class="card u"><div class="info">
        <b>${esc(u.name)}</b> <span class="tag ${u.status}">${STATUS[u.status]}</span> ${resetTag(u)}
        <p class="small muted">${esc(fmtPhone(u.phone))} · ${u.rides} corridas · desde ${fmtDate(u.created_at)}${u.rating ? ` · ★ ${u.rating}` : ''}</p>
        <div class="acts">${u.status === 'blocked' ? `<button class="btn green small" data-status="active" data-id="${u.id}">Desbloquear</button>` : `<button class="btn danger small" data-status="blocked" data-id="${u.id}">Bloquear</button>`}
          <button class="btn ghost small" data-reset="${u.id}">Nova senha</button>
          <a class="btn ghost small" href="https://wa.me/55${esc(u.phone)}" target="_blank" rel="noopener">WhatsApp</a></div>
      </div></div>`).join('');
    },
    async rides() {
      const { rides } = await api('GET', '/api/admin/rides');
      if (!rides.length) return '<p class="muted center">Nenhuma corrida ainda.</p>';
      return rides.map((r) => `<div class="card">
        <div class="line"><b>#${r.id} · ${fmtDate(r.created_at)}</b><b>${money(r.fare_cents)}</b></div>
        <p class="small"><span class="tag ${r.status === 'completed' ? 'active' : ['cancelled', 'expired'].includes(r.status) ? 'blocked' : 'pending'}">${RIDE[r.status]}</span> ${r.payment === 'pix' ? 'Pix' : 'Dinheiro'} · ${(r.distance_m / 1000).toFixed(1)} km${r.commission_cents ? ` · comissão ${money(r.commission_cents)}` : ''}</p>
        <p class="small muted">Passageiro: ${esc(r.passenger.name)} (${esc(fmtPhone(r.passenger.phone))})${r.driver ? ` · Motorista: ${esc(r.driver.name)} (${esc(r.driver.car_plate)})` : ''}</p>
        <p class="small">🟢 ${esc(r.pickup.addr)}<br>🔴 ${esc(r.dest.addr)}</p>
        ${ACTIVE.includes(r.status) ? `<div class="u"><div class="acts"><button class="btn danger small" data-cancel-ride="${r.id}">Cancelar corrida</button></div></div>` : ''}</div>`).join('');
    },
    async live() {
      return `<div class="legend"><span>🚗 livre</span><span>🚕 em corrida</span><span>🟢 embarque</span><span>🔴 destino</span><span id="liveInfo"></span></div><div id="liveMap"></div>
        <p class="small muted">Atualiza a cada 10 segundos. Motoristas aparecem enquanto estão online.</p>`;
    },
    async settings() {
      const s = await api('GET', '/api/admin/settings');
      const f = (k, label, step = '0.01') => `<label class="field"><span>${label}</span><input name="${k}" type="number" step="${step}" min="0" value="${esc(s[k])}"></label>`;
      return `<form id="settingsForm" class="card">
        <h2 class="title">Preço da corrida</h2>
        <div class="set">${f('fare_base', 'Valor fixo por corrida (R$)')}${f('fare_km', 'Valor por km (R$)')}${f('fare_min', 'Valor por minuto (R$)')}${f('fare_minimum', 'Corrida mínima (R$)')}</div>
        <h2 class="title" style="margin-top:10px">Operação</h2>
        <div class="set">${f('commission_pct', 'Comissão do app (%)', '0.5')}${f('search_radius_km', 'Raio para chamar motoristas (km)', '1')}
          <label class="field"><span>Aprovação de motoristas</span><select name="driver_auto_approve"><option value="0" ${s.driver_auto_approve ? '' : 'selected'}>Manual (você aprova cada um)</option><option value="1" ${s.driver_auto_approve ? 'selected' : ''}>Automática</option></select></label>
          <label class="field"><span>WhatsApp de suporte (com DDD)</span><input name="support_whatsapp" inputmode="tel" value="${esc(s.support_whatsapp)}"></label></div>
        <button class="btn dark" type="submit">Salvar</button></form>`;
    },
  };
  function resetTag(u) { return u.reset_requested_at ? `<span class="tag reset">pediu nova senha ${fmtDate(u.reset_requested_at)}</span>` : ''; }
  async function refreshLive() {
    if (!liveMap || tab !== 'live') return;
    try {
      const { drivers, rides } = await api('GET', '/api/admin/live');
      liveLayer.clearLayers();
      const pts = [];
      const mk = (lat, lng, html, title) => { pts.push([lat, lng]); L.marker([lat, lng], { icon: L.divIcon({ className: '', html: `<div style="font-size:24px;line-height:1">${html}</div>`, iconSize: [26, 26], iconAnchor: [13, 13] }) }).bindPopup(title).addTo(liveLayer); };
      drivers.forEach((d) => mk(d.lat, d.lng, d.busy ? '🚕' : '🚗', `<b>${esc(d.name)}</b><br>${esc(d.car)} · ${esc(d.plate)}<br>${d.busy ? 'Em corrida' : 'Livre'} · visto há ${d.seen_s}s`));
      rides.forEach((r) => {
        mk(r.pickup.lat, r.pickup.lng, '🟢', `<b>Corrida #${r.id}</b> · ${esc(RIDE[r.status])}<br>${esc(r.pickup.addr)}`);
        mk(r.dest.lat, r.dest.lng, '🔴', `<b>Destino #${r.id}</b><br>${esc(r.dest.addr)}`);
        L.polyline([[r.pickup.lat, r.pickup.lng], [r.dest.lat, r.dest.lng]], { color: '#0f172a', weight: 2, dashArray: '6 6' }).addTo(liveLayer);
      });
      const info = $('#liveInfo');
      if (info) info.textContent = `${drivers.length} online · ${rides.length} corrida(s) ativa(s)`;
      if (pts.length && !liveFitted) { liveMap.fitBounds(pts, { padding: [40, 40], maxZoom: 15 }); liveFitted = true; }
    } catch (e) { toast(e.message, true); }
  }
  async function show(next) {
    if (next) tab = next;
    document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (liveMap) { liveMap.remove(); liveMap = null; clearInterval(liveTimer); }
    try { $('#content').innerHTML = await views[tab](); } catch (e) { toast(e.message, true); return; }
    if (tab === 'live') {
      liveMap = L.map('liveMap').setView([-14.24, -51.93], 4);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(liveMap);
      liveLayer = L.layerGroup().addTo(liveMap);
      liveFitted = false;
      refreshLive();
      liveTimer = setInterval(refreshLive, 10000);
    }
  }
  async function start() {
    $('#login').hidden = true; $('#panel').hidden = false;
    try { const c = await (await fetch('/api/config')).json(); $('#appName').textContent = `${c.appName} · Painel`; } catch { /* ok */ }
    await show('overview');
    socket = io({ auth: { token } });
    socket.on('admin:refresh', () => { if (tab === 'live') refreshLive(); else if (tab !== 'settings') show(); });
    setInterval(() => { if (token && tab === 'overview') show(); }, 30000);
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    $('#loginErr').textContent = '';
    try {
      const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: e.target.password.value }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      token = data.token; sessionStorage.setItem('adminToken', token);
      start();
    } catch (err) { $('#loginErr').textContent = err.message; }
  });
  $('#logout').addEventListener('click', () => { api('POST', '/api/logout').catch(() => {}); logout(); });
  $('#nav').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) show(b.dataset.tab); });
  $('#content').addEventListener('click', async (e) => {
    const s = e.target.closest('[data-status]'), p = e.target.closest('[data-paid]');
    const rs = e.target.closest('[data-reset]'), cnh = e.target.closest('[data-cnh]'), cr = e.target.closest('[data-cancel-ride]'), bk = e.target.closest('[data-backup]');
    try {
      if (rs) {
        if (!confirm('Gerar uma nova senha para este usuário? A senha atual deixa de funcionar.')) return;
        const out = await api('POST', `/api/admin/users/${rs.dataset.reset}/reset-password`);
        const msg = `Olá, ${out.name.split(' ')[0]}! Sua nova senha no app é: ${out.password}\nEntre com ela e troque em Menu › Minha conta.`;
        const box = document.createElement('div');
        box.className = 'card';
        box.innerHTML = `<b>Nova senha de ${esc(out.name)}: <span data-newpw style="font-size:1.3rem;letter-spacing:.1em">${esc(out.password)}</span></b>
          <p class="small muted" style="margin:6px 0 10px">Envie para a pessoa. Ela pode trocar depois em Minha conta.</p>
          <a class="btn green small" style="width:auto;display:inline-flex" href="https://wa.me/55${esc(out.phone)}?text=${encodeURIComponent(msg)}" target="_blank" rel="noopener">Enviar pelo WhatsApp</a>`;
        rs.closest('.card').after(box);
        rs.remove();
        return;
      }
      if (cnh) {
        const win = window.open('', '_blank'); // abre já no clique para não ser bloqueado
        try {
          const blob = await (await api('GET', `/api/admin/users/${cnh.dataset.cnh}/cnh-photo`)).blob();
          if (win) win.location.href = URL.createObjectURL(blob);
        } catch (err) { if (win) win.close(); throw err; }
        return;
      }
      if (cr) {
        if (!confirm('Cancelar esta corrida? Passageiro e motorista serão avisados.')) return;
        await api('POST', `/api/admin/rides/${cr.dataset.cancelRide}/cancel`);
        toast('Corrida cancelada.'); show();
        return;
      }
      if (bk) {
        const res = await api('GET', '/api/admin/backup');
        const name = (/filename="?([^";]+)/.exec(res.headers.get('content-disposition') || '') || [])[1] || 'backup.db';
        const a = document.createElement('a');
        a.href = URL.createObjectURL(await res.blob());
        a.download = name;
        a.click();
        return;
      }
      if (s) {
        if (s.dataset.status === 'blocked' && !confirm('Confirmar bloqueio/recusa?')) return;
        await api('POST', `/api/admin/users/${s.dataset.id}/status`, { status: s.dataset.status });
        toast('Atualizado.'); show();
      } else if (p) {
        if (!confirm('Marcar toda a comissão deste motorista como recebida?')) return;
        await api('POST', `/api/admin/users/${p.dataset.paid}/commission-paid`);
        toast('Comissão registrada.'); show();
      }
    } catch (err) { toast(err.message, true); }
  });
  $('#content').addEventListener('submit', async (e) => {
    e.preventDefault();
    try { await api('PUT', '/api/admin/settings', Object.fromEntries(new FormData(e.target))); toast('Ajustes salvos.'); } catch (err) { toast(err.message, true); }
  });

  if (token) start(); else $('#login').hidden = false;
})();
