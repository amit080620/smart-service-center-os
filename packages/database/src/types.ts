// Core schema types — matching the already-applied Supabase schema from
// the previous build (organizations, branches, employees tables). More
// types get added here as each module is rebuilt.
import type { Role, OrgStatus, OrgPlan } from '@smartbizos/constants';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  business_type: string;
  status: OrgStatus;
  contact_email: string;
  contact_phone: string;
  address: string;
  logo_url: string | null;
  plan: OrgPlan;
  trial_ends_at: string | null;
  max_branches: number;
  max_employees: number;
  settings: {
    cgst_rate: number;
    sgst_rate: number;
    igst_rate: number;
    currency: string;
    timezone: string;
    whatsapp_enabled: boolean;
    [key: string]: unknown;
  };
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Branch {
  id: string;
  org_id: string;
  name: string;
  address: string;
  phone: string;
  manager_id: string | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Employee {
  id: string;
  org_id: string;
  branch_id: string;
  user_id: string; // Supabase Auth user id
  full_name: string;
  role: Role;
  phone: string;
  email: string;
  hire_date: string;
  monthly_salary: number | null;
  hourly_rate: number | null;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Customer {
  id: string;
  org_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  whatsapp_opt_in: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface Vehicle {
  id: string;
  org_id: string;
  customer_id: string;
  plate_number: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  color: string;
  odometer_km: number;
  last_service_odometer: number | null;
  next_service_date: string | null;
  next_service_odometer: number | null;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SessionContext {
  employee: Employee;
  org: Organization;
  branch: Branch;
}