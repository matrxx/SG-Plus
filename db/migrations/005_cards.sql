-- 005 : cartes ICOM / ICOMOS et leurs réservations.
--
-- Les réservations sont rattachées à un compte (pour le rappel par e-mail et
-- pour que chacun retrouve les siennes), mais l'identité de l'emprunteur n'est
-- JAMAIS renvoyée par le tableau public (voir routes/cards.js).

CREATE TABLE IF NOT EXISTS cards (
    id SERIAL PRIMARY KEY,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('ICOM', 'ICOMOS')),
    label VARCHAR(60) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (kind, label)
);

CREATE TABLE IF NOT EXISTS card_reservations (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    -- Dates civiles (sans heure) : la carte est retirée le jour de début et
    -- restituée le jour de fin ; elle est occupée du début à la fin inclus.
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    -- Au-delà d'une semaine : départ en vacances ou en déplacement (3 semaines max)
    extended BOOLEAN NOT NULL DEFAULT FALSE,
    reason VARCHAR(20) CHECK (reason IN ('vacances', 'deplacement')),
    status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'returned', 'cancelled')),
    -- Rappel : 1 jour ouvré avant la restitution
    reminder_date DATE NOT NULL,
    reminder_sent_at TIMESTAMP WITH TIME ZONE,
    reminder_status VARCHAR(20),
    reminder_error TEXT,
    returned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_card_res_card_dates ON card_reservations(card_id, start_date, end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_card_res_user ON card_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_card_res_reminder ON card_reservations(reminder_date) WHERE status = 'active' AND reminder_sent_at IS NULL;
