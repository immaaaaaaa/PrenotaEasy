export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Monday … 6 = Sunday

export type AppointmentStatus = "booked" | "cancelled" | "completed" | "no_show";

export interface Business {
  id: string;
  owner_id: string | null;
  name: string;
  slug: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  slot_step_min: number;
  booking_lead_min: number;
  booking_horizon_days: number;
  onboarded: boolean;
  operator_pages_enabled?: boolean;
  created_at: string;
}

export interface BusinessHours {
  id: string;
  business_id: string;
  weekday: Weekday;
  is_closed: boolean;
  open_time: string | null; // 'HH:mm:ss'
  close_time: string | null;
  break_start: string | null;
  break_end: string | null;
}

export type BookingMode = "auto" | "fixed_slots";

export interface Service {
  id: string;
  business_id: string;
  name: string;
  duration_min: number;
  price_cents: number;
  sort: number;
  active: boolean;
  created_at: string;
  description?: string | null;
  booking_mode?: BookingMode; // absent/"auto" = free availability (default)
}

export interface ServiceAddon {
  id: string;
  business_id: string;
  service_id: string;
  name: string;
  extra_min: number;
  extra_price_cents: number;
  sort: number;
  active: boolean;
  created_at: string;
}

/** Snapshot of an add-on as chosen at booking time (stored on the appointment). */
export interface AppointmentAddon {
  name: string;
  extra_min: number;
  extra_price_cents: number;
}

export interface ServiceSlot {
  id: string;
  business_id: string;
  service_id: string;
  weekday: Weekday; // 0 = Monday … 6 = Sunday
  start_time: string; // 'HH:mm:ss'
  employee_id: string | null; // null = any operator
  active: boolean;
  created_at: string;
}

export interface ServiceSlotException {
  id: string;
  business_id: string;
  service_id: string;
  date: string; // YYYY-MM-DD
  kind: "removed" | "extra";
  slot_id: string | null; // for 'removed': which recurring slot is hidden
  start_time: string | null; // for 'extra'
  employee_id: string | null; // for 'extra'; null = any operator
  created_at: string;
}

export interface Employee {
  id: string;
  business_id: string;
  name: string;
  color: string;
  sort: number;
  active: boolean;
  access_token?: string;
  avatar_url?: string | null;
  created_at: string;
}

export interface BusinessHoliday {
  id: string;
  business_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  description?: string | null;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  name: string;
  phone: string;
  created_at: string;
}

export interface Appointment {
  id: string;
  business_id: string;
  employee_id: string;
  service_id: string | null;
  customer_id: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  source: "client" | "owner";
  notes: string | null;
  owner_notes?: string | null;
  service_name: string;
  duration_min: number;
  price_cents: number;
  customer_name: string;
  customer_phone: string;
  created_at: string;
  // Snapshot of the optional add-ons chosen at booking time (null = none).
  // duration_min and price_cents already include their extras.
  addons?: AppointmentAddon[] | null;
}
