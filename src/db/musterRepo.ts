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
