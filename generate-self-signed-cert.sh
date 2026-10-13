// Routes d'administration : gestion des comptes valideurs et de leurs
// affectations aux catégories de formulaires. Toutes ces routes sont
// réservées au rôle 'admin' (équipe informatique).

const express = require('express');
const argon2 = require('argon2');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { generateToken, hashToken, getExpiryDate, PASSWORD_SETUP_TTL_HOURS } = require('../utils/tokens');
const { sendValidatorAccountEmail } = require('../utils/mailer');

const router = express.Router();

// Toutes les routes de ce fichier exigent une session active ET le rôle admin.
router.use(requireAuth, requireRole('admin'));

// Génère un mot de passe temporaire aléatoire et lisible (sans caractères
// ambigus comme 0/O ou 1/l), à communiquer indirectement au valideur via
// le lien de mise en place — le mot de passe lui-même n'est jamais envoyé
// en clair par e-mail, seul le lien l'est (voir la route POST ci-dessous).
function generateTemporaryPassword() {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(16);
  let result = '';
  for (let i = 0; i < 16; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

// ---------------------------------------------------------------
// GET /api/admin/validators — liste des comptes valideurs avec leurs
// catégories affectées
// ---------------------------------------------------------------
router.get('/validators', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         u.id, u.first_name, u.last_name, u.email, u.status, u.created_at,
         COALESCE(
           json_agg(vc.category_key) FILTER (WHERE vc.category_key IS NOT NULL),
           '[]'
         ) AS category_keys
       FROM users u
       LEFT JOIN validator_categories vc ON vc.user_id = u.id
       WHERE u.role = 'valideur'
       GROUP BY u.id
       ORDER BY u.last_name, u.first_name`
    );

    return res.json({ validators: result.rows });
  } catch (err) {
    console.error('[admin/validators/list] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// POST /api/admin/validators — crée un nouveau compte valideur, avec un
// mot de passe temporaire et un lien de mise en place envoyé par e-mail.
// Les catégories peuvent être affectées dès la création (optionnel).
// ---------------------------------------------------------------
router.post(
  '/validators',
  [
    body('firstName').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('lastName').trim().notEmpty().withMessage('Le nom est requis.'),
    body('email').trim().isEmail().withMessage('Adresse e-mail invalide.'),
    body('categoryKeys').optional().isArray().withMessage('Les catégories doivent être une liste.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { firstName, lastName } = req.body;
    const email = req.body.email.trim().toLowerCase();
    const categoryKeys = Array.isArray(req.body.categoryKeys) ? req.body.categoryKeys : [];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
      if (existing.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
      }

      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await argon2.hash(temporaryPassword, { type: argon2.argon2id });

      const insertResult = await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, status, role)
         VALUES ($1, $2, $3, $4, 'active', 'valideur') RETURNING id`,
        [firstName.trim(), lastName.trim(), email, passwordHash]
      );
      const userId = insertResult.rows[0].id;

      for (const categoryKey of categoryKeys) {
        await client.query(
          `INSERT INTO validator_categories (user_id, category_key) VALUES ($1, $2)
           ON CONFLICT (user_id, category_key) DO NOTHING`,
          [userId, categoryKey]
        );
      }

      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = getExpiryDate(PASSWORD_SETUP_TTL_HOURS);

      await client.query(
        `INSERT INTO password_setup_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
      );

      await client.query('COMMIT');

      const setupUrl = `${process.env.PUBLIC_BASE_URL}/setup-password?token=${token}`;
      await sendValidatorAccountEmail(email, setupUrl, categoryKeys);

      return res.status(201).json({
        validator: { id: userId, firstName, lastName, email, categoryKeys },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[admin/validators/create] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    } finally {
      client.release();
    }
  }
);

// ---------------------------------------------------------------
// PUT /api/admin/validators/:id/categories — remplace entièrement les
// catégories affectées à un valideur (liste complète attendue, pas un
// ajout/retrait incrémental — plus simple à raisonner côté front comme
// côté serveur pour une affectation qui change rarement).
// ---------------------------------------------------------------
router.put(
  '/validators/:id/categories',
  [body('categoryKeys').isArray().withMessage('Les catégories doivent être une liste.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { id } = req.params;
    const categoryKeys = req.body.categoryKeys;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userCheck = await client.query(`SELECT id FROM users WHERE id = $1 AND role = 'valideur'`, [id]);
      if (userCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Valideur introuvable.' });
      }

      await client.query('DELETE FROM validator_categories WHERE user_id = $1', [id]);

      for (const categoryKey of categoryKeys) {
        await client.query(
          `INSERT INTO validator_categories (user_id, category_key) VALUES ($1, $2)
           ON CONFLICT (user_id, category_key) DO NOTHING`,
          [id, categoryKey]
        );
      }

      await client.query('COMMIT');
      return res.json({ id, categoryKeys });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[admin/validators/categories] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    } finally {
      client.release();
    }
  }
);

module.exports = router;
