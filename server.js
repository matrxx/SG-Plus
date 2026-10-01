require('dotenv').config();

const https = require('https');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { pool } = require('./db/pool');
const { verifySmtpConnection } = require('./utils/mailer');
const { restrictToLan } = require('./middleware/restrictToLan');
const authRoutes = require('./routes/auth');
const requestsRoutes = require('./routes/requests');
const adminRoutes = require('./routes/admin');

const app = express();

// ---------------------------------------------------------------
// Sécurité de base
// ---------------------------------------------------------------
app.use(helmet());

// Pas de configuration CORS nécessaire ici : public/index.html est servi
// par ce même serveur Express (même origine que l'API), donc le navigateur
// n'applique aucune restriction cross-origin sur les appels fetch() du
// front vers /api/.... Si un jour le front est déplacé sur un serveur
// séparé, il faudra réintroduire le module "cors" — voir l'historique du
// projet ou la documentation Express à ce sujet.

// IMPORTANT : pas de reverse proxy devant ce serveur pour le moment, donc
// on NE configure PAS app.set('trust proxy', ...). Activer ce réglage
// sans proxy réel permettrait à un client distant de falsifier son IP
// apparente via l'en-tête X-Forwarded-For et de contourner restrictToLan
// ci-dessous. Si un reverse proxy est ajouté un jour, voir la note dans
// src/middleware/restrictToLan.js avant de changer quoi que ce soit ici.

// Filtre par IP : limite l'accès au réseau interne de l'organisation.
// Couche de défense complémentaire au filtrage réseau (pare-feu, absence
// de NAT public) qui reste la protection principale — voir README.md.
app.use(restrictToLan);


// Limitation du nombre de tentatives sur les routes sensibles, pour
// limiter les attaques par force brute sur le mot de passe ou la
// création de comptes en masse.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 tentatives max par IP sur cette fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives. Veuillez réessayer plus tard.' },
});

app.use(express.json());

// ---------------------------------------------------------------
// Sessions stockées en base PostgreSQL (table "session", créée par schema.sql)
//
// public/index.html est servi par ce même serveur Express, donc le front
// et l'API partagent la même origine : sameSite: 'lax' suffit pour que le
// cookie de session soit transmis normalement par le navigateur, sans
// configuration particulière. USE_HTTPS=true reste fortement recommandé
// (le cookie est alors marqué "secure", donc jamais transmis en clair),
// mais n'est plus une condition technique pour que la connexion fonctionne.
// ---------------------------------------------------------------
const cookieSecure = process.env.USE_HTTPS === 'true';

app.use(
  session({
    store: new pgSession({ pool, tableName: 'session' }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 1000 * 60 * 60 * 8, // 8 heures
      sameSite: 'lax',
    },
  })
);

// ---------------------------------------------------------------
// Routes API
// ---------------------------------------------------------------
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin', adminRoutes);

// Endpoint de vérification de bon fonctionnement (utile pour le monitoring)
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// ---------------------------------------------------------------
// Pages servies aux liens envoyés par e-mail (voir src/utils/mailer.js
// pour la construction exacte de ces URLs : PUBLIC_BASE_URL + ce chemin
// + ?token=...). Ces pages appellent ensuite les routes /api/auth/...
// correspondantes en JavaScript, avec le token lu dans l'URL.
// ---------------------------------------------------------------
app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'verify-email.html'));
});
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'reset-password.html'));
});
app.get('/setup-password', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'setup-password.html'));
});

// ---------------------------------------------------------------
// Fichiers statiques du front-end (public/index.html et ses ressources).
// ---------------------------------------------------------------
app.use(express.static(path.join(__dirname, '..', 'public')));

// ---------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const useHttps = process.env.USE_HTTPS === 'true';

async function startServer() {
  if (useHttps) {
    if (!process.env.TLS_KEY_PATH || !process.env.TLS_CERT_PATH) {
      console.error(
        'USE_HTTPS=true mais TLS_KEY_PATH et/ou TLS_CERT_PATH ne sont pas renseignés dans .env. ' +
        "Voir README.md, section \"HTTPS avec certificat auto-signé\", pour générer ces fichiers."
      );
      process.exit(1);
    }

    let httpsOptions;
    try {
      httpsOptions = {
        key: fs.readFileSync(process.env.TLS_KEY_PATH),
        cert: fs.readFileSync(process.env.TLS_CERT_PATH),
      };
    } catch (err) {
      console.error(
        `Impossible de lire la clé ou le certificat TLS (${err.message}). ` +
        'Vérifiez les chemins TLS_KEY_PATH et TLS_CERT_PATH dans .env.'
      );
      process.exit(1);
    }

    https.createServer(httpsOptions, app).listen(PORT, async () => {
      console.log(
        `Serveur HTTPS démarré sur le port ${PORT} (environnement: ${process.env.NODE_ENV || 'development'})`
      );
      console.log(
        'Certificat auto-signé : les navigateurs afficheront un avertissement de sécurité ' +
        "tant que ce certificat n'est pas importé dans le magasin de confiance des postes. " +
        'Voir README.md pour la procédure.'
      );
      await verifySmtpConnection();
    });
  } else {
    app.listen(PORT, async () => {
      console.log(
        `Serveur HTTP (sans chiffrement) démarré sur le port ${PORT} (environnement: ${process.env.NODE_ENV || 'development'})`
      );
      console.log(
        "USE_HTTPS n'est pas activé — adapté pour un développement local, " +
        'mais à activer avant tout usage avec de vraies données d\'agents. Voir README.md.'
      );
      await verifySmtpConnection();
    });
  }
}

startServer();

// Arrêt propre du pool de connexions à la base lors de l'arrêt du serveur
process.on('SIGTERM', async () => {
  console.log('Signal SIGTERM reçu, fermeture propre du serveur...');
  await pool.end();
  process.exit(0);
});
