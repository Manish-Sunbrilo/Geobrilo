import { buildGeneralAuditServiceXml } from '../utils/xml';
import { pushToQueue } from './pushQueueApi';
import {
  E_LOGIN,
  E_LOGOUT,
  E_FLIGHTMODE_ENABLE,
  E_FLIGHTMODE_DISABLE,
  E_GEOBRILO_APP_OFF,
  E_GEOBRILO_APP_ON,
  E_GEOBRILO_DEVICE_OFF,
  E_GEOBRILO_DEVICE_ON,
  E_GEOBRILO_INTERNET_OFF,
  E_GEOBRILO_INTERNET_ON,
  type AuditEventType,
} from '../db/auditEventsRepo';

export type AuditEventPushRecord = {
  guid: string;
  eventtype: AuditEventType;
  eventat: string;
  userid: string;
  idsuser: string;
  companycode: string;
  tripguid: string;
  deviceSystemId: string;
  detail: string;
};

/** Every generalaudit-family service page in the backend (pulsar100dev's
 * ui/service/generalaudit/inc_service_info.php and l_inc_listdata.php) sets
 * this exact same constant for both $L_modulecode and $G_module_name. */
const MODULE_CODE = 'M_PULSAR';

// Falls back to a plain, human-readable description of the event type when
// there's no more specific detail (e.g. the device-off/on gap message) --
// so the backend's alert always has something meaningful to display instead
// of just a bare event code.
const DEFAULT_MESSAGES: Record<AuditEventType, string> = {
  [E_LOGIN]: 'User logged in',
  [E_LOGOUT]: 'User logged out',
  [E_FLIGHTMODE_ENABLE]: 'Flight mode is enabled now',
  [E_FLIGHTMODE_DISABLE]: 'Flight mode is disabled now',
  [E_GEOBRILO_APP_OFF]: 'App moved to background',
  [E_GEOBRILO_APP_ON]: 'App brought to foreground',
  [E_GEOBRILO_DEVICE_OFF]: 'Device unreachable, possibly powered off',
  [E_GEOBRILO_DEVICE_ON]: 'Device reachable again',
  [E_GEOBRILO_INTERNET_OFF]: 'Internet connectivity lost',
  [E_GEOBRILO_INTERNET_ON]: 'Internet connectivity restored',
};

/**
 * Posts the "generalaudit" service through the shared jobpipe queue
 * (pushToQueue), which wraps this in <queuemessagerequest>/<endpoint>/
 * <companycode> and gets accepted immediately with a "0" success marker
 * regardless of the endpoint key -- that marker only means the raw XML was
 * queued, not that it was routed anywhere. The jobpipe processor cron later
 * reads <passdata><request><endpoint>, turns "_xxx_" into a "/" to build a
 * file path under external_interface/pulsar_api/, and POSTs <passdata> on to
 * that file. For generalaudit there's no dedicated push_multiple file --
 * the real target (confirmed by reading pulsar100dev's source directly) is
 * external_interface/pulsar_api/service/x_api_common_service_push.php, i.e.
 * endpoint key "service_xxx_x_api_common_service_push". That script is what
 * writes the row the "Monitor API Audit" panel displays.
 *
 * columndata field set (userid/idsuser/description/modulecode/eventcode) is
 * the authoritative one confirmed directly against a real sample payload --
 * these become literal INSERT columns on the backend (unlike rawdata, which
 * gets JSON-blobbed into one column and tolerates any field name), so this
 * list must stay exactly in sync with the real generalaudit table schema.
 * guid moved to rawdata since it isn't part of that confirmed column set.
 */
export function pushAuditEvent(record: AuditEventPushRecord): Promise<boolean> {
  const message = record.detail || DEFAULT_MESSAGES[record.eventtype];
  const listXml = buildGeneralAuditServiceXml(
    record.companycode,
    [
      ['userid', record.userid],
      ['idsuser', record.idsuser],
      ['description', message],
      ['modulecode', MODULE_CODE],
      ['eventcode', record.eventtype],
    ],
    [
      ['tripguid', record.tripguid],
      ['deviceuid', record.deviceSystemId],
      ['androidid', record.deviceSystemId],
      ['guid', record.guid],
      ['eventat', record.eventat],
      ['message', message],
    ],
  );
  return pushToQueue(listXml, 'service_xxx_x_api_common_service_push', record.companycode);
}
