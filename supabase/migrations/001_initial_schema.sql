-- Passport MVP schema
-- Run in Supabase SQL Editor or via supabase db push

create table if not exists applicants (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  nationality text not null default 'VNM',
  status text not null default 'PENDING'
    check (status in ('PENDING', 'REVIEW', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists passport_records (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  passport_number text,
  surname text,
  given_names text,
  nationality text,
  sex text,
  date_of_birth date,
  date_of_issue date,
  date_of_expiry date,
  mrz_line1 text,
  mrz_line2 text,
  mrz_valid boolean not null default false,
  quality_score real,
  confidence real,
  recommendation text not null default 'REVIEW'
    check (recommendation in ('PASS', 'REVIEW', 'FAIL')),
  flags jsonb not null default '[]'::jsonb,
  storage_path text not null,
  raw_extraction jsonb not null default '{}'::jsonb,
  used_ai boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_passport_records_applicant_id
  on passport_records(applicant_id);

create index if not exists idx_applicants_created_at
  on applicants(created_at desc);

-- Storage bucket (create in Dashboard if this fails)
insert into storage.buckets (id, name, public)
values ('passports', 'passports', false)
on conflict (id) do nothing;
