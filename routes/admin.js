// Routes d'administration : gestion des comptes, des formulaires et des droits.

const express = require('express');
const argon2 = require('argon2');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');
const { requireRole } = require('../middleware/requireRole');
const { generateToken, hashToken, getExpiryDate, PASSWORD_SETUP_TTL_HOURS } = require('../utils/tokens');
const { sendPasswordSetupEmail } = require('../utils/mailer');
const { isAllowedDomain } = require('../utils/emailDomain');
const { notifyRequest } = require('../lib/requestMail');
const { removeFile } = require('../utils/uploads');

const router = express.Router();

// Deux niveaux d'accès :
//  - admin et superAdmin : consulter les comptes, désactiver / réactiver ;
//  - superAdmin seul : tout ce qui suit (création, modification, suppression
//    de comptes, valideurs, demandes).
// Les routes déclarées AVANT router.use(onlySuperAdmin) sont donc accessibles
// aux administrateurs simples ; celles déclarées après sont réservées au superAdmin.
router.use(requireAuth);
const onlySuperAdmin = requireRole('superAdmin');
const adminOrSuperAdmin = requireRole('admin', 'superAdmin');

function normalizeRole(role) {
  const value = (role || 'agent').toLowerCase();
  if (value === 'superadmin') return 'superAdmin';
  if (value === 'admin' || value === 'administrateur') return 'admin';
  return value === 'validator' || value === 'valideur' ? 'validator' : 'agent';
}

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// Ferme toutes les sessions ouvertes d'un compte (désactivation, suppression,
// changement de rôle) : sans cela, la personne resterait connectée jusqu'à
// l'expiration de son cookie (8 h).
async function endSessionsOf(userId) {
  await pool.query(`DELETE FROM "session" WHERE (sess->>'userId') = $1`, [String(userId)]);
}

