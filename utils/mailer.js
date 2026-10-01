// Envoi d'e-mails via le serveur SMTP interne fourni par le service
// informatique. Toutes les valeurs de connexion viennent de .env —
// aucune information de connexion n'est codée en dur ici.

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

function checkSMTPConfig() {
  const requiredVars = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'];
  return requiredVars.every(varName => process.env[varName]);
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

async function sendVerificationEmail(email, firstName, verificationLink) {
  if (!checkSMTPConfig()) {
    console.log('[MAILER] SMTP non configuré. Lien de vérification:', verificationLink);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"Nestor-C2" <${process.env.SMTP_USER}>`,
      to: email,
      subject: 'Vérifiez votre adresse e-mail - Nestor-C2',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Vérifiez votre adresse e-mail</h2>
          <p>Bonjour ${firstName},</p>
          <p>Pour finaliser votre inscription, cliquez sur le lien ci-dessous :</p>
          <p style="text-align: center; margin: 20px 0;">
            <a href="${verificationLink}" style="background: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
              Vérifier mon e-mail
            </a>
          </p>
          <p>Ce lien expirera dans 24 heures.</p>
        </div>
      `,
      text: `Bonjour ${firstName},\n\nPour finaliser votre inscription, visitez : ${verificationLink}\n\nCe lien expirera dans 24 heures.`,
    });
    return true;
  } catch (err) {
    console.error('[MAILER] Erreur:', err.message);
    return false;
  }
}

async function sendExpenseValidationEmail(email, firstName, request) {
  if (!checkSMTPConfig()) {
    console.log('[MAILER] SMTP non configuré. Notification de validation ignorée pour:', email);
    return false;
  }

  try {
    const link = `${process.env.PUBLIC_BASE_URL}/`;
    await transporter.sendMail({
      from: `"Nestor-C2" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Demande de dépense à valider - ${request.reference}`,
      html: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Demande de dépense à valider</h2>
        <p>Bonjour ${firstName || ''},</p>
        <p>Une demande de dépense vous a été attribuée pour validation.</p>
        <p><strong>${request.title}</strong><br>Référence : ${request.reference}</p>
        <p>Connectez-vous au portail pour consulter la demande et apposer votre signature électronique simple :</p>
        <p><a href="${link}">${link}</a></p>
      </div>`,
      text: `Bonjour ${firstName || ''},\n\nLa demande ${request.reference} (${request.title}) attend votre validation. Connectez-vous au portail : ${link}`,
    });
    return true;
  } catch (err) {
    console.error('[MAILER] Erreur notification validation:', err.message);
    return false;
  }
}

module.exports = { sendVerificationEmail, sendExpenseValidationEmail, checkSMTPConfig, verifySmtpConnection };
