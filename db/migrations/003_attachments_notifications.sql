-- 003 : pièces jointes des demandes + suivi de l'envoi des e-mails.

-- Un fichier est d'abord déposé (request_id NULL, "en attente"), puis rattaché
-- à la demande au moment de son envoi. Les dépôts jamais rattachés sont
-- purgés automatiquement (voir utils/uploads.js).
CREATE TABLE IF NOT EXISTS request_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    original_name VARCHAR(255) NOT NULL,
    stored_name VARCHAR(100) NOT NULL UNIQUE,
    mime_type VARCHAR(150),
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_request ON request_attachments(request_id);
CREATE INDEX IF NOT EXISTS idx_attachments_pending ON request_attachments(created_at) WHERE request_id IS NULL;

-- État de la notification par e-mail de chaque demande :
--   pending         : pas encore tentée
--   sent            : envoyée aux destinataires
--   failed          : tentative en erreur (voir notification_error)
--   not_configured  : aucun destinataire n'est configuré pour ce formulaire
--   smtp_disabled   : SMTP non configuré sur le serveur
ALTER TABLE requests ADD COLUMN IF NOT EXISTS notification_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE requests ADD COLUMN IF NOT EXISTS notification_recipients TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS notification_error TEXT;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE;
