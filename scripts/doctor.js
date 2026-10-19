// Diagnostic de la configuration : npm run doctor
// Envoi d'un e-mail de test réel (à une adresse que vous choisissez) :
//   npm run test-mail -- prenom.nom@culture.gouv.fr

require('dotenv').config();
const { pool, dbTarget } = require('../db/pool');
const { checkSMTPConfig, verifySmtpConnection, sendTestEmail } = require('../utils/mailer');

const results = [];
function report(level, label, detail = '') {
  const icon = { ok: 'OK  ', warn: 'WARN', fail: 'FAIL' }[level];
  results.push(level);
  console.log(`[${icon}] ${label}${detail ? ' — ' + detail : ''}`);
}

const PLACEHOLDERS = ['mon-entreprise', 'example', 'votre_', 'changer_la_obligatoirement'];
const isPlaceholder = (v) => PLACEHOLDERS.some((p) => String(v || '').toLowerCase().includes(p));

async function main() {
  const testMailTo = process.argv.includes('--mail')
    ? process.argv[process.argv.indexOf('--mail') + 1]
    : null;

  console.log('=== Diagnostic Nestor-C2 ===\n');

  // --- Variables d'environnement -------------------------------------
  const secret = process.env.SESSION_SECRET || '';
  if (secret.length < 16 || isPlaceholder(secret)) report('fail', 'SESSION_SECRET', 'absent, trop court ou valeur d’exemple');
  else report('ok', 'SESSION_SECRET');

  if (!process.env.PUBLIC_BASE_URL) report('fail', 'PUBLIC_BASE_URL', 'absent : les liens des e-mails seraient invalides');
  else report('ok', 'PUBLIC_BASE_URL', process.env.PUBLIC_BASE_URL);

  if (process.env.ALLOW_TEST_BYPASS === 'true') {
    report('warn', 'ALLOW_TEST_BYPASS=true', 'le bouton TEST ouvre une session SANS mot de passe : à désactiver en production');
  }

  if ((process.env.AUTH_MODE || '').toLowerCase() === 'exchange') {
    report('warn', 'AUTH_MODE=exchange', 'la connexion passe par EXCHANGE_AUTH_URL, pas par les comptes locaux : pour utiliser un compte local, retirez AUTH_MODE du .env');
  }

  if (process.env.EMAIL_VERIFICATION_REQUIRED === 'false') {
    report('warn', 'EMAIL_VERIFICATION_REQUIRED=false', 'les comptes sont activés SANS vérification d’e-mail');
  }

  // --- Base de données ------------------------------------------------
  try {
    await pool.query('SELECT 1');
    report('ok', 'Connexion PostgreSQL', dbTarget());
    const t = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
    );
    const have = new Set(t.rows.map((r) => r.table_name));
    const need = ['users', 'requests', 'session', 'email_verifications', 'password_resets', 'password_setup_tokens', 'validator_categories', 'request_attachments'];
    const missing = need.filter((n) => !have.has(n));
    if (missing.length) report('fail', 'Migrations', `tables manquantes : ${missing.join(', ')} → lancez npm run migrate`);
    else report('ok', 'Migrations', 'toutes les tables sont présentes');

    // Comptes : une base neuve (autre machine, autre dev-db) n'a aucun utilisateur,
    // d'où une connexion qui échoue alors que tout semble démarré.
    if (have.has('users')) {
      const u = await pool.query(
        `SELECT role, status, (password_hash IS NOT NULL AND password_hash <> '') AS has_password, COUNT(*)::int AS n
           FROM users GROUP BY role, status, has_password ORDER BY role`
      );
      const loginable = u.rows.filter((r) => r.status === 'active' && r.has_password).reduce((s, r) => s + r.n, 0);
      if (loginable === 0) {
        report('fail', 'Comptes', 'aucun compte actif avec mot de passe dans CETTE base → npm run create-admin -- adresse@culture.gouv.fr "Prénom" "Nom"');
      } else {
        report('ok', 'Comptes', u.rows.map((r) => `${r.n} ${r.role}/${r.status}${r.has_password ? '' : ' sans mot de passe'}`).join(', '));
      }
      // Adresses exactes enregistrées (à comparer avec celle saisie à la connexion).
      const emails = await pool.query(`SELECT email, role, status FROM users ORDER BY id LIMIT 20`);
      emails.rows.forEach((r) => console.log(`       - ${r.email} (${r.role}, ${r.status})`));
    }
  } catch (err) {
    let target = 'DATABASE_URL absent';
    try {
      const u = new URL(process.env.DATABASE_URL);
      target = `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)} (utilisateur ${u.username})`;
    } catch {
      if (process.env.DATABASE_URL) target = 'DATABASE_URL illisible (caractère spécial dans le mot de passe ? à encoder en %XX)';
    }
    const reasons = (err.errors || [err]).map((e) => e.message || e.code).filter(Boolean);
    const hint = (err.errors || [err]).some((e) => e.code === 'ECONNREFUSED')
      ? ' → aucun PostgreSQL n’écoute à cette adresse (non installé ou arrêté)'
      : '';
    report('fail', 'Connexion PostgreSQL', `${target} : ${[...new Set(reasons)].join(' | ') || err.code || 'erreur inconnue'}${hint}`);
  }

  // --- SMTP -------------------------------------------------------------
  if (!checkSMTPConfig()) {
    report('fail', 'SMTP', 'SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASSWORD non renseignés : aucun e-mail ne partira');
  } else if (isPlaceholder(process.env.SMTP_HOST) || isPlaceholder(process.env.SMTP_USER)) {
    report('fail', 'SMTP', `valeurs d’exemple détectées (SMTP_HOST=${process.env.SMTP_HOST}) : renseignez le vrai serveur dans .env`);
  } else if (await verifySmtpConnection()) {
    report('ok', 'SMTP', `${process.env.SMTP_HOST}:${process.env.SMTP_PORT}`);
    if (testMailTo) {
      const sent = await sendTestEmail(testMailTo);
      report(sent ? 'ok' : 'fail', `E-mail de test vers ${testMailTo}`, sent ? 'envoyé, vérifiez la boîte de réception (et les indésirables)' : 'échec, voir l’erreur ci-dessus');
    } else {
      console.log('       (ajoutez --mail adresse pour envoyer un e-mail de test réel : npm run test-mail -- adresse)');
    }
  } else {
    report('fail', 'SMTP', 'connexion impossible, voir l’erreur [MAILER] ci-dessus');
  }

  await pool.end();
  const failed = results.includes('fail');
  console.log(failed ? '\nDes points bloquants sont à corriger.' : '\nConfiguration prête.');
  process.exit(failed ? 1 : 0);
}

main();
