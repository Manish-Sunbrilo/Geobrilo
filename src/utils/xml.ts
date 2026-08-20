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
