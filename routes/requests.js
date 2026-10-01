// Routes de gestion des demandes (formulaires soumis par les agents).
// Toutes ces routes nécessitent une session active (middleware requireAuth) :
// un agent ne peut voir ou créer que ses propres demandes.

const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');
const { sendExpenseValidationEmail } = require('../utils/mailer');
const { isAllowedDomain } = require('../utils/emailDomain');

const router = express.Router();

// ---------------------------------------------------------------
// GET /api/requests — Liste des demandes de l'agent connecté
// ---------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, reference, category_key, form_key, title, status, data, created_at, updated_at
       FROM requests WHERE user_id = $1 ORDER BY created_at DESC`,
      [req.session.userId]
    );

    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('[requests/list] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// POST /api/requests — Créer une nouvelle demande
// ---------------------------------------------------------------
router.post(
  '/',
  requireAuth,
  [
    body('categoryKey').trim().notEmpty().withMessage('La catégorie est requise.'),
    body('formKey').trim().notEmpty().withMessage('Le formulaire est requis.'),
    body('title').trim().notEmpty().withMessage('Le titre est requis.'),
    body('data').isObject().withMessage('Les données doivent être un objet.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { categoryKey, formKey, title, data } = req.body;

    try {
      // Générer une référence unique (ex: DEM-2024-0001)
      const year = new Date().getFullYear();
      const refPrefix = 'DEM';
      const refResult = await pool.query(
        `SELECT COUNT(*) as count FROM requests WHERE reference LIKE '${refPrefix}-${year}-%'`
      );
      const count = parseInt(refResult.rows[0].count, 10) + 1;
      const reference = `${refPrefix}-${year}-${String(count).padStart(4, '0')}`;

      const isExpenseRequest = categoryKey === 'budget' && formKey === 'proposition_depenses';
      const initialStatus = isExpenseRequest ? 'en_attente_validation' : 'en_cours';
      const responsibleEmail = isExpenseRequest ? String(data['1-field-5'] || '').trim().toLowerCase() : '';
      const responsibleLastName = isExpenseRequest ? String(data['1-field-3'] || '').trim() : '';
      const responsibleFirstName = isExpenseRequest ? String(data['1-field-4'] || '').trim() : '';
      if (isExpenseRequest && !responsibleEmail) {
        return res.status(400).json({ error: 'L’adresse e-mail du responsable valideur est requise.' });
      }
      if (isExpenseRequest && (!responsibleLastName || !responsibleFirstName)) {
        return res.status(400).json({ error: 'Le nom et le prénom du responsable valideur sont requis.' });
      }
      if (isExpenseRequest && !isAllowedDomain(responsibleEmail)) {
        return res.status(403).json({ error: 'Le responsable valideur doit avoir une adresse e-mail du domaine autorisé.' });
      }
      const result = await pool.query(
        `INSERT INTO requests (user_id, reference, category_key, form_key, title, data, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.session.userId, reference, categoryKey, formKey, title, data, initialStatus]
      );

      if (isExpenseRequest) {
        await sendExpenseValidationEmail(responsibleEmail, responsibleFirstName, result.rows[0]);
      }

      return res.status(201).json({ request: result.rows[0] });
    } catch (err) {
      console.error('[requests/create] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// GET /api/requests/pending-validation — Demandes attribuées au responsable
// ---------------------------------------------------------------
router.get('/pending-validation', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, reference, title, category_key, form_key, status, data, created_at, updated_at
       FROM requests
      WHERE status IN ('en_attente_validation', 'validee_responsable')
         AND LOWER(COALESCE(data->>'1-field-5', '')) = LOWER($1)
       ORDER BY created_at DESC`,
      [req.session.userEmail]
    );
    return res.json({ requests: result.rows });
  } catch (err) {
    console.error('[requests/pending-validation] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// GET /api/requests/:id — Détails d'une demande
// ---------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM requests WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.session.userId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Demande non trouvée.' });
    return res.json({ request: result.rows[0] });
  } catch (err) {
    console.error('[requests/details] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// POST /api/requests/:id/validate-responsible — Signature électronique simple
// ---------------------------------------------------------------
router.post('/:id/validate-responsible', requireAuth, async (req, res) => {
  try {
    if (req.body.signatureAccepted !== true) {
      return res.status(400).json({ error: 'La confirmation de signature est requise.' });
    }

    const result = await pool.query(
      `UPDATE requests
       SET status = 'validee_responsable', validator_id = $1, validated_at = NOW(), updated_at = NOW()
       WHERE id = $2 AND status = 'en_attente_validation'
         AND LOWER(COALESCE(data->>'1-field-5', '')) = LOWER($3)
       RETURNING *`,
      [req.session.userId, req.params.id, req.session.userEmail]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Demande introuvable ou déjà validée.' });
    return res.json({ message: 'Demande validée par signature électronique simple.', request: result.rows[0] });
  } catch (err) {
    console.error('[requests/validate-responsible] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// POST /api/requests/:id/transmit-budget — Transmission au service budget
// ---------------------------------------------------------------
router.post('/:id/transmit-budget', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE requests
       SET status = 'transmise_budget', updated_at = NOW()
       WHERE id = $1 AND status = 'validee_responsable'
         AND (user_id = $2 OR LOWER(COALESCE(data->>'1-field-5', '')) = LOWER($3))
       RETURNING *`,
      [req.params.id, req.session.userId, req.session.userEmail]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Demande introuvable ou non validée.' });
    return res.json({ message: 'Demande transmise au service budget.', request: result.rows[0] });
  } catch (err) {
    console.error('[requests/transmit-budget] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

// ---------------------------------------------------------------
// PUT /api/requests/:id — Mettre à jour une demande (brouillon)
// ---------------------------------------------------------------
router.put(
  '/:id',
  requireAuth,
  [
    body('data').isObject().withMessage('Les données doivent être un objet.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { data } = req.body;

    try {
      const result = await pool.query(
        `UPDATE requests SET data = $1, updated_at = now() WHERE id = $2 AND user_id = $3 RETURNING *`,
        [data, req.params.id, req.session.userId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Demande non trouvée.' });
      }

      return res.json({ request: result.rows[0] });
    } catch (err) {
      console.error('[requests/update] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// DELETE /api/requests/:id — Supprimer une demande (brouillon uniquement)
// ---------------------------------------------------------------
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM requests WHERE id = $1 AND user_id = $2 AND status = 'brouillon' RETURNING *`,
      [req.params.id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée ou déjà soumise.' });
    }

    return res.json({ message: 'Demande supprimée avec succès.' });
  } catch (err) {
    console.error('[requests/delete] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

module.exports = router;
