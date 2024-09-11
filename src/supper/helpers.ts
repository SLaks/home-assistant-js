export function isDateToday(dateStr: string) {
  const today = new Date();
  return new Date(today.getTime() - today.getTimezoneOffset() * 60_000)
    .toISOString()
    .startsWith(dateStr);
}
