-- 001 : schéma initial (idempotent : sans effet sur une base créée avec
-- l'ancien schema.sql).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('agent', 'validator', 'admin', 'superAdmin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'request_status') THEN
    CREATE TYPE request_status AS ENUM (
      'draft', 'submitted', 'validated', 'rejected', 'cancelled',
      'brouillon', 'en_cours', 'en_attente_validation', 'validee_responsable',
      'transmise_budget', 'traitee', 'rejetee', 'annulee'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    role user_role NOT NULL DEFAULT 'agent',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_categories (
    id SERIAL PRIMARY KEY,
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS request_types (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES request_categories(id) ON DELETE CASCADE,
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    form_schema JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    type_id INTEGER REFERENCES request_types(id) ON DELETE CASCADE,
    reference VARCHAR(50) UNIQUE NOT NULL,
    category_key VARCHAR(100) NOT NULL,
    form_key VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    status request_status NOT NULL DEFAULT 'en_cours',
    validator_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    validated_at TIMESTAMP WITH TIME ZONE,
    rejected_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_requests_user_id ON requests(user_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_requests_updated_at ON requests;
CREATE TRIGGER update_requests_updated_at
    BEFORE UPDATE ON requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Table des sessions (connect-pg-simple)
CREATE TABLE IF NOT EXISTS "session" (
    "sid" VARCHAR NOT NULL COLLATE "default",
    "sess" JSON NOT NULL,
    "expire" TIMESTAMP(6) NOT NULL,
    CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
