# PrenotaEasy

App di prenotazioni per parrucchieri, centri estetici e piccole attività.
Il cliente **inquadra un QR code e prenota in venti secondi** — senza scaricare
nessuna app. L'attività gestisce orari, listino, operatori e agende da un unico
pannello. Se sposti un appuntamento, avvisi il cliente su **WhatsApp** con un
tocco.

## Stack

- **Next.js 15** (App Router) + **React 19**
- **Supabase** (Postgres + Auth + Row Level Security)
- **Tailwind CSS v4** + **Motion** (animazioni in stile Apple)
- Front-end mobile-first, italiano

---

## Setup (10 minuti)

### 1. Installa le dipendenze

```bash
npm install
```

### 2. Crea un progetto Supabase

Vai su [supabase.com](https://supabase.com) → **New project** (il piano gratuito
basta). Scegli una region europea (es. *Europe West*) per la latenza.

### 3. Crea le tabelle

Nel progetto Supabase apri **SQL Editor → New query**, incolla il contenuto di
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) e premi
**Run**.

### 4. (Opzionale) Dati demo

Per provare subito il flusso di prenotazione, esegui anche
[`supabase/seed.sql`](supabase/seed.sql): crea un salone demo raggiungibile su
`/b/demo`.

### 5. Disattiva la conferma email (per lo sviluppo)

**Authentication → Providers → Email** → disattiva *"Confirm email"*.
Così puoi registrarti e accedere subito senza aspettare l'email di conferma.
(In produzione puoi riattivarla.)

### 6. Configura le variabili d'ambiente

Copia `.env.example` in `.env.local` e riempi i valori. Le chiavi sono in
**Project Settings → API**:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co     # Project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...                  # anon / publishable key
SUPABASE_SERVICE_ROLE_KEY=eyJ...                      # service_role / secret key (NON esporre!)
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

> La `service_role` key bypassa la sicurezza RLS: resta solo lato server (viene
> usata dagli endpoint pubblici di prenotazione) e non va mai nel browser.

### 7. Avvia

```bash
npm run dev
```

- App: <http://localhost:3000>
- Prenotazione demo: <http://localhost:3000/b/demo> (se hai eseguito il seed)
- Pannello attività: <http://localhost:3000/signup>

---

## Come funziona

### Lato cliente — `/b/[slug]`
Il target del QR code. Flusso in 4 passi, con avanzamento automatico:
**servizio → operatore → data/ora → nome + WhatsApp → conferma**.
Gli orari liberi vengono calcolati in tempo reale a partire dagli orari di
apertura, dalle pause, dalla durata del servizio e dagli appuntamenti già presi.

### Lato attività — `/dashboard`
- **Agenda**: vista giornaliera, filtrabile per operatore. Tocca un appuntamento
  per **spostarlo** o **annullarlo**.
- **Condividi**: QR code da stampare + link da inviare.
- **Impostazioni**: dati attività, orari (con pause), listino con durate,
  operatori.

### WhatsApp (tap-to-send)
Quando sposti o annulli un appuntamento, l'app apre WhatsApp con il messaggio già
scritto per il cliente: basta premere *invia*. Nessun costo, nessuna
verifica, funziona da subito.
*Evoluzione futura:* invio automatico via **WhatsApp Cloud API** (Meta) o Twilio
— la logica dei messaggi è già isolata in [`lib/whatsapp.ts`](lib/whatsapp.ts).

---

## Struttura del progetto

```
app/
  page.tsx                 Landing
  b/[slug]/                Prenotazione cliente (QR target)
  login, signup/           Accesso attività
  onboarding/              Configurazione iniziale attività
  dashboard/               Agenda, condividi, impostazioni
  api/availability, book/  Endpoint pubblici (calcolo slot + prenotazione)
components/                 UI riutilizzabile (Sheet, Button, DatePicker, QR…)
lib/                        Tipi, availability, timezone, WhatsApp, Supabase
supabase/                  Migrazione SQL + seed demo
```

## Sicurezza

- **RLS attiva** su tutte le tabelle: ogni titolare vede solo i dati della
  propria attività.
- Le prenotazioni pubbliche passano da endpoint server-side che validano orario
  e disponibilità; un vincolo di esclusione in Postgres impedisce due
  appuntamenti sovrapposti per lo stesso operatore.

## Note MVP / prossimi passi

- Fuso orario per attività (default `Europe/Rome`).
- Possibili estensioni: promemoria automatici, buffer di pulizia tra
  appuntamenti, invio WhatsApp automatico, servizi per singolo operatore,
  deposito/acconto.
