// Routes de gestion des demandes (formulaires soumis par les agents).
// Toutes ces routes nécessitent une session active (middleware requireAuth) :
// un agent ne peut voir ou créer que ses propres demandes.

const express = require('express');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/pool');
const { requireAuth } = require('../middleware/requireAuth');
const { getForm, validateSubmission } = require('../lib/forms');
const { notifyRequest } = require('../lib/requestMail');
const { extensionOf } = require('../utils/uploads');

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
//
// Le serveur ne reprend du navigateur que la catégorie, le formulaire et les
// données : le titre vient de la définition, et tout est revalidé (champs
// obligatoires, listes fermées, étapes conditionnelles, pièces jointes).
// ---------------------------------------------------------------
const MAX_REFERENCE_ATTEMPTS = 5;

router.post(
  '/',
  requireAuth,
  [
    body('categoryKey').trim().notEmpty().withMessage('La catégorie est requise.'),
    body('formKey').trim().notEmpty().withMessage('Le formulaire est requis.'),
    body('data').isObject().withMessage('Les données doivent être un objet.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { categoryKey, formKey } = req.body;

    const found = getForm(categoryKey, formKey);
    if (!found || found.form.externalUrl) {
      return res.status(400).json({ error: "Ce formulaire n'existe pas." });
    }
    const { form } = found;

    const { errors: formErrors, clean, fileRefs } = validateSubmission(form, req.body.data);
    if (formErrors.length > 0) {
      return res.status(400).json({ error: formErrors[0], errors: formErrors });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Pièces jointes : elles doivent avoir été déposées par CET utilisateur,
      // ne pas être déjà rattachées, et respecter les limites du formulaire.
      const attached = [];
      for (const ref of fileRefs) {
        const { rows } = await client.query(
          `SELECT id, original_name, size_bytes FROM request_attachments
            WHERE id = ANY($1::uuid[]) AND user_id = $2 AND request_id IS NULL`,
          [ref.ids, req.session.userId]
        );
        if (rows.length !== ref.ids.length) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Une pièce jointe est introuvable ou a déjà été utilisée. Redéposez le fichier.' });
        }
        for (const file of rows) {
          const ext = extensionOf(file.original_name);
          if (ref.config.allowed_formats && !ref.config.allowed_formats.includes(ext)) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `Format .${ext} non accepté pour « ${ref.config.label} ».` });
          }
          if (ref.config.max_file_size && file.size_bytes > ref.config.max_file_size) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: `« ${file.original_name} » dépasse la taille maximale autorisée.` });
          }
        }
        clean[ref.step + '-files'] = rows.map((r) => ({ id: r.id, name: r.original_name, size: r.size_bytes }));
        attached.push(...rows.map((r) => r.id));
      }

      // Référence unique (ex. DEM-2026-0001) : en cas de collision entre deux
      // envois simultanés, la contrainte UNIQUE refuse le doublon et on réessaie.
      const year = new Date().getFullYear();
      let request = null;
      for (let attempt = 0; attempt < MAX_REFERENCE_ATTEMPTS && !request; attempt++) {
        const { rows: last } = await client.query(
          `SELECT COALESCE(MAX(SUBSTRING(reference FROM '[0-9]+$')::int), 0) AS n
             FROM requests WHERE reference LIKE $1`,
          [`DEM-${year}-%`]
        );
        const reference = `DEM-${year}-${String(last[0].n + 1 + attempt).padStart(4, '0')}`;
        await client.query('SAVEPOINT insert_request');
        try {
          const inserted = await client.query(
            `INSERT INTO requests (user_id, reference, category_key, form_key, title, data, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [req.session.userId, reference, categoryKey, formKey, form.title, clean, 'en_cours']
          );
          request = inserted.rows[0];
        } catch (err) {
          if (err.code !== '23505') throw err;
          await client.query('ROLLBACK TO SAVEPOINT insert_request');
        }
      }
      if (!request) throw new Error('Impossible de générer une référence unique');

      if (attached.length) {
        await client.query('UPDATE request_attachments SET request_id = $1 WHERE id = ANY($2::uuid[])', [request.id, attached]);
      }

      await client.query('COMMIT');

      // Notification par e-mail (après enregistrement : un échec d'envoi ne
      // fait jamais perdre la demande, il est consigné et peut être renvoyé).
      let notification;
      try {
        notification = (await notifyRequest(request.id)).status;
      } catch (err) {
        // La demande est enregistrée : un incident de notification ne doit pas
        // la transformer en erreur pour l'utilisateur (renvoi possible par l'admin).
        console.error('[requests/notify] Erreur :', err);
        notification = 'failed';
      }
      request.notification_status = notification;

      return res.status(201).json({ request, notification });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[requests/create] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    } finally {
      client.release();
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

    if (result.rows.length === 0) return res.status(404).json({ error: 'Demande non trouvée.' });
    return res.json({ request: result.rows[0] });
  } catch (err) {
    console.error('[requests/details] Erreur :', err);
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
