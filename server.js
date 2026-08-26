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
// Sécurité
// ---------------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: false,
    hsts: false
  })
);


// ---------------------------------------------------------------
// Restriction réseau interne
// ---------------------------------------------------------------


// ---------------------------------------------------------------
// Limitation brute force
// ---------------------------------------------------------------
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Trop de tentatives. Veuillez réessayer plus tard.'
  }
});


app.use(express.json());


// ---------------------------------------------------------------
// Sessions PostgreSQL
// ---------------------------------------------------------------
const cookieSecure = process.env.USE_HTTPS === 'true';

app.use(
  session({
    store: new pgSession({
      pool,
      tableName: 'session'
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: cookieSecure,
      maxAge: 1000 * 60 * 60 * 8,
      sameSite: 'lax'
    }
  })
);


// ---------------------------------------------------------------
// API
// ---------------------------------------------------------------
app.use(restrictToLan);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/requests', requestsRoutes);
app.use('/api/admin', adminRoutes);


// ---------------------------------------------------------------
// Healthcheck
// ---------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok'
  });
});


// ---------------------------------------------------------------
// Pages publiques avec token
// ---------------------------------------------------------------
app.get('/verify-email', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'verify-email.html')
  );
});


app.get('/reset-password', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'reset-password.html')
  );
});


app.get('/setup-password', (req, res) => {
  res.sendFile(
    path.join(__dirname, 'public', 'setup-password.html')
  );
});


// ---------------------------------------------------------------
// Frontend
// ---------------------------------------------------------------
app.use(express.static(
  path.join(__dirname, 'public')
));


// ---------------------------------------------------------------
// Démarrage serveur
// ---------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const useHttps = process.env.USE_HTTPS === 'true';


async function startServer() {

  if (useHttps) {

    if (!process.env.TLS_KEY_PATH ||
        !process.env.TLS_CERT_PATH) {

      console.error(
        'TLS_KEY_PATH et TLS_CERT_PATH manquants dans .env'
      );

      process.exit(1);
    }


    const httpsOptions = {
      key: fs.readFileSync(process.env.TLS_KEY_PATH),
      cert: fs.readFileSync(process.env.TLS_CERT_PATH)
    };


    https.createServer(
      httpsOptions,
      app
    ).listen(PORT, async () => {

      console.log(
        `Serveur HTTPS démarré sur le port ${PORT}`
      );

      await verifySmtpConnection();

    });


  } else {


    app.listen(PORT, async () => {

      console.log(
        `Serveur HTTP démarré sur le port ${PORT}`
      );

      await verifySmtpConnection();

    });

  }

}


startServer();


// ---------------------------------------------------------------
// Arrêt propre
// ---------------------------------------------------------------
process.on('SIGTERM', async () => {

  console.log(
    'Arrêt propre du serveur'
  );

  await pool.end();

  process.exit(0);

});
