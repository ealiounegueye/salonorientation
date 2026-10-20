# Salon 2026 — Inscriptions

Page publique d’inscription et espace admin. À l’inscription, un code badge est créé, son QR code est affiché, puis envoyé par e-mail.

Même socle que Bourses 2026 : React, Tailwind, Supabase.

## Mise en route

1. Crée un projet sur [supabase.com](https://supabase.com).
2. **Authentication → Providers → Email** : désactive la confirmation d’e-mail.
3. Ne pas activer l’inscription publique Auth. Les comptes admin se créent à la main.
4. **SQL Editor** : exécute `supabase/schema.sql`.
5. Copie `.env.example` vers `.env` et renseigne l’URL + la clé `anon`.
6. Crée un admin dans **Authentication → Users → Add user**, avec user metadata :

```json
{ "nom": "Équipe salon", "role": "admin" }
```

7. Déploie les fonctions :

```bash
supabase link
supabase secrets set RESEND_API_KEY=re_xxx MAIL_FROM="Salon Auchan <salon@votredomaine.com>" PUBLIC_SITE_URL=https://votre-site.example
supabase functions deploy inscrire
supabase functions deploy renvoyer-badge
```

8. Lance l’app :

```bash
npm install
npm run dev
```

Le formulaire public est sur `/`. L’espace équipe est sur `/admin/connexion`.

## E-mail

L’envoi passe par [Resend](https://resend.com). Tant que le domaine d’envoi n’est pas vérifié, Resend n’accepte que l’adresse `onboarding@resend.dev`, et seulement vers l’e-mail du compte Resend.

Sans `RESEND_API_KEY`, l’inscription est quand même enregistrée et le QR code s’affiche à l’écran. L’admin peut renvoyer le badge ensuite.

Le titre affiché dans l’app se change dans `src/lib/evenement.ts`. Le titre de l’e-mail est dans `supabase/functions/_shared/badge.ts`.

## Jour J

- Laisser le champ **Pointage** focus : une douchette qui saisit `SLN-XXXXXX` puis Entrée marque la personne présente.
- Fermer la campagne depuis le tableau quand les inscriptions doivent s’arrêter.
- Exporter la liste en CSV (ouvrable dans Excel).
