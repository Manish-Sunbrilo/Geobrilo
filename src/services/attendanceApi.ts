import { DEFAULT_DEVICE_CONFIG, buildAttendanceEndpoints } from '../config/apiConfig';
import { postXml } from './httpXml';
import { getDeviceConfig } from './storage';
import { buildPassDataXml, findTagList, findTagText, parseXmlDocument } from '../utils/xml';
import type { HolidayRecord, MusterRecord, MusterReportResult } from '../types/attendance';

/** fromDate/toDate must be 'yyyy-MM-dd'. */
export async function getMusterReport(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<MusterReportResult> {
  const config = (await getDeviceConfig()) ?? DEFAULT_DEVICE_CONFIG;
  const xmlBody = buildPassDataXml([
    ['userid', userId],
    ['fromdate', fromDate],
    ['todate', toDate],
  ]);

  let xmlText: string;
  try {
    xmlText = await postXml(buildAttendanceEndpoints(config).musterReport, xmlBody);
  } catch {
    return { success: false, message: 'Could not reach the server. Check your connection and try again.' };
  }

  let doc: unknown;
  try {
    doc = parseXmlDocument(xmlText);
  } catch {
    return { success: false, message: 'Received an unexpected response from the server.' };
  }

  const musterNodes = findTagList(doc, 'muster') as Array<Record<string, unknown>>;
  const records: MusterRecord[] = musterNodes.map(node => ({
    date: node.fdatedata != null ? String(node.fdatedata) : undefined,
    checkIn: node.fcheckinhourmin != null ? String(node.fcheckinhourmin) : undefined,
    checkOut: node.fcheckouthourmin != null ? String(node.fcheckouthourmin) : undefined,
    minuteDifference:
      node.minutedifference != null ? Number(node.minutedifference) : undefined,
    remark: node.remark != null ? String(node.remark) : undefined,
  }));

  const holidayNodes = findTagList(doc, 'holiday') as Array<Record<string, unknown>>;
  const holidays: HolidayRecord[] = holidayNodes
    .map(node => ({
      date: node.holiday_yyyy_mm_dd != null ? String(node.holiday_yyyy_mm_dd) : '',
      description:
        node.holidaydescription != null ? String(node.holidaydescription) : undefined,
    }))
    .filter(h => h.date);

  const errorno = findTagText(doc, 'errorno');
  if (errorno && errorno !== '0' && records.length === 0 && holidays.length === 0) {
    return {
      success: false,
      message: findTagText(doc, 'errordesc') || 'Could not load attendance.',
    };
  }

  return { success: true, records, holidays };
}
