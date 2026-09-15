const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // UTC+5:30, no DST

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export type IstParts = {
  year: number;
  month: number; // 0-based
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  weekday: number; // 0 = Sunday
};

/**
 * The given instant's wall-clock date/time in India Standard Time
 * (UTC+5:30, fixed, no DST), independent of the device's own system
 * timezone setting. Works by shifting the epoch by the IST offset and then
 * reading it back with UTC getters, which sidesteps the device timezone
 * entirely -- using local getters (getHours/getFullYear/etc.) here would
 * silently give the device's own timezone instead of India's.
 */
export function getIstParts(date: Date = new Date()): IstParts {
  const shifted = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(),
  };
}

export function formatIstDate(date: Date = new Date()): string {
  const p = getIstParts(date);
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

export function formatIstTime(date: Date = new Date()): string {
  const p = getIstParts(date);
  return `${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
}

/** 'yyyy-MM-dd HH:mm:ss' in IST -- this is the format musterdate/start_time/
 * trackedon are stored and sent to the server in, so they represent the
 * actual India check-in/out clock time regardless of the device's own
 * timezone setting. */
export function formatIstDateTime(date: Date = new Date()): string {
  return `${formatIstDate(date)} ${formatIstTime(date)}`;
}

/** 'HH:mm' in IST, for the live clock display. */
export function formatIstClock(date: Date = new Date()): string {
  const p = getIstParts(date);
  return `${pad(p.hours)}:${pad(p.minutes)}`;
}

/** e.g. 'Wednesday, Aug 27' in IST. Spelled out manually rather than via
 * Intl/toLocaleDateString(timeZone) so it doesn't depend on the JS engine's
 * ICU/timezone-database support. */
export function formatIstWeekdayDate(date: Date = new Date()): string {
  const p = getIstParts(date);
  return `${WEEKDAY_NAMES[p.weekday]}, ${MONTH_NAMES[p.month]} ${p.day}`;
}

/**
 * Reverses formatIstDateTime: given an IST wall-clock string, returns the
 * Date representing that real instant. Necessary because `new Date(str)` on
 * a timezone-less string is parsed using the DEVICE's timezone, which
 * silently corrupts elapsed-time math (e.g. live timers) whenever the
 * device isn't itself set to IST.
 */
export function parseIstDateTime(value: string): Date {
  const [datePart, timePart] = value.trim().split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = (timePart ?? '00:00:00').split(':').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds || 0) - IST_OFFSET_MS);
}
