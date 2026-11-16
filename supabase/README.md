# StockFlow Pro — Supabase Setup Guide

## Overview

Supabase Auth is used for sign-in. Operational business data is still stored in browser `localStorage`; Supabase is not yet the source of truth for products, stock, deliveries, or reports.

---

## 1. Create a Supabase Project

1. Go to [https://app.supabase.com](https://app.supabase.com) and sign in.
2. Click **New project**, choose your organisation, pick a region close to your users.
3. Set a **strong database password** and save it somewhere safe.
4. Wait for the project to finish provisioning (~2 minutes).

---

## 2. Environment Variables

Create a `.env.local` file in the Vite project root with:

```env
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-publishable-or-anon-key>
```

Find these values in the Supabase dashboard under **Settings → API**.

> [!CAUTION]
> Never place a service-role or secret key in a `VITE_` variable or browser code. `.env` and `.env.local` are excluded from Git.

---

## 3. Run Migrations

The configured Supabase project contains real business data, and its schema and migration history have not been verified with authenticated database access. **Do not run `supabase db push`, `001_initial_schema.sql`, or any cleanup SQL against it until a schema/migration review and backup are completed.** The previous `002_seed_data.sql` migration is now a no-op; optional sample data is outside the migration directory in `seeds/development_seed.sql` and must never be run against production.

The existing schema file is a historical starting point, not a verified production migration. New schema changes must be additive, reviewed against the live database, and tested in a separate environment before application.

---

## Database and RLS verification status

The schema and policies have not been tested against the configured live database. Do not rely on the role descriptions in the legacy SQL files as proof of authorization. Before using Supabase for operations, verify every frontend-accessible table's RLS policies and test allowed and denied access using real Admin, Manager, Staff, and unauthenticated accounts.

The frontend's operational CRUD, stock posting, drafts, dashboard statistics, reports, and settings have not yet been migrated to Supabase. Creating an Auth user or profile does not make those workflows production-ready.

## File Locations

```
supabase/
├── migrations/
│   ├── 001_initial_schema.sql   # Historical initial schema; not verified against live database
│   ├── 002_seed_data.sql        # No-op retained migration
│   └── 003_operational_entities.sql # Additive domain tables and RLS policies
├── seeds/
│   └── development_seed.sql     # Manual sample data for development only
├── create_admin.sql             # Template to insert first admin profile
└── README.md                    # This file
```
