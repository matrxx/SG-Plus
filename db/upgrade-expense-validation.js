// Ajoute les statuts du circuit de validation des propositions de dépenses.
// Usage : node db/upgrade-expense-validation.js

require('dotenv').config();
const { query, pool } = require('./pool');

const statuses = ['brouillon', 'en_cours', 'en_attente_validation', 'validee_responsable', 'transmise_budget', 'traitee', 'rejetee', 'annulee'];

async function upgrade() {
  try {
    for (const status of statuses) {
      await query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status')
             AND NOT EXISTS (
               SELECT 1 FROM pg_enum
               WHERE enumtypid = 'request_status'::regtype AND enumlabel = '${status}'
             ) THEN
            ALTER TYPE request_status ADD VALUE '${status}';
          END IF;
        END
        $$;
      `);
    }
    console.log('[UPGRADE] Les statuts de validation des dépenses sont disponibles.');
  } catch (err) {
    console.error('[UPGRADE] Erreur :', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

upgrade();