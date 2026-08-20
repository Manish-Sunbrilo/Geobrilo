import { getDatabase } from './database';

export type TripLocationRow = {
  idtriplocations: number;
  tripguid: string;
  latitude: string;
  longitude: string;
  accuracy: string;
  altitude: string;
  speed: string;
  heading: string;
  trackedon: string;
  userid: string;
  syncdate: string | null;
  is_sent: number;
};

export async function insertTripLocation(
  tripguid: string,
  latitude: number,
  longitude: number,
  accuracy: number,
  altitude: number,
  speed: number,
  heading: number,
  trackedon: string,
  userId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO triplocations
     (tripguid, latitude, longitude, accuracy, altitude, speed, heading, trackedon, userid, is_sent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      tripguid,
      String(latitude),
      String(longitude),
      String(accuracy),
      String(altitude),
      String(speed),
      String(heading),
      trackedon,
      userId,
    ],
  );
}

export async function getUnsyncedTripLocations(): Promise<TripLocationRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT * FROM triplocations WHERE is_sent = 0');
  return rowsToArray<TripLocationRow>(result);
}

export async function markTripLocationsSynced(ids: number[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  await db.executeSql(
    `UPDATE triplocations SET is_sent = 1, syncdate = datetime('now') WHERE idtriplocations IN (${placeholders})`,
    ids,
  );
}

export async function getLocationsForTrip(tripguid: string): Promise<TripLocationRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql(
    'SELECT * FROM triplocations WHERE tripguid = ? ORDER BY trackedon ASC',
    [tripguid],
  );
  return rowsToArray<TripLocationRow>(result);
}

export async function insertTripLocationFromApi(
  tripguid: string,
  latitude: string,
  longitude: string,
  accuracy: string,
  altitude: string,
  speed: string,
  heading: string,
  trackedon: string,
  userId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO triplocations
     (tripguid, latitude, longitude, accuracy, altitude, speed, heading, trackedon, userid, is_sent, syncdate)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
    [tripguid, latitude, longitude, accuracy, altitude, speed, heading, trackedon, userId],
  );
}

function rowsToArray<T>(result: { rows: { length: number; item: (i: number) => T } }): T[] {
  const rows: T[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
}
