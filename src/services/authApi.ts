import { DEFAULT_DEVICE_CONFIG, buildAuthEndpoints } from '../config/apiConfig';
import { buildPassDataXml, findTagList, findTagText, parseXmlDocument } from '../utils/xml';
import { postXml } from './httpXml';
import {
  getDeviceConfig,
  getOrCreateDeviceUid,
  getOrCreateGuid,
  getStoredCompanyCode,
  markProvisioned,
  setDeviceConfig,
  setStoredCompanyCode,
} from './storage';
import type { Branch, SUser, SignInResult, SignUpResult } from '../types/auth';
import type { DeviceConfig } from './storage';

function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    String(date.getFullYear()) +
    pad(date.getMonth() + 1) +
    pad(date.getDate()) +
    pad(date.getHours()) +
    pad(date.getMinutes()) +
    pad(date.getSeconds())
  );
}

function mapSuser(node: Record<string, unknown>, fallbackUserId: string): SUser {
  const get = (key: string) => (node[key] != null ? String(node[key]) : undefined);
  const addressLines = [
    get('firstaddressline1'),
    get('firstaddressline2'),
    get('firstaddresscity'),
    get('firstaddressstate'),
    get('firstaddresscountry'),
  ].filter((part): part is string => Boolean(part));
  const pincode = get('firstaddresspincode');
  if (pincode) {
    addressLines.push(`Pincode: ${pincode}`);
  }

  return {
    idsuser: get('idsuser'),
    eno: get('eno'),
    eeno: get('eeno'),
    firstname: get('firstname'),
    lastname: get('lastname'),
    dob: get('dob'),
    email1: get('email1'),
    phone1: get('phone1'),
    utype: get('utype'),
    userid: get('userid') ?? fallbackUserId,
    idcompany: get('idcompany'),
    companycode: get('companycode'),
    address: addressLines.length > 0 ? addressLines.join(', ') : undefined,
  };
}

