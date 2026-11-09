// Onglet « Cartes ICOM » : tableau de disponibilité (anonyme), réservation,
// « mes réservations » et, pour les RH / SG / superAdmin, la gestion des cartes.
//
// Chargé après app.js : il en réutilise escapeHtml, readApiJson et describeApiError.
// L'API ne renvoie jamais l'identité des autres emprunteurs (voir routes/cards.js).

(function () {
  const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

  const state = { from: null, board: null, mine: [], manage: null, loaded: false };

  // ------------------------------------------------------------ dates (AAAA-MM-JJ, sans fuseau)
  const toDate = (s) => new Date(s + 'T12:00:00Z');
  const fmtDate = (d) => d.toISOString().slice(0, 10);
  const addDays = (s, n) => fmtDate(new Date(toDate(s).getTime() + n * 86400000));
  const diffDays = (a, b) => Math.round((toDate(b).getTime() - toDate(a).getTime()) / 86400000);
  const dayNum = (s) => Number(s.slice(8, 10));
  const frShort = (s) => `${s.slice(8, 10)}/${s.slice(5, 7)}`;
  const frLong = (s) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(toDate(s));
  const frMid = (s) => new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' }).format(toDate(s));
  const esc = (v) => (typeof escapeHtml === 'function' ? escapeHtml(v) : String(v));

  async function api(path, options) {
    const response = await fetch('/api/cards' + path, options);
    const data = await readApiJson(response);
    return { ok: response.ok, status: response.status, data };
  }
  const post = (path, body) => api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });

  function say(id, message, isError) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('is-error', !!isError);
    el.classList.toggle('is-ok', !isError && !!message);
  }

  // ------------------------------------------------------------ tableau
  function cellState(card, day, today) {
    if (!day.working) return { cls: 'is-closed', label: 'fermé' + (day.closedReason ? ` (${day.closedReason.toLowerCase()})` : '') };
    const busy = (card.busy || []).find((b) => b.start <= day.date && b.end >= day.date);
    if (busy) return busy.mine ? { cls: 'is-mine', label: 'ma réservation' } : { cls: 'is-busy', label: 'indisponible' };
    if (day.date < today) return { cls: 'is-past', label: 'passé' };
    return { cls: 'is-free', label: 'disponible' };
  }

  function renderBoard() {
    const host = document.getElementById('cartes-board');
    const b = state.board;
    if (!host || !b) return;

    if (b.cards.length === 0) {
      host.innerHTML = '<div class="admin-empty-state">Aucune carte n\'est encore configurée. Les RH ou le SG peuvent les ajouter.</div>';
      return;
    }

    // en-têtes : une ligne par semaine, puis une ligne de jours
    const weeks = [];
    for (let i = 0; i < b.days.length; i += 7) weeks.push(b.days.slice(i, i + 7));
    const head1 = weeks.map((w) => `<th colspan="${w.length}" class="cb-week" scope="colgroup">Semaine du ${esc(frShort(w[0].date))}</th>`).join('');
    const head2 = b.days.map((d) => {
      const isToday = d.date === b.today;
      return `<th scope="col" class="cb-day${d.working ? '' : ' is-closed'}${isToday ? ' is-today' : ''}" title="${esc(frLong(d.date))}${d.closedReason ? ' — ' + esc(d.closedReason) : ''}"><span class="cb-dow">${DAY_LETTERS[toDate(d.date).getUTCDay()]}</span><span class="cb-dom">${dayNum(d.date)}</span></th>`;
    }).join('');

    const rows = b.cards.map((card) => {
      const cells = b.days.map((d) => {
        const st = cellState(card, d, b.today);
        const isToday = d.date === b.today ? ' is-today' : '';
        const title = `${card.label}, ${frLong(d.date)} : ${st.label}`;
        if (st.cls === 'is-free') {
          return `<td class="cb-cell is-free${isToday}"><button type="button" class="cb-btn" title="${esc(title)}" aria-label="${esc(title)}" data-onclick="cartesPick('${esc(card.kind)}', '${esc(d.date)}')"></button></td>`;
        }
        return `<td class="cb-cell ${st.cls}${isToday}" title="${esc(title)}" aria-label="${esc(title)}"></td>`;
      }).join('');
      const off = card.active ? '' : ' <span class="cb-off">(désactivée)</span>';
      return `<tr><th scope="row" class="cb-card"><span class="cb-kind">${esc(card.kind)}</span> ${esc(card.label)}${off}</th>${cells}</tr>`;
    }).join('');

    host.innerHTML = `<table class="cartes-board">
      <thead><tr><th class="cb-corner" rowspan="2" scope="col">Carte</th>${head1}</tr><tr>${head2}</tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  async function loadBoard() {
    const { ok, data } = await api('/board' + (state.from ? `?from=${state.from}&weeks=4` : '?weeks=4'));
    if (!ok) {
      const host = document.getElementById('cartes-board');
      if (host) host.innerHTML = '<div class="admin-empty-state">Impossible de charger le tableau.</div>';
      return;
    }
    state.board = data;
    state.from = data.from;

    const rules = document.getElementById('cartes-rules');
    if (rules) {
      const w2 = data.rules.maxDaysExtended / 7;
      rules.textContent = `Une carte se réserve pour ${data.rules.maxDays === 7 ? 'une semaine' : data.rules.maxDays + ' jours'} au plus, ${w2} semaines en cas de départ en vacances ou en déplacement. Retrait et restitution un jour ouvré ; un rappel vous est envoyé 1 jour ouvré avant la restitution.`;
    }

    // types de carte proposés (liste fournie par le serveur)
    const kindSel = document.getElementById('cartes-kind');
    if (kindSel && kindSel.options.length === 0) {
      kindSel.innerHTML = data.kinds.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('');
    }
    renderBoard();
    const manage = document.getElementById('cartes-manage');
    if (manage) manage.style.display = data.canManage ? 'block' : 'none';
  }

  // ------------------------------------------------------------ mes réservations
  const REASON_TEXT = { vacances: 'départ en vacances', deplacement: 'déplacement' };
  const STATUS_TEXT = { active: 'En cours', returned: 'Restituée', cancelled: 'Annulée' };

  function renderMine() {
    const host = document.getElementById('cartes-mine');
    if (!host) return;
    if (state.mine.length === 0) { host.innerHTML = '<div class="cartes-empty">Aucune réservation pour le moment.</div>'; return; }
    host.innerHTML = state.mine.map((r) => {
      const actions = r.canCancel
        ? `<button type="button" class="admin-delete-btn" data-onclick="cartesCancel(${Number(r.id)})">Annuler</button>`
        : r.canReturn ? `<button type="button" class="admin-save-btn" data-onclick="cartesReturn(${Number(r.id)})">Restituer la carte</button>` : '';
      const extra = r.extended ? ` · ${esc(REASON_TEXT[r.reason] || 'durée prolongée')}` : '';
      return `<div class="cartes-res${r.status === 'active' ? '' : ' is-closed'}">
        <div class="cartes-res-main">
          <div class="cartes-res-title">${esc(r.cardLabel)} <span class="admin-badge ${r.status === 'active' ? 'status-active' : 'status-disabled'}">${esc(STATUS_TEXT[r.status] || r.status)}</span></div>
          <div class="cartes-res-meta">Du ${esc(frMid(r.startDate))} au ${esc(frMid(r.endDate))}${extra}</div>
          ${r.status === 'active' ? `<div class="cartes-res-meta">Rappel le ${esc(frMid(r.reminderDate))}</div>` : ''}
        </div>
        <div class="cartes-res-actions">${actions}</div>
      </div>`;
    }).join('');
  }

  async function loadMine() {
    const { ok, data } = await api('/mine');
    state.mine = ok && Array.isArray(data.reservations) ? data.reservations : [];
    renderMine();
  }

  // ------------------------------------------------------------ formulaire de réservation
  function formValues() {
    return {
      kind: document.getElementById('cartes-kind').value,
      startDate: document.getElementById('cartes-start').value,
      endDate: document.getElementById('cartes-end').value,
      reason: document.getElementById('cartes-reason').value,
    };
  }

  // Aide à la saisie : durée, motif exigé au-delà d'une semaine (le serveur contrôle tout)
  function updateForm() {
    const rules = state.board && state.board.rules;
    const { startDate, endDate } = formValues();
    const field = document.getElementById('cartes-reason-field');
    const hint = document.getElementById('cartes-duration');
    if (!rules || !hint) return;
    hint.textContent = '';
    hint.classList.remove('is-error');
    let needsReason = false;
    if (startDate && endDate) {
      const days = diffDays(startDate, endDate);
      if (days < 0) { hint.textContent = 'La restitution doit être après le retrait.'; hint.classList.add('is-error'); }
      else {
        needsReason = days > rules.maxDays;
        if (days > rules.maxDaysExtended) { hint.textContent = `Durée maximale : ${rules.maxDaysExtended / 7} semaines.`; hint.classList.add('is-error'); }
        else hint.textContent = `${days} jour${days > 1 ? 's' : ''} entre le retrait et la restitution` + (needsReason ? ' : durée prolongée, indiquez le motif.' : '.');
      }
    }
    if (field) field.style.display = needsReason ? 'block' : 'none';
  }

  // Clic sur un jour libre du tableau : 1er clic = retrait, 2e clic = restitution
  function pick(kind, date) {
    const kindSel = document.getElementById('cartes-kind');
    const start = document.getElementById('cartes-start');
    const end = document.getElementById('cartes-end');
    if (kindSel.value !== kind) { kindSel.value = kind; start.value = ''; end.value = ''; }
    if (!start.value || (start.value && end.value) || date < start.value) { start.value = date; end.value = ''; }
    else end.value = date;
    say('cartes-msg', '');
    updateForm();
    (end.value ? document.getElementById('cartes-submit') : end).focus({ preventScroll: true });
  }

  async function reserve() {
    const v = formValues();
    if (!v.startDate || !v.endDate) { say('cartes-msg', 'Choisissez la date de retrait et la date de restitution.', true); return; }
    const btn = document.getElementById('cartes-submit');
    btn.disabled = true;
    say('cartes-msg', 'Réservation en cours…');
    try {
      const { ok, data } = await post('/reservations', { kind: v.kind, startDate: v.startDate, endDate: v.endDate, reason: v.reason || null });
      if (!ok) { say('cartes-msg', data.error || 'Réservation impossible.', true); return; }
      const r = data.reservation;
      say('cartes-msg', `Réservé : ${r.cardLabel}, du ${frShort(r.startDate)} au ${frShort(r.endDate)}. Un rappel vous sera envoyé le ${frShort(r.reminderDate)}.`);
      document.getElementById('cartes-start').value = '';
      document.getElementById('cartes-end').value = '';
      document.getElementById('cartes-reason').value = '';
      updateForm();
      await refresh();
    } catch (err) {
      say('cartes-msg', describeApiError(err, 'Réservation impossible.'), true);
    } finally {
      btn.disabled = false;
    }
  }

  async function closeReservation(kind, id) {
    const question = kind === 'cancel' ? 'Annuler cette réservation ?' : 'Confirmer la restitution de la carte ?';
    if (!window.confirm(question)) return;
    const { ok, data } = await post(`/reservations/${Number(id)}/${kind}`);
    if (!ok) { window.alert(data.error || 'Action impossible.'); return; }
    await refresh();
  }

  // ------------------------------------------------------------ gestion RH / SG
  function renderManage() {
    const m = state.manage;
    const cardsHost = document.getElementById('cartes-manage-cards');
    const resHost = document.getElementById('cartes-manage-reservations');
    if (!m || !cardsHost || !resHost) return;

    const newKind = document.getElementById('cartes-new-kind');
    if (newKind && newKind.options.length === 0 && state.board) newKind.innerHTML = state.board.kinds.map((k) => `<option value="${esc(k)}">${esc(k)}</option>`).join('');

    cardsHost.innerHTML = m.cards.length === 0
      ? '<div class="cartes-empty">Aucune carte. Ajoutez la première ci-dessous.</div>'
      : m.cards.map((c) => `<div class="cartes-mcard${c.active ? '' : ' is-off'}">
          <div><strong>${esc(c.kind)}</strong> ${esc(c.label)} <span class="admin-badge ${c.active ? 'status-active' : 'status-disabled'}">${c.active ? 'Active' : 'Désactivée'}</span></div>
          <div class="cartes-mcard-actions">
            <button type="button" class="admin-save-btn" data-onclick="cartesToggleCard(${Number(c.id)}, ${c.active ? 'false' : 'true'})">${c.active ? 'Désactiver' : 'Réactiver'}</button>
            ${c.reservationCount === 0 ? `<button type="button" class="admin-delete-btn" data-onclick="cartesDeleteCard(${Number(c.id)})">Supprimer</button>` : ''}
          </div>
        </div>`).join('');

    resHost.innerHTML = m.reservations.length === 0
      ? '<div class="cartes-empty">Aucune réservation en cours.</div>'
      : m.reservations.map((r) => {
          const who = `${r.borrower.firstName} ${r.borrower.lastName}`.trim();
          const rem = r.reminderSentAt ? 'rappel envoyé' : `rappel prévu le ${frShort(r.reminderDate)}${r.reminderStatus && r.reminderStatus !== 'sent' ? ` (${r.reminderStatus === 'smtp_disabled' ? 'messagerie non configurée' : r.reminderStatus})` : ''}`;
          return `<div class="cartes-res">
            <div class="cartes-res-main">
              <div class="cartes-res-title">${esc(r.cardLabel)} — ${esc(who)}</div>
              <div class="cartes-res-meta">${esc(r.borrower.email)}</div>
              <div class="cartes-res-meta">Du ${esc(frShort(r.startDate))} au ${esc(frShort(r.endDate))}${r.extended ? ' · ' + esc(REASON_TEXT[r.reason] || 'prolongée') : ''} · ${esc(rem)}</div>
            </div>
            <div class="cartes-res-actions">
              ${state.board && r.startDate <= state.board.today ? `<button type="button" class="admin-save-btn" data-onclick="cartesManagerClose('return', ${Number(r.id)})">Restituée</button>` : ''}
              <button type="button" class="admin-delete-btn" data-onclick="cartesManagerClose('cancel', ${Number(r.id)})">Annuler</button>
            </div>
          </div>`;
        }).join('');
  }

  async function loadManage() {
    if (!state.board || !state.board.canManage) return;
    const { ok, data } = await api('/manage');
    if (ok) { state.manage = data; renderManage(); }
  }

  async function managerClose(kind, id) {
    const question = kind === 'cancel' ? 'Annuler cette réservation ?' : 'Enregistrer la restitution de la carte ?';
    if (!window.confirm(question)) return;
    const { ok, data } = await post(`/reservations/${Number(id)}/${kind}`);
    if (!ok) { say('cartes-manage-msg', data.error || 'Action impossible.', true); return; }
    say('cartes-manage-msg', '');
    await refresh();
  }

  async function addCard() {
    const kind = document.getElementById('cartes-new-kind').value;
    const input = document.getElementById('cartes-new-label');
    const { ok, data } = await post('/manage/cards', { kind, label: input.value });
    if (!ok) { say('cartes-manage-msg', data.error || 'Ajout impossible.', true); return; }
    input.value = '';
    say('cartes-manage-msg', `Carte « ${data.card.label} » ajoutée.`);
    await refresh();
  }

  async function toggleCard(id, active) {
    const response = await fetch(`/api/cards/manage/cards/${Number(id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !!active }) });
    const data = await readApiJson(response);
    if (!response.ok) { say('cartes-manage-msg', data.error || 'Modification impossible.', true); return; }
    say('cartes-manage-msg', '');
    await refresh();
  }

  async function deleteCard(id) {
    if (!window.confirm('Supprimer définitivement cette carte ?')) return;
    const response = await fetch(`/api/cards/manage/cards/${Number(id)}`, { method: 'DELETE' });
    const data = await readApiJson(response);
    if (!response.ok) { say('cartes-manage-msg', data.error || 'Suppression impossible.', true); return; }
    say('cartes-manage-msg', '');
    await refresh();
  }

  async function runReminders() {
    const { ok, data } = await post('/manage/reminders/run');
    if (!ok) { say('cartes-manage-msg', data.error || 'Envoi impossible.', true); return; }
    const s = data.summary;
    say('cartes-manage-msg', s.sent || s.failed || s.notConfigured
      ? `Rappels : ${s.sent} envoyé(s)${s.failed ? `, ${s.failed} en échec` : ''}${s.notConfigured ? `, ${s.notConfigured} en attente (messagerie non configurée)` : ''}.`
      : 'Aucun rappel à envoyer pour le moment.');
    await loadManage();
  }

  // ------------------------------------------------------------ cycle de vie de l'onglet
  async function refresh() {
    await loadBoard();
    await Promise.all([loadMine(), loadManage()]);
    updateForm();
  }

  async function open() {
    try {
      await refresh();
      state.loaded = true;
    } catch (err) {
      const host = document.getElementById('cartes-board');
      if (host) host.innerHTML = `<div class="admin-empty-state">${esc(describeApiError(err, 'Impossible de charger les cartes.'))}</div>`;
    }
  }

  function shiftWeeks(n) {
    if (!state.from) return;
    state.from = addDays(state.from, 7 * n);
    loadBoard();
  }
  function goToday() { state.from = null; loadBoard(); }

  // Déconnexion : plus aucune donnée de l'utilisateur précédent
  function reset() {
    state.from = null; state.board = null; state.mine = []; state.manage = null; state.loaded = false;
    ['cartes-board', 'cartes-mine', 'cartes-manage-cards', 'cartes-manage-reservations'].forEach((id) => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });
    ['cartes-start', 'cartes-end', 'cartes-reason'].forEach((id) => { const el = document.getElementById(id); if (el) el.value = ''; });
    say('cartes-msg', ''); say('cartes-manage-msg', '');
    const m = document.getElementById('cartes-manage'); if (m) m.style.display = 'none';
  }

  Object.assign(window, {
    openCartesTab: open,
    resetCartesTab: reset,
    cartesShiftWeeks: shiftWeeks,
    cartesGoToday: goToday,
    cartesPick: pick,
    cartesFormChanged: updateForm,
    cartesReserve: reserve,
    cartesCancel: (id) => closeReservation('cancel', id),
    cartesReturn: (id) => closeReservation('return', id),
    cartesManagerClose: managerClose,
    cartesAddCard: addCard,
    cartesToggleCard: toggleCard,
    cartesDeleteCard: deleteCard,
    cartesRunReminders: runReminders,
  });
})();
