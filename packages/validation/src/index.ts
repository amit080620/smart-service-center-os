// Auth-related validation schemas. Used on BOTH sides: the login/signup
// forms in apps/web validate with these before submitting (fast, friendly
// client-side feedback), and the API routes in apps/web/app/api validate
// with the SAME schema before touching the database (never trust the
// client — the previous build had several endpoints that skipped this).
// One definition, two places it matters, zero drift between them.

import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.')
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  orgName: z.string().trim().min(2, 'Garage name must be at least 2 characters.'),
  ownerFullName: z.string().trim().min(2, 'Enter your full name.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  contactPhone: z.string().trim().optional()
});
export type SignupInput = z.infer<typeof signupSchema>;

export const customerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.'),
  lastName: z.string().trim().optional().default(''),
  phone: z.string().trim().min(6, 'Enter a valid phone number.'),
  email: z.string().trim().toLowerCase().email().optional().or(z.literal('')),
  address: z.string().trim().optional().default(''),
  whatsappOptIn: z.boolean().optional().default(true)
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const vehicleSchema = z.object({
  customerId: z.string().uuid('Select a valid customer.'),
  plateNumber: z.string().trim().min(2, 'Plate number is required.'),
  vin: z.string().trim().optional().default(''),
  make: z.string().trim().min(1, 'Make is required.'),
  model: z.string().trim().min(1, 'Model is required.'),
  year: z.number().int().min(1980).max(2100).optional(),
  color: z.string().trim().optional().default(''),
  odometerKm: z.number().int().min(0).optional().default(0),
  notes: z.string().trim().optional().default('')
});
export type VehicleInput = z.infer<typeof vehicleSchema>;

export const serviceSchema = z.object({
  name: z.string().trim().min(1, 'Service name is required.'),
  description: z.string().trim().optional().default(''),
  baseCost: z.number().min(0, 'Cost cannot be negative.'),
  estDurationMinutes: z.number().int().min(0).optional().default(60),
  category: z.string().trim().optional().default('general')
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const partSchema = z.object({
  name: z.string().trim().min(1, 'Part name is required.'),
  sku: z.string().trim().min(1, 'SKU is required.'),
  description: z.string().trim().optional().default(''),
  category: z.string().trim().optional().default('general'),
  supplier: z.string().trim().optional().default(''),
  unitCost: z.number().min(0, 'Cost cannot be negative.')
});
export type PartInput = z.infer<typeof partSchema>;

export const createJobCardSchema = z.object({
  customerId: z.string().uuid('Select a valid customer.'),
  vehicleId: z.string().uuid('Select a valid vehicle.'),
  odometerIn: z.number().int().min(0, 'Odometer reading is required.'),
  notes: z.string().trim().optional().default('')
});
export type CreateJobCardInput = z.infer<typeof createJobCardSchema>;

export const addLineItemSchema = z.object({
  type: z.enum(['service', 'part']),
  itemId: z.string().uuid('Select a valid item.'),
  qty: z.number().min(0.01, 'Quantity must be greater than zero.'),
  unitCost: z.number().min(0, 'Cost cannot be negative.')
});
export type AddLineItemInput = z.infer<typeof addLineItemSchema>;

export const updateJobStatusSchema = z.object({
  // 'completed' is deliberately NOT in this list — completing a job now
  // requires POST /api/job-cards/[id]/complete, which generates the
  // invoice and (eventually) deducts inventory in the same operation.
  // Allowing 'completed' here would let a job be marked done with no
  // invoice ever created — same rule the previous build enforced.
  status: z.enum([
    'received',
    'diagnosing',
    'in_progress',
    'awaiting_parts',
    'pending_approval',
    'approved',
    'delivered',
    'cancelled'
  ]),
  assignedTechnicianId: z.string().uuid().nullable().optional(),
  note: z.string().trim().optional().default('')
});
export type UpdateJobStatusInput = z.infer<typeof updateJobStatusSchema>;

export const recordPaymentSchema = z.object({
  amount: z.number().min(0.01, 'Amount must be greater than zero.'),
  method: z.enum(['cash', 'card', 'upi', 'bank_transfer', 'cheque'])
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const addToInventorySchema = z.object({
  partId: z.string().uuid('Select a valid part.'),
  qtyOnHand: z.number().int().min(0, 'Quantity cannot be negative.'),
  reorderLevel: z.number().int().min(0, 'Reorder level cannot be negative.').optional().default(5)
});
export type AddToInventoryInput = z.infer<typeof addToInventorySchema>;

export const adjustInventorySchema = z.object({
  type: z.enum(['received', 'adjusted']),
  qty: z.number().int().refine((n) => n !== 0, 'Quantity cannot be zero.'),
  notes: z.string().trim().optional().default('')
});
export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;

export const createEmployeeSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter the employee\u2019s full name.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  phone: z.string().trim().optional().default(''),
  role: z.enum(['super_admin', 'branch_manager', 'hr', 'accountant', 'parts_clerk', 'technician', 'reception']),
  hireDate: z.string().optional(),
  monthlySalary: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional()
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z.object({
  role: z.enum(['super_admin', 'branch_manager', 'hr', 'accountant', 'parts_clerk', 'technician', 'reception']).optional(),
  status: z.enum(['active', 'inactive']).optional()
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
