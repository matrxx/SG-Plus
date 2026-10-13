// Stockage des pièces jointes.
//
// - Les fichiers sont écrits HORS du dossier public, sous un nom aléatoire
//   sans extension : ils ne sont jamais servis ni exécutés directement, seul
//   le téléchargement contrôlé (routes/uploads.js) y donne accès.
// - Extension + signature (octets de tête) sont contrôlées.
// - Un dépôt jamais rattaché à une demande est purgé après 24 h.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { pool } = require('../db/pool');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');
const HARD_MAX_BYTES = 20 * 1024 * 1024; // plafond absolu, chaque formulaire peut être plus strict
const MAX_PENDING_PER_USER = 20;
const ORPHAN_TTL_HOURS = 24;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Signatures de fichiers (octets de tête) par extension. "raw" n'a pas de
// signature unique : seule l'extension est contrôlée pour ce format.
const SIGNATURES = {
  pdf: [[0x25, 0x50, 0x44, 0x46]],
  jpg: [[0xff, 0xd8, 0xff]],
  jpeg: [[0xff, 0xd8, 0xff]],
  png: [[0x89, 0x50, 0x4e, 0x47]],
  tif: [[0x49, 0x49, 0x2a, 0x00], [0x4d, 0x4d, 0x00, 0x2a]],
  tiff: [[0x49, 0x49, 0x2a, 0x00], [0x4d, 0x4d, 0x00, 0x2a]],
  docx: [[0x50, 0x4b, 0x03, 0x04]],
  xlsx: [[0x50, 0x4b, 0x03, 0x04]],
  doc: [[0xd0, 0xcf, 0x11, 0xe0]],
  xls: [[0xd0, 0xcf, 0x11, 0xe0]],
  raw: null,
};
const ALLOWED_EXTENSIONS = Object.keys(SIGNATURES);

function extensionOf(name) {
  return path.extname(String(name || '')).replace('.', '').toLowerCase();
}

// multer lit le nom en latin1 : on le remet en UTF-8 (accents des noms de fichiers)
function fixName(name) {
  const decoded = Buffer.from(String(name || ''), 'latin1').toString('utf8');
  return decoded.replace(/[\u0000-\u001F\u007F\\/]/g, '_').slice(0, 200) || 'fichier';
}

function hasValidSignature(filePath, ext) {
  const signatures = SIGNATURES[ext];
  if (!signatures) return true;
  const fd = fs.openSync(filePath, 'r');
  try {
    const head = Buffer.alloc(8);
    fs.readSync(fd, head, 0, 8, 0);
    return signatures.some((sig) => sig.every((byte, i) => head[i] === byte));
  } finally {
    fs.closeSync(fd);
  }
}

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, crypto.randomBytes(24).toString('hex')),
  }),
  limits: { fileSize: HARD_MAX_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const ext = extensionOf(fixName(file.originalname));
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const err = new Error('Format de fichier non autorisé.');
      err.code = 'BAD_EXTENSION';
      return cb(err);
    }
    cb(null, true);
  },
});

function removeFile(storedName) {
  if (!storedName || /[\\/]/.test(storedName)) return;
  fs.promises.unlink(path.join(UPLOAD_DIR, storedName)).catch(() => {});
}

async function purgeOrphanUploads() {
  try {
    const { rows } = await pool.query(
      `DELETE FROM request_attachments
        WHERE request_id IS NULL AND created_at < NOW() - ($1 || ' hours')::interval
        RETURNING stored_name`,
      [String(ORPHAN_TTL_HOURS)]
    );
    rows.forEach((r) => removeFile(r.stored_name));
    if (rows.length) console.log(`[uploads] ${rows.length} dépôt(s) orphelin(s) purgé(s).`);
  } catch (err) {
    console.error('[uploads] Purge impossible :', err.message);
  }
}

function startPurgeSchedule() {
  purgeOrphanUploads();
  setInterval(purgeOrphanUploads, 60 * 60 * 1000).unref();
}

module.exports = {
  UPLOAD_DIR,
  HARD_MAX_BYTES,
  MAX_PENDING_PER_USER,
  ALLOWED_EXTENSIONS,
  upload,
  extensionOf,
  fixName,
  hasValidSignature,
  removeFile,
  startPurgeSchedule,
};
