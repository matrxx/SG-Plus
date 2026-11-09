// Réservation des cartes ICOM / ICOMOS.
//
//  Tout compte connecté peut consulter le tableau et réserver.
//  Les rôles RH, SG et superAdmin gèrent les cartes (/manage/...).
//
//  ANONYMAT : le tableau (GET /board) ne contient JAMAIS l'identité de l'emprunteur,
//  ni son identifiant : une réservation d'un autre agent apparaît seulement comme
//  « indisponible ». Seules les réservations de l'utilisateur connecté sont marquées
//  « mine ». L'identité n'est visible que dans l'écran de gestion RH / SG.

const express = require('express');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { KINDS, REASONS, rules, validatePeriod, reminderDateFor } = require('../lib/cards');
const { runReminders } = require('../lib/cardReminders');
const { parseDate, addDays, closedReason, mondayOf, todayParis } = require('../lib/workdays');

const router = express.Router();
router.use(requireAuth);

const MANAGER_ROLES = ['rh', 'sg', 'superAdmin'];
const requireManager = requireRole(...MANAGER_ROLES);
const isManager = (req) => MANAGER_ROLES.includes(req.session.userRole);

const FAIL = { error: 'Une erreur est survenue, veuillez réessayer.' };
const D = (col) => `to_char(${col}, 'YYYY-MM-DD')`;

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function present(row) {
  return {
    id: row.id,
    kind: row.kind,
    cardLabel: row.label,
    startDate: row.start_date,
    endDate: row.end_date,
    extended: row.extended,
    reason: row.reason,
    status: row.status,
    reminderDate: row.reminder_date,
  };
}

