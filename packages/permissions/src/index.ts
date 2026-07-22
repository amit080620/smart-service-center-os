// Centralized permission checks. In the previous build, the single most
// common bug (found repeatedly, across nearly every module) was a role
// check either missing entirely or copy-pasted slightly wrong in a new
// endpoint — e.g. an inventory-adjustment endpoint with no org check at
// all, a payroll-settle endpoint with no permission check at all. Writing
// each rule ONCE here and importing it everywhere means the rule can't
// drift between call sites.
import { ROLES, type Role } from '@smartbizos/constants';

const MANAGEMENT_ROLES: Role[] = [ROLES.ORG_OWNER, ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER];

export function canManageOrgSettings(role: Role): boolean {
  return role === ROLES.ORG_OWNER || role === ROLES.SUPER_ADMIN;
}

export function canManageBranches(role: Role): boolean {
  return role === ROLES.ORG_OWNER || role === ROLES.SUPER_ADMIN;
}

export function canManageEmployees(role: Role): boolean {
  return MANAGEMENT_ROLES.includes(role) || role === ROLES.HR;
}

export function canDeactivateEmployees(role: Role): boolean {
  return role === ROLES.ORG_OWNER || role === ROLES.SUPER_ADMIN || role === ROLES.HR;
}

export function canApproveJobCard(role: Role): boolean {
  return role === ROLES.BRANCH_MANAGER || role === ROLES.ORG_OWNER;
}

export function canRunPayroll(role: Role): boolean {
  return MANAGEMENT_ROLES.includes(role) || role === ROLES.HR;
}

export function canViewPayroll(role: Role): boolean {
  return canRunPayroll(role) || role === ROLES.ACCOUNTANT;
}

export function canViewAuditLog(role: Role): boolean {
  return role === ROLES.ORG_OWNER || role === ROLES.SUPER_ADMIN || role === ROLES.BRANCH_MANAGER;
}

export function canManagePartsCatalog(role: Role): boolean {
  return MANAGEMENT_ROLES.includes(role) || role === ROLES.PARTS_CLERK;
}
