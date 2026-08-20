const emptyResult = { rows: { length: 0, item: () => undefined } };

const fakeDb = {
  executeSql: jest.fn(() => Promise.resolve([emptyResult])),
};

module.exports = {
  enablePromise: jest.fn(),
  openDatabase: jest.fn(() => Promise.resolve(fakeDb)),
};
