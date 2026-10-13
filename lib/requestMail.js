// Fabrication et envoi de l'e-mail associé à une demande.
//
// Objet : "<Catégorie> - <Formulaire>" (ex. "Intervention technique - Ascenseur
// / Monte charges"), pour que la réception puisse trier avec des règles.

const path = require('path');
const { pool } = require('../db/pool');
const { sendEmail, escapeHtml } = require('../utils/mailer');
const { recipientsFor } = require('../config/mail-routing');
const { describeSubmission } = require('./forms');
const { UPLOAD_DIR } = require('../utils/uploads');

function buildSubject(category, form) {
  // Retire les retours à la ligne éventuels (en-tête SMTP)
  return `${category.title} - ${form.title}`.replace(/[\r\n]+/g, ' ');
}

function buildBodies({ request, category, form, requester, sections }) {
  const created = new Date(request.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const portal = process.env.PUBLIC_BASE_URL ? `${process.env.PUBLIC_BASE_URL}/` : '';

  const meta = [
    ['Référence', request.reference],
    ['Catégorie', category.title],
    ['Formulaire', form.title],
    ['Demandeur', `${requester.first_name} ${requester.last_name}`],
    ['E-mail du demandeur', requester.email],
    ['Date de la demande', created],
  ];

  const table = (rows) =>
    `<table style="border-collapse:collapse;width:100%;font-size:14px;">${rows
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 10px;border-bottom:1px solid #e5e5e5;color:#555;width:38%;vertical-align:top;">${escapeHtml(k)}</td>` +
          `<td style="padding:6px 10px;border-bottom:1px solid #e5e5e5;white-space:pre-wrap;">${escapeHtml(v)}</td></tr>`
      )
      .join('')}</table>`;

  const html =
    `<h2 style="margin:0 0 12px;">${escapeHtml(form.title)}</h2>` +
    table(meta) +
    sections
      .map((s) => `<h3 style="margin:20px 0 6px;font-size:15px;">${escapeHtml(s.title)}</h3>${table(s.rows.map((r) => [r.label, r.value]))}`)
      .join('') +
    (portal ? `<p style="margin-top:20px;font-size:12px;color:#777;">Demande enregistrée sur le portail Nestor-C2 : <a href="${escapeHtml(portal)}">${escapeHtml(portal)}</a>. Répondre à cet e-mail écrit directement au demandeur.</p>` : '');

  const text =
    `${form.title}\n\n` +
    meta.map(([k, v]) => `${k} : ${v}`).join('\n') +
    sections.map((s) => `\n\n${s.title}\n` + s.rows.map((r) => `- ${r.label} : ${r.value}`).join('\n')).join('') +
    '\n\nRépondre à cet e-mail écrit directement au demandeur.';

  return { html, text };
}

// Envoie la notification de la demande et enregistre le résultat en base.
// Ne lève jamais d'exception : la demande est déjà enregistrée, un échec
// d'e-mail ne doit pas la faire perdre (statut "failed", renvoi possible).
async function notifyRequest(requestId) {
  const { rows } = await pool.query(
    `SELECT r.*, u.first_name, u.last_name, u.email
       FROM requests r JOIN users u ON u.id = r.user_id WHERE r.id = $1`,
    [requestId]
  );
  if (rows.length === 0) return { status: 'failed', error: 'Demande introuvable' };
  const row = rows[0];

  const { getForm } = require('./forms');
  const found = getForm(row.category_key, row.form_key);
  if (!found) return { status: 'failed', error: 'Formulaire inconnu' };
  const { category, form } = found;

  const attachRows = (
    await pool.query('SELECT * FROM request_attachments WHERE request_id = $1 ORDER BY created_at', [requestId])
  ).rows;

  // Pièces jointes regroupées par étape : la table ne garde pas le numéro
  // d'étape, on le relit dans les données de la demande.
  const filesByStep = {};
  form.steps.forEach((step, i) => {
    if (step.type !== 'file-upload') return;
    const ids = (row.data[i + 1 + '-files'] || []).map((f) => f.id);
    filesByStep[i + 1] = attachRows.filter((a) => ids.includes(a.id));
  });

  const sections = describeSubmission(form, row.data, filesByStep);
  const to = recipientsFor(row.category_key, row.form_key, row.data);
  const { html, text } = buildBodies({ request: row, category, form, requester: row, sections });

  const result = await sendEmail({
    to,
    subject: buildSubject(category, form),
    html,
    text,
    replyTo: row.email,
    headers: { 'X-Nestor-Reference': row.reference, 'X-Nestor-Category': row.category_key },
    attachments: attachRows.map((a) => ({
      filename: a.original_name,
      path: path.join(UPLOAD_DIR, a.stored_name),
    })),
  });

  await pool.query(
    `UPDATE requests
        SET notification_status = $1, notification_recipients = $2, notification_error = $3,
            notified_at = CASE WHEN $5::boolean THEN NOW() ELSE notified_at END
      WHERE id = $4`,
    [result.status, to.join(', ') || null, result.error, requestId, result.status === 'sent']
  );

  if (result.status === 'not_configured') {
    console.warn(`[notification] Aucun destinataire configuré pour ${row.category_key}/${row.form_key} (${row.reference}).`);
  }
  return result;
}

module.exports = { notifyRequest, buildSubject };
