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
const uploadsRoutes = require('./routes/uploads');
const documentsRoutes = require('./routes/documents');
const { startPurgeSchedule } = require('./utils/uploads');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 16) {
  console.error(
    'SESSION_SECRET est manquant ou trop court (16 caractères minimum). ' +
    "Générez-en un avec : node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  );
  process.exit(1);
}

const PUBLIC_DIR = path.join(__dirname, 'public');

const app = express();

// ---------------------------------------------------------------
// Sécurité de base
// ---------------------------------------------------------------
// La CSP par défaut de Helmet est conservée (scripts uniquement depuis ce
// serveur, aucun gestionnaire en ligne). Seule exception : on retire
// "upgrade-insecure-requests" tant que l'app est servie en HTTP, sinon le
// navigateur réécrit les appels /api/... en https:// et plus rien ne répond
// dès qu'on n'y accède plus par "localhost".
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'upgrade-insecure-requests': process.env.USE_HTTPS === 'true' ? [] : null,
      },
    },
  })
);

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
// middleware/restrictToLan.js avant de changer quoi que ce soit ici.

// Filtre par IP : limite l'accès au réseau interne de l'organisation.
// Couche de défense complémentaire au filtrage réseau (pare-feu, absence
// de NAT public) qui reste la protection principale — voir README.md.
app.use(restrictToLan);


// Limitation du nombre de tentatives sur les routes sensibles, pour
// limiter les attaques par force brute sur le mot de passe ou la
// création de comptes en masse.
//
// - /me est appelé à CHAQUE chargement de page et /logout est sans risque :
//   les compter bloquerait des utilisateurs légitimes (et, derrière un proxy
//   ou un NAT, tous les agents partageant la même adresse IP).
// - Seuls les échecs comptent (skipSuccessfulRequests) : une connexion réussie
//   ne consomme pas de tentative.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 échecs max par IP sur cette fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  skip: (req) => ['/me', '/logout', '/config'].includes(req.path),
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
    store: new pgSession({
      pool,
      tableName: 'session',
      // Une panne de base ne doit pas inonder la console de traces brutes
      errorLog: (err) => console.error('[session] Erreur du magasin de sessions :', err.message || err.code || 'base injoignable'),
    }),
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
app.use('/api', uploadsRoutes);
app.use('/api', documentsRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin', adminRoutes);

// Endpoint de vérification de bon fonctionnement (utile pour le monitoring)
// "build" = date de dernière modification du front servi : permet de vérifier
// d'un coup d'œil quelle version tourne réellement (affichée en bas de page).
app.get('/api/health', (req, res) => {
  let build = null;
  try {
    build = ['index.html', 'app.js', 'ui-events.js']
      .map((f) => fs.statSync(path.join(PUBLIC_DIR, f)).mtimeMs)
      .reduce((a, b) => Math.max(a, b), 0);
    build = new Date(build).toISOString();
  } catch (err) {
    // fichier manquant : on ne bloque pas le health check
  }
  res.json({ status: 'ok', version: require('./package.json').version, build });
});

// ---------------------------------------------------------------
// Pages servies aux liens envoyés par e-mail (voir utils/mailer.js et les
// routes auth/admin pour la construction exacte de ces URLs :
// PUBLIC_BASE_URL + ce chemin + ?token=...). Ces pages appellent ensuite
// les routes /api/auth/... correspondantes en JavaScript, avec le token lu
// dans l'URL.
// ---------------------------------------------------------------
app.get('/verify-email', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'verify-email.html'));
});
app.get('/reset-password', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'reset-password.html'));
});
app.get('/setup-password', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'setup-password.html'));
});

// ---------------------------------------------------------------
// Fichiers statiques du front-end (public/index.html et ses ressources).
// ---------------------------------------------------------------
// no-cache : le navigateur revalide à chaque chargement (ETag), donc une
// modification du front est visible immédiatement, sans Ctrl+F5.
app.use(
  express.static(PUBLIC_DIR, {
    setHeaders: (res) => res.setHeader('Cache-Control', 'no-cache'),
  })
);

// ---------------------------------------------------------------
// Démarrage
// ---------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const useHttps = process.env.USE_HTTPS === 'true';

// Vérifie la base AVANT d'écouter : sans elle, ni les sessions ni aucune
// route ne fonctionnent, et l'erreur brute du pool est illisible.
async function ensureDatabase() {
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    let target = 'DATABASE_URL absent';
    try {
      const u = new URL(process.env.DATABASE_URL);
      target = `${u.hostname}:${u.port || 5432}/${u.pathname.slice(1)}`;
    } catch (e) {
      if (process.env.DATABASE_URL) target = 'DATABASE_URL illisible';
    }
    const reasons = (err.errors || [err]).map((e) => e.message || e.code).filter(Boolean);
    console.error(`\n[DB] Impossible de se connecter à PostgreSQL (${target}) : ${[...new Set(reasons)].join(' | ')}`);
    console.error('[DB] Vérifiez que PostgreSQL est démarré (en développement : npm run dev-db dans un autre terminal)');
    console.error('[DB] et que DATABASE_URL dans .env pointe vers lui. Diagnostic complet : npm run doctor\n');
    process.exit(1);
  }
}

async function startServer() {
  await ensureDatabase();
  startPurgeSchedule();

  if (process.env.ALLOW_TEST_BYPASS === 'true') {
    console.warn(
      '\n[SÉCURITÉ] ALLOW_TEST_BYPASS=true : le bouton « TEST » permet de se connecter SANS mot de passe.\n' +
      '[SÉCURITÉ] À n\'utiliser que sur un environnement de test, jamais en production.\n'
    );
  }

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
