import { getDatabase } from './database';
import { MUSTER_CHECK_IN, MUSTER_CHECK_OUT, MUSTER_MISSED_CHECKOUT, type MusterPresenseType } from '../constants/attendance';

export type MusterRow = {
  idmuster: number;
  musterdate: string;
  userid: string;
  guid: string;
  musterpresensetype: MusterPresenseType;
  latitude: string;
  longitude: string;
  accuracy: string;
  altitude: string;
  speed: string;
  heading: string;
  selfieimage: string;
  remark: string;
  syncdate: string | null;
  is_sent: number;
};

export type NewMuster = {
  musterdate: string;
  userid: string;
  guid: string;
  musterpresensetype: MusterPresenseType;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  speed: number;
  heading: number;
  selfieimage: string;
  remark: string;
};

export type OpenMusterSession = {
  guid: string;
  checkInDate: string; // yyyy-MM-dd
};

export async function insertMuster(record: NewMuster): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO muster
     (musterdate, userid, guid, musterpresensetype, latitude, longitude, accuracy, altitude, speed, heading, selfieimage, remark, is_sent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      record.musterdate,
      record.userid,
      record.guid,
      record.musterpresensetype,
      String(record.latitude),
      String(record.longitude),
      String(record.accuracy),
      String(record.altitude),
      String(record.speed),
      String(record.heading),
      record.selfieimage,
      record.remark,
    ],
  );
}

/**
 * The most recent check-in (MP0005) for this user that has no matching
 * check-out (MP0006 or MP0007, missed-checkout) under the same guid yet.
 * Null means the user is free to start a new check-in.
 */
export async function getOpenMusterSession(userid: string): Promise<OpenMusterSession | null> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    `SELECT guid, musterdate FROM muster
     WHERE userid = ? AND musterpresensetype = ?
     AND guid NOT IN (
       SELECT guid FROM muster WHERE musterpresensetype IN (?, ?) AND guid IS NOT NULL
     )
     ORDER BY idmuster DESC LIMIT 1`,
    [userid, MUSTER_CHECK_IN, MUSTER_CHECK_OUT, MUSTER_MISSED_CHECKOUT],
  );
  if (result.rows.length === 0) {
    return null;
  }
  const row = result.rows.item(0);
  const musterdate: string = row.musterdate ?? '';
  return { guid: row.guid, checkInDate: musterdate.slice(0, 10) };
}

type MusterSession = {
  day: string; // yyyy-MM-dd, the check-in's date
  checkIn: string;
  checkOut?: string;
};

/**
 * Every check-in/check-out pair (by shared guid) whose check-in falls within
 * [fromDate, toDate], ordered oldest-first. Multiple sessions per day are
 * expected (e.g. a lunch break, or back-to-back shifts) -- see constants/attendance.ts.
 * A session with no `checkOut` is still open.
 */
async function getSessionsInRange(
  userid: string,
  fromDate: string,
  toDate: string,
): Promise<MusterSession[]> {
  const db = await getDatabase();
  const [checkInsResult] = await db.executeSql(
    `SELECT guid, musterdate FROM muster
     WHERE userid = ? AND musterpresensetype = ? AND substr(musterdate, 1, 10) BETWEEN ? AND ?
     ORDER BY idmuster ASC`,
    [userid, MUSTER_CHECK_IN, fromDate, toDate],
  );

  const sessions: MusterSession[] = [];
  for (let i = 0; i < checkInsResult.rows.length; i++) {
    const row = checkInsResult.rows.item(i);
    const [checkOutResult] = await db.executeSql(
      `SELECT musterdate FROM muster
       WHERE guid = ? AND musterpresensetype IN (?, ?)
       ORDER BY idmuster DESC LIMIT 1`,
      [row.guid, MUSTER_CHECK_OUT, MUSTER_MISSED_CHECKOUT],
    );
    sessions.push({
      day: (row.musterdate as string).slice(0, 10),
      checkIn: row.musterdate,
      checkOut: checkOutResult.rows.length > 0 ? checkOutResult.rows.item(0).musterdate : undefined,
    });
  }
  return sessions;
}

