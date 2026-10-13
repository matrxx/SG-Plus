// Middleware à placer devant toute route réservée à un ou plusieurs rôles
// spécifiques (admin, valideur). S'appuie sur req.session.userRole, qui est
// renseigné à la connexion (voir routes/auth.js) — ce middleware doit donc
// toujours être utilisé après requireAuth dans la chaîne de middlewares,
// pour garantir qu'une session existe avant de tenter de lire son rôle.
//
// Usage :
//   router.get('/admin/validators', requireAuth, requireRole('admin'), handler);
//   router.get('/validation/queue', requireAuth, requireRole('valideur', 'admin'), handler);

function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.session || !req.session.userRole) {
      // Ne devrait normalement pas arriver si requireAuth est bien placé
      // avant ce middleware — filet de sécurité au cas où l'ordre serait
      // un jour inversé par erreur dans une route.
      return res.status(401).json({ error: 'Authentification requise.' });
    }

    if (!allowedRoles.includes(req.session.userRole)) {
      return res.status(403).json({ error: "Vous n'avez pas les droits nécessaires pour cette action." });
    }

    next();
  };
}

module.exports = { requireRole };
