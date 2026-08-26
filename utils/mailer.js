// Envoi d'e-mails via le serveur SMTP interne fourni par le service
// informatique. Toutes les valeurs de connexion viennent de .env —
// aucune information de connexion n'est codée en dur ici.

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

// Fonction pour envoyer un e-mail avec pièces jointes
async function sendRequestEmail(email, firstName, requestDetails, attachments = []) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
    tls: { rejectUnauthorized: false }
  });

  // Préparer les pièces jointes
  const mailAttachments = attachments.map(attachment => ({
    filename: attachment.originalname,
    path: attachment.path
  }));

  try {
    await transporter.sendMail({
      from: `"Nestor-C2" <${process.env.SMTP_USER}>`,
      to: email,
      subject: `Nouvelle demande - ${requestDetails.ref}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Nouvelle demande soumise</h2>
          <p>Bonjour ${firstName},</p>
          <p>Une nouvelle demande a été soumise avec les détails suivants :</p>
          <pre>${JSON.stringify(requestDetails, null, 2)}</pre>
          <p>Les pièces jointes sont incluses avec cet e-mail.</p>
        </div>
      `,
      text: `Bonjour ${firstName},\n\nUne nouvelle demande a été soumise avec les détails suivants :\n${JSON.stringify(requestDetails, null, 2)}\n\nLes pièces jointes sont incluses avec cet e-mail.`,
      attachments: mailAttachments
    });
    return true;
  } catch (err) {
    console.error('[MAILER] Erreur:', err.message);
    return false;
  }
}

//module.exports = { sendRequestEmail };

//const transporter = nodemailer.createTransport({
  //host: process.env.SMTP_HOST,
  //port: parseInt(process.env.SMTP_PORT || '587', 10),
  //secure: process.env.SMTP_SECURE === 'true',
  //auth: {
    //user: process.env.SMTP_USER,
    //pass: process.env.SMTP_PASSWORD,
  //},
  //tls: {
    //rejectUnauthorized: false,
  //},
//});

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

module.exports = { sendVerificationEmail, checkSMTPConfig, verifySmtpConnection };
