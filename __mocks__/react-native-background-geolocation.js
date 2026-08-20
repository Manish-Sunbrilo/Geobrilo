const BackgroundGeolocation = {
  ready: jest.fn(() => Promise.resolve({})),
  requestPermission: jest.fn(() => Promise.resolve(3)),
  getCurrentPosition: jest.fn(() =>
    Promise.resolve({
      coords: { latitude: 0, longitude: 0, accuracy: 0, altitude: 0, speed: 0, heading: 0 },
      timestamp: new Date().toISOString(),
    }),
  ),
  start: jest.fn(() => Promise.resolve({})),
  stop: jest.fn(() => Promise.resolve({})),
  onLocation: jest.fn(() => ({ remove: jest.fn() })),
  onGeofence: jest.fn(() => ({ remove: jest.fn() })),
  addGeofence: jest.fn(() => Promise.resolve(true)),
  addGeofences: jest.fn(() => Promise.resolve(true)),
  removeGeofences: jest.fn(() => Promise.resolve(true)),
};

module.exports = BackgroundGeolocation;
module.exports.default = BackgroundGeolocation;
module.exports.DesiredAccuracy = { Navigation: -2, High: -1, Medium: 10, Low: 100, VeryLow: 1000, Lowest: 3000 };
