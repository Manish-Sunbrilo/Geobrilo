import { getDatabase } from './database';
import { generateUuidV4 } from '../utils/uuid';

export const E_LOGIN = 'E_LOGIN';
export const E_LOGOUT = 'E_LOGOUT';
export const E_FLIGHTMODE_ENABLE = 'E_FLIGHTMODE_ENABLE';
export const E_FLIGHTMODE_DISABLE = 'E_FLIGHTMODE_DISABLE';
export const E_GEOBRILO_APP_OFF = 'E_GEOBRILO_APP_OFF';
export const E_GEOBRILO_APP_ON = 'E_GEOBRILO_APP_ON';
export const E_GEOBRILO_DEVICE_OFF = 'E_GEOBRILO_DEVICE_OFF';
export const E_GEOBRILO_DEVICE_ON = 'E_GEOBRILO_DEVICE_ON';
export const E_GEOBRILO_INTERNET_OFF = 'E_GEOBRILO_INTERNET_OFF';
export const E_GEOBRILO_INTERNET_ON = 'E_GEOBRILO_INTERNET_ON';

export type AuditEventType =
  | typeof E_LOGIN
  | typeof E_LOGOUT
  | typeof E_FLIGHTMODE_ENABLE
  | typeof E_FLIGHTMODE_DISABLE
  | typeof E_GEOBRILO_APP_OFF
  | typeof E_GEOBRILO_APP_ON
  | typeof E_GEOBRILO_DEVICE_OFF
  | typeof E_GEOBRILO_DEVICE_ON
  | typeof E_GEOBRILO_INTERNET_OFF
  | typeof E_GEOBRILO_INTERNET_ON;

export type AuditEventRow = {
  idauditevent: number;
  guid: string | null;
  eventtype: AuditEventType;
  eventat: string;
  tripguid: string | null;
  detail: string | null;
  userid: string;
  syncdate: string | null;
  is_sent: number;
};

/**
 * A guid is generated once here and persisted with the row (not regenerated
 * per push attempt), matching muster/trip's own pattern -- so retries of the
 * same local event reuse the same guid instead of the backend seeing a new
 * identifier every time a sync attempt fails and gets re-tried.
 */
export async function insertAuditEvent(
  eventtype: AuditEventType,
  eventat: string,
  userId: string,
  tripguid: string,
  detail: string,
): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    `INSERT INTO auditevents (guid, eventtype, eventat, tripguid, detail, userid, is_sent)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [generateUuidV4(), eventtype, eventat, tripguid, detail, userId],
  );
}

export async function getUnsyncedAuditEvents(): Promise<AuditEventRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT * FROM auditevents WHERE is_sent = 0');
  return rowsToArray<AuditEventRow>(result);
}

export async function markAuditEventSynced(id: number): Promise<void> {
  const db = await getDatabase();
  await db.executeSql(
    "UPDATE auditevents SET is_sent = 1, syncdate = datetime('now') WHERE idauditevent = ?",
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
