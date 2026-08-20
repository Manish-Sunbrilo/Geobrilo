import { DEFAULT_DEVICE_CONFIG, buildProfileEndpoints } from '../config/apiConfig';
import { postXml } from './httpXml';
import { getDeviceConfig } from './storage';
import { buildPassDataXml, findTagText, parseXmlDocument } from '../utils/xml';

export type UpdateProfileParams = {
  userId: string;
  email: string;
  phone: string;
  eno: string;
  eeno: string;
  companyCode: string;
  deviceUid: string;
};

export type UpdateProfileResult = { success: true } | { success: false; message: string };

export async function updateProfile(params: UpdateProfileParams): Promise<UpdateProfileResult> {
  const config = (await getDeviceConfig()) ?? DEFAULT_DEVICE_CONFIG;
  const xmlBody = buildPassDataXml([
    ['eno', params.eno],
    ['eeno', params.eeno],
    ['userid', params.userId],
    ['email1', params.email],
    ['phone1', params.phone],
    ['clientcode', config.clientCode],
    ['xkey', 'tbs'],
    ['idcompany', '13'],
    ['deviceuid', params.deviceUid],
    ['companycode', params.companyCode],
  ]);

  let xmlText: string;
  try {
    xmlText = await postXml(buildProfileEndpoints(config).updateProfile, xmlBody);
  } catch {
    return {
      success: false,
      message: 'Could not reach the server. Check your connection and try again.',
    };
  }

  let doc: unknown;
  try {
    doc = parseXmlDocument(xmlText);
  } catch {
    return { success: false, message: 'Received an unexpected response from the server.' };
  }

  const errorno = findTagText(doc, 'errorno');
  if (errorno && errorno !== '0') {
    return {
      success: false,
      message: findTagText(doc, 'errordesc') || 'Could not update profile.',
    };
  }

  return { success: true };
}
