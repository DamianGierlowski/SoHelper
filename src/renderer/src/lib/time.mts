const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const pad = (n: number): string => String(n).padStart(2, '0');

/** Pozostaly czas jako HH:MM:SS, z dniami z przodu gdy przekracza dobe. */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  const minutes = Math.floor((ms % HOUR) / MINUTE);
  const seconds = Math.floor((ms % MINUTE) / SECOND);
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

/** Dlugosc cooldownu opisana po ludzku: "24 h", "90 min", "2 d 6 h". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const rest = minutes % 60;
  const parts: string[] = [];
  if (days) parts.push(`${days} d`);
  if (hours) parts.push(`${hours} h`);
  if (rest) parts.push(`${rest} min`);
  return parts.join(' ');
}

export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * <input type="datetime-local"> operuje na czasie lokalnym bez strefy, wiec
 * toISOString() sie tu nie nadaje - przesunalby wartosc o offset UTC.
 */
export function toDateTimeLocal(timestamp: number): string {
  const d = new Date(timestamp);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

export function fromDateTimeLocal(value: string): number {
  return new Date(value).getTime();
}
