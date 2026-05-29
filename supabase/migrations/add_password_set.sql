-- Houdt bij of een gebruiker zelf een wachtwoord heeft ingesteld.
-- false = via uitnodiging binnengekomen maar nog geen wachtwoord gekozen → verplichte
-- modal in de app. true = account is af.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_set boolean NOT NULL DEFAULT false;

-- Bestaande admins hebben al een wachtwoord; zet hen op af.
UPDATE profiles SET password_set = true WHERE is_admin = true;
