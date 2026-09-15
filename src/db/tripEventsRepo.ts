import { getDatabase } from './database';

export const TRIP_EVENT_APP_BACKGROUNDED = 'APP_BACKGROUNDED';
export const TRIP_EVENT_CONNECTIVITY_LOST = 'CONNECTIVITY_LOST';
export const TRIP_EVENT_CONNECTIVITY_RESTORED = 'CONNECTIVITY_RESTORED';
export const TRIP_EVENT_LOCATION_GAP = 'LOCATION_GAP';

export type TripEventType =
  | typeof TRIP_EVENT_APP_BACKGROUNDED
  | typeof TRIP_EVENT_CONNECTIVITY_LOST
  | typeof TRIP_EVENT_CONNECTIVITY_RESTORED
  | typeof TRIP_EVENT_LOCATION_GAP;

export type TripEventRow = {
  idtripevent: number;
  tripguid: string;
  eventtype: TripEventType;
  eventat: string;
  detail: string | null;
  userid: string;
  syncdate: string | null;
  is_sent: number;
};

export async function insertTripEvent(
  tripguid: string,
  eventtype: TripEventType,
  eventat: string,
  detail: string,
  userId: string,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO tripevents (tripguid, eventtype, eventat, detail, userid, is_sent)
     VALUES (?, ?, ?, ?, ?, 0)`,
    [tripguid, eventtype, eventat, detail, userId],
  );
}

export async function getUnsyncedTripEvents(): Promise<TripEventRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT * FROM tripevents WHERE is_sent = 0');
  return rowsToArray<TripEventRow>(result);
}

export async function markTripEventSynced(id: number): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    "UPDATE tripevents SET is_sent = 1, syncdate = datetime('now') WHERE idtripevent = ?",
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
