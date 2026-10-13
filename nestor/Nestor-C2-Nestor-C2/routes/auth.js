// Routes d'authentification.
// Reprend la logique métier validée dans nos échanges :
//  - auto-inscription avec vérification de domaine
//  - activation automatique au clic du lien (pas d'étape manuelle)
//  - aucune fuite d'information sur les comptes existants
//  - mots de passe hachés en argon2id, jamais stockés en clair

const express = require('express');
const argon2 = require('argon2');
const { body, validationResult } = require('express-validator');
const { pool } = require('../db/pool');
const { isAllowedDomain } = require('../utils/emailDomain');
const {
  generateToken,
  hashToken,
  getExpiryDate,
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_HOURS,
  PASSWORD_SETUP_TTL_HOURS,
} = require('../utils/tokens');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/mailer');

const router = express.Router();

function isExchangeConfigured() {
  return (process.env.AUTH_MODE || '').toLowerCase() === 'exchange' && Boolean(process.env.EXCHANGE_AUTH_URL);
}

function normalizeExchangeUser(payload) {
  const user = payload?.user || payload?.account || payload || {};
  const email = (user.email || user.mail || '').trim().toLowerCase();

  if (!email) return null;

  return {
    id: user.id || email,
    email,
    firstName: user.firstName || user.firstname || user.givenName || '',
    lastName: user.lastName || user.lastname || user.familyName || '',
    role: user.role || 'agent',
  };
}

async function authenticateWithExchange(email, password) {
  if (!isExchangeConfigured()) {
    throw new Error('Le connecteur Exchange n\'est pas configuré.');
  }

  const response = await fetch(process.env.EXCHANGE_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || data.message || 'Échec de l\'authentification Exchange.');
  }

  const user = normalizeExchangeUser(data);
  if (!user) {
    throw new Error('Réponse Exchange incomplète.');
  }

  return user;
}

// Retrouve (ou crée au premier passage) le compte local correspondant à une
// identité validée par Exchange. Les nouveaux comptes sont des agents sans
// mot de passe local ; l'élévation de rôle passe par l'administration.
async function findOrCreateExchangeUser(exchangeUser) {
  const existing = await pool.query('SELECT * FROM users WHERE email = $1', [exchangeUser.email]);
  if (existing.rows.length > 0) return existing.rows[0];

  const created = await pool.query(
    `INSERT INTO users (email, first_name, last_name, password_hash, role, status, email_verified)
     VALUES ($1, $2, $3, '', 'agent', 'active', TRUE)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`,
    [
      exchangeUser.email,
      exchangeUser.firstName || exchangeUser.email.split('@')[0],
      exchangeUser.lastName || '-',
    ]
  );
  return created.rows[0];
}

// Message volontairement identique dans tous les cas (nouveau compte,
// compte déjà actif, compte en attente) pour ne pas permettre à quelqu'un
// de déduire si une adresse e-mail est déjà inscrite (anti-énumération).
// NOTE: Lorsque EMAIL_VERIFICATION_REQUIRED est false, les comptes sont activés automatiquement
const GENERIC_SIGNUP_RESPONSE = {
  message:
    process.env.EMAIL_VERIFICATION_REQUIRED === 'false' 
      ? "Votre compte a été créé avec succès. Vous pouvez maintenant vous connecter."
      : "Si les conditions sont remplies, un e-mail de vérification a été envoyé à l'adresse fournie.",
};

