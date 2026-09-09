import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function Maintenance() {
  const [message, setMessage] = useState('Circle is temporarily unavailable. Please check back shortly.');

  useEffect(() => {
    supabase.from('platform_settings')
      .select('value').eq('key', 'maintenance_message').single()
      .then(({ data }) => { if (data?.value) setMessage(data.value); });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-8">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-6">🔧</div>
        <h1 className="text-foreground text-2xl font-bold mb-4">Scheduled Maintenance</h1>
        <p className="text-muted-foreground text-lg mb-6">{message}</p>
        <p className="text-muted-foreground text-sm">
          Contact <span className="text-primary">trading@moneyacumenadvisory.com</span> if urgent.
        </p>
      </div>
    </div>
  );
}