export async function signIn(userId: string, password: string): Promise<SignInResult> {
  const trimmedUserId = userId.trim();
  const [guid, deviceUid, companyCode, deviceConfig] = await Promise.all([
    getOrCreateGuid(),
    getOrCreateDeviceUid(),
    getStoredCompanyCode(),
    getDeviceConfig(),
  ]);
  const config = deviceConfig ?? DEFAULT_DEVICE_CONFIG;

  const xmlBody = buildPassDataXml([
    ['eno', 'eeno'],
    ['eeno', 'eeno'],
    ['userid', trimmedUserId],
    ['sdata', password],
    ['signuptokenguid', guid],
    ['clientcode', config.clientCode],
    ['xkey', 'tbs'],
    ['idcompany', '13'],
    ['deviceuid', deviceUid],
    ['companycode', companyCode ?? 'default'],
  ]);

  let xmlText: string;
  try {
    xmlText = await postXml(buildAuthEndpoints(config).signIn, xmlBody);
  } catch {
    return {
      success: false,
      errorCode: 'network',
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }

  let doc: unknown;
  try {
    doc = parseXmlDocument(xmlText);
  } catch {
    return {
      success: false,
      errorCode: 'parse_error',
      message: 'Received an unexpected response from the server.',
    };
  }

  const errorno = findTagText(doc, 'errorno');
  const errordesc = findTagText(doc, 'errordesc');

  if (errorno === '0') {
    const suserNode = findTagList(doc, 'suser')[0] as Record<string, unknown> | undefined;
    if (!suserNode) {
      return {
        success: false,
        errorCode: 'no_user',
        message: 'No user details found in the response.',
      };
    }
    const user = mapSuser(suserNode, trimmedUserId);
    if (user.companycode) {
      await setStoredCompanyCode(user.companycode);
    }
    return { success: true, user };
  }

  if (errorno === '-1') {
    return {
      success: false,
      errorCode: 'auth_failed',
      message: errordesc || 'Invalid user ID or password.',
    };
  }

  if (errorno === '1') {
    return {
      success: false,
      errorCode: 'locked',
      message: errordesc || 'Your account is locked.',
    };
  }

  return {
    success: false,
    errorCode: errorno ?? 'unknown',
    message: errordesc || 'Something went wrong. Please try again.',
  };
}

export type SignUpParams = {
  baseUrl: string;
  clientCode: string;
  environment: string;
  userId: string;
  password: string;
  /** Not collected on the Sign Up form (matches the reference app); defaults to its placeholder values. */
  phoneNumber?: string;
  phoneCountryCode?: string;
};

export async function signUp(params: SignUpParams): Promise<SignUpResult> {
  const trimmedUserId = params.userId.trim();
  const config: DeviceConfig = {
    baseUrl: params.baseUrl.trim(),
    clientCode: params.clientCode.trim(),
    environment: params.environment.trim(),
  };
  const [guid, deviceUid] = await Promise.all([getOrCreateGuid(), getOrCreateDeviceUid()]);
  const deviceId = `${trimmedUserId}${formatTimestamp()}`;

  const xmlBody = buildPassDataXml([
    ['eno', 'C01E000000'],
    ['eeno', 'C01E000000'],
    ['userid', trimmedUserId],
    ['sdata', params.password],
    ['phonenumber', params.phoneNumber ?? '9860236578'],
    ['phonecountrycode', params.phoneCountryCode ?? '91'],
    ['signuptokenguid', guid],
    ['clientcode', config.clientCode],
    ['xkey', 'tbs'],
    ['idcompany', 'C01'],
    ['companycode', 'C01'],
    ['deviceid', deviceId],
    ['androidid', deviceUid],
    ['devicesystemid', deviceUid],
    ['deviceuid', deviceUid],
    ['trackitementitytype', 'TIE0002'],
  ]);

  let xmlText: string;
  try {
    xmlText = await postXml(buildAuthEndpoints(config).signUp, xmlBody);
  } catch {
    return {
      success: false,
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }

  // Known backend issue: malformed/unexpected requests currently return a
  // raw PHP exception string instead of the documented XML shape.
  if (!xmlText.trim().startsWith('<')) {
    return {
      success: false,
      message: `Signup is currently failing on the server: ${xmlText.trim().slice(0, 200)}`,
    };
  }

  let doc: unknown;
  try {
    doc = parseXmlDocument(xmlText);
  } catch {
    return { success: false, message: 'Received an unexpected response from the server.' };
  }

  const errorno = findTagText(doc, 'errorno');
  const errordesc = findTagText(doc, 'errordesc');

  if (errorno !== '0') {
    return { success: false, message: errordesc || 'Signup failed. Please try again.' };
  }

  const suserNode = findTagList(doc, 'suser')[0] as Record<string, unknown> | undefined;
  if (!suserNode) {
    return { success: false, message: 'User details are missing in the response.' };
  }

  const companyCode = suserNode.companycode != null ? String(suserNode.companycode) : '';
  if (!companyCode) {
    return { success: false, message: 'Company code is missing in the response.' };
  }

  await setStoredCompanyCode(companyCode);
  await setDeviceConfig(config);
  await markProvisioned();

  const branches: Branch[] = (findTagList(doc, 'branch') as Array<Record<string, unknown>>).map(node => ({
    idbranch: node.idbranch != null ? String(node.idbranch) : undefined,
    // The backend's own XML tag is misspelled "laititude", not "latitude".
    latitude: node.laititude != null ? String(node.laititude) : undefined,
    longitude: node.longitude != null ? String(node.longitude) : undefined,
  }));

  return {
    success: true,
    user: {
      userid: suserNode.userid != null ? String(suserNode.userid) : trimmedUserId,
      phone1: suserNode.phone1 != null ? String(suserNode.phone1) : params.phoneNumber,
      companycode: companyCode,
    },
    branches,
  };
}
