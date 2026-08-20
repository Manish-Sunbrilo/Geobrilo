import { DEFAULT_DEVICE_CONFIG, buildAttendanceEndpoints } from '../config/apiConfig';
import { postXml } from './httpXml';
import { getDeviceConfig } from './storage';
import { buildPassDataXml, findTagList, findTagText, parseXmlDocument } from '../utils/xml';
import type { TripBreadcrumb, TripReportEntry, TripReportResult } from '../types/attendance';

/** fromDate/toDate must be 'yyyy-MM-dd'. */
export async function getTripReport(
  userId: string,
  fromDate: string,
  toDate: string,
  companyCode: string,
): Promise<TripReportResult> {
  const config = (await getDeviceConfig()) ?? DEFAULT_DEVICE_CONFIG;
  const xmlBody = buildPassDataXml([
    ['userid', userId],
    ['fromdate', fromDate],
    ['todate', toDate],
    ['companycode', companyCode],
  ]);

  let xmlText: string;
  try {
    xmlText = await postXml(buildAttendanceEndpoints(config).tripReport, xmlBody);
  } catch {
    return { success: false, message: 'Could not reach the server. Check your connection and try again.' };
  }

  let doc: unknown;
  try {
    doc = parseXmlDocument(xmlText);
  } catch {
    return { success: false, message: 'Received an unexpected response from the server.' };
  }

  const tripNodes = findTagList(doc, 'trip') as Array<Record<string, unknown>>;
  const trips: TripReportEntry[] = tripNodes.map(node => {
    const breadcrumbNodes = findTagList(node, 'trackdata') as Array<Record<string, unknown>>;
    const points: TripBreadcrumb[] = breadcrumbNodes.map(point => ({
      latitude: point.latitude != null ? String(point.latitude) : '0',
      longitude: point.longitude != null ? String(point.longitude) : '0',
      accuracy: point.accuracy != null ? String(point.accuracy) : undefined,
      altitude: point.altitude != null ? String(point.altitude) : undefined,
      speed: point.speed != null ? String(point.speed) : undefined,
      heading: point.heading != null ? String(point.heading) : undefined,
      trackedOn: point.trackedon != null ? String(point.trackedon) : undefined,
    }));

    return {
      tripguid: node.tripguid != null ? String(node.tripguid) : '',
      description: node.description != null ? String(node.description) : undefined,
      tripStart: node.tripstart != null ? String(node.tripstart) : undefined,
      tripEnd: node.tripend != null ? String(node.tripend) : undefined,
      points,
    };
  });

  const errorno = findTagText(doc, 'errorno');
  if (errorno && errorno !== '0' && trips.length === 0) {
    return {
      success: false,
      message: findTagText(doc, 'errordesc') || 'Could not load trips.',
    };
  }

  return { success: true, trips: trips.filter(t => t.tripguid) };
}
