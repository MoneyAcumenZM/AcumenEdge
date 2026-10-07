export async function initNetworkMonitoring(
  onOffline: () => void,
  onOnline: () => void
) {
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
}
