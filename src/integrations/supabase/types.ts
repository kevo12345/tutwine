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
      blocked_users: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      daily_usage: {
        Row: {
          boosts_count: number | null
          date: string
          id: string
          likes_count: number | null
          profile_views: number | null
          user_id: string
        }
        Insert: {
          boosts_count?: number | null
          date?: string
          id?: string
          likes_count?: number | null
          profile_views?: number | null
          user_id: string
        }
        Update: {
          boosts_count?: number | null
          date?: string
          id?: string
          likes_count?: number | null
          profile_views?: number | null
          user_id?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      live_passes: {
        Row: {
          amount_paid_usd: number
          created_at: string
          currency: string
          duration_hours: number
          expires_at: string | null
          id: string
          provider: string
          provider_ref: string | null
          session_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["live_status"]
          updated_at: string
          viewer_id: string
        }
        Insert: {
          amount_paid_usd: number
          created_at?: string
          currency?: string
          duration_hours: number
          expires_at?: string | null
          id?: string
          provider: string
          provider_ref?: string | null
          session_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["live_status"]
          updated_at?: string
          viewer_id: string
        }
        Update: {
          amount_paid_usd?: number
          created_at?: string
          currency?: string
          duration_hours?: number
          expires_at?: string | null
          id?: string
          provider?: string
          provider_ref?: string | null
          session_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["live_status"]
          updated_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_passes_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          amount_paid_usd: number
          created_at: string
          currency: string
          daily_room_name: string | null
          daily_room_url: string | null
          duration_hours: number
          expires_at: string | null
          host_id: string
          id: string
          provider: string
          provider_ref: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["live_status"]
          updated_at: string
        }
        Insert: {
          amount_paid_usd: number
          created_at?: string
          currency?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          duration_hours: number
          expires_at?: string | null
          host_id: string
          id?: string
          provider: string
          provider_ref?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["live_status"]
          updated_at?: string
        }
        Update: {
          amount_paid_usd?: number
          created_at?: string
          currency?: string
          daily_room_name?: string | null
          daily_room_url?: string | null
          duration_hours?: number
          expires_at?: string | null
          host_id?: string
          id?: string
          provider?: string
          provider_ref?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["live_status"]
          updated_at?: string
        }
        Relationships: []
      }
      matches: {
        Row: {
          created_at: string
          id: string
          user_a: string
          user_b: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_a: string
          user_b: string
        }
        Update: {
          created_at?: string
          id?: string
          user_a?: string
          user_b?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          match_id: string
          read_at: string | null
          sender_id: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          match_id: string
          read_at?: string | null
          sender_id: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          match_id?: string
          read_at?: string | null
          sender_id?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      nowpayments_ipn_log: {
        Row: {
          activation_result: string
          error: string | null
          id: string
          matched_subscription_id: string | null
          order_id: string | null
          pay_amount: number | null
          pay_currency: string | null
          payment_id: string | null
          payment_status: string | null
          price_amount: number | null
          price_currency: string | null
          raw_payload: Json | null
          received_at: string
          signature_present: boolean
          signature_valid: boolean
        }
        Insert: {
          activation_result?: string
          error?: string | null
          id?: string
          matched_subscription_id?: string | null
          order_id?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          payment_status?: string | null
          price_amount?: number | null
          price_currency?: string | null
          raw_payload?: Json | null
          received_at?: string
          signature_present?: boolean
          signature_valid?: boolean
        }
        Update: {
          activation_result?: string
          error?: string | null
          id?: string
          matched_subscription_id?: string | null
          order_id?: string | null
          pay_amount?: number | null
          pay_currency?: string | null
          payment_id?: string | null
          payment_status?: string | null
          price_amount?: number | null
          price_currency?: string | null
          raw_payload?: Json | null
          received_at?: string
          signature_present?: boolean
          signature_valid?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "nowpayments_ipn_log_matched_subscription_id_fkey"
            columns: ["matched_subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          bio: string | null
          city: string | null
          country: string | null
          created_at: string
          date_of_birth: string | null
          display_name: string | null
          gender: Database["public"]["Enums"]["gender_type"] | null
          geohash: string | null
          hide_distance: boolean | null
          hide_state: boolean | null
          id: string
          interested_in: Database["public"]["Enums"]["gender_type"][] | null
          interests: string[] | null
          latitude: number | null
          longitude: number | null
          onboarding_complete: boolean | null
          onboarding_step: number | null
          phone: string | null
          photos: string[] | null
          preferred_age_max: number | null
          preferred_age_min: number | null
          preferred_distance_km: number | null
          state: string | null
          suspended: boolean
          updated_at: string
          user_id: string
          verified: boolean | null
        }
        Insert: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          geohash?: string | null
          hide_distance?: boolean | null
          hide_state?: boolean | null
          id?: string
          interested_in?: Database["public"]["Enums"]["gender_type"][] | null
          interests?: string[] | null
          latitude?: number | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          onboarding_step?: number | null
          phone?: string | null
          photos?: string[] | null
          preferred_age_max?: number | null
          preferred_age_min?: number | null
          preferred_distance_km?: number | null
          state?: string | null
          suspended?: boolean
          updated_at?: string
          user_id: string
          verified?: boolean | null
        }
        Update: {
          bio?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          date_of_birth?: string | null
          display_name?: string | null
          gender?: Database["public"]["Enums"]["gender_type"] | null
          geohash?: string | null
          hide_distance?: boolean | null
          hide_state?: boolean | null
          id?: string
          interested_in?: Database["public"]["Enums"]["gender_type"][] | null
          interests?: string[] | null
          latitude?: number | null
          longitude?: number | null
          onboarding_complete?: boolean | null
          onboarding_step?: number | null
          phone?: string | null
          photos?: string[] | null
          preferred_age_max?: number | null
          preferred_age_min?: number | null
          preferred_distance_km?: number | null
          state?: string | null
          suspended?: boolean
          updated_at?: string
          user_id?: string
          verified?: boolean | null
        }
        Relationships: []
      }
      region_pricing: {
        Row: {
          basic_price: number
          country: string
          currency: string
          id: string
          plus_price: number
          pro_price: number
          state: string | null
          updated_at: string
        }
        Insert: {
          basic_price?: number
          country: string
          currency?: string
          id?: string
          plus_price?: number
          pro_price?: number
          state?: string | null
          updated_at?: string
        }
        Update: {
          basic_price?: number
          country?: string
          currency?: string
          id?: string
          plus_price?: number
          pro_price?: number
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string
          status: Database["public"]["Enums"]["report_status"]
          target_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id: string
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          target_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          currency: string | null
          ends_at: string | null
          id: string
          payment_phone: string | null
          price: number | null
          provider: string | null
          provider_sub_id: string | null
          started_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string | null
          ends_at?: string | null
          id?: string
          payment_phone?: string | null
          price?: number | null
          provider?: string | null
          provider_sub_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string | null
          ends_at?: string | null
          id?: string
          payment_phone?: string | null
          price?: number | null
          provider?: string | null
          provider_sub_id?: string | null
          started_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_conversations: {
        Row: {
          created_at: string
          id: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_admin: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_admin?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      swipes: {
        Row: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at: string
          id: string
          swiper_id: string
          target_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          swiper_id: string
          target_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["swipe_action"]
          created_at?: string
          id?: string
          swiper_id?: string
          target_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          is_online: boolean
          last_seen_at: string
          user_id: string
        }
        Insert: {
          is_online?: boolean
          last_seen_at?: string
          user_id: string
        }
        Update: {
          is_online?: boolean
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      discover_profiles: {
        Args: {
          _gender: Database["public"]["Enums"]["gender_type"]
          _limit: number
          _max_age: number
          _max_distance_km: number
          _min_age: number
          _my_lat: number
          _my_lng: number
          _offset: number
        }
        Returns: {
          active_tier: Database["public"]["Enums"]["subscription_tier"]
          age: number
          bio: string
          city: string
          country: string
          created_at: string
          display_name: string
          distance_km: number
          gender: Database["public"]["Enums"]["gender_type"]
          hide_distance: boolean
          hide_state: boolean
          interests: string[]
          like_count: number
          photos: string[]
          state: string
          user_id: string
          verified: boolean
        }[]
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_active_live_sessions: {
        Args: never
        Returns: {
          daily_room_url: string
          display_name: string
          duration_hours: number
          expires_at: string
          host_id: string
          id: string
          photos: string[]
          started_at: string
          viewer_count: number
        }[]
      }
      get_profile_public: {
        Args: { _target: string }
        Returns: {
          active_tier: Database["public"]["Enums"]["subscription_tier"]
          age: number
          bio: string
          city: string
          country: string
          created_at: string
          display_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          hide_distance: boolean
          hide_state: boolean
          interested_in: Database["public"]["Enums"]["gender_type"][]
          interests: string[]
          like_count: number
          onboarding_complete: boolean
          photos: string[]
          state: string
          suspended: boolean
          updated_at: string
          user_id: string
          verified: boolean
        }[]
      }
      get_profiles_public: {
        Args: { _targets: string[] }
        Returns: {
          active_tier: Database["public"]["Enums"]["subscription_tier"]
          age: number
          bio: string
          city: string
          country: string
          created_at: string
          display_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          hide_distance: boolean
          hide_state: boolean
          interested_in: Database["public"]["Enums"]["gender_type"][]
          interests: string[]
          like_count: number
          onboarding_complete: boolean
          photos: string[]
          state: string
          suspended: boolean
          updated_at: string
          user_id: string
          verified: boolean
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      who_liked_me: {
        Args: never
        Returns: {
          age: number
          bio: string
          city: string
          country: string
          display_name: string
          gender: Database["public"]["Enums"]["gender_type"]
          interests: string[]
          liked_at: string
          photos: string[]
          state: string
          user_id: string
          verified: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      gender_type: "man" | "woman" | "non-binary" | "other"
      live_status:
        | "pending_payment"
        | "active"
        | "ended"
        | "expired"
        | "canceled"
      message_type: "text" | "emoji" | "image"
      report_status: "pending" | "reviewed" | "resolved" | "dismissed"
      subscription_status: "active" | "canceled" | "expired" | "past_due"
      subscription_tier: "free" | "basic" | "plus" | "pro" | "simp"
      swipe_action: "like" | "pass"
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
    Enums: {
      app_role: ["admin", "moderator", "user"],
      gender_type: ["man", "woman", "non-binary", "other"],
      live_status: [
        "pending_payment",
        "active",
        "ended",
        "expired",
        "canceled",
      ],
      message_type: ["text", "emoji", "image"],
      report_status: ["pending", "reviewed", "resolved", "dismissed"],
      subscription_status: ["active", "canceled", "expired", "past_due"],
      subscription_tier: ["free", "basic", "plus", "pro", "simp"],
      swipe_action: ["like", "pass"],
    },
  },
} as const
