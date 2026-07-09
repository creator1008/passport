-- Company details extracted from career certificates

alter table career_certificate_records
  add column if not exists company_address text,
  add column if not exists company_phone text,
  add column if not exists representative text,
  add column if not exists employment_years real;
