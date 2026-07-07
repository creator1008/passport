export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR");
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR");
}

export function recommendationLabel(value: string): string {
  switch (value) {
    case "PASS":
      return "적격";
    case "REVIEW":
      return "심사 필요";
    case "FAIL":
      return "부적격";
    default:
      return value;
  }
}

export function statusLabel(value: string): string {
  switch (value) {
    case "PENDING":
      return "대기";
    case "REVIEW":
      return "심사중";
    case "APPROVED":
      return "승인";
    case "REJECTED":
      return "반려";
    default:
      return value;
  }
}

export function severityClass(severity: string): string {
  switch (severity) {
    case "HIGH":
      return "bg-red-50 text-red-700 border-red-200";
    case "MEDIUM":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

export function recommendationClass(value: string): string {
  switch (value) {
    case "PASS":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "REVIEW":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "FAIL":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}
