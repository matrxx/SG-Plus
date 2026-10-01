// Script à exécuter une seule fois en ligne de commande sur le serveur,
// pour créer le premier compte superAdmin de l'application.
//
// Usage :
//   node db/create-admin.js
//
// Avec les arguments optionnels :
//   node db/create-admin.js s.dellupo@culture.gouv.fr "Sébastien" "Dellupo" "mot-de-passe"

const readline = require('readline');
const argon2 = require('argon2');
const { query } = require('./pool');

const DEFAULT_EMAIL = 's.dellupo@culture.gouv.fr';
const DEFAULT_FIRST_NAME = 'Sébastien';
const DEFAULT_LAST_NAME = 'Dellupo';
const DEFAULT_PASSWORD = process.env.SUPERADMIN_PASSWORD;

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function ensureSuperAdminRole() {
  const roleType = await query(`
    SELECT 1
    FROM pg_type
    WHERE typname = 'user_role'
  `);

  if (roleType.rows.length === 0) {
    throw new Error('Le type PostgreSQL user_role est introuvable. Exécutez la migration initiale.');
  }

  const roleValue = await query(`
    SELECT 1
    FROM pg_enum
    WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'superAdmin'
  `);

  if (roleValue.rows.length === 0) {
    await query("ALTER TYPE user_role ADD VALUE 'superAdmin'");
  }
}

async function createAdmin() {
  console.log('\n=== Création du compte administrateur ===\n');

  try {
    const email = process.argv[2] || DEFAULT_EMAIL;
    const firstName = process.argv[3] || DEFAULT_FIRST_NAME;
    const lastName = process.argv[4] || DEFAULT_LAST_NAME;
    const password = process.argv[5] || DEFAULT_PASSWORD || await ask('Mot de passe du superAdmin : ');
    if (!password || password.length < 12) {
      throw new Error('Le mot de passe du superAdmin doit contenir au moins 12 caractères.');
    }

    await ensureSuperAdminRole();

    const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      console.warn('\n[WARN] Un compte avec cette adresse existe déjà.');
      rl.close();
      process.exit(0);
    }

    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 1,
    });

    await query(
      `INSERT INTO users (email, first_name, last_name, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'superAdmin', 'active')`,
      [email, firstName, lastName, passwordHash]
    );

    console.log('\n[SUCCESS] Compte superAdmin créé !');
    console.log(`E-mail: ${email}`);
    console.log(`Nom: ${firstName} ${lastName}`);
    console.log('\n➡️  Conservez ce mot de passe dans un gestionnaire de secrets.');

    rl.close();
    process.exit(0);
  } catch (err) {
    console.error('\n[ERREUR]:', err.message);
    rl.close();
    process.exit(1);
  }
}

createAdmin();
