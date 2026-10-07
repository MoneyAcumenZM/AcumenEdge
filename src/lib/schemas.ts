import { z } from 'zod';

// Sign-up validates inline in SignUp.tsx (validateStep1/validateStep2), so
// there are deliberately no sign-up schemas here.

export const orderSchema = z.object({
  stock_id: z.string().uuid('Invalid stock'),
  side: z.enum(['buy', 'sell']),
  order_type: z.enum(['market', 'limit']),
  qualifier: z.enum(['day', 'gtd', 'fok', 'ioc']),
  quantity: z.number()
    .int('Quantity must be a whole number')
    .positive('Quantity must be at least 1')
    .max(1000000, 'Quantity too large'),
  limit_price: z.number().positive('Price must be positive').optional().nullable(),
  expiry_date: z.string().optional().nullable(),
}).refine(d => d.order_type === 'market' || (d.limit_price !== null && d.limit_price !== undefined), {
  message: 'Limit price is required for limit orders',
  path: ['limit_price'],
}).refine(d => d.qualifier !== 'gtd' || (d.expiry_date !== null && d.expiry_date !== undefined), {
  message: 'Expiry date is required for GTD orders',
  path: ['expiry_date'],
});

export const signInSchema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});