// ---------------------------------------------------------------
// GET /api/cards/board?from=AAAA-MM-JJ&weeks=4 — tableau de disponibilité (anonyme)
// ---------------------------------------------------------------
router.get('/board', async (req, res) => {
  try {
    const today = todayParis();
    const r = rules();

    // Fenêtre : semaines entières (du lundi), de la semaine précédente à 6 mois
    const earliest = mondayOf(addDays(today, -7));
    const latest = mondayOf(addDays(today, r.maxAheadDays));
    let from = parseDate(req.query.from) ? mondayOf(req.query.from) : mondayOf(today);
    if (from < earliest) from = earliest;
    if (from > latest) from = latest;
    const weeks = Math.min(8, Math.max(1, Number.parseInt(req.query.weeks, 10) || 4));
    const to = addDays(from, weeks * 7 - 1);

    const days = [];
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const closed = closedReason(d);
      days.push({ date: d, working: closed === null, closedReason: closed });
    }

    const manager = isManager(req);
    const cards = (await pool.query(
      `SELECT id, kind, label, active FROM cards ${manager ? '' : 'WHERE active'} ORDER BY kind, id`
    )).rows;

    // user_id sert UNIQUEMENT à calculer « mine » : il n'est jamais renvoyé.
    const busy = (await pool.query(
      `SELECT id, card_id, user_id, ${D('start_date')} AS start_date, ${D('end_date')} AS end_date
         FROM card_reservations
        WHERE status = 'active' AND start_date <= $2::date AND end_date >= $1::date
        ORDER BY start_date`,
      [from, to]
    )).rows;

    const byCard = new Map();
    for (const b of busy) {
      const mine = b.user_id === req.session.userId;
      const entry = { start: b.start_date, end: b.end_date, mine };
      if (mine) entry.reservationId = b.id;
      if (!byCard.has(b.card_id)) byCard.set(b.card_id, []);
      byCard.get(b.card_id).push(entry);
    }

    return res.json({
      today,
      from,
      to,
      days,
      rules: { maxDays: r.maxDays, maxDaysExtended: r.maxDaysExtended, maxAheadDays: r.maxAheadDays },
      kinds: KINDS,
      canManage: manager,
      cards: cards.map((c) => ({ id: c.id, kind: c.kind, label: c.label, active: c.active, busy: byCard.get(c.id) || [] })),
    });
  } catch (err) {
    console.error('[cartes/board] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// ---------------------------------------------------------------
// GET /api/cards/mine — mes réservations
// ---------------------------------------------------------------
router.get('/mine', async (req, res) => {
  try {
    const today = todayParis();
    const { rows } = await pool.query(
      `SELECT r.id, c.kind, c.label, ${D('r.start_date')} AS start_date, ${D('r.end_date')} AS end_date,
              r.extended, r.reason, r.status, ${D('r.reminder_date')} AS reminder_date
         FROM card_reservations r JOIN cards c ON c.id = r.card_id
        WHERE r.user_id = $1
        ORDER BY (r.status = 'active') DESC, r.start_date DESC, r.id DESC
        LIMIT 30`,
      [req.session.userId]
    );
    return res.json({
      reservations: rows.map((row) => ({
        ...present(row),
        canCancel: row.status === 'active' && row.start_date > today,
        canReturn: row.status === 'active' && row.start_date <= today,
      })),
    });
  } catch (err) {
    console.error('[cartes/mine] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// ---------------------------------------------------------------
// POST /api/cards/reservations — réserver une carte (la première disponible du type)
// ---------------------------------------------------------------
router.post('/reservations', async (req, res) => {
  const body = req.body || {};
  const kind = String(body.kind || '').toUpperCase();
  const startDate = String(body.startDate || '');
  const endDate = String(body.endDate || '');
  const reason = body.reason ? String(body.reason) : null;

  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Type de carte invalide (ICOM ou ICOMOS).' });
  if (reason && !REASONS.includes(reason)) return res.status(400).json({ error: 'Motif invalide.' });

  const check = validatePeriod({ startDate, endDate, reason }, todayParis());
  if (check.error) return res.status(400).json({ error: check.error });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verrouille les cartes du type : deux réservations simultanées ne peuvent pas
    // obtenir la même carte (la seconde attend, puis voit la première).
    const cards = (await client.query(
      'SELECT id, label FROM cards WHERE kind = $1 AND active ORDER BY id FOR UPDATE',
      [kind]
    )).rows;
    if (cards.length === 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Aucune carte ${kind} n'est disponible à la réservation pour le moment.` });
    }

    const mineOverlap = await client.query(
      `SELECT 1 FROM card_reservations r JOIN cards c ON c.id = r.card_id
        WHERE r.user_id = $1 AND c.kind = $2 AND r.status = 'active'
          AND r.start_date <= $4::date AND r.end_date >= $3::date LIMIT 1`,
      [req.session.userId, kind, startDate, endDate]
    );
    if (mineOverlap.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Vous avez déjà une réservation de carte ${kind} qui chevauche cette période.` });
    }

    let chosen = null;
    for (const card of cards) {
      const taken = await client.query(
        `SELECT 1 FROM card_reservations
          WHERE card_id = $1 AND status = 'active' AND start_date <= $3::date AND end_date >= $2::date LIMIT 1`,
        [card.id, startDate, endDate]
      );
      if (taken.rows.length === 0) { chosen = card; break; }
    }
    if (!chosen) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Aucune carte ${kind} n'est disponible sur cette période.` });
    }

    const inserted = await client.query(
      `INSERT INTO card_reservations (card_id, user_id, start_date, end_date, extended, reason, reminder_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, ${D('start_date')} AS start_date, ${D('end_date')} AS end_date, extended, reason, status, ${D('reminder_date')} AS reminder_date`,
      [chosen.id, req.session.userId, startDate, endDate, check.extended, check.extended ? reason : null, reminderDateFor(startDate, endDate)]
    );
    await client.query('COMMIT');

    return res.status(201).json({ reservation: present({ ...inserted.rows[0], kind, label: chosen.label }) });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[cartes/reserve] Erreur :', err);
    return res.status(500).json(FAIL);
  } finally {
    client.release();
  }
});

// Récupère une réservation que l'utilisateur a le droit de clôturer (la sienne, ou n'importe laquelle pour un gestionnaire)
async function loadClosable(req, res) {
  const id = parseId(req.params.id);
  if (!id) { res.status(400).json({ error: 'Réservation invalide.' }); return null; }
  const { rows } = await pool.query(
    `SELECT id, user_id, status, ${D('start_date')} AS start_date, ${D('end_date')} AS end_date FROM card_reservations WHERE id = $1`,
    [id]
  );
  const row = rows[0];
  // Même réponse pour « inexistante » et « celle de quelqu'un d'autre » : pas d'indication sur les autres
  if (!row || (row.user_id !== req.session.userId && !isManager(req))) {
    res.status(404).json({ error: 'Réservation introuvable.' });
    return null;
  }
  if (row.status !== 'active') {
    res.status(409).json({ error: 'Cette réservation est déjà clôturée.' });
    return null;
  }
  return row;
}

// POST /api/cards/reservations/:id/cancel — annuler (avant le retrait)
router.post('/reservations/:id/cancel', async (req, res) => {
  try {
    const row = await loadClosable(req, res);
    if (!row) return;
    if (row.start_date <= todayParis() && !isManager(req)) {
      return res.status(409).json({ error: 'La période a commencé : utilisez « Restituer la carte ».' });
    }
    await pool.query(`UPDATE card_reservations SET status = 'cancelled' WHERE id = $1`, [row.id]);
    if (row.user_id !== req.session.userId) console.log(`[cartes] ${req.session.userEmail} a annulé la réservation ${row.id}.`);
    return res.json({ message: 'Réservation annulée.' });
  } catch (err) {
    console.error('[cartes/cancel] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// POST /api/cards/reservations/:id/return — restituer la carte (libère la carte dès aujourd'hui)
router.post('/reservations/:id/return', async (req, res) => {
  try {
    const row = await loadClosable(req, res);
    if (!row) return;
    const today = todayParis();
    if (row.start_date > today) {
      return res.status(409).json({ error: "La carte n'a pas encore été retirée : annulez la réservation." });
    }
    await pool.query(
      `UPDATE card_reservations SET status = 'returned', returned_at = NOW(), end_date = LEAST(end_date, $2::date) WHERE id = $1`,
      [row.id, today]
    );
    if (row.user_id !== req.session.userId) console.log(`[cartes] ${req.session.userEmail} a enregistré la restitution de la réservation ${row.id}.`);
    return res.json({ message: 'Restitution enregistrée.' });
  } catch (err) {
    console.error('[cartes/return] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// ===============================================================
// Gestion RH / SG
// ===============================================================

// GET /api/cards/manage — cartes et réservations en cours AVEC l'identité des emprunteurs
router.get('/manage', requireManager, async (req, res) => {
  try {
    const cards = (await pool.query(
      `SELECT c.id, c.kind, c.label, c.active,
              (SELECT COUNT(*)::int FROM card_reservations r WHERE r.card_id = c.id) AS reservation_count
         FROM cards c ORDER BY c.kind, c.id`
    )).rows;
    const reservations = (await pool.query(
      `SELECT r.id, c.id AS card_id, c.kind, c.label, ${D('r.start_date')} AS start_date, ${D('r.end_date')} AS end_date,
              r.extended, r.reason, r.status, ${D('r.reminder_date')} AS reminder_date, r.reminder_sent_at, r.reminder_status,
              u.first_name, u.last_name, u.email
         FROM card_reservations r
         JOIN cards c ON c.id = r.card_id
         JOIN users u ON u.id = r.user_id
        WHERE r.status = 'active'
        ORDER BY r.start_date, r.id`
    )).rows;
    return res.json({
      cards: cards.map((c) => ({ id: c.id, kind: c.kind, label: c.label, active: c.active, reservationCount: c.reservation_count })),
      reservations: reservations.map((r) => ({
        ...present(r),
        cardId: r.card_id,
        reminderSentAt: r.reminder_sent_at,
        reminderStatus: r.reminder_status,
        borrower: { firstName: r.first_name, lastName: r.last_name, email: r.email },
      })),
    });
  } catch (err) {
    console.error('[cartes/manage] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// POST /api/cards/manage/cards — ajouter une carte { kind, label }
router.post('/manage/cards', requireManager, async (req, res) => {
  const kind = String((req.body && req.body.kind) || '').toUpperCase();
  const label = String((req.body && req.body.label) || '').replace(/\s+/g, ' ').trim();
  if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Type de carte invalide (ICOM ou ICOMOS).' });
  if (!label || label.length > 60) return res.status(400).json({ error: 'Le nom de la carte est requis (60 caractères maximum).' });
  try {
    const { rows } = await pool.query(
      'INSERT INTO cards (kind, label) VALUES ($1, $2) RETURNING id, kind, label, active',
      [kind, label]
    );
    console.log(`[cartes] ${req.session.userEmail} a ajouté la carte ${kind} « ${label} ».`);
    return res.status(201).json({ card: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Une carte porte déjà ce nom pour ce type.' });
    console.error('[cartes/add] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// PATCH /api/cards/manage/cards/:id — renommer, désactiver (perdue, en réparation…) ou réactiver
router.patch('/manage/cards/:id', requireManager, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Carte invalide.' });
  const sets = [];
  const params = [];
  if (typeof req.body.active === 'boolean') { params.push(req.body.active); sets.push(`active = $${params.length}`); }
  if (typeof req.body.label === 'string') {
    const label = req.body.label.replace(/\s+/g, ' ').trim();
    if (!label || label.length > 60) return res.status(400).json({ error: 'Le nom de la carte est requis (60 caractères maximum).' });
    params.push(label); sets.push(`label = $${params.length}`);
  }
  if (sets.length === 0) return res.status(400).json({ error: 'Rien à modifier.' });
  params.push(id);
  try {
    const { rows } = await pool.query(
      `UPDATE cards SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING id, kind, label, active`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Carte introuvable.' });
    return res.json({ card: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Une carte porte déjà ce nom pour ce type.' });
    console.error('[cartes/update] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// DELETE /api/cards/manage/cards/:id — supprimer une carte jamais réservée (sinon : la désactiver)
router.delete('/manage/cards/:id', requireManager, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Carte invalide.' });
  try {
    const used = await pool.query('SELECT 1 FROM card_reservations WHERE card_id = $1 LIMIT 1', [id]);
    if (used.rows.length > 0) {
      return res.status(409).json({ error: 'Cette carte a des réservations : désactivez-la plutôt que de la supprimer.' });
    }
    const { rowCount } = await pool.query('DELETE FROM cards WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Carte introuvable.' });
    return res.json({ message: 'Carte supprimée.' });
  } catch (err) {
    console.error('[cartes/delete] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

// POST /api/cards/manage/reminders/run — lance l'envoi des rappels dus maintenant
router.post('/manage/reminders/run', requireManager, async (req, res) => {
  try {
    return res.json({ summary: await runReminders() });
  } catch (err) {
    console.error('[cartes/reminders] Erreur :', err);
    return res.status(500).json(FAIL);
  }
});

module.exports = router;
