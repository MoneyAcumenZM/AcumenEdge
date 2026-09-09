import { supabase } from '@/integrations/supabase/client';

interface NotifyParams {
  userId: string;
  title: string;
  body: string;
  type: string;
  url?: string;
  data?: Record<string, any>;
}

export async function sendNotification(params: NotifyParams): Promise<void> {
  await Promise.all([
    supabase.from('notifications').insert({
      user_id: params.userId,
      title: params.title,
      body: params.body,
      type: params.type,
    }),
    supabase.functions.invoke('send-onesignal-notification', {
      body: {
        userId: params.userId,
        title: params.title,
        body: params.body,
        url: params.url || '/',
        data: params.data,
      },
    }),
  ]);
}

export async function sendBulkNotification(
  params: Omit<NotifyParams, 'userId'> & { userIds: string[] }
): Promise<void> {
  const { userIds, ...rest } = params;
  await Promise.all([
    supabase.from('notifications').insert(
      userIds.map(userId => ({
        user_id: userId,
        title: rest.title,
        body: rest.body,
        type: rest.type,
      }))
    ),
    supabase.functions.invoke('send-onesignal-notification', {
      body: {
        userIds,
        title: rest.title,
        body: rest.body,
        url: rest.url || '/',
      },
    }),
  ]);
}
