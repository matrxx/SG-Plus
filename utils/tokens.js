// Génération et vérification des tokens à usage unique (vérification
// d'e-mail, réinitialisation de mot de passe, définition de mot de passe).
//
// Principe : on génère un token aléatoire, on l'envoie en clair par e-mail,
// mais on ne stocke en base QUE son empreinte (hash SHA-256). Ainsi, même
// en cas de fuite de la base de données, les tokens ne sont pas exploitables
// directement — il faudrait déjà connaître le token original.

const crypto = require('crypto');

const EMAIL_VERIFICATION_TTL_HOURS = 24;
const PASSWORD_RESET_TTL_HOURS = 1;
const PASSWORD_SETUP_TTL_HOURS = 72;

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function getExpiryDate(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

module.exports = {
  generateToken,
  hashToken,
  getExpiryDate,
  EMAIL_VERIFICATION_TTL_HOURS,
  PASSWORD_RESET_TTL_HOURS,
  PASSWORD_SETUP_TTL_HOURS,
};
