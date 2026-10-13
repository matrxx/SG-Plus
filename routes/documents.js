// Génération d'un document (PDF / Word) à partir des champs saisis, à l'étape
// "Validation" des formulaires qui le proposent (propriété `documents` dans
// public/forms-data.js), et envoi de ce document par e-mail à une adresse libre.
//
//  POST /api/forms/:category/:form/document        { format, data }            -> fichier
//  POST /api/forms/:category/:form/document/send   { to, formats[], data }     -> e-mail
//
// L'envoi vers une adresse libre part de la boîte officielle : il est donc
// limité (10 envois / heure / utilisateur), journalisé, et peut être restreint
// à certains domaines avec DOCUMENT_MAIL_ALLOWED_DOMAINS (vide = toute adresse).

const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');
const { getForm, validateSubmission, describeSubmission } = require('../lib/forms');
const { generateDocument } = require('../lib/documents');
const { sendEmail, escapeHtml } = require('../utils/mailer');

const router = express.Router();
const EMAIL_RE = /^[^\s@,;<>()"]+@[^\s@,;<>()"]+\.[^\s@,;<>()"]+$/;

const sendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `user-${req.session.userId}`,
  message: { error: "Trop d'envois de documents. Réessayez dans une heure." },
});

function allowedDomains() {
  return String(process.env.DOCUMENT_MAIL_ALLOWED_DOMAINS || '')
    .split(/[;,]/)
    .map((d) => d.trim().toLowerCase().replace(/^@/, ''))
    .filter(Boolean);
}

// Valide la demande (formulaire, formats, champs) et renvoie le contexte de génération.
async function prepare(req, res, formats) {
  const found = getForm(req.params.category, req.params.form);
  const allowed = found && Array.isArray(found.form.documents) ? found.form.documents : [];

  if (!found || formats.length === 0 || !formats.every((f) => allowed.includes(f))) {
    res.status(404).json({ error: "Ce document n'est pas disponible pour ce formulaire." });
    return null;
  }

  const { errors, clean } = validateSubmission(found.form, req.body.data);
  if (errors.length > 0) {
    res.status(400).json({ error: errors[0], errors });
    return null;
  }

  const { rows } = await pool.query('SELECT first_name, last_name, email FROM users WHERE id = $1', [req.session.userId]);
  if (rows.length === 0) {
    res.status(401).json({ error: 'Authentification requise.' });
    return null;
  }

  return {
    ctx: { category: found.category, form: found.form, requester: rows[0] },
    sections: describeSubmission(found.form, clean),
  };
}

router.post('/forms/:category/:form/document', requireAuth, async (req, res) => {
  const format = String((req.body && req.body.format) || '').toLowerCase();

  try {
    const prepared = await prepare(req, res, format ? [format] : []);
    if (!prepared) return;

    const file = await generateDocument(format, prepared.ctx, prepared.sections);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.filename}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.send(file.buffer);
  } catch (err) {
    console.error('[documents] Erreur :', err);
    return res.status(500).json({ error: 'Impossible de générer le document.' });
  }
});

router.post('/forms/:category/:form/document/send', requireAuth, sendLimiter, async (req, res) => {
  const to = String((req.body && req.body.to) || '').trim().toLowerCase();
  const formats = [...new Set(
    (Array.isArray(req.body && req.body.formats) ? req.body.formats : []).map((f) => String(f).toLowerCase())
  )];

  if (!EMAIL_RE.test(to) || to.length > 254) {
    return res.status(400).json({ error: "L'adresse e-mail du destinataire est invalide." });
  }
  const domains = allowedDomains();
  if (domains.length && !domains.includes(to.split('@')[1])) {
    return res.status(403).json({ error: `Envoi limité aux adresses : ${domains.map((d) => '@' + d).join(', ')}.` });
  }
  if (formats.length === 0) {
    return res.status(400).json({ error: 'Choisissez au moins un format (PDF ou Word).' });
  }

  try {
    const prepared = await prepare(req, res, formats);
    if (!prepared) return;
    const { ctx, sections } = prepared;
    const { requester, form, category } = ctx;

    const files = await Promise.all(formats.map((f) => generateDocument(f, ctx, sections)));
    const who = `${requester.first_name} ${requester.last_name}`;

    const result = await sendEmail({
      to,
      subject: `${category.title} - ${form.title}`.replace(/[\r\n]+/g, ' '),
      replyTo: requester.email,
      html:
        `<h2 style="margin:0 0 12px;">${escapeHtml(form.title)}</h2>` +
        `<p>${escapeHtml(who)} (${escapeHtml(requester.email)}) vous transmet la fiche « ${escapeHtml(form.title)} » complétée, ` +
        `en pièce jointe${files.length > 1 ? ' (PDF et Word)' : ''}.</p>` +
        `<p style="font-size:12px;color:#777;">Message envoyé depuis le portail Nestor-C2. Répondre à cet e-mail écrit directement à ${escapeHtml(who)}.</p>`,
      text:
        `${who} (${requester.email}) vous transmet la fiche « ${form.title} » complétée, en pièce jointe.\n\n` +
        `Message envoyé depuis le portail Nestor-C2. Répondre à cet e-mail écrit directement à ${who}.`,
      headers: { 'X-Nestor-Document': `${req.params.category}/${req.params.form}` },
      attachments: files.map((f) => ({ filename: f.filename, content: f.buffer, contentType: f.contentType })),
    });

    // Trace : qui a envoyé quoi à qui (l'envoi part de la boîte officielle)
    console.log(`[documents/send] ${requester.email} -> ${to} : ${req.params.category}/${req.params.form} (${formats.join('+')}) = ${result.status}`);

    if (result.status === 'smtp_disabled') {
      return res.status(503).json({ error: "L'envoi d'e-mails n'est pas configuré sur le serveur." });
    }
    if (!result.ok) {
      return res.status(502).json({ error: "L'e-mail n'a pas pu être envoyé. Réessayez ou téléchargez le document." });
    }
    return res.json({ message: `Document envoyé à ${to}.` });
  } catch (err) {
    console.error('[documents/send] Erreur :', err);
    return res.status(500).json({ error: "Impossible d'envoyer le document." });
  }
});

module.exports = router;
