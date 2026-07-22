// Core schema types — matching the already-applied Supabase schema from
// the previous build (organizations, branches, employees tables). More
// types get added here as each module is rebuilt.
import type { Role, OrgStatus, OrgPlan, JobStatus } from '@smartbizos/constants';

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

export interface Service {
  id: string;
  org_id: string;
  name: string;
  description: string;
  base_cost: number;
  est_duration_minutes: number;
  category: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Part {
  id: string;
  org_id: string;
  name: string;
  sku: string;
  description: string;
  category: string;
  supplier: string;
  unit_cost: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface JobCard {
  id: string;
  org_id: string;
  branch_id: string;
  customer_id: string;
  vehicle_id: string;
  job_number: string;
  status: JobStatus;
  assigned_technician_id: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  estimated_cost: number;
  final_cost: number;
  paid: boolean;
  payment_status: string;
  odometer_in: number;
  notes: string;
  technician_notes: string;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface JobService {
  id: string;
  job_id: string;
  service_id: string;
  qty: number;
  unit_cost: number;
  created_at: string;
}

export interface JobPart {
  id: string;
  job_id: string;
  part_id: string;
  qty: number;
  unit_cost: number;
  created_at: string;
}

export interface JobStatusLog {
  id: string;
  job_id: string;
  old_status: string | null;
  new_status: string;
  changed_by: string;
  changed_at: string;
  note: string;
}

export interface SessionContext {
  employee: Employee;
  org: Organization;
  branch: Branch;
}
