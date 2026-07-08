-- Unique passport number (when extracted)
create unique index if not exists idx_passport_records_passport_number_unique
  on passport_records(passport_number)
  where passport_number is not null;
