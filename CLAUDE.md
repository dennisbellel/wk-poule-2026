# Dé WK Poule 2026 — context voor Claude

Een Next.js 15 + Supabase + Vercel app voor een familie/vrienden WK-poule.
Productie: https://wk-poule-2026-eight.vercel.app

## Stack & locaties

- **Next.js 15** app router, TypeScript, Tailwind CSS
- **Supabase**: auth + Postgres + RLS. Service-role admin client gebruikt in `/app/api/admin/*`
- **Vercel**: productie deployt automatisch bij push naar `main`
- Vercel Analytics + Speed Insights via `@vercel/analytics` en `@vercel/speed-insights`

Belangrijke mappen:
- `/app/(app)/` — alle ingelogde-user pagina's (home, predict, stand, stats, profile, match/[id])
- `/app/admin/` — admin pagina's (members, results, players, bonus, scoring, member/[id])
- `/app/api/admin/` — admin-only endpoints (gebruiken service-role)
- `/app/auth/` — login, register, confirm, callback (alleen `/auth/confirm` en `/auth/callback` zijn public via middleware)
- `/components/predict/` — voorspellingscomponenten (PredictClient, MatchPredictionCard, BonusQuestionItem, GroupStandingForm)
- `/components/admin/` — admin components
- `/components/onboarding/` — OnboardingTour modal + SetPasswordModal
- `/lib/points/calculate.ts` — alle scoringlogica
- `/lib/supabase/server.ts` — server client + admin client factory
- `/supabase/schema.sql` — leidende schema-definitie (zie hieronder)
- `/supabase/migrations/*.sql` — losse migratiebestanden (geen automatische runner, handmatig in SQL Editor draaien)

## Werkwijze met git

- **Feature branch**: `claude/brave-elion-66759b` — werk altijd hier, niet direct op main
- **Mergen naar main**: via terminal in een worktree-veilige manier:
  ```bash
  cd /Users/dennisbellel/Downloads/wk-poule-2026
  git pull origin main --ff-only
  git merge claude/brave-elion-66759b --no-edit
  git push origin main
  ```
- **Workflow**: bouw → commit → push naar branch → (bij grote/SQL changes overleg met user) → merge naar main wanneer akkoord
- **Vercel**: deployt elke push naar main automatisch (ca. 1-2 min build)

## Database — belangrijkste tabellen

`profiles`: id (uuid, = auth.users.id), email, display_name, is_admin, password_set, onboarded_at, display_preference, previous_rank
`matches`: phase ('group','r32','r16','qf','sf','third','final'), home/away_team_id, scheduled_at, prediction_deadline_at, status ('scheduled','live','finished'), uitslag-velden (home_ft, away_ft, home_ht, away_ht, home/away_yellow, home/away_red, et, penalties, winner_team_id), home/away_team_placeholder
`match_predictions`: user_id + match_id, idem velden als matches, points
`group_standing_predictions`: user_id + group_id + position (1-4), team_id, predicted_points, goals_for/against, yellow/red_cards, points. UNIQUE(user_id, group_id, position)
`bonus_questions`: question_nl, question_type ('yes_no','team','player','number','text'), phase ('group','tournament','knockout','live'), points_value, deadline_at, correct_answer, team_filter (voor speler-vragen), sort_order, active
`bonus_answers`: user_id + question_id, answer, points
`teams`: 3-letter FIFA-code als id (NED, ENG, ...), name_nl, flag, group_id
`players`: name, team_id, position (GK/DEF/MID/FWD)
`scoring_config`: key/value voor alle punten-instellingen (match_ft_team, match_ft_exact_bonus, etc.). DEFAULT_SCORING in `/types/index.ts`
`rank_history`: snapshots van rank na elke publish — voor de lijngrafiek
`invited_emails`: tracking; `registered_at` is onbetrouwbaar (DB-trigger werkt niet altijd) — gebruik `profiles.password_set` als waarheidsbron

`leaderboard` is een view — let op de subquery-aggregatie (geen Cartesisch product)

## RPC functies (Postgres)

- `save_group_predictions(p_user_id, p_group_id, p_rows JSONB)` — atomic DELETE+INSERT voor poulestand. Gebruikt door GroupStandingForm en `/api/admin/proxy-save`. **Belangrijk**: voorkomt halve states bij volgorde-wissels. Sinds `lock_group_predictions.sql`: weigert saves zodra het toernooi begonnen is (eerste groepswedstrijd-deadline verstreken), behalve via service-role. Bron staat in de repo.
- `generate_match_activity(p_match_id)` — RPC voor activity feed (kan ontbreken in sommige omgevingen, daarom altijd in try/catch)

## Auth flow (subtiel!)

Standaard registratie (invite):
1. Admin nodigt uit via Admin → Members → "+ Uitnodigen"
2. Email-template (Supabase Dashboard → Authentication → Email Templates → Invite User) heeft een link naar `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/auth/register`
3. Gebruiker klikt → `/auth/confirm` (tussenpagina tegen e-mailscanners — toont alleen knop, doet niks met token)
4. Klikt "Activeren" → `/auth/callback` doet `verifyOtp({ token_hash, type })` → sessie aangemaakt → maakt profielrij aan (omdat handle_new_user trigger onbetrouwbaar is) → redirect naar `/`
5. AppShell ziet `profile.password_set === false` → toont **verplichte SetPasswordModal** voor naam + wachtwoord. Niet weg te klikken.
6. Save → `password_set=true` → modal weg → klaar

Alternatieven die de admin kan gebruiken bij vastlopers:
- "↻ Opnieuw versturen" op pending invite (verwijdert oud account + verstuurt nieuwe link)
- "+ Direct aanmaken" — bouwt account met tijdelijk wachtwoord ter plekke

