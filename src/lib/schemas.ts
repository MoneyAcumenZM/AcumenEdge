import { z } from 'zod';

const nrcPattern = /^\d{6}\/\d{2}\/\d{1}$/;
const phonePattern = /^\+260\d{9}$/;
const zambiaTpinPattern = /^\d{1,10}$/;

export const signUpStep1Schema = z.object({
  full_name: z.string().min(2, 'Full name is required').max(100),
  email: z.string().email('Enter a valid email address'),
  phone: z.string().regex(phonePattern, 'Phone must be in +260XXXXXXXXX format'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/\d/, 'Password must contain at least one number'),
  confirm_password: z.string(),
}).refine(d => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

export const signUpStep2Schema = z.object({
  date_of_birth: z.string().refine(d => {
    const dob = new Date(d);
    const age = (Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return age >= 18;
  }, 'You must be 18 or older to open a trading account'),
  nrc_passport: z.string().refine(v =>
    nrcPattern.test(v) || v.length >= 6,
    'Enter a valid NRC (000000/00/0) or passport number'
  ),
  tpin: z.string().regex(zambiaTpinPattern, 'TPIN must be up to 10 digits'),
  physical_address: z.string().min(10, 'Enter your full address'),
  province: z.string().min(2, 'Select a province'),
  next_of_kin_name: z.string().min(2, 'Next of kin name is required'),
  next_of_kin_phone: z.string().regex(phonePattern, 'Phone must be in +260XXXXXXXXX format'),
  next_of_kin_relation: z.enum(['Spouse', 'Parent', 'Child', 'Sibling', 'Other']),
  bank_name: z.string().min(2, 'Select a bank'),
  bank_account_number: z.string().min(5, 'Enter a valid account number'),
});

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
