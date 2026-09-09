let lastFetch = 0;
const COOLDOWN = 10 * 60 * 1000;

export function canFetchNotifications(): boolean {
  const now = Date.now();
  if (now - lastFetch < COOLDOWN) return false;
  lastFetch = now;
  return true;
}

export function resetNotificationCooldown() {
  lastFetch = 0;
}
