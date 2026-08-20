import { getDatabase } from './database';

export type TripRow = {
  idtrips: number;
  tripguid: string;
  description: string;
  start_time: string;
  end_time: string | null;
  remark: string | null;
  userid: string;
  syncdate: string | null;
  is_sent: number;
};

/** is_sent states: 0 = not synced, 2 = trip-start pushed only, 1 = fully synced (start + end). */

export async function insertTrip(
  tripguid: string,
  description: string,
  startTime: string,
  userId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    'INSERT INTO trips (tripguid, description, start_time, userid, is_sent) VALUES (?, ?, ?, ?, 0)',
    [tripguid, description, startTime, userId],
  );
}

export async function updateTripEnd(tripguid: string, endTime: string): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('UPDATE trips SET end_time = ? WHERE tripguid = ?', [endTime, tripguid]);
}

export async function updateTripRemark(tripguid: string, remark: string): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('UPDATE trips SET remark = ? WHERE tripguid = ?', [remark, tripguid]);
}

export async function markTripStartSynced(tripguid: string): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('UPDATE trips SET is_sent = 2 WHERE tripguid = ?', [tripguid]);
}

export async function markTripFullySynced(tripguid: string): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    "UPDATE trips SET is_sent = 1, syncdate = datetime('now') WHERE tripguid = ?",
    [tripguid],
  );
}

export async function getUnsyncedTripStarts(): Promise<TripRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT * FROM trips WHERE is_sent = 0');
  return rowsToArray<TripRow>(result);
}

export async function getUnsyncedTripEnds(): Promise<TripRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    "SELECT * FROM trips WHERE is_sent = 2 AND end_time IS NOT NULL AND end_time != ''",
  );
  return rowsToArray<TripRow>(result);
}

export async function getAllTrips(): Promise<TripRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT * FROM trips ORDER BY start_time DESC');
  return rowsToArray<TripRow>(result);
}

export async function getTripByGuid(tripguid: string): Promise<TripRow | undefined> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT * FROM trips WHERE tripguid = ?', [tripguid]);
  return result.rows.length > 0 ? result.rows.item(0) : undefined;
}

export async function tripExists(tripguid: string): Promise<boolean> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT 1 FROM trips WHERE tripguid = ?', [tripguid]);
  return result.rows.length > 0;
}

export async function insertTripFromApi(
  tripguid: string,
  description: string,
  startTime: string,
  endTime: string | null,
  userId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO trips (tripguid, description, start_time, end_time, userid, is_sent, syncdate)
     VALUES (?, ?, ?, ?, ?, 1, datetime('now'))`,
    [tripguid, description, startTime, endTime, userId],
  );
}

function rowsToArray<T>(result: { rows: { length: number; item: (i: number) => T } }): T[] {
  const rows: T[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
}
