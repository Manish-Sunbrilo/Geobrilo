import { buildPassDataXml, findTagList, findTagText, parseXmlDocument } from './xml';

describe('buildPassDataXml', () => {
  it('wraps fields in the passdata/request/fdata envelope in order', () => {
    const xml = buildPassDataXml([
      ['userid', 'alice'],
      ['sdata', 'secret'],
    ]);
    expect(xml).toBe(
      '<passdata><request><fdata><userid>alice</userid><sdata>secret</sdata></fdata></request></passdata>',
    );
  });

  it('escapes XML-special characters in values', () => {
    const xml = buildPassDataXml([['sdata', `a&b<c>"d"'e'`]]);
    expect(xml).toBe(
      '<passdata><request><fdata><sdata>a&amp;b&lt;c&gt;&quot;d&quot;&apos;e&apos;</sdata></fdata></request></passdata>',
    );
  });
});

describe('findTagText / findTagList', () => {
  it('finds an error nested under <retdata><error> (the live backend shape)', () => {
    const doc = parseXmlDocument(
      '<retdata><error><errorno>-1</errorno><errordesc>Authentication failure !!! </errordesc></error></retdata>',
    );
    expect(findTagText(doc, 'errorno')).toBe('-1');
    expect(findTagText(doc, 'errordesc')).toBe('Authentication failure !!!');
  });

  it('finds a top-level <response><errorno> (the shape the reference app assumed)', () => {
    const doc = parseXmlDocument('<response><errorno>0</errorno></response>');
    expect(findTagText(doc, 'errorno')).toBe('0');
  });

  it('collects a single <suser> as a one-item list', () => {
    const doc = parseXmlDocument(
      '<response><errorno>0</errorno><suserlist><suser><userid>alice</userid><companycode>C01</companycode></suser></suserlist></response>',
    );
    const users = findTagList(doc, 'suser') as Array<Record<string, unknown>>;
    expect(users).toHaveLength(1);
    expect(users[0].userid).toBe('alice');
    expect(users[0].companycode).toBe('C01');
  });

  it('collects multiple <branch> siblings as a list', () => {
    const doc = parseXmlDocument(
      '<response><branchlist><branch><idbranch>1</idbranch></branch><branch><idbranch>2</idbranch></branch></branchlist></response>',
    );
    const branches = findTagList(doc, 'branch') as Array<Record<string, unknown>>;
    expect(branches.map(b => String(b.idbranch))).toEqual(['1', '2']);
  });

  it('returns undefined/empty when a tag is absent', () => {
    const doc = parseXmlDocument('<retdata><errorno>0</errorno></retdata>');
    expect(findTagText(doc, 'errordesc')).toBeUndefined();
    expect(findTagList(doc, 'suser')).toEqual([]);
  });
});
