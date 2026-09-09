export function sanitizeError(error: unknown): string {
  if (!error) return 'Something went wrong. Please try again.';

  const message = error instanceof Error
    ? error.message
    : typeof error === 'string' ? error : 'Unknown error';

  const errorMap: Record<string, string> = {
    'Invalid login credentials': 'Incorrect email or password.',
    'Email not confirmed': 'Please verify your email before signing in.',
    'duplicate key value': 'An account with this email already exists.',
    'JWT expired': 'Your session has expired. Please sign in again.',
    'JWT invalid': 'Your session is invalid. Please sign in again.',
    'violates row-level security': 'You do not have permission to do this.',
    'violates foreign key': 'Related data not found.',
    'violates check constraint': 'The value you entered is not valid.',
    'Network request failed': 'No internet connection. Please check your network.',
    'FetchError': 'No internet connection. Please check your network.',
    'timeout': 'Request timed out. Please try again.',
    'Failed to fetch': 'No internet connection. Please check your network.',
    'Order already processed': 'This order has already been submitted.',
    'CSD registration required': 'Your account is not yet registered with the CSD.',
    'Platform temporarily unavailable': 'Circle is temporarily offline. Please try again shortly.',
    'Order value exceeds maximum': 'Order value exceeds the K500,000 single order limit.',
    'Limit price is more than 20%': 'Your limit price is too far from the current market price.',
    'exceed_egress_quota': 'Service is temporarily unavailable. Please try again in a few minutes.',
    'service for this project is restricted': 'Service is temporarily unavailable. Please try again in a few minutes.',
    'rate limit': 'Too many requests. Please wait a moment and try again.',
  };

  for (const [key, friendly] of Object.entries(errorMap)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return friendly;
  }

  if (import.meta.env.DEV) return message;
  return 'Something went wrong. Please try again or contact trading@moneyacumenadvisory.com';
}
