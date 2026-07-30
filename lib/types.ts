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
}
