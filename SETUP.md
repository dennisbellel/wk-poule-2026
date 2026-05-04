# 🏆 Dé WK Poule 2026 — Setup Instructies

Volg deze stappen exact op volgorde. Duurt ~30 minuten.

---

## Stap 1 — Supabase database opzetten

1. Ga naar **https://supabase.com** en log in op je project
2. Klik links in de sidebar op **SQL Editor**
3. Klik op **New query**
4. Open het bestand `supabase/schema.sql` uit de code
5. Kopieer de volledige inhoud en plak het in de SQL Editor
6. Klik **Run** — je ziet "Success"
7. Doe hetzelfde met `supabase/schema_engagement.sql`

✅ Database is klaar

---

## Stap 2 — Admin account aanmaken

1. Ga in Supabase naar **Authentication → Users**
2. Klik **Add user → Create new user**
3. Vul jouw e-mailadres en een wachtwoord in
4. Klik **Create user**
5. Ga naar **Table Editor → profiles**
6. Zoek jouw gebruiker op en zet `is_admin` op `true`

✅ Jij bent de admin

---

## Stap 3 — Vercel configureren

1. Ga naar **https://vercel.com** en klik op je project
2. Klik op **Settings → Environment Variables**
3. Voeg de volgende variabelen toe (klik steeds **Add**):

| Naam | Waarde |
|------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kfetnjchyxpwmojznkii.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJhbGci...` (jouw anon key) |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (jouw service role key) |
| `FOOTBALL_DATA_API_KEY` | `ecf5ef50827d46809f38c4540de2a8ca` |
| `SYNC_SECRET` | Zelf een willekeurige string verzinnen, bijv. `wk2026sync!` |
| `NEXT_PUBLIC_SITE_URL` | `https://jouw-app-naam.vercel.app` (zie stap 4) |

4. Klik na elke variabele op **Save**

---

## Stap 4 — Deployen

1. Ga naar **https://github.com/dennisbellel/wk-poule-2026**
2. Upload de code bestanden (zie stap 5)
3. Vercel deploy automatisch zodra je naar GitHub pusht

De app URL is zoiets als `https://wk-poule-2026.vercel.app` — kopieer die en vul hem in bij `NEXT_PUBLIC_SITE_URL`

---

## Stap 5 — Code naar GitHub pushen

Open Terminal (Mac) of Command Prompt (Windows) en voer in:

```bash
# Ga naar de map met de code
cd pad/naar/wk-poule-app

# Installeer Node.js packages (eenmalig)
npm install

# Koppel aan GitHub
git init
git remote add origin https://github.com/dennisbellel/wk-poule-2026.git

# Maak .env.local aan (lokaal testen, NIET naar GitHub)
cp .env.local.example .env.local
# Vul de .env.local in met je echte keys

# Push naar GitHub
git add .
git commit -m "Initial deployment"
git push -u origin main
```

Vercel pikt dit automatisch op en deployt.

---

## Stap 6 — Supabase Auth instellen

1. Ga naar Supabase → **Authentication → URL Configuration**
2. Zet **Site URL** op `https://jouw-app.vercel.app`
3. Voeg toe aan **Redirect URLs**: `https://jouw-app.vercel.app/auth/callback`

---

## Stap 7 — Testen

1. Ga naar `https://jouw-app.vercel.app/auth/login`
2. Log in met jouw admin account
3. Je wordt doorgestuurd naar de app — de wizard verschijnt
4. Ga naar `/admin` — je ziet het admin dashboard
5. Nodig jezelf uit via een tweede e-mailadres om te testen

---

## Stap 8 — Eerste deelnemers uitnodigen

1. Ga naar `/admin/members`
2. Klik **+ Uitnodigen**
3. Plak de e-mailadressen van je vrienden/familie
4. Klik **Uitnodigingen versturen**
5. Zij ontvangen een e-mail met een link om een account aan te maken

---

## Automatische uitslagen synchroniseren

De app haalt automatisch uitslagen op via football-data.org. Je kunt dit handmatig triggeren via:
- `/admin` → "Handmatig synchroniseren"
- Of via URL: `POST https://jouw-app.vercel.app/api/sync` met header `Authorization: Bearer jouw-sync-secret`

Voor volledig automatisch: stel een Vercel Cron Job in (via `vercel.json`):

```json
{
  "crons": [{
    "path": "/api/sync",
    "schedule": "*/30 * * * *"
  }]
}
```

Dit synchroniseert elke 30 minuten automatisch.

---

## Problemen?

- **Login werkt niet**: Check of Supabase Auth URL Configuration klopt
- **Pagina laadt niet**: Check Environment Variables in Vercel
- **Database fout**: Controleer of je beide SQL bestanden hebt gerund
- **Sync werkt niet**: Check FOOTBALL_DATA_API_KEY en SYNC_SECRET

Stuur een berichtje dan help ik je verder!
