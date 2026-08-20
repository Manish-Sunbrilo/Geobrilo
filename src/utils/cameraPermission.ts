import { PermissionsAndroid, Platform } from 'react-native';

export async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}
