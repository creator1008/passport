-- Career certificate: Korean translation + source file type

alter table career_certificate_records
  add column if not exists fields_ko jsonb,
  add column if not exists source_mime_type text;
