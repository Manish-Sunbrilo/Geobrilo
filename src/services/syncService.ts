import { getOrCreateDeviceUid, getSession, getStoredCompanyCode } from './storage';
import { getUnsyncedMusters, markMusterSynced } from '../db/musterRepo';
import {
  getUnsyncedTripEnds,
  getUnsyncedTripStarts,
  markTripFullySynced,
  markTripStartSynced,
} from '../db/tripsRepo';
import { getUnsyncedTripLocations, markTripLocationsSynced } from '../db/tripLocationsRepo';
import { pushMuster, pushTripEnd, pushTripLocation, pushTripStart } from './pushQueueApi';

async function currentIdentity() {
  const [session, deviceUid, companyCode] = await Promise.all([
    getSession(),
    getOrCreateDeviceUid(),
    getStoredCompanyCode(),
  ]);
  return {
    userid: session?.userid ?? '',
    eno: session?.eno ?? 'eeno',
    eeno: session?.eeno ?? 'eeno',
    phone1: session?.phone1 ?? '',
    deviceUid,
    companyCode: companyCode ?? 'default',
  };
}

export async function syncUnsyncedMusters(): Promise<void> {
  const identity = await currentIdentity();
  const rows = await getUnsyncedMusters();
  for (const row of rows) {
    const ok = await pushMuster({
      eno: identity.eno,
      eeno: identity.eeno,
      userid: row.userid,
      musterdate: row.musterdate,
      status: '1',
      musterpresensetype: row.musterpresensetype,
      guid: row.guid,
      source: 'geobrilo-app',
      companycode: identity.companyCode,
      latitude: row.latitude,
      longitude: row.longitude,
      accuracy: row.accuracy,
      altitude: row.altitude,
      speed: row.speed,
      heading: row.heading,
      selfieimage: row.selfieimage,
      remark: row.remark,
      deviceSystemId: identity.deviceUid,
    });
    if (ok) {
      await markMusterSynced(row.idmuster);
    }
  }
}

export async function syncUnsyncedTripStarts(): Promise<void> {
  const identity = await currentIdentity();
  const rows = await getUnsyncedTripStarts();
  for (const row of rows) {
    const ok = await pushTripStart({
      tripguid: row.tripguid,
      description: row.description,
      tripStart: row.start_time,
      companycode: identity.companyCode,
      userid: row.userid,
      deviceId: `${row.userid}${row.tripguid.slice(0, 8)}`,
      deviceSystemId: identity.deviceUid,
      phoneNumber: identity.phone1,
    });
    if (ok) {
      await markTripStartSynced(row.tripguid);
    }
  }
}

export async function syncUnsyncedTripEnds(): Promise<void> {
  const identity = await currentIdentity();
  const rows = await getUnsyncedTripEnds();
  for (const row of rows) {
    const ok = await pushTripEnd({
      tripguid: row.tripguid,
      description: row.description,
      tripStart: row.start_time,
      tripEnd: row.end_time ?? '',
      remark: row.remark ?? '',
      companycode: identity.companyCode,
      userid: row.userid,
      deviceId: `${row.userid}${row.tripguid.slice(0, 8)}`,
      deviceSystemId: identity.deviceUid,
      phoneNumber: identity.phone1,
    });
    if (ok) {
      await markTripFullySynced(row.tripguid);
    }
  }
}

export async function syncUnsyncedTripLocations(): Promise<void> {
  const identity = await currentIdentity();
  const rows = await getUnsyncedTripLocations();
  for (const row of rows) {
    const ok = await pushTripLocation({
      tripguid: row.tripguid,
      latitude: row.latitude,
      longitude: row.longitude,
      altitude: row.altitude,
      accuracy: row.accuracy,
      speed: row.speed,
      heading: row.heading,
      trackedOn: row.trackedon,
      userid: row.userid,
      deviceSystemId: identity.deviceUid,
      companycode: identity.companyCode,
    });
    if (ok) {
      await markTripLocationsSynced([row.idtriplocations]);
    }
  }
}

export async function syncAll(): Promise<void> {
  await syncUnsyncedMusters();
  await syncUnsyncedTripStarts();
  await syncUnsyncedTripEnds();
  await syncUnsyncedTripLocations();
}
