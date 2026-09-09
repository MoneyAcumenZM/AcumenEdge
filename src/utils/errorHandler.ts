export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const m = error.message.toLowerCase();
    if (m.includes('invalid login') || m.includes('invalid credentials'))
      return 'Incorrect email or password.';
    if (m.includes('email not confirmed'))
      return 'Please verify your email address first.';
    if (m.includes('too many requests'))
      return 'Too many attempts. Please wait and try again.';
    if (m.includes('network') || m.includes('fetch'))
      return 'Connection error. Please check your internet.';
    if (m.includes('jwt') || m.includes('session'))
      return 'Your session has expired. Please log in again.';
    if (m.includes('permission') || m.includes('not authorized'))
      return 'You do not have permission to do this.';
    if (m.includes('not found'))
      return 'The requested information was not found.';
    if (m.includes('duplicate') || m.includes('already exists'))
      return 'This record already exists.';
  }
  return 'Something went wrong. Please try again.';
}