// ---------------------------------------------------------------
// POST /api/auth/signup
// ---------------------------------------------------------------
router.post(
  '/signup',
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

    const { firstName, lastName, password } = req.body;
    const email = req.body.email.trim().toLowerCase();

    // Le domaine non autorisé est la SEULE situation où l'on répond
    // différemment — ce n'est pas une fuite d'information sur les comptes,
    // c'est une règle d'accès publique (le domaine accepté n'est pas secret).
    if (!isAllowedDomain(email)) {
      return res.status(403).json({
        error: "Seules les adresses e-mail du domaine autorisé peuvent créer un compte.",
      });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const existing = await client.query('SELECT id, status FROM users WHERE email = $1', [email]);

      let userId;

      if (existing.rows.length > 0 && existing.rows[0].status === 'active') {
        // Compte déjà actif : on ne crée rien, on ne révèle rien de plus.
        await client.query('COMMIT');
        return res.json(GENERIC_SIGNUP_RESPONSE);
      }

      if (existing.rows.length > 0 && existing.rows[0].status === 'pending') {
        // Compte en attente de vérification : on active automatiquement si EMAIL_VERIFICATION_REQUIRED=false
        // sinon on régénère un token
        userId = existing.rows[0].id;
        
        if (process.env.EMAIL_VERIFICATION_REQUIRED === 'false') {
          await client.query('UPDATE users SET status = $1, updated_at = now() WHERE id = $2', ['active', userId]);
          await client.query('COMMIT');
          return res.json(GENERIC_SIGNUP_RESPONSE);
        }
      } else {
        // Nouveau compte : créer avec status 'active' si EMAIL_VERIFICATION_REQUIRED=false, sinon 'pending'
        const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
        const status = process.env.EMAIL_VERIFICATION_REQUIRED === 'false' ? 'active' : 'pending';
        const insertResult = await client.query(
          `INSERT INTO users (first_name, last_name, email, password_hash, status)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [firstName.trim(), lastName.trim(), email, passwordHash, status]
        );
        userId = insertResult.rows[0].id;
      }

      // Si la vérification par email est désactivée, on ne génère pas de token
      if (process.env.EMAIL_VERIFICATION_REQUIRED === 'false') {
        await client.query('COMMIT');
        return res.json(GENERIC_SIGNUP_RESPONSE);
      }

      // Sinon, on génère le token et on envoie l'email (code existant pour réactivation future)
      const token = generateToken();
      const tokenHash = hashToken(token);
      const expiresAt = getExpiryDate(EMAIL_VERIFICATION_TTL_HOURS);

      await client.query(
        `INSERT INTO email_verifications (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [userId, tokenHash, expiresAt]
      );

      await client.query('COMMIT');

      const verificationUrl = `${process.env.PUBLIC_BASE_URL}/verify-email?token=${token}`;
      await sendVerificationEmail(email, firstName.trim(), verificationUrl);

      return res.json(GENERIC_SIGNUP_RESPONSE);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[auth/signup] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    } finally {
      client.release();
    }
  }
);

// POST /api/auth/bypass
router.post('/bypass', (req, res) => {
  // Le bypass reste disponible tant que le connecteur Exchange n'est pas
  // configuré. Il permet de continuer à tester le front sans casser la version.
  const isRender = process.env.RENDER_ENV === 'true' || req.headers.host?.includes('nestor-c2.onrender.com');
  const exchangeConfigured = isExchangeConfigured();

  if (!exchangeConfigured && process.env.NODE_ENV !== 'test' && process.env.NODE_ENV !== 'development' && !isRender) {
    return res.status(403).json({ error: "Cette route est désactivée." });
  }

  req.session.userId = 1;
  req.session.userEmail = 'test@culture.gouv.fr';
  req.session.userRole = 'admin';
  req.session.userFirstName = 'Test';
  req.session.userLastName = 'Utilisateur';

  return res.json({
    message: 'Bypass activé.',
    user: { email: 'test@culture.gouv.fr', role: 'admin', firstName: 'Test', lastName: 'Utilisateur' },
  });
});

// ---------------------------------------------------------------
// GET /api/auth/verify-email?token=...
// ---------------------------------------------------------------
router.get('/verify-email', async (req, res) => {
  const { token } = req.query;
  if (!token) {
    return res.status(400).json({ error: 'Token manquant.' });
  }

  const tokenHash = hashToken(String(token));
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT id, user_id, expires_at, used_at FROM email_verifications WHERE token_hash = $1`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Lien de vérification invalide.' });
    }

    const verification = result.rows[0];

    if (verification.used_at) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ce lien a déjà été utilisé.' });
    }

    if (new Date(verification.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: 'Ce lien a expiré. Vous pouvez demander un nouvel e-mail de vérification.',
      });
    }

    await client.query('UPDATE users SET status = $1, updated_at = now() WHERE id = $2', [
      'active',
      verification.user_id,
    ]);
    await client.query('UPDATE email_verifications SET used_at = now() WHERE id = $1', [
      verification.id,
    ]);

    await client.query('COMMIT');
    return res.json({ message: 'Votre compte a été activé avec succès.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[auth/verify-email] Erreur :', err);
    return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------------
router.post(
  '/login',
  [
    body('email').trim().isEmail().withMessage('Adresse e-mail invalide.'),
    body('password').notEmpty().withMessage('Mot de passe requis.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const email = req.body.email.trim().toLowerCase();
    const { password } = req.body;

    const GENERIC_LOGIN_ERROR = { error: 'Adresse e-mail ou mot de passe incorrect.' };

    try {
      let user;

      if (isExchangeConfigured()) {
        let exchangeUser;
        try {
          exchangeUser = await authenticateWithExchange(email, password);
        } catch (exchangeError) {
          console.warn('[auth/login] Exchange auth failed:', exchangeError.message);
          return res.status(401).json(GENERIC_LOGIN_ERROR);
        }

        if (!isAllowedDomain(exchangeUser.email)) {
          return res.status(401).json(GENERIC_LOGIN_ERROR);
        }

        // Compte local lié à l'identité Exchange : l'ID de session doit être
        // l'ID entier de users (clé étrangère de requests.user_id). Le rôle
        // vient de NOTRE base, jamais de la réponse du connecteur.
        const localUser = await findOrCreateExchangeUser(exchangeUser);
        if (localUser.status !== 'active') {
          return res.status(401).json(GENERIC_LOGIN_ERROR);
        }
        user = {
          id: localUser.id,
          email: localUser.email,
          firstName: localUser.first_name,
          lastName: localUser.last_name,
          role: localUser.role,
        };
      } else {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
          return res.status(401).json(GENERIC_LOGIN_ERROR);
        }

        const localUser = result.rows[0];

        if (localUser.status !== 'active') {
          return res.status(401).json({
            error: "Ce compte n'est pas encore activé. Vérifiez votre boîte mail.",
          });
        }

        // Compte sans mot de passe (valideur pas encore activé, ou compte
        // Exchange) : même réponse qu'un mauvais mot de passe.
        if (!localUser.password_hash) {
          return res.status(401).json(GENERIC_LOGIN_ERROR);
        }

        const passwordValid = await argon2.verify(localUser.password_hash, password);
        if (!passwordValid) {
          return res.status(401).json(GENERIC_LOGIN_ERROR);
        }

        user = {
          id: localUser.id,
          email: localUser.email,
          firstName: localUser.first_name,
          lastName: localUser.last_name,
          role: localUser.role,
        };
      }

      req.session.userId = user.id;
      req.session.userEmail = user.email;
      req.session.userRole = user.role || 'agent';

      return res.json({
        message: 'Connexion réussie.',
        user: {
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role || 'agent',
        },
      });
    } catch (err) {
      console.error('[auth/login] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/auth/logout
// ---------------------------------------------------------------
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('[auth/logout] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue.' });
    }
    res.clearCookie('connect.sid');
    return res.json({ message: 'Déconnexion réussie.' });
  });
});

// ---------------------------------------------------------------
// POST /api/auth/forgot-password
// ---------------------------------------------------------------
router.post(
  '/forgot-password',
  [body('email').trim().isEmail().withMessage('Adresse e-mail invalide.')],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const email = req.body.email.trim().toLowerCase();

    // Même principe anti-énumération que pour l'inscription : la réponse
    // ne change jamais, que le compte existe ou non.
    const GENERIC_RESPONSE = {
      message: 'Si cette adresse correspond à un compte existant, un lien a été envoyé.',
    };

    try {
      const result = await pool.query("SELECT id FROM users WHERE email = $1 AND status = 'active'", [
        email,
      ]);

      if (result.rows.length > 0) {
        const userId = result.rows[0].id;
        const token = generateToken();
        const tokenHash = hashToken(token);
        const expiresAt = getExpiryDate(PASSWORD_RESET_TTL_HOURS);

        await pool.query(
          `INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
          [userId, tokenHash, expiresAt]
        );

        const resetUrl = `${process.env.PUBLIC_BASE_URL}/reset-password?token=${token}`;
        await sendPasswordResetEmail(email, resetUrl);
      }

      return res.json(GENERIC_RESPONSE);
    } catch (err) {
      console.error('[auth/forgot-password] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    }
  }
);

