import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').max(254).email('Invalid email').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const signupSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100).regex(/^[a-zA-Z\s\-'\.]+$/, 'Invalid characters in name'),
  email: z.string().email('Invalid email').max(254).toLowerCase(),
  password: z.string()
    .min(8, 'Minimum 8 characters')
    .max(128)
    .regex(/[A-Z]/, 'Need at least 1 uppercase letter')
    .regex(/[a-z]/, 'Need at least 1 lowercase letter')
    .regex(/[0-9]/, 'Need at least 1 number')
    .regex(/[^A-Za-z0-9]/, 'Need at least 1 special character'),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const tradeSchema = z.object({
  ticker: z.string().min(1).max(10).regex(/^[A-Z]+$/),
  type: z.enum(['buy', 'sell']),
  quantity: z.number().int().min(1).max(1000000),
  price: z.number().positive().max(1000000),
});

export const depositSchema = z.object({
  amount: z.number().positive('Amount must be positive').min(1).max(10000000),
});

export const withdrawSchema = z.object({
  amount: z.number().positive('Amount must be positive').min(1).max(10000000),
  accountNumber: z.string().min(5).max(30).regex(/^[a-zA-Z0-9]+$/, 'Invalid account number'),
});

export const profileSchema = z.object({
  fullName: z.string().min(2).max(100).regex(/^[a-zA-Z\s\-'\.]+$/),
  phone: z.string().regex(/^[\d\+\s\-\(\)]+$/).min(7).max(20).optional(),
});

export function validate<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const r = schema.safeParse(data);
  if (r.success) return { success: true, data: r.data };
  const errors: Record<string, string> = {};
  r.error.errors.forEach((e) => {
    errors[e.path[0] as string] = e.message;
  });
  return { success: false, errors };
}
