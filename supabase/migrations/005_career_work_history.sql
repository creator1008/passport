-- Work history and career summary from GPT extraction

alter table career_certificate_records
  add column if not exists work_history jsonb not null default '[]'::jsonb,
  add column if not exists career_summary text,
  add column if not exists career_summary_ko text;
