// Restreint l'accès au serveur aux seules adresses IP du réseau interne
// de l'organisation. C'est une couche de défense supplémentaire — la
// vraie protection doit venir du réseau lui-même (pas de NAT/port
// forwarding public vers ce serveur, voir README.md). Ce middleware sert
// de filet de sécurité si jamais la configuration réseau change un jour.
//
// IMPORTANT : ce middleware lit req.socket.remoteAddress, PAS l'en-tête
// X-Forwarded-For. C'est volontaire : sans reverse proxy devant ce
// serveur, un client distant pourrait écrire n'importe quoi dans cet
// en-tête pour usurper une IP interne. Si un reverse proxy est ajouté un
// jour, voir la note en bas de ce fichier avant de changer cette logique.

const { isIP } = require('net');

// Renseigner ici les plages IP du réseau interne, au format CIDR, une fois
// communiquées par le service informatique. Exemples courants :
//   '10.0.0.0/8'        → tout le bloc 10.x.x.x
//   '192.168.0.0/16'    → tout le bloc 192.168.x.x
//   '172.16.0.0/12'     → tout le bloc 172.16.x.x à 172.31.x.x
const ALLOWED_RANGES = (process.env.ALLOWED_IP_RANGES || '')
  .split(',')
  .map((r) => r.trim())
  .filter(Boolean);

function ipToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIpInCidr(ip, cidr) {
  if (isIP(ip) !== 4) return false; // ne gère que l'IPv4 ; adapter si le réseau utilise l'IPv6
  const [rangeIp, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr, 10);
  if (isIP(rangeIp) !== 4 || Number.isNaN(prefix) || prefix < 0 || prefix > 32) return false;

  const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(rangeIp) & mask);
}

function normalizeIp(rawIp) {
  // Les connexions IPv4 sur un serveur Node arrivent parfois préfixées
  // en "::ffff:" (notation IPv4-mapped IPv6) — on la retire pour comparer.
  return rawIp.startsWith('::ffff:') ? rawIp.slice(7) : rawIp;
}

function restrictToLan(req, res, next) {
  if (ALLOWED_RANGES.length === 0) {
    console.warn(
      "[avertissement] ALLOWED_IP_RANGES n'est pas configuré — " +
      "le filtrage par IP est désactivé. À renseigner dans .env une fois " +
      "la plage du réseau interne communiquée par le service informatique."
    );
    return next();
  }

  const clientIp = normalizeIp(req.socket.remoteAddress || '');
  const allowed = ALLOWED_RANGES.some((range) => isIpInCidr(clientIp, range));

  if (!allowed) {
    console.warn(`[restrictToLan] Accès refusé depuis une IP hors réseau interne : ${clientIp}`);
    return res.status(403).json({ error: 'Accès refusé : ce service est réservé au réseau interne.' });
  }

  next();
}

module.exports = { restrictToLan };

// ---------------------------------------------------------------------
// Note pour le futur : si un reverse proxy interne est ajouté un jour
// devant ce serveur (nginx, IIS, HAProxy...), il faudra :
//   1. Configurer le proxy pour qu'il transmette la vraie IP du client
//      dans l'en-tête X-Forwarded-For.
//   2. Activer app.set('trust proxy', ...) dans server.js avec la valeur
//      adaptée (idéalement le nombre de proxies de confiance, pas `true`).
//   3. Modifier ce middleware pour lire req.ip (qui tient alors compte de
//      X-Forwarded-For correctement) au lieu de req.socket.remoteAddress.
// Tant qu'il n'y a pas de proxy, ne PAS faire ces changements : cela
// ouvrirait une faille permettant de usurper une IP interne.
// ---------------------------------------------------------------------
