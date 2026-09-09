/**
 * OneSignal Live Activities for trade status updates on iPhone lock screen and Dynamic Island.
 *
 * Live Activities require the OneSignal iOS SDK to be integrated in the native Median app build.
 * The Median app handles the ActivityKit integration natively. The JavaScript layer only sends
 * the update payloads via the OneSignal REST API.
 *
 * Live Activities only display on iOS 16.1 and above. Android users receive standard push
 * notifications instead. Live Activities are not available in the browser version of the app.
 *
 * The activity_id must match the activity started on the device — always use generateActivityId
 * with the same clOrdId. A maximum of 5 Live Activities can run simultaneously per app per
 * Apple policy. Use priority 10 only for critical updates like trade execution — use priority 5
 * for status updates to avoid Apple throttling.
 */

import { supabase } from '@/integrations/supabase/client';

export interface TradeActivityData {
  clOrdId: string;
  symbol: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: string;
  status: 'placed' | 'processing' | 'executed' | 'cancelled' | 'rejected';
  statusLabel: string;
  executedPrice?: string;
  timestamp: string;
}

/** Generate a unique activity ID for each trade */
export function generateActivityId(clOrdId: string): string {
  return `trade_${clOrdId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/** Start a Live Activity when an order is placed */
export async function startTradeActivity(
  userId: string,
  activityId: string,
  tradeData: TradeActivityData
): Promise<void> {
  try {
    await supabase.functions.invoke('send-onesignal-notification', {
      body: {
        userId,
        liveActivity: {
          event: 'start',
          activityId,
          contentState: tradeData,
          attributesType: 'TradeStatusAttributes',
          attributes: {
            clOrdId: tradeData.clOrdId,
            symbol: tradeData.symbol,
            side: tradeData.side,
          },
          name: `${tradeData.side === 'buy' ? 'Buying' : 'Selling'} ${tradeData.symbol}`,
          dismissalDate: Math.floor(Date.now() / 1000) + (8 * 60 * 60), // 8 hours max
        },
      },
    });
  } catch (error) {
    console.error('Failed to start Live Activity:', error);
  }
}

/** Update Live Activity when order status changes */
export async function updateTradeActivity(
  userId: string,
  activityId: string,
  tradeData: TradeActivityData,
  isHighPriority: boolean = false
): Promise<void> {
  try {
    const isFinal = tradeData.status === 'executed' || tradeData.status === 'cancelled' || tradeData.status === 'rejected';
    await supabase.functions.invoke('send-onesignal-notification', {
      body: {
        userId,
        liveActivity: {
          event: isFinal ? 'end' : 'update',
          activityId,
          contentState: tradeData,
          priority: isHighPriority ? 10 : 5,
          dismissalDate: tradeData.status === 'executed'
            ? Math.floor(Date.now() / 1000) + (30 * 60)
            : undefined,
        },
      },
    });
  } catch (error) {
    console.error('Failed to update Live Activity:', error);
  }
}

/** End Live Activity */
export async function endTradeActivity(
  userId: string,
  activityId: string,
  finalData: TradeActivityData
): Promise<void> {
  try {
    await supabase.functions.invoke('send-onesignal-notification', {
      body: {
        userId,
        liveActivity: {
          event: 'end',
          activityId,
          contentState: finalData,
          dismissalDate: Math.floor(Date.now() / 1000) + (5 * 60),
        },
      },
    });
  } catch (error) {
    console.error('Failed to end Live Activity:', error);
  }
}
