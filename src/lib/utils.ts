import { format, formatDistanceToNow, isAfter, isBefore, parseISO } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

/** Format a UTC ISO string in the given timezone */
export function formatInTz(isoString: string, tz: string, fmt = 'HH:mm'): string {
  try {
    const zoned = toZonedTime(parseISO(isoString), tz);
    return format(zoned, fmt);
  } catch {
    return isoString;
  }
}

/** Human-readable countdown from now to a future ISO UTC timestamp */
export function countdown(isoString: string): string {
  try {
    const target = parseISO(isoString);
    if (isBefore(target, new Date())) return 'now';
    return formatDistanceToNow(target, { addSuffix: false });
  } catch {
    return '';
  }
}

/** Is the given ISO timestamp within the last N seconds? */
export function isWithinSeconds(isoString: string | null, seconds: number): boolean {
  if (!isoString) return false;
  try {
    return isAfter(parseISO(isoString), new Date(Date.now() - seconds * 1000));
  } catch {
    return false;
  }
}

/** Build today's scheduled_for ISO timestamp from a time_of_day "HH:MM:SS" string and a timezone. */
export function scheduledForToday(timeOfDay: string, timezone: string): string {
  const now = toZonedTime(new Date(), timezone);
  const [h, m] = timeOfDay.split(':').map(Number);
  const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
  // Convert back to UTC
  return local.toISOString();
}

/** Day-of-week names short */
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DAY_LABELS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Format days array to a readable string */
export function formatDays(days: number[]): string {
  if (days.length === 7) return 'Every day';
  if (days.length === 0) return 'Never';
  const sorted = [...days].sort();
  return sorted.map((d) => DAY_LABELS[d]).join(', ');
}

/** Wi-Fi signal strength to label */
export function rssiToLabel(rssi: number | null): string {
  if (rssi === null) return 'Unknown';
  if (rssi >= -50) return 'Excellent';
  if (rssi >= -60) return 'Good';
  if (rssi >= -70) return 'Fair';
  return 'Weak';
}

/** Wi-Fi signal strength to bar count (0-4) */
export function rssiToBars(rssi: number | null): number {
  if (rssi === null) return 0;
  if (rssi >= -50) return 4;
  if (rssi >= -60) return 3;
  if (rssi >= -70) return 2;
  if (rssi >= -80) return 1;
  return 0;
}

/** Format uptime seconds to readable string */
export function formatUptime(seconds: number | null): string {
  if (seconds === null) return 'Unknown';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** Clamp a number between min and max */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
