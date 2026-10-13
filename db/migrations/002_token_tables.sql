-- 002 : tables utilisées par routes/auth.js et routes/admin.js mais absentes
-- de l'ancien schéma, et valeurs d'enum possiblement manquantes sur les
-- bases créées avant l'ajout du circuit de validation / du rôle superAdmin.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'superAdmin';

ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'brouillon';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'en_cours';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'en_attente_validation';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'validee_responsable';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'transmise_budget';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'traitee';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'rejetee';
ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'annulee';

CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_resets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS password_setup_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validator_categories (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_key VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, category_key)
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);
CREATE INDEX IF NOT EXISTS idx_password_setup_user ON password_setup_tokens(user_id);
