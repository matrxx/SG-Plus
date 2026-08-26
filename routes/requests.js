// Routes de gestion des demandes (formulaires soumis par les agents).
// Toutes ces routes nécessitent une session active (middleware requireAuth) :
// un agent ne peut voir ou créer que ses propres demandes.

const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();
const { upload } = require('../server'); // Importe la configuration Multer

// Route pour soumettre une demande avec pièces jointes
router.post('/submit-request', upload.array('files'), (req, res) => {
  const { formData } = req.body;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Aucun fichier téléchargé.' });
  }

  // Traiter les données du formulaire et les fichiers
  const requestData = {
    ...JSON.parse(formData),
    files: files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path
    }))
  };

  // Ici, tu peux enregistrer requestData en base de données
  // et envoyer un e-mail avec les pièces jointes

  res.json({ success: true, message: 'Demande soumise avec succès.', requestData });
});

module.exports = router;

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

      const result = await pool.query(
        `INSERT INTO requests (user_id, reference, category_key, form_key, title, data, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'en_cours') RETURNING *`,
        [req.session.userId, reference, categoryKey, formKey, title, data]
      );

      return res.status(201).json({ request: result.rows[0] });
    } catch (err) {
      console.error('[requests/create] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// GET /api/requests/:id — Détails d'une demande
// ---------------------------------------------------------------
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM requests WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.session.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Demande non trouvée.' });
    }

    return res.json({ request: result.rows[0] });
  } catch (err) {
    console.error('[requests/details] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});
const { sendRequestEmail } = require('../utils/mailer');

// Route pour soumettre une demande avec pièces jointes
router.post('/submit-request', upload.array('files'), async (req, res) => {
  const { formData, email, firstName } = req.body;
  const files = req.files;

  if (!files || files.length === 0) {
    return res.status(400).json({ error: 'Aucun fichier téléchargé.' });
  }

  const requestData = {
    ...JSON.parse(formData),
    files: files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      path: file.path
    }))
  };

  // Envoyer l'e-mail avec les pièces jointes
  const emailSent = await sendRequestEmail(email, firstName, requestData, requestData.files);

  if (!emailSent) {
    return res.status(500).json({ error: 'Échec de l\'envoi de l\'e-mail.' });
  }

  res.json({ success: true, message: 'Demande soumise avec succès.' });
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
