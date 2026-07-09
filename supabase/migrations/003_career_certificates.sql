-- Career certificate (경력증명서) records

create table if not exists career_certificate_records (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  document_type text,
  employee_name text,
  date_of_birth date,
  company_name text,
  business_number text,
  department text,
  job_title text,
  employment_start date,
  employment_end date,
  is_currently_employed boolean not null default false,
  issue_date date,
  issuer text,
  certificate_number text,
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

create index if not exists idx_career_certificate_records_applicant_id
  on career_certificate_records(applicant_id);

create unique index if not exists idx_career_certificate_unique_number
  on career_certificate_records(certificate_number)
  where certificate_number is not null;

insert into storage.buckets (id, name, public)
values ('career-certificates', 'career-certificates', false)
on conflict (id) do nothing;
