export function isValidIsoDate(value: string | null | undefined): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const parsed = new Date(value);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

export function sanitizeIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return isValidIsoDate(value) ? value : null;
}

export function parseMrzDate(value: string | null | undefined): string | null {
  if (!value || !/^\d{6}$/.test(value)) return null;
  const yy = Number(value.slice(0, 2));
  const mm = Number(value.slice(2, 4));
  const dd = Number(value.slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const currentYear = new Date().getFullYear() % 100;
  const century = yy > currentYear + 10 ? 1900 : 2000;
  const iso = `${century + yy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

export function isPlausibleBirthDate(mrzDate: string, expiryIso: string | null): boolean {
  const birth = parseMrzDate(mrzDate);
  if (!birth) return false;
  const birthYear = Number(birth.slice(0, 4));
  if (birthYear < 1920 || birthYear > 2015) return false;
  if (expiryIso) {
    const expiryYear = Number(expiryIso.slice(0, 4));
    if (birthYear >= expiryYear) return false;
  }
  return true;
}

export function inferIssueDateFromExpiry(expiry: string | null): string | null {
  if (!expiry) return null;
  const d = new Date(expiry);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() - 10);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return sanitizeIsoDate(`${yyyy}-${mm}-${dd}`);
}

export function isAdultIssueDate(issueDate: string, birthDate: string | null): boolean {
  if (!birthDate) return true;
  const issue = new Date(issueDate);
  const birth = new Date(birthDate);
  if (Number.isNaN(issue.getTime()) || Number.isNaN(birth.getTime())) return true;
  const minIssue = new Date(birth);
  minIssue.setFullYear(minIssue.getFullYear() + 16);
  return issue >= minIssue;
}
