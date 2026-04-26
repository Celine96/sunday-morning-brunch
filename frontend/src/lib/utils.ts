export function formatDate(dateStr: string | undefined | null, locale = "ko-KR"): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(locale);
}
