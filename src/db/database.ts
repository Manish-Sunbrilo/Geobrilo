import SQLite from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let dbInstance: SQLite.SQLiteDatabase | null = null;

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS branch (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idbranch TEXT,
    latitude TEXT,
    longitude TEXT
  );`,
  `CREATE TABLE IF NOT EXISTS trips (
    idtrips INTEGER PRIMARY KEY AUTOINCREMENT,
    tripguid TEXT UNIQUE,
    description TEXT,
    start_time TEXT,
    end_time TEXT,
    remark TEXT DEFAULT NULL,
    userid TEXT,
    syncdate TEXT DEFAULT NULL,
    is_sent INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS triplocations (
    idtriplocations INTEGER PRIMARY KEY AUTOINCREMENT,
    tripguid TEXT,
    latitude TEXT,
    longitude TEXT,
    accuracy TEXT,
    altitude TEXT,
    speed TEXT,
    heading TEXT,
    trackedon TEXT,
    userid TEXT,
    syncdate TEXT DEFAULT NULL,
    is_sent INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS tripevents (
    idtripevent INTEGER PRIMARY KEY AUTOINCREMENT,
    tripguid TEXT,
    eventtype TEXT,
    eventat TEXT,
    detail TEXT,
    userid TEXT,
    syncdate TEXT DEFAULT NULL,
    is_sent INTEGER DEFAULT 0
  );`,
  `CREATE TABLE IF NOT EXISTS muster (
    idmuster INTEGER PRIMARY KEY AUTOINCREMENT,
    musterdate TEXT,
    userid TEXT,
    guid TEXT,
    musterpresensetype TEXT DEFAULT 'MP0005',
    latitude TEXT,
    longitude TEXT,
    accuracy TEXT,
    altitude TEXT,
    speed TEXT,
    heading TEXT,
    selfieimage TEXT,
    remark TEXT,
    syncdate TEXT DEFAULT NULL,
    is_sent INTEGER DEFAULT 0
  );`,
];

// Column added after the muster table already shipped to some installs;
// CREATE TABLE IF NOT EXISTS won't retrofit it onto an existing table.
const MIGRATION_STATEMENTS = [
  `ALTER TABLE muster ADD COLUMN musterpresensetype TEXT DEFAULT 'MP0005';`,
];

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (dbInstance) {
    return dbInstance;
  }
  const db = await SQLite.openDatabase({ name: 'kattendance.db', location: 'default' });
  for (const statement of SCHEMA_STATEMENTS) {
    await db.executeSql(statement);
  }
  for (const statement of MIGRATION_STATEMENTS) {
    try {
      await db.executeSql(statement);
    } catch {
      // Column already exists on this install — expected on every run after the first.
    }
  }
  dbInstance = db;
  return db;
}