**Belangrijk om te weten**: Supabase's `handle_new_user` DB-trigger werkt in productie onbetrouwbaar. Daarom maakt `/auth/callback` zelf het profiel aan (`ensureProfile()`). Niet vertrouwen op de trigger.

## "Voorspel namens..." (admin)

Admin kan via Admin → Members → 👁 een deelnemer-overzicht zien en op "✏ Voorspel namens →" klikken.
- Route: `/admin/member/[id]/predict`
- Geeft `adminActAs={ userId, displayName }` prop aan PredictClient
- Alle save-acties gaan dan via `/api/admin/proxy-save` (admin endpoint met service-role)
- Banner bovenaan UI: "⚠ Je vult voorspellingen in namens [naam]"

## Bekende valkuilen

1. **PostgREST max-rows 1000**: standaard cap op SELECT response. Bij >1000 rijen (zoals 1255 spelers) gebruik **batches** in een while-loop, NIET `.range(0, 9999)` — sommige instellingen negeren dat. Zie `/app/admin/players/page.tsx` voor het patroon.
2. **E-mail link-scanners** (Outlook/zakelijke mail) openen invite-links automatisch en verbruiken het eenmalige token. De `/auth/confirm` tussenpagina vermindert dat maar lost het niet 100% op. Bij hardnekkige problemen: gebruik "+ Direct aanmaken" voor die persoon.
3. **OTP-expiry**: Supabase Dashboard → Authentication → Email Templates of Providers → "Email OTP Expiration". Default 3600s (1u), max 86400s (24u). De gebruiker heeft dit verhoogd.
4. **Big-bowl effect bij upsert**: gebruik liever een RPC met DELETE+INSERT in een transactie bij meerderdere-rij-upserts met conflict-keys (zoals nu voor group_standing_predictions).
5. **Worktree**: gebruiker werkt in `.claude/worktrees/brave-elion-66759b` en de hoofdmap `/Users/dennisbellel/Downloads/wk-poule-2026` heeft `main` uitgecheckt. Voor merge: cd naar hoofdmap.

## SQL-migraties die al gedraaid zijn op productie

Status: alle bekende migraties zitten in `/supabase/migrations/` en zijn (volgens user-bevestiging) al gedraaid:
- `add_previous_rank.sql` — profiles.previous_rank
- `add_rank_history.sql` — rank_history tabel + policy
- `add_onboarded_at.sql` — profiles.onboarded_at
- `fix_leaderboard_view.sql` — leaderboard view zonder Cartesisch product
- `lock_group_predictions.sql` — poulestand op slot bij toernooistart (RLS + RPC met deadline-check); gedraaid 11 juni 2026
- (impliciet) `profiles.password_set boolean DEFAULT false`
- (impliciet) `profiles.display_preference TEXT DEFAULT 'normal'`

Bij twijfel: laat de user de query draaien
`SELECT column_name FROM information_schema.columns WHERE table_name='profiles' ORDER BY column_name;`

## Stijl-conventies

- Hoofdkleuren: groen `#1a5c38` (primary), beige/cream `#f6f4ef` (achtergrond), `#eaf4ef` (light green accent), `#e5e1d8` (border)
- Knoppen: `btn-primary` (groen), secundair = wit met `border-[#c8e6d4]` en `text-[#1a5c38]`
- Tags: `tag` class voor kleine rounded labels
- Cards: `card` class
- Display preference 'large' → root font-size 20px, rest schaalt via rem
- Geen emoji's wegnemen — opa houdt ervan en de gebruiker heeft ze speels gehouden

## Toon & taal

- Alles in **Nederlands** (zoals tom_bellel ook Nederlands moet lezen)
- Speelse toon, geen formaliteit (gebruik "je", emoji's, korte zinnen)
- Termen: "voorspellen" niet "voorspelling indienen", "deelnemers" niet "gebruikers"

## Open TODO's / aandachtspunten

- **Spelers-data**: ~1255 spelers per CSV geïmporteerd. FIFA-deadline 1 juni. Mogelijk eind mei extra import-ronde nodig.
- **Knockout-wedstrijden**: nog niet in DB (wachten op loting na groepsfase). Template-SQL staat klaar in een mappen-notitie of zoek in de chathistorie.
- **Opa** moet getest worden met "grote weergave" toggle op zijn tablet — UX-feedback verwacht.
- **Backup**: admin-dashboard heeft een "💾 Backup downloaden"-knop (`/api/admin/export`, alle tabellen als JSON). Herinner de gebruiker er af en toe aan tijdens het toernooi.
- **Poulestand-punten** worden automatisch herberekend zodra een groep compleet gespeeld is (via publish-result); punten tellen alleen voor complete groepen. "Herbereken alles" hanteert dezelfde regel.
- **1000-rijen-cap**: gebruik `fetchAllRows` uit `/lib/supabase/fetchAll.ts` voor tabellen die groot kunnen worden (voorspellingen, antwoorden, spelers).

## Werkstijl met de gebruiker

- **Geen verstand van coderen**, wel UX/design. Leg dingen uit in normale taal, geen jargon.
- **Eerst overleggen** bij grote keuzes (auth flows, ingrijpende UX-wijzigingen). Voor kleine fixes direct doen.
- **Voorstellen met opties A/B/C** met aanbeveling, niet één optie.
- **Bij twijfel: ask, don't assume**. De gebruiker is graag betrokken bij keuzes.
- **SQL-migraties**: altijd eerst de SQL geven, wachten op bevestiging dat hij gedraaid is, dan pas code mergen naar main.
- **Pragmatisch**: dit is een familie-poule, niet een productieve enterprise app. Goedkope oplossingen die werken > perfecte architectuur.
