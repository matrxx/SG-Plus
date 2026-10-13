// Connexion centralisée à PostgreSQL.
// Tous les autres fichiers du projet importent "pool" depuis ici
// plutôt que de créer chacun leur propre connexion.

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('connect', () => {
  console.log('[DB] Connecté à PostgreSQL');
});

pool.on('error', (err) => {
  console.error('[DB] Erreur PostgreSQL:', err.message);
});

const query = async (text, params) => {
  try {
    const result = await pool.query(text, params);
    return result;
  } catch (err) {
    console.error('[DB] Erreur de requête:', err.message);
    throw err;
  }
};

module.exports = { pool, query };
