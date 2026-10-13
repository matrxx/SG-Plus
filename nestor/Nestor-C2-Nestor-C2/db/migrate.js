// Applique les migrations SQL de db/migrations/ (ordre alphabétique) sur la
// base configurée dans DATABASE_URL. Chaque fichier n'est exécuté qu'une
// fois (suivi dans la table schema_migrations), dans une transaction.
// Peut être relancé à tout moment : npm run migrate

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('./pool');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function migrate() {
  console.log('[MIGRATE] Début de la migration...');
  const client = await pool.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
      )
    `);

    const applied = new Set(
      (await client.query('SELECT name FROM schema_migrations')).rows.map((r) => r.name)
    );

    const files = fs
      .readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`[MIGRATE] Application de ${file}...`);

      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        count += 1;
      } catch (err) {
        await client.query('ROLLBACK');
        throw new Error(`${file} : ${err.message}`);
      }
    }

    console.log(
      count === 0
        ? '[MIGRATE] Base déjà à jour.'
        : `[MIGRATE] ${count} migration(s) appliquée(s) avec succès.`
    );
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => {
  // Une erreur de connexion "localhost" (IPv4 + IPv6) est un AggregateError
  // au message vide : on détaille chaque cause.
  const reasons = (err.errors || [err]).map((e) => e.message || e.code).filter(Boolean);
  console.error('[MIGRATE] Erreur:', [...new Set(reasons)].join(' | ') || err.code || 'inconnue');
  process.exit(1);
});
