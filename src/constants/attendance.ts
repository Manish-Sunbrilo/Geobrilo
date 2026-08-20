/**
 * Muster presence-type codes, shared with the server-side muster API.
 *
 * A "session" is a check-in + check-out pair sharing the same guid. Multiple
 * sessions per day are allowed (e.g. back-to-back night shifts) — the only
 * thing that blocks a new Check-In is an OPEN session (a check-in with no
 * matching check-out yet, from any date).
 */
export const MUSTER_CHECK_IN = 'MP0005';
export const MUSTER_CHECK_OUT = 'MP0006';
export const MUSTER_MISSED_CHECKOUT = 'MP0007';
export const MUSTER_MISSED_CHECKIN = 'MP0008';

export type MusterPresenseType =
  | typeof MUSTER_CHECK_IN
  | typeof MUSTER_CHECK_OUT
  | typeof MUSTER_MISSED_CHECKOUT
  | typeof MUSTER_MISSED_CHECKIN;
