import type { DeviceConfig } from '../services/storage';

/** Prefills the Sign Up form; matches the reference Android app's defaults. */
export const DEFAULT_DEVICE_CONFIG: DeviceConfig = {
  baseUrl: 'https://sbt.pulsar100.com',
  clientCode: 'sbt',
  environment: 'sandbox',
};

function apiBase(config: DeviceConfig): string {
  const clientCode = config.clientCode.toLowerCase();
  const environment = config.environment.toLowerCase();
  return `${config.baseUrl}/${clientCode}/${environment}/pulsar100/external_interface/pulsar_api`;
}

export function buildAuthEndpoints(config: DeviceConfig) {
  const base = apiBase(config);
  return {
    signIn: `${base}/signin/x_api_signin.php`,
    signUp: `${base}/signup/x_api_signup.php`,
  };
}

export function buildAttendanceEndpoints(config: DeviceConfig) {
  const base = apiBase(config);
  return {
    musterReport: `${base}/musterreport/x_api_get_suser_muster_report.php`,
    tripReport: `${base}/tripreport/x_api_get_suser_trip_report.php`,
    pushQueue: `${base}/apifactory/x_api_add_to_process_queue.php`,
  };
}

export function buildProfileEndpoints(config: DeviceConfig) {
  const base = apiBase(config);
  return {
    updateProfile: `${base}/suser/x_api_updateprofile.php`,
  };
}
