import AsyncStorage from '@react-native-async-storage/async-storage';
import { generateUuidV4 } from '../utils/uuid';
import type { SUser } from '../types/auth';

const KEYS = {
  deviceUid: 'geobrilo_device_uid',
  guid: 'geobrilo_signup_guid',
  companyCode: 'geobrilo_company_code',
  provisioned: 'geobrilo_provisioned',
  rememberedUserId: 'geobrilo_remembered_user_id',
  sessionUser: 'geobrilo_session_user',
  trackingState: 'geobrilo_tracking_state',
  deviceConfig: 'geobrilo_device_config',
} as const;

async function getOrCreate(key: string): Promise<string> {
  const existing = await AsyncStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const created = generateUuidV4();
  await AsyncStorage.setItem(key, created);
  return created;
}

export function getOrCreateDeviceUid(): Promise<string> {
  return getOrCreate(KEYS.deviceUid);
}

export function getOrCreateGuid(): Promise<string> {
  return getOrCreate(KEYS.guid);
}

export function getStoredCompanyCode(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.companyCode);
}

export async function setStoredCompanyCode(code: string): Promise<void> {
  await AsyncStorage.setItem(KEYS.companyCode, code);
}

export type DeviceConfig = { baseUrl: string; clientCode: string; environment: string };

export async function getDeviceConfig(): Promise<DeviceConfig | null> {
  const raw = await AsyncStorage.getItem(KEYS.deviceConfig);
  return raw ? (JSON.parse(raw) as DeviceConfig) : null;
}

export async function setDeviceConfig(config: DeviceConfig): Promise<void> {
  await AsyncStorage.setItem(KEYS.deviceConfig, JSON.stringify(config));
}

export async function isProvisioned(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.provisioned)) === '1';
}

export async function markProvisioned(): Promise<void> {
  await AsyncStorage.setItem(KEYS.provisioned, '1');
}

export function getRememberedUserId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.rememberedUserId);
}

export async function setRememberedUserId(userId: string | null): Promise<void> {
  if (userId) {
    await AsyncStorage.setItem(KEYS.rememberedUserId, userId);
  } else {
    await AsyncStorage.removeItem(KEYS.rememberedUserId);
  }
}

export async function saveSession(user: SUser): Promise<void> {
  await AsyncStorage.setItem(KEYS.sessionUser, JSON.stringify(user));
}

export async function getSession(): Promise<SUser | null> {
  const raw = await AsyncStorage.getItem(KEYS.sessionUser);
  return raw ? (JSON.parse(raw) as SUser) : null;
}

export async function clearSession(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.sessionUser);
}

export type TrackingState = { isTracking: boolean; tripGuid: string; description: string };

export async function getTrackingState(): Promise<TrackingState | null> {
  const raw = await AsyncStorage.getItem(KEYS.trackingState);
  return raw ? (JSON.parse(raw) as TrackingState) : null;
}

export async function setTrackingState(state: TrackingState): Promise<void> {
  await AsyncStorage.setItem(KEYS.trackingState, JSON.stringify(state));
}

export async function clearTrackingState(): Promise<void> {
  await AsyncStorage.removeItem(KEYS.trackingState);
}
