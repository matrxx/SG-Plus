// Validation du domaine e-mail autorisé pour la création de compte.
// Reprend exactement la logique validée ensemble : comparaison stricte
// sur la partie après le @, insensible à la casse.

const DEFAULT_ALLOWED_DOMAIN = 'culture.gouv.fr';
const ALLOWED_DOMAINS = Array.from(new Set([
  DEFAULT_ALLOWED_DOMAIN,
  ...(process.env.ALLOWED_EMAIL_DOMAIN || '')
    .split(',')
    .map((d) => d.trim().toLowerCase().replace(/^@/, '').replace(/\.$/, ''))
    .filter(Boolean),
]));

function isAllowedDomain(email) {
  if (process.env.ALLOWED_EMAIL_DOMAIN === undefined) {
    console.warn(
      "[avertissement] ALLOWED_EMAIL_DOMAIN non défini dans l'environnement — " +
      "utilisation du domaine par défaut culture.gouv.fr."
    );
  }

  const normalizedEmail = String(email || '').trim().toLowerCase();
  const atIndex = normalizedEmail.lastIndexOf('@');
  if (atIndex <= 0) return false;

  const domain = normalizedEmail.slice(atIndex + 1).replace(/\.$/, '');
  if (!domain) return false;

  return ALLOWED_DOMAINS.includes(domain.toLowerCase());
}

module.exports = { isAllowedDomain };
