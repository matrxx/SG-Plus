// Base PostgreSQL locale de DÉVELOPPEMENT (aucune installation serveur requise).
// Usage : npm run dev-db   (laisser tourner dans un terminal, Ctrl+C pour arrêter)
//
// Les données sont conservées dans ~/.nestor-c2/devdb entre deux lancements. Ne JAMAIS
// utiliser cette base en production : utilisez un vrai serveur PostgreSQL.
//
// Puis, dans .env :
//   DATABASE_URL=postgresql://postgres:postgres@localhost:54320/nestor_dev
//   PGSSL=false

const fs = require('fs');
const os = require('os');
const path = require('path');
const EmbeddedPostgres = require('embedded-postgres').default;

const PORT = 54320;
const DB_NAME = 'nestor_dev';
// Hors du dossier du projet : évite les dossiers synchronisés/virtualisés
// (OneDrive, stockage d'applications) sur lesquels PostgreSQL plante.
const DATA_DIR = process.env.DEVDB_DIR || path.join(os.homedir(), '.nestor-c2', 'devdb');

async function main() {
  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
  });

  if (!fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'))) {
    console.log('[dev-db] Initialisation de la base (premier lancement)...');
    await pg.initialise();
  }

  await pg.start();

  try {
    await pg.createDatabase(DB_NAME);
    console.log(`[dev-db] Base "${DB_NAME}" créée.`);
  } catch (err) {
    // Déjà existante : normal aux lancements suivants.
  }

  console.log('\n[dev-db] PostgreSQL de développement prêt.');
  console.log(`[dev-db] DATABASE_URL=postgresql://postgres:postgres@localhost:${PORT}/${DB_NAME}`);
  console.log('[dev-db] Ctrl+C pour arrêter.\n');

  const stop = async () => {
    console.log('\n[dev-db] Arrêt...');
    await pg.stop().catch(() => {});
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('[dev-db] Erreur :', err.message);
  process.exit(1);
});
