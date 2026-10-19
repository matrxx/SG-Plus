// Envoi d'e-mails via le serveur SMTP interne fourni par le service
// informatique. Toutes les valeurs de connexion viennent de .env —
// aucune information de connexion n'est codée en dur ici.

const nodemailer = require('nodemailer');
const {
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_HOURS,
  PASSWORD_SETUP_TTL_HOURS,
} = require('./tokens');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER
    ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
    : undefined,
  // Microsoft 365 (smtp.office365.com:587) impose STARTTLS : SMTP_REQUIRE_TLS=true
  // refuse l'envoi plutôt que de basculer en clair si la négociation échoue.
  requireTLS: process.env.SMTP_REQUIRE_TLS === 'true',
  // Délais courts : un serveur SMTP muet ne doit pas bloquer l'envoi d'une demande
  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 90000,
  tls: {
    // Certificat auto-signé toléré uniquement si SMTP_REJECT_UNAUTHORIZED=false
    rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== 'false',
  },
});

// Expéditeur affiché. Avec un compte de service qui envoie "en tant que" une
// boîte partagée, SMTP_USER (identifiant) et SMTP_FROM (adresse de la boîte
// partagée, droit Send As requis) sont deux adresses différentes.
function getFromHeader() {
  const address = process.env.SMTP_FROM || process.env.SMTP_USER;
  const name = process.env.SMTP_FROM_NAME || 'SG+';
  return { name, address };
}

function checkSMTPConfig() {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
  return requiredVars.every((varName) => process.env[varName]);
}

async function verifySmtpConnection() {
  if (!checkSMTPConfig()) {
    console.warn('[MAILER] SMTP non configuré. Vérification de connexion ignorée.');
    return false;
  }

  try {
    await transporter.verify();
    console.log('[MAILER] Connexion SMTP OK.');
    return true;
  } catch (err) {
    console.error('[MAILER] Impossible de vérifier la connexion SMTP :', err.message);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDuration(hours) {
  return hours === 1 ? '1 heure' : `${hours} heures`;
}

function buttonHtml(link, label) {
  const safeLink = escapeHtml(link);
  return `
    <p style="text-align: center; margin: 20px 0;">
      <a href="${safeLink}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
        ${escapeHtml(label)}
      </a>
    </p>
    <p style="font-size: 12px; color: #666;">Si le bouton ne fonctionne pas, copiez ce lien : ${safeLink}</p>`;
}

// Envoi générique : renvoie true/false, ne lève jamais d'exception pour ne
// pas casser le parcours appelant (l'erreur est journalisée). En l'absence
// de SMTP, le lien est affiché en console hors production pour faciliter
// les tests.
async function sendMail({ to, subject, html, text, devLink }) {
  if (!checkSMTPConfig()) {
    console.log(`[MAILER] SMTP non configuré. E-mail "${subject}" non envoyé à ${to}.`);
    if (devLink && process.env.NODE_ENV !== 'production') {
      console.log('[MAILER] Lien (dev) :', devLink);
    }
    return false;
  }

  try {
    await transporter.sendMail({
      from: getFromHeader(),
      replyTo: process.env.SMTP_REPLY_TO || undefined,
      to,
      subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">${html}</div>`,
      text,
    });
    return true;
  } catch (err) {
    console.error('[MAILER] Erreur:', err.message);
    return false;
  }
}

// Envoi d'un e-mail complet (plusieurs destinataires, pièces jointes, Reply-To).
// Contrairement à sendMail, renvoie la cause de l'échec pour que l'appelant
// puisse l'enregistrer : { ok, status: 'sent'|'smtp_disabled'|'failed', error }.
async function sendEmail({ to, subject, html, text, replyTo, attachments, headers }) {
  const recipients = [].concat(to || []).filter(Boolean);
  if (recipients.length === 0) return { ok: false, status: 'not_configured', error: 'Aucun destinataire' };

  if (!checkSMTPConfig()) {
    console.log(`[MAILER] SMTP non configuré. E-mail "${subject}" non envoyé à ${recipients.join(', ')}.`);
    return { ok: false, status: 'smtp_disabled', error: 'SMTP non configuré sur le serveur' };
  }

  try {
    await transporter.sendMail({
      from: getFromHeader(),
      replyTo: replyTo || process.env.SMTP_REPLY_TO || undefined,
      to: recipients,
      subject,
      html: `<div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto;">${html}</div>`,
      text,
      attachments,
      headers,
    });
    return { ok: true, status: 'sent', error: null };
  } catch (err) {
    console.error('[MAILER] Erreur:', err.message);
    return { ok: false, status: 'failed', error: String(err.message || err).slice(0, 500) };
  }
}

async function sendVerificationEmail(email, firstName, verificationLink) {
  const duration = formatDuration(EMAIL_VERIFICATION_TTL_HOURS);
  return sendMail({
    to: email,
    subject: 'Vérifiez votre adresse e-mail - SG+',
    devLink: verificationLink,
    html: `
      <h2>Vérifiez votre adresse e-mail</h2>
      <p>Bonjour ${escapeHtml(firstName)},</p>
      <p>Pour finaliser votre inscription, cliquez sur le lien ci-dessous :</p>
      ${buttonHtml(verificationLink, 'Vérifier mon e-mail')}
      <p>Ce lien expirera dans ${duration}.</p>`,
    text: `Bonjour ${firstName},\n\nPour finaliser votre inscription, visitez : ${verificationLink}\n\nCe lien expirera dans ${duration}.`,
  });
}

async function sendPasswordResetEmail(email, resetLink) {
  const duration = formatDuration(PASSWORD_RESET_TTL_HOURS);
  return sendMail({
    to: email,
    subject: 'Réinitialisation de votre mot de passe - SG+',
    devLink: resetLink,
    html: `
      <h2>Réinitialisation du mot de passe</h2>
      <p>Une demande de réinitialisation a été faite pour votre compte.</p>
      ${buttonHtml(resetLink, 'Choisir un nouveau mot de passe')}
      <p>Ce lien expirera dans ${duration}. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
    text: `Pour choisir un nouveau mot de passe, visitez : ${resetLink}\n\nCe lien expirera dans ${duration}. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
  });
}

async function sendPasswordSetupEmail(email, setupLink) {
  const duration = formatDuration(PASSWORD_SETUP_TTL_HOURS);
  return sendMail({
    to: email,
    subject: 'Activation de votre compte valideur - SG+',
    devLink: setupLink,
    html: `
      <h2>Activation de votre compte</h2>
      <p>Un compte valideur a été créé pour vous sur le portail SG+.</p>
      ${buttonHtml(setupLink, 'Définir mon mot de passe')}
      <p>Ce lien expirera dans ${duration}.</p>`,
    text: `Un compte valideur a été créé pour vous. Définissez votre mot de passe : ${setupLink}\n\nCe lien expirera dans ${duration}.`,
  });
}

async function sendTestEmail(to) {
  return sendMail({
    to,
    subject: 'Test d’envoi - SG+',
    html: '<h2>Test d’envoi</h2><p>Si vous lisez ce message, la configuration SMTP de SG+ fonctionne.</p>',
    text: 'Si vous lisez ce message, la configuration SMTP de SG+ fonctionne.',
  });
}

module.exports = {
  sendEmail,
  escapeHtml,
  sendTestEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordSetupEmail,
  checkSMTPConfig,
  verifySmtpConnection,
};