// ---------------------------------------------------------------
// GET /api/admin/users — Liste des comptes (admin et superAdmin)
// ---------------------------------------------------------------
router.get('/users', adminOrSuperAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.role, u.status, u.created_at,
              (SELECT COUNT(*)::int FROM requests r WHERE r.user_id = u.id) AS request_count,
              CASE
                WHEN u.status = 'expired' THEN true
                WHEN u.status = 'pending' AND u.created_at < NOW() - INTERVAL '30 days' THEN true
                ELSE false
              END AS is_expired
       FROM users u
       ORDER BY u.created_at DESC`
    );

    return res.json({ users: result.rows });
  } catch (err) {
    console.error('[admin/users] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// PATCH /api/admin/users/:id/status — Désactiver / réactiver un compte
// (admin et superAdmin). Un administrateur simple ne peut agir que sur les
// agents et les valideurs ; personne ne peut agir sur son propre compte.
// ---------------------------------------------------------------
router.patch(
  '/users/:id/status',
  adminOrSuperAdmin,
  [body('status').isIn(['active', 'disabled']).withMessage('Le statut est invalide.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const targetId = parseId(req.params.id);
    if (!targetId) return res.status(400).json({ error: 'Compte invalide.' });
    if (targetId === req.session.userId) {
      return res.status(403).json({ error: 'Vous ne pouvez pas modifier votre propre compte.' });
    }

    try {
      const found = await pool.query('SELECT id, email, role, status FROM users WHERE id = $1', [targetId]);
      if (found.rows.length === 0) return res.status(404).json({ error: 'Compte introuvable.' });
      const target = found.rows[0];

      if (req.session.userRole !== 'superAdmin' && !['agent', 'validator'].includes(target.role)) {
        return res.status(403).json({ error: 'Seul un superAdmin peut modifier un compte administrateur.' });
      }

      const wanted = req.body.status;
      if (wanted === 'disabled' && target.status !== 'active') {
        return res.status(409).json({ error: 'Seul un compte actif peut être désactivé.' });
      }
      if (wanted === 'active' && target.status !== 'disabled') {
        return res.status(409).json({ error: "Ce compte n'est pas désactivé." });
      }

      const result = await pool.query(
        `UPDATE users SET status = $1, updated_at = NOW() WHERE id = $2
         RETURNING id, first_name, last_name, email, role, status, created_at`,
        [wanted, targetId]
      );
      if (wanted === 'disabled') await endSessionsOf(targetId);

      console.log(`[admin] ${req.session.userEmail} a ${wanted === 'disabled' ? 'désactivé' : 'réactivé'} le compte ${target.email}.`);
      return res.json({
        message: wanted === 'disabled' ? 'Compte désactivé.' : 'Compte réactivé.',
        user: result.rows[0],
      });
    } catch (err) {
      console.error('[admin/user-status] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// Tout ce qui suit est réservé au superAdmin.
router.use(onlySuperAdmin);
// ---------------------------------------------------------------
// POST /api/admin/users — Créer un compte depuis le formulaire admin
// ---------------------------------------------------------------
router.post(
  '/users',
  [
    body('firstName').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('lastName').trim().notEmpty().withMessage('Le nom est requis.'),
    body('email').trim().isEmail().withMessage('Adresse e-mail invalide.'),
    body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { firstName, lastName, email, password, role } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedRole = normalizeRole(role);

    if (!isAllowedDomain(normalizedEmail)) {
      return res.status(403).json({
        error: 'Seules les adresses e-mail du domaine autorisé peuvent être créées par l’admin.',
      });
    }

    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const status = process.env.EMAIL_VERIFICATION_REQUIRED === 'false' ? 'active' : 'pending';

      const creation = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, first_name, last_name, email, role, status, created_at`,
        [firstName.trim(), lastName.trim(), normalizedEmail, passwordHash, normalizedRole, status]
      );

      return res.status(201).json({
        message: 'Compte créé avec succès.',
        user: creation.rows[0],
      });
    } catch (err) {
      console.error('[admin/create-user] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// PUT /api/admin/users/:id — Modifier un compte
// ---------------------------------------------------------------
router.put(
  '/users/:id',
  [
    body('firstName').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('lastName').trim().notEmpty().withMessage('Le nom est requis.'),
    body('email').trim().isEmail().withMessage('Adresse e-mail invalide.'),
    body('role').optional().isString().withMessage('Le rôle est invalide.'),
    body('status').optional().isIn(['active', 'pending', 'expired', 'disabled']).withMessage('Le statut est invalide.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    const { firstName, lastName, email, role, status } = req.body;
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!isAllowedDomain(normalizedEmail)) {
      return res.status(403).json({ error: 'Seules les adresses e-mail du domaine autorisé peuvent être utilisées.' });
    }

    const targetId = parseId(req.params.id);
    if (!targetId) return res.status(400).json({ error: 'Compte invalide.' });

    // Un superAdmin ne peut pas se retirer lui-même l'accès (rôle ou statut).
    if (targetId === req.session.userId && ((role && normalizeRole(role) !== 'superAdmin') || (status && status !== 'active'))) {
      return res.status(403).json({ error: 'Vous ne pouvez pas retirer vos propres droits ni désactiver votre propre compte.' });
    }

    try {
      const duplicate = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2',
        [normalizedEmail, targetId]
      );
      if (duplicate.rows.length > 0) return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });

      const before = await pool.query('SELECT role FROM users WHERE id = $1', [targetId]);

      const result = await pool.query(
        `UPDATE users
         SET first_name = $1, last_name = $2, email = $3,
             role = COALESCE($4, role), status = COALESCE($5, status), updated_at = NOW()
         WHERE id = $6
         RETURNING id, first_name, last_name, email, role, status, created_at`,
        [firstName.trim(), lastName.trim(), normalizedEmail, role ? normalizeRole(role) : null, status || null, targetId]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Compte introuvable.' });

      // Statut ou rôle modifié : les sessions ouvertes portent l'ancien rôle,
      // on les ferme pour que le changement soit immédiat.
      const updated = result.rows[0];
      if (updated.status !== 'active' || (before.rows[0] && before.rows[0].role !== updated.role)) {
        await endSessionsOf(targetId);
      }
      return res.json({ message: 'Compte modifié avec succès.', user: updated });
    } catch (err) {
      console.error('[admin/update-user] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// DELETE /api/admin/users/:id — Supprimer définitivement un compte
//
// Réservé au superAdmin, sur n'importe quel compte sauf le sien. La suppression
// emporte les demandes du compte et leurs pièces jointes (clés étrangères en
// cascade) ; les fichiers stockés sur le disque sont effacés aussi.
// Pour simplement bloquer l'accès en conservant l'historique : désactiver.
// ---------------------------------------------------------------
router.delete('/users/:id', async (req, res) => {
  const targetId = parseId(req.params.id);
  if (!targetId) return res.status(400).json({ error: 'Compte invalide.' });
  if (targetId === req.session.userId) {
    return res.status(403).json({ error: 'Vous ne pouvez pas supprimer votre propre compte.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const found = await client.query('SELECT id, email FROM users WHERE id = $1 FOR UPDATE', [targetId]);
    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Compte introuvable.' });
    }

    const requests = await client.query('SELECT COUNT(*)::int AS n FROM requests WHERE user_id = $1', [targetId]);
    const files = await client.query('SELECT stored_name FROM request_attachments WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM users WHERE id = $1', [targetId]);
    await client.query('COMMIT');

    files.rows.forEach((f) => removeFile(f.stored_name));
    await endSessionsOf(targetId);

    console.log(`[admin] ${req.session.userEmail} a supprimé le compte ${found.rows[0].email} (${requests.rows[0].n} demande(s), ${files.rows.length} fichier(s)).`);
    return res.json({
      message: 'Compte supprimé.',
      deletedRequests: requests.rows[0].n,
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('[admin/delete-user] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  } finally {
    client.release();
  }
});
// ---------------------------------------------------------------
// GET /api/admin/validators — Liste des valideurs
// ---------------------------------------------------------------
router.get('/validators', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.status, u.role, u.created_at
       FROM users u WHERE u.role = 'validator' ORDER BY u.created_at DESC`
    );

    return res.json({ validators: result.rows });
  } catch (err) {
    console.error('[admin/validators] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// POST /api/admin/validators — Créer un nouveau valideur
// ---------------------------------------------------------------
router.post(
  '/validators',
  [
    body('firstName').trim().notEmpty().withMessage('Le prénom est requis.'),
    body('lastName').trim().notEmpty().withMessage('Le nom est requis.'),
    body('email').trim().isEmail().withMessage('Adresse e-mail invalide.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { firstName, lastName, email } = req.body;
    const normalizedEmail = email.trim().toLowerCase();

    try {
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse e-mail.' });
      }

      const userResult = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, status, role)
         VALUES ($1, $2, $3, '', 'active', 'validator') RETURNING id`,
        [firstName.trim(), lastName.trim(), normalizedEmail]
      );

      const userId = userResult.rows[0].id;

      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = getExpiryDate(PASSWORD_SETUP_TTL_HOURS);

      await pool.query(
        `INSERT INTO password_setup_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
      );

      const setupUrl = `${process.env.PUBLIC_BASE_URL}/setup-password?token=${token}`;
      await sendPasswordSetupEmail(normalizedEmail, setupUrl);

      return res.status(201).json({
        message: 'Valideur créé avec succès. Un e-mail de configuration a été envoyé.',
        validator: { id: userId, firstName, lastName, email: normalizedEmail },
      });
    } catch (err) {
      console.error('[admin/create-validator] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/admin/validators/:userId/categories — Associer un valideur à une catégorie
// ---------------------------------------------------------------
router.post(
  '/validators/:userId/categories',
  [body('categoryKey').trim().notEmpty().withMessage('La clé de catégorie est requise.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { categoryKey } = req.body;
    const { userId } = req.params;

    try {
      const userResult = await pool.query('SELECT id FROM users WHERE id = $1 AND role = $2', [
        userId,
        'validator',
      ]);
      if (userResult.rows.length === 0) {
        return res.status(404).json({ error: 'Valideur non trouvé.' });
      }

      const existing = await pool.query(
        'SELECT id FROM validator_categories WHERE user_id = $1 AND category_key = $2',
        [userId, categoryKey]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'Cette association existe déjà.' });
      }

      await pool.query(
        `INSERT INTO validator_categories (user_id, category_key)
         VALUES ($1, $2)`,
        [userId, categoryKey]
      );

      return res.status(201).json({
        message: 'Catégorie associée avec succès.',
        association: { userId, categoryKey },
      });
    } catch (err) {
      console.error('[admin/assign-category] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// GET /api/admin/validators/:userId/categories — Liste des catégories d'un valideur
// ---------------------------------------------------------------
router.get('/validators/:userId/categories', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT category_key FROM validator_categories WHERE user_id = $1`,
      [req.params.userId]
    );

    return res.json({ categories: result.rows.map((row) => row.category_key) });
  } catch (err) {
    console.error('[admin/validator-categories] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// DELETE /api/admin/validators/:userId/categories/:categoryKey — Retirer une catégorie
// ---------------------------------------------------------------
router.delete('/validators/:userId/categories/:categoryKey', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM validator_categories WHERE user_id = $1 AND category_key = $2 RETURNING *`,
      [req.params.userId, req.params.categoryKey]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Association non trouvée.' });
    }

    return res.json({ message: 'Catégorie retirée avec succès.' });
  } catch (err) {
    console.error('[admin/remove-category] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// GET /api/admin/requests — Liste de toutes les demandes (pour les stats)
// ---------------------------------------------------------------
router.get('/requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.reference, r.category_key, r.form_key, r.title, r.status, r.created_at,
              r.notification_status, r.notification_recipients, r.notification_error,
              u.first_name, u.last_name, u.email as user_email
       FROM requests r
       JOIN users u ON r.user_id = u.id
       ORDER BY r.created_at DESC`
    );

    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('[admin/all-requests] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// POST /api/admin/requests/:id/resend-notification — Renvoyer l'e-mail d'une
// demande (destinataire configuré après coup, erreur SMTP passagère…)
// ---------------------------------------------------------------
router.post('/requests/:id/resend-notification', async (req, res) => {
  try {
    const existing = await pool.query('SELECT id FROM requests WHERE id = $1', [req.params.id]);
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Demande introuvable.' });

    const result = await notifyRequest(existing.rows[0].id);
    return res.json({ notification: result.status, error: result.error || null });
  } catch (err) {
    console.error('[admin/resend-notification] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// PATCH /api/admin/requests/:id — Modifier le suivi d'une demande
// ---------------------------------------------------------------
router.patch(
  '/requests/:id',
  [
    body('status').isIn(['brouillon', 'en_cours', 'traitee', 'annulee', 'rejetee']).withMessage('Statut de demande invalide.'),
    body('rejectedReason').optional({ nullable: true }).isString().withMessage('Le motif de rejet est invalide.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ error: errors.array()[0].msg });

    try {
      const result = await pool.query(
        `UPDATE requests
         SET status = $1, rejected_reason = CASE WHEN $1 = 'rejetee' THEN $2 ELSE NULL END, updated_at = NOW()
         WHERE id = $3
         RETURNING id, reference, category_key, form_key, title, status, rejected_reason, created_at, updated_at`,
        [req.body.status, req.body.rejectedReason || null, req.params.id]
      );

      if (result.rows.length === 0) return res.status(404).json({ error: 'Demande introuvable.' });
      return res.json({ message: 'Demande mise à jour avec succès.', request: result.rows[0] });
    } catch (err) {
      console.error('[admin/update-request] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

module.exports = router;
