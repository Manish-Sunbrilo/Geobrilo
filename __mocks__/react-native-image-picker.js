module.exports = {
  launchCamera: jest.fn((_options, callback) => {
    callback?.({ didCancel: true, assets: [] });
  }),
  launchImageLibrary: jest.fn((_options, callback) => {
    callback?.({ didCancel: true, assets: [] });
  }),
};
