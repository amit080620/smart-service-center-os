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
    gst_number?: string;
    invoice_footer_text?: string;
    footer_image_url?: string | null;
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
  date_of_birth: string | null;
  anniversary_date: string | null;
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
  vehicle_type: string;
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

export interface PlatformAdmin {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  created_at: string;
}

export interface PlatformSettings {
  id: string;
  bike_job_price: number;
  car_job_price: number;
  low_balance_threshold: number;
  block_threshold: number;
  support_phone: string;
  updated_at: string;
}

export interface OrgWallet {
  org_id: string;
  balance: number;
  custom_bike_price: number | null;
  custom_car_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface WalletTransaction {
  id: string;
  org_id: string;
  type: string;
  amount: number;
  reason: string;
  balance_after: number;
  related_job_id: string | null;
  created_by: string | null;
  created_at: string;
}


export interface Service {
  id: string;
  org_id: string;
  name: string;
  description: string;
  base_cost: number;
  discount_percent: number;
  est_duration_minutes: number;
  category: string;
  hsn_sac_code: string;
  unit: string;
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
  supplier_id: string | null;
  unit_cost: number;
  discount_percent: number;
  hsn_sac_code: string;
  unit: string;
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
  technician_accepted_at: string | null;
  created_by: string;
  approved_by: string | null;
  approved_at: string | null;
  approved_estimate_amount: number | null;
  estimated_cost: number;
  final_cost: number;
  paid: boolean;
  payment_status: string;
  odometer_in: number;
  notes: string;
  technician_notes: string;
  is_insurance_claim: boolean;
  insurance_company: string;
  insurance_claim_number: string;
  insurance_approved_amount: number | null;
  completed_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SupplierBillItem {
  id: string;
  bill_id: string;
  part_id: string;
  qty: number;
  unit_cost: number;
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

export interface Invoice {
  id: string;
  org_id: string;
  job_id: string;
  invoice_number: string;
  subtotal: number;
  discount: number;
  tax_type: string;
  tax: number;
  total: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  due_date: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: string;
  paid_at: string;
  recorded_by: string;
}

export interface Inventory {
  id: string;
  org_id: string;
  branch_id: string;
  part_id: string;
  qty_on_hand: number;
  reorder_level: number;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  inventory_id: string;
  type: string;
  qty: number;
  reference_job_id: string | null;
  performed_by: string;
  notes: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  org_id: string;
  name: string;
  contact_phone: string;
  contact_email: string;
  address: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierBill {
  id: string;
  org_id: string;
  supplier_id: string;
  bill_number: string;
  amount: number;
  amount_paid: number;
  balance_due: number;
  status: string;
  bill_date: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SupplierPayment {
  id: string;
  bill_id: string;
  amount: number;
  method: string;
  paid_at: string;
  recorded_by: string;
}

export interface PlatformUsageCharge {
  id: string;
  org_id: string;
  job_card_id: string;
  amount: number;
  charge_date: string;
  billed: boolean;
  bill_id: string | null;
  created_at: string;
}

export interface PlatformBill {
  id: string;
  org_id: string;
  bill_date: string;
  job_count: number;
  total_amount: number;
  status: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface SessionContext {
  employee: Employee;
  org: Organization;
  branch: Branch;
}
