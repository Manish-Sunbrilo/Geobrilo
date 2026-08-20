export type MusterRecord = {
  date?: string;
  checkIn?: string;
  checkOut?: string;
  minuteDifference?: number;
  remark?: string;
};

export type HolidayRecord = {
  date: string;
  description?: string;
};

export type MusterReportResult =
  | { success: true; records: MusterRecord[]; holidays: HolidayRecord[] }
  | { success: false; message: string };

export type TripBreadcrumb = {
  latitude: string;
  longitude: string;
  accuracy?: string;
  altitude?: string;
  speed?: string;
  heading?: string;
  trackedOn?: string;
};

export type TripReportEntry = {
  tripguid: string;
  description?: string;
  tripStart?: string;
  tripEnd?: string;
  points: TripBreadcrumb[];
};

export type TripReportResult =
  | { success: true; trips: TripReportEntry[] }
  | { success: false; message: string };
