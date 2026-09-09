import { useEffect, useRef } from 'react';
import { isMedianApp, getBiometricStatus, saveBiometricSecret } from '@/services/biometricService';
import { initOneSignal, linkUserToOneSignal, requestNotificationPermission, setUserTags } from '@/services/oneSignalService';
import { supabase } from '@/integrations/supabase/client';

const ONBOARDED_KEY = 'circle_first_login_done';

/**
 * Invisible component that runs once on first login:
 * 1. Auto-requests push notification permission via OneSignal
 * 2. Auto-enrolls biometric auth via Median bridge (if available on device)
 */
export default function FirstLoginSetup() {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (localStorage.getItem(ONBOARDED_KEY)) return;
    ran.current = true;

    const run = async () => {
      await new Promise(r => setTimeout(r, 2000));

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // 1. OneSignal: init, link user, request permission
        await initOneSignal();
        await linkUserToOneSignal(session.user.id, session.user.email || '');
        await requestNotificationPermission();
        setUserTags({
          platform: isMedianApp() ? 'native' : 'web',
        });

        // 2. Auto-enroll biometrics via Median bridge if available
        if (isMedianApp()) {
          const status = await getBiometricStatus();
          if (status.available && !status.hasSecret && session.refresh_token) {
            await saveBiometricSecret(session.refresh_token);
            localStorage.setItem(`bio_enabled_${session.user.id}`, 'true');
          }
        }
      }

      localStorage.setItem(ONBOARDED_KEY, '1');
    };

    run();
  }, []);

  return null;
}
