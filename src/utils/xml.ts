import { XMLParser } from 'fast-xml-parser';

const parser = new XMLParser({ ignoreAttributes: true, trimValues: true });

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function buildFieldsXml(fields: Array<[string, string]>): string {
  return fields.map(([tag, value]) => `<${tag}>${escapeXml(value)}</${tag}>`).join('');
}

export function buildPassDataXml(fields: Array<[string, string]>): string {
  return `<passdata><request><fdata>${buildFieldsXml(fields)}</fdata></request></passdata>`;
}

function buildColumnListXml(fields: Array<[string, string]>): string {
  return `<columnlist>${fields
    .map(([name, value]) => `<column><columnname>${name}</columnname><columnvalue>${escapeXml(value)}</columnvalue></column>`)
    .join('')}</columnlist>`;
}

/**
 * The "generalaudit" service's inner payload. Field placement is confirmed
 * from two sources: the actual deployed backend script
 * (pulsar100dev/external_interface/pulsar_api/service/x_api_common_service_push.php,
 * which reads /passdata/request/fdata/companycode and
 * /passdata/request/fdata/servicelist/service -- so companycode has to be a
 * sibling of servicelist inside <fdata>, not left in the outer
 * <queuemessagerequest> wrapper, since only <passdata> gets forwarded
 * downstream), and the reference Android app's GeneralAuditWorker.java
 * (KrishnaeAttendance), which sends columndata fields userid/eeno/name/
 * eventcode and rawdata fields tripguid/deviceuid/androidid for this exact
 * service. columndata fields become real DB columns on the backend (unlike
 * rawdata, which gets JSON-blobbed into a single column).
 */
export function buildGeneralAuditServiceXml(
  companyCode: string,
  columnFields: Array<[string, string]>,
  rawFields: Array<[string, string]>,
): string {
  return (
    `<companycode>${escapeXml(companyCode)}</companycode>` +
    `<servicelist><service>` +
    `<serviceinfo><servicename>generalaudit</servicename></serviceinfo>` +
    `<servicedata>` +
    `<columndata>${buildColumnListXml(columnFields)}</columndata>` +
    `<rawdata>${buildColumnListXml(rawFields)}</rawdata>` +
    `</servicedata>` +
    `</service></servicelist>`
  );
}

export function parseXmlDocument(xmlText: string): unknown {
  return parser.parse(xmlText);
}

/**
 * The backend's response root tag and error nesting are inconsistent
 * (observed live: <retdata><error><errorno> for failures, while the
 * original client code assumed a top-level <response><errorno> for
 * success). Searching the whole tree for the first match mirrors what
 * the reference app's Java code actually did (getElementsByTagName /
 * "//tag" XPath both search anywhere), so it stays correct either way.
 */
function deepFindFirst(node: unknown, tagName: string): unknown {
  if (node == null || typeof node !== 'object') {
    return undefined;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = deepFindFirst(item, tagName);
      if (found !== undefined) {
        return found;
      }
    }
    return undefined;
  }
  const record = node as Record<string, unknown>;
  if (tagName in record) {
    return record[tagName];
  }
  for (const key of Object.keys(record)) {
    const found = deepFindFirst(record[key], tagName);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

export function findTagText(node: unknown, tagName: string): string | undefined {
  const value = deepFindFirst(node, tagName);
  if (value == null || typeof value === 'object') {
    return undefined;
  }
  return String(value);
}

export function findTagList(node: unknown, tagName: string): unknown[] {
  const value = deepFindFirst(node, tagName);
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}
