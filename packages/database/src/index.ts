// Root export — browser-safe only. Client Components can safely import
// from '@smartbizos/database' directly. Server-only utilities
// (createSupabaseServerClient, createSupabaseAdminClient) live at
// '@smartbizos/database/server' and '@smartbizos/database/admin' — kept
// OUT of this file specifically, since re-exporting them here would pull
// next/headers (a server-only API) into any Client Component's bundle
// that imports from this package, breaking the build.
export { createSupabaseBrowserClient } from './browser';
export type { Organization, Branch, Employee, Customer, Vehicle, SessionContext } from './types';
export type { Database } from './database.types';