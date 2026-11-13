export const APP_TIME_ZONE = 'Asia/Ho_Chi_Minh';

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: APP_TIME_ZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/**
 * Formats a date in Vietnam time: 'date' gives DD/MM/YYYY, 'datetime' gives
 * DD/MM/YYYY HH:mm. Null or undefined gives an empty string.
 */
export function formatVn(
  date: Date | null | undefined,
  kind: 'date' | 'datetime' = 'datetime',
): string {
  if (!date) return '';
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(date)) parts[p.type] = p.value;
  const day = `${parts['day']}/${parts['month']}/${parts['year']}`;
  return kind === 'date' ? day : `${day} ${parts['hour']}:${parts['minute']}`;
}
