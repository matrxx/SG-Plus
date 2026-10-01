// Ajoute le rôle superAdmin à une base existante sans recréer les données.
// Usage : node db/upgrade-superadmin.js

require('dotenv').config();
const { query, pool } = require('./pool');

async function upgrade() {
  try {
    const role = await query(`
      SELECT 1 FROM pg_enum
      WHERE enumtypid = 'user_role'::regtype AND enumlabel = 'superAdmin'
    `);
    if (role.rows.length === 0) {
      await query("ALTER TYPE user_role ADD VALUE 'superAdmin'");
    }
    console.log('[UPGRADE] Le rôle superAdmin est disponible.');
  } catch (err) {
    console.error('[UPGRADE] Erreur :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

upgrade();