// ---------------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------------
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token manquant.'),
    body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT id, user_id, expires_at, used_at FROM password_resets WHERE token_hash = $1`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Lien de réinitialisation invalide.' });
      }

      const reset = result.rows[0];

      if (reset.used_at || new Date(reset.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Ce lien a expiré ou a déjà été utilisé. Veuillez refaire une demande.',
        });
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
        passwordHash,
        reset.user_id,
      ]);
      await client.query('UPDATE password_resets SET used_at = now() WHERE id = $1', [reset.id]);

      await client.query('COMMIT');
      return res.json({ message: 'Votre mot de passe a été modifié avec succès.' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[auth/reset-password] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    } finally {
      client.release();
    }
  }
);

// ---------------------------------------------------------------
// POST /api/auth/setup-password — utilisée par un compte valideur créé
// par l'administrateur, pour définir son propre mot de passe à partir du
// lien reçu par e-mail, avant sa première connexion. Distincte de
// reset-password : ce token vient de password_setup_tokens, pas de
// password_resets, et le compte est déjà actif (créé directement par
// l'admin) plutôt qu'en attente de vérification.
// ---------------------------------------------------------------
router.post(
  '/setup-password',
  [
    body('token').notEmpty().withMessage('Token manquant.'),
    body('password').isLength({ min: 8 }).withMessage('Le mot de passe doit contenir au moins 8 caractères.'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array()[0].msg });
    }

    const { token, password } = req.body;
    const tokenHash = hashToken(token);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `SELECT id, user_id, expires_at, used_at FROM password_setup_tokens WHERE token_hash = $1`,
        [tokenHash]
      );

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Lien invalide.' });
      }

      const setupToken = result.rows[0];

      if (setupToken.used_at || new Date(setupToken.expires_at) < new Date()) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          error: 'Ce lien a expiré ou a déjà été utilisé. Contactez votre administrateur pour un nouveau lien.',
        });
      }

      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      await client.query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
        passwordHash,
        setupToken.user_id,
      ]);
      await client.query('UPDATE password_setup_tokens SET used_at = now() WHERE id = $1', [setupToken.id]);

      await client.query('COMMIT');
      return res.json({ message: 'Votre mot de passe a été défini avec succès.' });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('[auth/setup-password] Erreur :', err);
      return res.status(500).json({ error: 'Une erreur est survenue, veuillez réessayer.' });
    } finally {
      client.release();
    }
  }
);

// ---------------------------------------------------------------
// GET /api/auth/me  — savoir si une session est active (utile au chargement du front)
// ---------------------------------------------------------------
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ authenticated: false });
  }
  return res.json({ authenticated: true, email: req.session.userEmail, role: req.session.userRole });
});

module.exports = router;
