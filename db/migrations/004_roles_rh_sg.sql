-- 004 : rôles RH et SG (gestionnaires des cartes ICOM / ICOMOS).
-- Fichier séparé : une valeur d'enum ajoutée ne peut pas être utilisée dans la
-- transaction qui la crée.

ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'rh';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'sg';
