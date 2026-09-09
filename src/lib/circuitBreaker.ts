let failureCount = 0;
let circuitOpen = false;
let circuitOpenedAt = 0;

const FAILURE_THRESHOLD = 3;
const RESET_TIMEOUT = 10_000;

export function checkCircuit(): boolean {
  const now = Date.now();
  if (circuitOpen) {
    if (now - circuitOpenedAt > RESET_TIMEOUT) {
      circuitOpen = false;
      failureCount = 0;
    } else {
      return false;
    }
  }
  return true;
}

export function recordCircuitFailure() {
  failureCount++;
  if (failureCount >= FAILURE_THRESHOLD) {
    circuitOpen = true;
    circuitOpenedAt = Date.now();
    failureCount = 0;
  }
}

export function resetCircuit() {
  failureCount = 0;
  circuitOpen = false;
}
