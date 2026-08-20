import { getDatabase } from './database';

export type BranchRow = {
  idbranch: string;
  latitude: string;
  longitude: string;
};

export async function replaceBranches(branches: BranchRow[]): Promise<void> {
  const db = await getDatabase();
  await db.executeSql('DELETE FROM branch');
  for (const branch of branches) {
    await db.executeSql(
      'INSERT INTO branch (idbranch, latitude, longitude) VALUES (?, ?, ?)',
      [branch.idbranch, branch.latitude, branch.longitude],
    );
  }
}

export async function getAllBranches(): Promise<BranchRow[]> {
  const db = await getDatabase();
  const [result] = await db.executeSql('SELECT idbranch, latitude, longitude FROM branch');
  const rows: BranchRow[] = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
}
