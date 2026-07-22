// Single source of truth for employee roles. In the previous build, role
// strings like 'org_owner' were typed out by hand in dozens of places
// across the backend — a typo would silently fail (TypeScript can't catch
// a mismatched string literal the way it catches a mismatched identifier).
// Importing ROLES.ORG_OWNER instead means a typo becomes a compile error.

export const ROLES = {
  ORG_OWNER: 'org_owner',
  SUPER_ADMIN: 'super_admin',
  BRANCH_MANAGER: 'branch_manager',
  HR: 'hr',
  ACCOUNTANT: 'accountant',
  PARTS_CLERK: 'parts_clerk',
  TECHNICIAN: 'technician',
  RECEPTION: 'reception'
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);

// Organization subscription status/plan constants
export const ORG_STATUS = {
  TRIAL: 'trial',
  ACTIVE: 'active',
  SUSPENDED: 'suspended'
} as const;
export type OrgStatus = (typeof ORG_STATUS)[keyof typeof ORG_STATUS];

export const ORG_PLAN = {
  TRIAL: 'trial',
  STARTER: 'starter',
  GROWTH: 'growth',
  ENTERPRISE: 'enterprise'
} as const;
export type OrgPlan = (typeof ORG_PLAN)[keyof typeof ORG_PLAN];

// Job card lifecycle status
export const JOB_STATUS = {
  RECEIVED: 'received',
  DIAGNOSING: 'diagnosing',
  IN_PROGRESS: 'in_progress',
  AWAITING_PARTS: 'awaiting_parts',
  PENDING_APPROVAL: 'pending_approval',
  APPROVED: 'approved',
  COMPLETED: 'completed',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled'
} as const;
export type JobStatus = (typeof JOB_STATUS)[keyof typeof JOB_STATUS];

export const TRIAL_PERIOD_DAYS = 14;
export const DEFAULT_MAX_BRANCHES = 1;
export const DEFAULT_MAX_EMPLOYEES = 5;
