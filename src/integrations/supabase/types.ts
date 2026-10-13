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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      commands: {
        Row: {
          created_at: string
          done_at: string | null
          id: string
          payload: Json
          result: Json | null
          status: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          status?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commands_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_status: {
        Row: {
          active_event_id: string | null
          current_slot: number | null
          firmware: string | null
          ip: string | null
          last_seen: string | null
          oled_screen: Json
          parts_ok: Json
          rssi: number | null
          state: string
          updated_at: string
          uptime_s: number | null
          user_id: string
        }
        Insert: {
          active_event_id?: string | null
          current_slot?: number | null
          firmware?: string | null
          ip?: string | null
          last_seen?: string | null
          oled_screen?: Json
          parts_ok?: Json
          rssi?: number | null
          state?: string
          updated_at?: string
          uptime_s?: number | null
          user_id: string
        }
        Update: {
          active_event_id?: string | null
          current_slot?: number | null
          firmware?: string | null
          ip?: string | null
          last_seen?: string | null
          oled_screen?: Json
          parts_ok?: Json
          rssi?: number | null
          state?: string
          updated_at?: string
          uptime_s?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dose_events: {
        Row: {
          created_at: string
          dose: string
          id: string
          is_demo: boolean
          medicine_name: string
          schedule_id: string | null
          scheduled_for: string
          slot_number: number
          snooze_until: string | null
          status: string
          taken_at: string | null
          taken_via: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          dose?: string
          id?: string
          is_demo?: boolean
          medicine_name: string
          schedule_id?: string | null
          scheduled_for: string
          slot_number: number
          snooze_until?: string | null
          status?: string
          taken_at?: string | null
          taken_via?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          dose?: string
          id?: string
          is_demo?: boolean
          medicine_name?: string
          schedule_id?: string | null
          scheduled_for?: string
          slot_number?: number
          snooze_until?: string | null
          status?: string
          taken_at?: string | null
          taken_via?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dose_events_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dose_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hardware_config: {
        Row: {
          device_name: string
          has_button: boolean
          has_buzzer: boolean
          has_hall: boolean
          has_ir: boolean
          has_led: boolean
          has_oled: boolean
          has_servo: boolean
          has_stepper: boolean
          low_stock_threshold: number
          missed_after_minutes: number
          num_slots: number
          simulator_enabled: boolean
          snooze_minutes: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          device_name?: string
          has_button?: boolean
          has_buzzer?: boolean
          has_hall?: boolean
          has_ir?: boolean
          has_led?: boolean
          has_oled?: boolean
          has_servo?: boolean
          has_stepper?: boolean
          low_stock_threshold?: number
          missed_after_minutes?: number
          num_slots?: number
          simulator_enabled?: boolean
          snooze_minutes?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          device_name?: string
          has_button?: boolean
          has_buzzer?: boolean
          has_hall?: boolean
          has_ir?: boolean
          has_led?: boolean
          has_oled?: boolean
          has_servo?: boolean
          has_stepper?: boolean
          low_stock_threshold?: number
          missed_after_minutes?: number
          num_slots?: number
          simulator_enabled?: boolean
          snooze_minutes?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hardware_config_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      medicines: {
        Row: {
          color: string
          created_at: string
          dose: string
          id: string
          is_demo: boolean
          name: string
          notes: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          dose?: string
          id?: string
          is_demo?: boolean
          name: string
          notes?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          dose?: string
          id?: string
          is_demo?: boolean
          name?: string
          notes?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "medicines_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          days: number[]
          enabled: boolean
          id: string
          is_demo: boolean
          medicine_id: string | null
          pills_per_dose: number
          slot_number: number
          time_of_day: string
          user_id: string
        }
        Insert: {
          created_at?: string
          days?: number[]
          enabled?: boolean
          id?: string
          is_demo?: boolean
          medicine_id?: string | null
          pills_per_dose?: number
          slot_number: number
          time_of_day: string
          user_id: string
        }
        Update: {
          created_at?: string
          days?: number[]
          enabled?: boolean
          id?: string
          is_demo?: boolean
          medicine_id?: string | null
          pills_per_dose?: number
          slot_number?: number
          time_of_day?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "schedules_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_user_id_medicine_id_fkey"
            columns: ["user_id", "medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "schedules_user_id_slot_number_fkey"
            columns: ["user_id", "slot_number"]
            isOneToOne: false
            referencedRelation: "slots"
            referencedColumns: ["user_id", "slot_number"]
          },
        ]
      }
      slots: {
        Row: {
          medicine_id: string | null
          pills_remaining: number
          slot_number: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          medicine_id?: string | null
          pills_remaining?: number
          slot_number: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          medicine_id?: string | null
          pills_remaining?: number
          slot_number?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slots_user_id_medicine_id_fkey"
            columns: ["user_id", "medicine_id"]
            isOneToOne: false
            referencedRelation: "medicines"
            referencedColumns: ["user_id", "id"]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
