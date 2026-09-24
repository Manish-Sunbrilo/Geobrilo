import { DEFAULT_DEVICE_CONFIG, buildAttendanceEndpoints } from '../config/apiConfig';
import { postXml } from './httpXml';
import { getDeviceConfig } from './storage';
import { buildFieldsXml } from '../utils/xml';

const SYNC_SUCCESS_MARKER = '<queuemessageresponse>0</queuemessageresponse>';

function buildQueueXml(listXml: string, endpointKey: string, companyCode: string): string {
  return (
    `<queuemessagerequest><passdata><request><fdata>${listXml}</fdata>` +
    `<endpoint>${endpointKey}</endpoint></request></passdata>` +
    `<companycode>${companyCode}</companycode></queuemessagerequest>`
  );
}

export async function pushToQueue(
  listXml: string,
  endpointKey: string,
  companyCode: string,
): Promise<boolean> {
  const config = (await getDeviceConfig()) ?? DEFAULT_DEVICE_CONFIG;
  const xmlBody = buildQueueXml(listXml, endpointKey, companyCode);
  try {
    const responseText = await postXml(buildAttendanceEndpoints(config).pushQueue, xmlBody);
    return responseText.includes(SYNC_SUCCESS_MARKER);
  } catch {
    return false;
  }
}

export type MusterPushRecord = {
  eno: string;
  eeno: string;
  userid: string;
  musterdate: string;
  status: string;
  musterpresensetype: string;
  guid: string;
  source: string;
  companycode: string;
  latitude: string;
  longitude: string;
  accuracy: string;
  altitude: string;
  speed: string;
  heading: string;
  selfieimage: string;
  remark: string;
  deviceSystemId: string;
};

export function pushMuster(record: MusterPushRecord): Promise<boolean> {
  const fields = buildFieldsXml([
    ['eno', record.eno],
    ['eeno', record.eeno],
    ['userid', record.userid],
    ['musterdate', record.musterdate],
    ['mustertype', 'M02'],
    ['status', record.status],
    ['musterpresensetype', record.musterpresensetype],
    ['guid', record.guid],
    ['source', record.source],
    ['companycode', record.companycode],
    ['latitude', record.latitude],
    ['longitude', record.longitude],
    ['accuracy', record.accuracy],
    ['altitude', record.altitude],
    ['speed', record.speed],
    ['heading', record.heading],
    ['selfieimage', record.selfieimage],
    ['remark', record.remark],
    ['devicesystemid', record.deviceSystemId],
    ['deviceuid', record.deviceSystemId],
  ]);
  const listXml = `<musterlist><muster>${fields}</muster></musterlist>`;
  return pushToQueue(listXml, 'muster_xxx_x_api_push_multiple_muster', record.companycode);
}

export type TripStartPushRecord = {
  tripguid: string;
  description: string;
  tripStart: string;
  companycode: string;
  userid: string;
  deviceId: string;
  deviceSystemId: string;
  phoneNumber: string;
};

export function pushTripStart(record: TripStartPushRecord): Promise<boolean> {
  const fields = buildFieldsXml([
    ['tripguid', record.tripguid],
    ['description', record.description],
    ['tripstart', record.tripStart],
    ['tripend', ''],
    ['companycode', record.companycode],
    ['userid', record.userid],
    ['deviceid', record.deviceId],
    ['devicesystemid', record.deviceSystemId],
    ['deviceuid', record.deviceSystemId],
    ['phonenumber', record.phoneNumber],
  ]);
  const listXml = `<tracktriplist><tracktrip>${fields}</tracktrip></tracktriplist>`;
  return pushToQueue(listXml, 'tracktrip_xxx_x_api_push_multiple_tracktrip', record.companycode);
}

export type TripEndPushRecord = TripStartPushRecord & {
  tripEnd: string;
  remark: string;
};

export function pushTripEnd(record: TripEndPushRecord): Promise<boolean> {
  const fields = buildFieldsXml([
    ['tripguid', record.tripguid],
    ['description', record.description],
    ['tripstart', record.tripStart],
    ['tripend', record.tripEnd],
    ['companycode', record.companycode],
    ['userid', record.userid],
    ['deviceid', record.deviceId],
    ['devicesystemid', record.deviceSystemId],
    ['deviceuid', record.deviceSystemId],
    ['phonenumber', record.phoneNumber],
    ['remark', record.remark],
  ]);
  const listXml = `<tracktriplist><tracktrip>${fields}</tracktrip></tracktriplist>`;
  return pushToQueue(listXml, 'tracktrip_xxx_x_api_push_multiple_tracktrip', record.companycode);
}

export type TripLocationPushRecord = {
  tripguid: string;
  latitude: string;
  longitude: string;
  altitude: string;
  accuracy: string;
  speed: string;
  heading: string;
  trackedOn: string;
  userid: string;
  deviceSystemId: string;
  companycode: string;
};

export function pushTripLocation(record: TripLocationPushRecord): Promise<boolean> {
  const fields = buildFieldsXml([
    ['tripguid', record.tripguid],
    ['longitude', record.longitude],
    ['latitude', record.latitude],
    ['altitude', record.altitude],
    ['accuracy', record.accuracy],
    ['speed', record.speed],
    ['heading', record.heading],
    ['trackedon', record.trackedOn],
    ['userid', record.userid],
    ['deviceuid', record.deviceSystemId],
    ['companycode', record.companycode],
  ]);
  const listXml = `<trackdatalist><trackdata>${fields}</trackdata></trackdatalist>`;
  return pushToQueue(listXml, 'trackdata_xxx_x_api_push_multiple_trackdata', record.companycode);
}
