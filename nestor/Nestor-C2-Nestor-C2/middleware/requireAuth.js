// Middleware à placer devant toute route qui nécessite un agent connecté
// (ex: soumission de formulaire, consultation de "Suivre mes demandes").
//
// Usage : router.get('/requests', requireAuth, async (req, res) => { ... });

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Authentification requise.' });
  }
  next();
}

module.exports = { requireAuth };
