// Tactile feedback through the standard Vibration API. It works in Android
// browsers and webviews (including the Median wrapper); iOS doesn't expose
// it, so every call there is simply a no-op.
const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(pattern);
  }
};

export const HapticFeedback = {
  light: async () => vibrate(10),
  medium: async () => vibrate(20),
  heavy: async () => vibrate(35),
  success: async () => vibrate([15, 40, 15]),
  error: async () => vibrate([30, 40, 30, 40, 30]),
  warning: async () => vibrate([25, 50, 25]),
};
