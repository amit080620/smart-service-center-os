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
