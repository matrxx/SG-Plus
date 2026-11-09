// Rappel par e-mail avant la restitution d'une carte ICOM / ICOMOS.
//
// Règle : le rappel part 1 JOUR OUVRÉ avant la restitution (week-ends, jours fériés
// et fermetures exclus : une restitution le lundi est rappelée le vendredi). La date
// du rappel est calculée à la réservation (lib/cards.js, reminder_date).
//
// Mécanisme : une tâche planifiée (au démarrage puis toutes les heures) envoie les
// rappels arrivés à échéance. Rien n'est perdu si le serveur ou la messagerie est
// indisponible : tant que le rappel n'est pas parti ET que la restitution n'est pas
// passée, il est retenté à chaque passage. Tant que le SMTP n'est pas configuré,
// le statut reste « smtp_disabled » et l'envoi partira dès qu'il le sera.

const { pool } = require('../db/pool');
const { sendEmail, escapeHtml } = require('../utils/mailer');
const { todayParis, hourParis, longDateFr } = require('./workdays');

// Heure (Paris) à partir de laquelle les rappels du jour partent
const REMINDER_HOUR = Number.isInteger(Number(process.env.CARDS_REMINDER_HOUR)) && process.env.CARDS_REMINDER_HOUR !== ''
  ? Number(process.env.CARDS_REMINDER_HOUR)
  : 8;

function buildReminder({ first_name, kind, label, end_date, start_date }) {
  const end = longDateFr(end_date);
  const portal = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/` : '';
  const subject = `Rappel : carte ${kind} à restituer le ${end}`;
  const html =
    `<h2 style="margin:0 0 12px;">Rappel de restitution</h2>` +
    `<p>Bonjour ${escapeHtml(first_name)},</p>` +
    `<p>Vous avez emprunté la <strong>${escapeHtml(label)}</strong>. Merci de la restituer le <strong>${escapeHtml(end)}</strong>.</p>` +
    `<p style="font-size:13px;color:#555;">Si vous n'en avez plus besoin avant cette date, vous pouvez la restituer plus tôt. ` +
    `Une prolongation n'est possible que si la carte n'est pas réservée à la suite, dans la limite des durées autorisées.</p>` +
    (portal ? `<p style="font-size:12px;color:#777;">Réservations : <a href="${escapeHtml(portal)}">${escapeHtml(portal)}</a></p>` : '');
  const text =
    `Bonjour ${first_name},\n\nVous avez emprunté la ${label}. Merci de la restituer le ${end}.\n\n` +
    `Si vous n'en avez plus besoin avant cette date, vous pouvez la restituer plus tôt.` +
    (portal ? `\n\nRéservations : ${portal}` : '');
  void start_date;
  return { subject, html, text };
}

// Envoie les rappels arrivés à échéance. `today` / `hour` sont injectables (tests).
async function runReminders({ today = todayParis(), hour = hourParis() } = {}) {
  const { rows } = await pool.query(
    `SELECT r.id, to_char(r.start_date, 'YYYY-MM-DD') AS start_date, to_char(r.end_date, 'YYYY-MM-DD') AS end_date,
            to_char(r.reminder_date, 'YYYY-MM-DD') AS reminder_date, r.reminder_status,
            c.kind, c.label, u.first_name, u.email
       FROM card_reservations r
       JOIN cards c ON c.id = r.card_id
       JOIN users u ON u.id = r.user_id
      WHERE r.status = 'active'
        AND r.reminder_sent_at IS NULL
        AND r.reminder_date <= $1::date
        AND r.end_date >= $1::date
      ORDER BY r.reminder_date, r.id`,
    [today]
  );

  const summary = { due: 0, sent: 0, failed: 0, notConfigured: 0, waiting: 0 };
  for (const row of rows) {
    // Rappel du jour : pas avant l'heure d'envoi (un rappel en retard part tout de suite)
    if (row.reminder_date === today && hour < REMINDER_HOUR) { summary.waiting += 1; continue; }
    summary.due += 1;

    const { subject, html, text } = buildReminder(row);
    const result = await sendEmail({
      to: row.email,
      subject,
      html,
      text,
      headers: { 'X-SG-Reminder': `carte-${row.kind}-${row.id}` },
    });

    await pool.query(
      `UPDATE card_reservations
          SET reminder_status = $1, reminder_error = $2,
              reminder_sent_at = CASE WHEN $4::boolean THEN NOW() ELSE NULL END
        WHERE id = $3`,
      [result.status, result.error || null, row.id, result.status === 'sent']
    );

    if (result.status === 'sent') summary.sent += 1;
    else if (result.status === 'smtp_disabled' || result.status === 'not_configured') summary.notConfigured += 1;
    else summary.failed += 1;
  }

  if (summary.sent || summary.failed) {
    console.log(`[cartes] Rappels : ${summary.sent} envoyé(s), ${summary.failed} en échec, ${summary.notConfigured} en attente de messagerie.`);
  }
  return summary;
}

function startReminderSchedule() {
  const tick = () => runReminders().catch((err) => console.error('[cartes] Rappels impossibles :', err.message));
  tick();
  setInterval(tick, 60 * 60 * 1000).unref();
}

module.exports = { runReminders, startReminderSchedule, buildReminder, REMINDER_HOUR };