function sessionSeconds(session: MusterSession): number {
  if (!session.checkOut) {
    return 0;
  }
  const checkIn = new Date(session.checkIn.replace(' ', 'T'));
  const checkOut = new Date(session.checkOut.replace(' ', 'T'));
  return Math.max(0, (checkOut.getTime() - checkIn.getTime()) / 1000);
}

export type LocalMusterStatus =
  | { status: 'not_marked' }
  | { status: 'present'; baseSeconds: number; openCheckInAt: string }
  | { status: 'completed'; totalSeconds: number };

/**
 * Today's status computed from local SQLite alone, so it's correct the
 * instant a check-in/out is recorded -- independent of the fire-and-forget
 * server sync and the server's own queue-processing delay. HomeScreen falls
 * back to the server report only when local has nothing for today (e.g. the
 * check-in happened on a different device).
 *
 * Sums every completed session today into `baseSeconds`/`totalSeconds` --
 * checking in again after a checkout resumes the day's running total instead
 * of restarting from zero.
 */
export async function getLocalMusterStatusForToday(
  userid: string,
  today: string,
): Promise<LocalMusterStatus> {
  const sessions = await getSessionsInRange(userid, today, today);
  if (sessions.length === 0) {
    return { status: 'not_marked' };
  }

  const openSession = sessions.find(s => !s.checkOut);
  const completedSeconds = sessions.filter(s => s.checkOut).reduce((sum, s) => sum + sessionSeconds(s), 0);

  if (openSession) {
    return { status: 'present', baseSeconds: completedSeconds, openCheckInAt: openSession.checkIn };
  }
  return { status: 'completed', totalSeconds: completedSeconds };
}

export type LocalMusterRangeEntry = { checkIn?: string; checkOut?: string; totalSeconds: number };

/**
 * Per-day check-in/check-out summary within [fromDate, toDate], keyed by
 * 'yyyy-MM-dd', computed from local SQLite alone. MonthlyAttendanceScreen
 * overlays this on top of the server report so today's (and any not-yet-synced)
 * rows show their real local check-in/out time and an accurate computed
 * duration immediately, instead of waiting on the server round-trip.
 *
 * `checkIn`/`checkOut` are the day's first check-in and last check-out (for
 * display); `totalSeconds` is the SUM of every completed session's duration
 * that day, which is what actually reflects hours worked when there's more
 * than one session (a first-in/last-out span would wrongly include break time).
 */
export async function getLocalMusterRangeSummary(
  userid: string,
  fromDate: string,
  toDate: string,
): Promise<Map<string, LocalMusterRangeEntry>> {
  const sessions = await getSessionsInRange(userid, fromDate, toDate);
  const summary = new Map<string, LocalMusterRangeEntry>();

  // Sessions arrive oldest-first: checkIn locks to the first session of the
  // day, while checkOut is always overwritten by the most recent session --
  // if that latest session is still open, the day correctly ends up with no
  // checkOut rather than showing a stale time from an earlier, already-closed
  // session.
  for (const session of sessions) {
    const existing = summary.get(session.day) ?? { totalSeconds: 0 };
    summary.set(session.day, {
      checkIn: existing.checkIn ?? session.checkIn,
      checkOut: session.checkOut,
      totalSeconds: existing.totalSeconds + sessionSeconds(session),
    });
  }

  return summary;
}

export async function getUnsyncedMusters(): Promise<MusterRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT * FROM muster WHERE is_sent = 0');
  return rowsToArray<MusterRow>(result);
}

export async function markMusterSynced(id: number): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    "UPDATE muster SET is_sent = 1, syncdate = datetime('now') WHERE idmuster = ?",
    [id],
  );
}

function rowsToArray<T>(result: { rows: { length: number; item: (i: number) => T } }): T[] {
  const rows: T[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
}
