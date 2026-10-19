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

// Description lisible (sans mot de passe) de la base ciblée : permet de vérifier
// que le serveur, create-admin et doctor parlent bien à la MÊME base.
function dbTarget() {
  try {
    const u = new URL(process.env.DATABASE_URL);
    return `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)} (utilisateur ${u.username})`;
  } catch (e) {
    return process.env.DATABASE_URL ? 'DATABASE_URL illisible' : 'DATABASE_URL absent';
  }
}

module.exports = { pool, query, dbTarget };
