import { Capacitor } from '@capacitor/core';

const isNative = () => Capacitor.isNativePlatform();

export const HapticFeedback = {
  light: async () => {
    if (!isNative()) return;
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    Haptics.impact({ style: ImpactStyle.Light });
  },
  medium: async () => {
    if (!isNative()) return;
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    Haptics.impact({ style: ImpactStyle.Medium });
  },
  heavy: async () => {
    if (!isNative()) return;
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    Haptics.impact({ style: ImpactStyle.Heavy });
  },
  success: async () => {
    if (!isNative()) return;
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    Haptics.notification({ type: NotificationType.Success });
  },
  error: async () => {
    if (!isNative()) return;
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    Haptics.notification({ type: NotificationType.Error });
  },
  warning: async () => {
    if (!isNative()) return;
    const { Haptics, NotificationType } = await import('@capacitor/haptics');
    Haptics.notification({ type: NotificationType.Warning });
  },
};
