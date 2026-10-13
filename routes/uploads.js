// Dépôt et téléchargement des pièces jointes.
//
//  POST   /api/uploads            dépose un fichier (en attente de rattachement)
//  DELETE /api/uploads/:id        retire un dépôt en attente (le sien uniquement)
//  GET    /api/attachments/:id    télécharge (propriétaire de la demande ou admin)

const express = require('express');
const path = require('path');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');
const {
  UPLOAD_DIR,
  MAX_PENDING_PER_USER,
  upload,
  extensionOf,
  fixName,
  hasValidSignature,
  removeFile,
} = require('../utils/uploads');

const router = express.Router();

router.post('/uploads', requireAuth, async (req, res) => {
  try {
    const pending = await pool.query(
      'SELECT COUNT(*)::int AS n FROM request_attachments WHERE user_id = $1 AND request_id IS NULL',
      [req.session.userId]
    );
    if (pending.rows[0].n >= MAX_PENDING_PER_USER) {
      return res.status(429).json({ error: 'Trop de fichiers en attente. Envoyez votre demande ou retirez des fichiers.' });
    }
  } catch (err) {
    console.error('[uploads/quota] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }

  upload.single('file')(req, res, async (err) => {
    if (err) {
      if (req.file) removeFile(req.file.filename);
      if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Fichier trop volumineux (20 Mo maximum).' });
      if (err.code === 'BAD_EXTENSION') return res.status(400).json({ error: err.message });
      console.error('[uploads] Erreur :', err);
      return res.status(400).json({ error: 'Dépôt du fichier impossible.' });
    }
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier reçu.' });

    const originalName = fixName(req.file.originalname);
    const ext = extensionOf(originalName);

    try {
      if (!hasValidSignature(path.join(UPLOAD_DIR, req.file.filename), ext)) {
        removeFile(req.file.filename);
        return res.status(400).json({ error: `Le contenu du fichier ne correspond pas au format .${ext}.` });
      }

      const { rows } = await pool.query(
        `INSERT INTO request_attachments (user_id, original_name, stored_name, mime_type, size_bytes)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [req.session.userId, originalName, req.file.filename, req.file.mimetype, req.file.size]
      );
      return res.status(201).json({ file: { id: rows[0].id, name: originalName, size: req.file.size } });
    } catch (e) {
      removeFile(req.file.filename);
      console.error('[uploads/save] Erreur :', e);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  });
});

router.delete('/uploads/:id', requireAuth, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Fichier introuvable.' });
  try {
    const { rows } = await pool.query(
      'DELETE FROM request_attachments WHERE id = $1 AND user_id = $2 AND request_id IS NULL RETURNING stored_name',
      [req.params.id, req.session.userId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Fichier introuvable.' });
    removeFile(rows[0].stored_name);
    return res.json({ message: 'Fichier retiré.' });
  } catch (err) {
    console.error('[uploads/delete] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

router.get('/attachments/:id', requireAuth, async (req, res) => {
  if (!/^[0-9a-f-]{36}$/i.test(req.params.id)) return res.status(404).json({ error: 'Fichier introuvable.' });
  try {
    const { rows } = await pool.query('SELECT * FROM request_attachments WHERE id = $1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Fichier introuvable.' });
    const file = rows[0];

    const isAdmin = ['admin', 'superAdmin'].includes(req.session.userRole);
    if (file.user_id !== req.session.userId && !isAdmin) {
      return res.status(404).json({ error: 'Fichier introuvable.' }); // 404 : ne révèle pas l'existence
    }

    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.download(path.join(UPLOAD_DIR, file.stored_name), file.original_name);
  } catch (err) {
    console.error('[attachments/download] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  }
});

module.exports = router;
