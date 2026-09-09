export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      advisory_letters: {
        Row: {
          advisor_staff_id: string | null
          body: string
          client_id: string
          created_at: string | null
          excerpt: string | null
          id: string
          is_read: boolean | null
          sent_at: string | null
          subject: string
        }
        Insert: {
          advisor_staff_id?: string | null
          body: string
          client_id: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_read?: boolean | null
          sent_at?: string | null
          subject: string
        }
        Update: {
          advisor_staff_id?: string | null
          body?: string
          client_id?: string
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_read?: boolean | null
          sent_at?: string | null
          subject?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      bonds: {
        Row: {
          ask_price: number | null
          bid_price: number | null
          coupon_rate: number | null
          created_at: string | null
          currency: string | null
          face_value: number | null
          id: string
          is_active: boolean | null
          isin: string
          issuer: string | null
          last_price: number | null
          maturity_date: string | null
          name: string
          price_updated_at: string | null
          sector: string | null
          symbol: string
          volume: number | null
        }
        Insert: {
          ask_price?: number | null
          bid_price?: number | null
          coupon_rate?: number | null
          created_at?: string | null
          currency?: string | null
          face_value?: number | null
          id?: string
          is_active?: boolean | null
          isin: string
          issuer?: string | null
          last_price?: number | null
          maturity_date?: string | null
          name: string
          price_updated_at?: string | null
          sector?: string | null
          symbol: string
          volume?: number | null
        }
        Update: {
          ask_price?: number | null
          bid_price?: number | null
          coupon_rate?: number | null
          created_at?: string | null
          currency?: string | null
          face_value?: number | null
          id?: string
          is_active?: boolean | null
          isin?: string
          issuer?: string | null
          last_price?: number | null
          maturity_date?: string | null
          name?: string
          price_updated_at?: string | null
          sector?: string | null
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      fallback_orders: {
        Row: {
          account_id: string | null
          cl_ord_id: string
          created_at: string | null
          execution_notes: string | null
          execution_price: string | null
          id: string
          new_cl_ord_id: string | null
          order_type: string | null
          price: string | null
          processed_at: string | null
          processed_by: string | null
          quantity: number
          reason: string | null
          retried_at: string | null
          side: string
          status: string | null
          symbol: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_id?: string | null
          cl_ord_id: string
          created_at?: string | null
          execution_notes?: string | null
          execution_price?: string | null
          id?: string
          new_cl_ord_id?: string | null
          order_type?: string | null
          price?: string | null
          processed_at?: string | null
          processed_by?: string | null
          quantity: number
          reason?: string | null
          retried_at?: string | null
          side: string
          status?: string | null
          symbol: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_id?: string | null
          cl_ord_id?: string
          created_at?: string | null
          execution_notes?: string | null
          execution_price?: string | null
          id?: string
          new_cl_ord_id?: string | null
          order_type?: string | null
          price?: string | null
          processed_at?: string | null
          processed_by?: string | null
          quantity?: number
          reason?: string | null
          retried_at?: string | null
          side?: string
          status?: string | null
          symbol?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      market_index: {
        Row: {
          change_amount: number | null
          change_percent: number | null
          id: string
          index_name: string
          recorded_at: string | null
          trades: number | null
          value: number | null
          value_traded: number | null
          volume: number | null
        }
        Insert: {
          change_amount?: number | null
          change_percent?: number | null
          id?: string
          index_name?: string
          recorded_at?: string | null
          trades?: number | null
          value?: number | null
          value_traded?: number | null
          volume?: number | null
        }
        Update: {
          change_amount?: number | null
          change_percent?: number | null
          id?: string
          index_name?: string
          recorded_at?: string | null
          trades?: number | null
          value?: number | null
          value_traded?: number | null
          volume?: number | null
        }
        Relationships: []
      }
      market_news: {
        Row: {
          body: string
          category: string
          created_at: string
          id: string
          is_active: boolean
          published_at: string
          source: string | null
          summary: string
          title: string
        }
        Insert: {
          body: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          source?: string | null
          summary: string
          title: string
        }
        Update: {
          body?: string
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          published_at?: string
          source?: string | null
          summary?: string
          title?: string
        }
        Relationships: []
      }
      market_status: {
        Row: {
          exchange: string
          id: string
          pre_market_open: boolean
          session_phase: string
          trading_allowed: boolean
          updated_at: string
        }
        Insert: {
          exchange?: string
          id?: string
          pre_market_open?: boolean
          session_phase?: string
          trading_allowed?: boolean
          updated_at?: string
        }
        Update: {
          exchange?: string
          id?: string
          pre_market_open?: boolean
          session_phase?: string
          trading_allowed?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          deposit_withdrawal: boolean
          id: string
          market_alerts: boolean
          price_alerts: boolean
          trade_executed: boolean
          updated_at: string
          user_id: string
          weekly_summary: boolean
        }
        Insert: {
          deposit_withdrawal?: boolean
          id?: string
          market_alerts?: boolean
          price_alerts?: boolean
          trade_executed?: boolean
          updated_at?: string
          user_id: string
          weekly_summary?: boolean
        }
        Update: {
          deposit_withdrawal?: boolean
          id?: string
          market_alerts?: boolean
          price_alerts?: boolean
          trade_executed?: boolean
          updated_at?: string
          user_id?: string
          weekly_summary?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          message: string | null
          title: string
          type: string
          url: string | null
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title: string
          type?: string
          url?: string | null
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string | null
          title?: string
          type?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          ats_reference: string | null
          broker_bpid: string | null
          broker_fee: number | null
          cancel_requested_at: string | null
          cl_ord_id: string | null
          client_order_id: string | null
          consideration: number | null
          created_at: string
          csd_reference: string | null
          expiry_date: string | null
          fill_value: number | null
          filled_at: string | null
          filled_price: number | null
          filled_quantity: number | null
          fix_sent: boolean | null
          id: string
          levy: number | null
          limit_price: number | null
          luse_fee: number | null
          member_bank_sca: string | null
          net_value: number | null
          order_capacity: string | null
          order_status: string | null
          order_type: string
          platform_code: string | null
          qualifier: string
          quantity: number
          queued: boolean | null
          rejection_reason: string | null
          settled_at: string | null
          settlement_cycle: string | null
          settlement_date: string | null
          settlement_type: string | null
          side: string
          sor_account: string | null
          status: string
          stock_id: string | null
          symbol: string | null
          total_fees: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ats_reference?: string | null
          broker_bpid?: string | null
          broker_fee?: number | null
          cancel_requested_at?: string | null
          cl_ord_id?: string | null
          client_order_id?: string | null
          consideration?: number | null
          created_at?: string
          csd_reference?: string | null
          expiry_date?: string | null
          fill_value?: number | null
          filled_at?: string | null
          filled_price?: number | null
          filled_quantity?: number | null
          fix_sent?: boolean | null
          id?: string
          levy?: number | null
          limit_price?: number | null
          luse_fee?: number | null
          member_bank_sca?: string | null
          net_value?: number | null
          order_capacity?: string | null
          order_status?: string | null
          order_type: string
          platform_code?: string | null
          qualifier?: string
          quantity: number
          queued?: boolean | null
          rejection_reason?: string | null
          settled_at?: string | null
          settlement_cycle?: string | null
          settlement_date?: string | null
          settlement_type?: string | null
          side: string
          sor_account?: string | null
          status?: string
          stock_id?: string | null
          symbol?: string | null
          total_fees?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ats_reference?: string | null
          broker_bpid?: string | null
          broker_fee?: number | null
          cancel_requested_at?: string | null
          cl_ord_id?: string | null
          client_order_id?: string | null
          consideration?: number | null
          created_at?: string
          csd_reference?: string | null
          expiry_date?: string | null
          fill_value?: number | null
          filled_at?: string | null
          filled_price?: number | null
          filled_quantity?: number | null
          fix_sent?: boolean | null
          id?: string
          levy?: number | null
          limit_price?: number | null
          luse_fee?: number | null
          member_bank_sca?: string | null
          net_value?: number | null
          order_capacity?: string | null
          order_status?: string | null
          order_type?: string
          platform_code?: string | null
          qualifier?: string
          quantity?: number
          queued?: boolean | null
          rejection_reason?: string | null
          settled_at?: string | null
          settlement_cycle?: string | null
          settlement_date?: string | null
          settlement_type?: string | null
          side?: string
          sor_account?: string | null
          status?: string
          stock_id?: string | null
          symbol?: string | null
          total_fees?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      portfolio_holdings: {
        Row: {
          average_cost: number | null
          created_at: string
          csd_status: string
          current_value: number | null
          gain_loss: number | null
          gain_loss_pct: number | null
          id: string
          last_calculated_at: string | null
          pending_qty: number
          quantity: number
          settled_qty: number
          stock_id: string
          total_cost: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          average_cost?: number | null
          created_at?: string
          csd_status?: string
          current_value?: number | null
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          last_calculated_at?: string | null
          pending_qty?: number
          quantity?: number
          settled_qty?: number
          stock_id: string
          total_cost?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          average_cost?: number | null
          created_at?: string
          csd_status?: string
          current_value?: number | null
          gain_loss?: number | null
          gain_loss_pct?: number | null
          id?: string
          last_calculated_at?: string | null
          pending_qty?: number
          quantity?: number
          settled_qty?: number
          stock_id?: string
          total_cost?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portfolio_holdings_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      portfolio_snapshots: {
        Row: {
          created_at: string
          id: string
          snapshot_date: string
          total_value: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          snapshot_date?: string
          total_value?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          snapshot_date?: string
          total_value?: number
          user_id?: string
        }
        Relationships: []
      }
      price_alerts: {
        Row: {
          created_at: string
          direction: string
          id: string
          stock_id: string
          target_price: number
          triggered: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          direction?: string
          id?: string
          stock_id: string
          target_price: number
          triggered?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          direction?: string
          id?: string
          stock_id?: string
          target_price?: number
          triggered?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_alerts_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          account_status: string
          bank_account_number: string | null
          bank_name: string | null
          broker_bpid: string | null
          broker_id: string | null
          client_type: string
          created_at: string
          csd_bpid: string | null
          csd_registered: boolean
          csd_registered_at: string | null
          csd_registration_code: string | null
          csd_registration_status: string | null
          date_of_birth: string | null
          dealer_id: string | null
          doc_id_path: string | null
          doc_proof_address_path: string | null
          doc_selfie_path: string | null
          email: string | null
          full_name: string | null
          id: string
          kyc_rejection_reason: string | null
          kyc_status: string
          member_bank_sca: string | null
          next_of_kin_name: string | null
          next_of_kin_phone: string | null
          next_of_kin_relation: string | null
          nrc_back_url: string | null
          nrc_front_url: string | null
          nrc_passport: string | null
          phone: string | null
          physical_address: string | null
          platform_code: string | null
          proof_of_address_url: string | null
          province: string | null
          restriction_reason: string | null
          restriction_until: string | null
          selfie_url: string | null
          sor_account: string | null
          tpin: string | null
          updated_at: string
          wallet_balance: number | null
        }
        Insert: {
          account_status?: string
          bank_account_number?: string | null
          bank_name?: string | null
          broker_bpid?: string | null
          broker_id?: string | null
          client_type?: string
          created_at?: string
          csd_bpid?: string | null
          csd_registered?: boolean
          csd_registered_at?: string | null
          csd_registration_code?: string | null
          csd_registration_status?: string | null
          date_of_birth?: string | null
          dealer_id?: string | null
          doc_id_path?: string | null
          doc_proof_address_path?: string | null
          doc_selfie_path?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          kyc_rejection_reason?: string | null
          kyc_status?: string
          member_bank_sca?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relation?: string | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_passport?: string | null
          phone?: string | null
          physical_address?: string | null
          platform_code?: string | null
          proof_of_address_url?: string | null
          province?: string | null
          restriction_reason?: string | null
          restriction_until?: string | null
          selfie_url?: string | null
          sor_account?: string | null
          tpin?: string | null
          updated_at?: string
          wallet_balance?: number | null
        }
        Update: {
          account_status?: string
          bank_account_number?: string | null
          bank_name?: string | null
          broker_bpid?: string | null
          broker_id?: string | null
          client_type?: string
          created_at?: string
          csd_bpid?: string | null
          csd_registered?: boolean
          csd_registered_at?: string | null
          csd_registration_code?: string | null
          csd_registration_status?: string | null
          date_of_birth?: string | null
          dealer_id?: string | null
          doc_id_path?: string | null
          doc_proof_address_path?: string | null
          doc_selfie_path?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          kyc_rejection_reason?: string | null
          kyc_status?: string
          member_bank_sca?: string | null
          next_of_kin_name?: string | null
          next_of_kin_phone?: string | null
          next_of_kin_relation?: string | null
          nrc_back_url?: string | null
          nrc_front_url?: string | null
          nrc_passport?: string | null
          phone?: string | null
          physical_address?: string | null
          platform_code?: string | null
          proof_of_address_url?: string | null
          province?: string | null
          restriction_reason?: string | null
          restriction_until?: string | null
          selfie_url?: string | null
          sor_account?: string | null
          tpin?: string | null
          updated_at?: string
          wallet_balance?: number | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          device_info: string | null
          endpoint: string
          id: string
          p256dh: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          device_info?: string | null
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_info?: string | null
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          consideration: number
          created_at: string
          csd_status_code: string | null
          csd_status_msg: string | null
          csd_tx_id: string | null
          id: string
          isin: string
          leg_type: string
          matched_deal_ref: string
          order_id: string
          price: number
          quantity: number
          settlement_date: string
          status: string
          trade_date: string
          updated_at: string
        }
        Insert: {
          consideration: number
          created_at?: string
          csd_status_code?: string | null
          csd_status_msg?: string | null
          csd_tx_id?: string | null
          id?: string
          isin: string
          leg_type: string
          matched_deal_ref: string
          order_id: string
          price: number
          quantity: number
          settlement_date: string
          status?: string
          trade_date: string
          updated_at?: string
        }
        Update: {
          consideration?: number
          created_at?: string
          csd_status_code?: string | null
          csd_status_msg?: string | null
          csd_tx_id?: string | null
          id?: string
          isin?: string
          leg_type?: string
          matched_deal_ref?: string
          order_id?: string
          price?: number
          quantity?: number
          settlement_date?: string
          status?: string
          trade_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_price_history: {
        Row: {
          ask_price: number | null
          bid_price: number | null
          change_amount: number | null
          change_percent: number | null
          high_price: number | null
          id: string
          last_price: number | null
          low_price: number | null
          open_price: number | null
          recorded_at: string
          symbol: string
          volume: number | null
        }
        Insert: {
          ask_price?: number | null
          bid_price?: number | null
          change_amount?: number | null
          change_percent?: number | null
          high_price?: number | null
          id?: string
          last_price?: number | null
          low_price?: number | null
          open_price?: number | null
          recorded_at?: string
          symbol: string
          volume?: number | null
        }
        Update: {
          ask_price?: number | null
          bid_price?: number | null
          change_amount?: number | null
          change_percent?: number | null
          high_price?: number | null
          id?: string
          last_price?: number | null
          low_price?: number | null
          open_price?: number | null
          recorded_at?: string
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      stocks: {
        Row: {
          ask_price: number | null
          bid_price: number | null
          change_amount: number | null
          change_percent: number | null
          created_at: string
          currency: string
          high_price: number | null
          id: string
          is_active: boolean
          isin: string
          last_price: number | null
          lot_size: number
          low_price: number | null
          min_trade_qty: number
          name: string
          open_price: number | null
          price_updated_at: string | null
          sector: string | null
          settlement_days: number
          symbol: string
          volume: number | null
        }
        Insert: {
          ask_price?: number | null
          bid_price?: number | null
          change_amount?: number | null
          change_percent?: number | null
          created_at?: string
          currency?: string
          high_price?: number | null
          id?: string
          is_active?: boolean
          isin: string
          last_price?: number | null
          lot_size?: number
          low_price?: number | null
          min_trade_qty?: number
          name: string
          open_price?: number | null
          price_updated_at?: string | null
          sector?: string | null
          settlement_days?: number
          symbol: string
          volume?: number | null
        }
        Update: {
          ask_price?: number | null
          bid_price?: number | null
          change_amount?: number | null
          change_percent?: number | null
          created_at?: string
          currency?: string
          high_price?: number | null
          id?: string
          is_active?: boolean
          isin?: string
          last_price?: number | null
          lot_size?: number
          low_price?: number | null
          min_trade_qty?: number
          name?: string
          open_price?: number | null
          price_updated_at?: string | null
          sector?: string | null
          settlement_days?: number
          symbol?: string
          volume?: number | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          balance_after: number | null
          created_at: string
          description: string
          dpo_result_code: string | null
          dpo_trans_token: string | null
          id: string
          network: string | null
          payment_method: string | null
          reference: string | null
          status: string | null
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          balance_after?: number | null
          created_at?: string
          description: string
          dpo_result_code?: string | null
          dpo_trans_token?: string | null
          id?: string
          network?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string | null
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          balance_after?: number | null
          created_at?: string
          description?: string
          dpo_result_code?: string | null
          dpo_trans_token?: string | null
          id?: string
          network?: string | null
          payment_method?: string | null
          reference?: string | null
          status?: string | null
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          created_at: string
          id: string
          stock_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stock_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stock_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "watchlist_stock_id_fkey"
            columns: ["stock_id"]
            isOneToOne: false
            referencedRelation: "stocks"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
