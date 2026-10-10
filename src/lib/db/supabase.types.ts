export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      account: {
        Row: {
          access_token: string | null
          access_token_expires_at: string | null
          account_id: string
          created_at: string
          id: string
          id_token: string | null
          password: string | null
          provider_id: string
          refresh_token: string | null
          refresh_token_expires_at: string | null
          scope: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_id: string
          created_at?: string
          id?: string
          id_token?: string | null
          password?: string | null
          provider_id: string
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          access_token_expires_at?: string | null
          account_id?: string
          created_at?: string
          id?: string
          id_token?: string | null
          password?: string | null
          provider_id?: string
          refresh_token?: string | null
          refresh_token_expires_at?: string | null
          scope?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_benchmarks: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          name: string
          result_display: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          name: string
          result_display: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          name?: string
          result_display?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_benchmarks_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_lifts: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          lift: Database["public"]["Enums"]["lift_name"]
          time_seconds: number | null
          updated_at: string
          weight_lbs: number | null
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          lift: Database["public"]["Enums"]["lift_name"]
          time_seconds?: number | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          lift?: Database["public"]["Enums"]["lift_name"]
          time_seconds?: number | null
          updated_at?: string
          weight_lbs?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_lifts_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_likes: {
        Row: {
          athlete_id: string
          created_at: string
          id: string
          liker_user_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["like_target_type"]
        }
        Insert: {
          athlete_id: string
          created_at?: string
          id?: string
          liker_user_id: string
          target_id: string
          target_type: Database["public"]["Enums"]["like_target_type"]
        }
        Update: {
          athlete_id?: string
          created_at?: string
          id?: string
          liker_user_id?: string
          target_id?: string
          target_type?: Database["public"]["Enums"]["like_target_type"]
        }
        Relationships: [
          {
            foreignKeyName: "athlete_likes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_likes_liker_user_id_fkey"
            columns: ["liker_user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          affiliate: string | null
          auth_user_id: string | null
          created_at: string
          date_of_birth: string | null
          email: string
          first_name: string
          gender: Database["public"]["Enums"]["athlete_gender"] | null
          id: string
          last_name: string
          organization_id: string
          phone: string | null
          photo_url: string | null
        }
        Insert: {
          affiliate?: string | null
          auth_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email: string
          first_name: string
          gender?: Database["public"]["Enums"]["athlete_gender"] | null
          id?: string
          last_name: string
          organization_id: string
          phone?: string | null
          photo_url?: string | null
        }
        Update: {
          affiliate?: string | null
          auth_user_id?: string | null
          created_at?: string
          date_of_birth?: string | null
          email?: string
          first_name?: string
          gender?: Database["public"]["Enums"]["athlete_gender"] | null
          id?: string
          last_name?: string
          organization_id?: string
          phone?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_auth_user_id_fkey"
            columns: ["auth_user_id"]
            isOneToOne: true
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athletes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      broadcast_state: {
        Row: {
          active_graphic: Database["public"]["Enums"]["active_graphic"]
          active_sponsor_id: string | null
          current_heat_id: string | null
          floor_id: string
          id: string
          lower_third_athlete_id: string | null
          timer_anchor_time: string | null
          timer_direction: Database["public"]["Enums"]["timer_direction"]
          timer_duration_seconds: number
          timer_elapsed_at_anchor: number
          timer_status: Database["public"]["Enums"]["timer_status"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active_graphic?: Database["public"]["Enums"]["active_graphic"]
          active_sponsor_id?: string | null
          current_heat_id?: string | null
          floor_id: string
          id?: string
          lower_third_athlete_id?: string | null
          timer_anchor_time?: string | null
          timer_direction?: Database["public"]["Enums"]["timer_direction"]
          timer_duration_seconds?: number
          timer_elapsed_at_anchor?: number
          timer_status?: Database["public"]["Enums"]["timer_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active_graphic?: Database["public"]["Enums"]["active_graphic"]
          active_sponsor_id?: string | null
          current_heat_id?: string | null
          floor_id?: string
          id?: string
          lower_third_athlete_id?: string | null
          timer_anchor_time?: string | null
          timer_direction?: Database["public"]["Enums"]["timer_direction"]
          timer_duration_seconds?: number
          timer_elapsed_at_anchor?: number
          timer_status?: Database["public"]["Enums"]["timer_status"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "broadcast_state_active_sponsor_id_fkey"
            columns: ["active_sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_state_current_heat_id_fkey"
            columns: ["current_heat_id"]
            isOneToOne: false
            referencedRelation: "heats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_state_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: true
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_state_lower_third_athlete_id_fkey"
            columns: ["lower_third_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "broadcast_state_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      camera_zones: {
        Row: {
          created_at: string
          floor_id: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          created_at?: string
          floor_id: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          created_at?: string
          floor_id?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "camera_zones_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
        ]
      }
      circuits: {
        Row: {
          created_at: string
          description: string | null
          ends_on: string | null
          id: string
          name: string
          organization_id: string
          starts_on: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          name: string
          organization_id: string
          starts_on?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          ends_on?: string | null
          id?: string
          name?: string
          organization_id?: string
          starts_on?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "circuits_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      display_blocks: {
        Row: {
          block_type: Database["public"]["Enums"]["display_block_type"]
          display_id: string
          duration_seconds: number
          enabled: boolean
          weight: number
        }
        Insert: {
          block_type: Database["public"]["Enums"]["display_block_type"]
          display_id: string
          duration_seconds: number
          enabled?: boolean
          weight?: number
        }
        Update: {
          block_type?: Database["public"]["Enums"]["display_block_type"]
          display_id?: string
          duration_seconds?: number
          enabled?: boolean
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "display_blocks_display_id_fkey"
            columns: ["display_id"]
            isOneToOne: false
            referencedRelation: "display_devices"
            referencedColumns: ["id"]
          },
        ]
      }
      display_devices: {
        Row: {
          created_at: string
          enabled: boolean
          event_id: string
          floor_id: string
          id: string
          info_blocks_between_sponsors: number
          name: string
          sponsors_enabled: boolean
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          event_id: string
          floor_id: string
          id?: string
          info_blocks_between_sponsors?: number
          name: string
          sponsors_enabled?: boolean
        }
        Update: {
          created_at?: string
          enabled?: boolean
          event_id?: string
          floor_id?: string
          id?: string
          info_blocks_between_sponsors?: number
          name?: string
          sponsors_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "display_devices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "display_devices_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
        ]
      }
      divisions: {
        Row: {
          created_at: string
          event_id: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "divisions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_commentator_assignments: {
        Row: {
          assigned_at: string
          assigned_by_admin_id: string | null
          commentator_user_id: string
          created_at: string
          event_id: string
          id: string
          removed_at: string | null
          role_label: string | null
          status: Database["public"]["Enums"]["event_assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_admin_id?: string | null
          commentator_user_id: string
          created_at?: string
          event_id: string
          id?: string
          removed_at?: string | null
          role_label?: string | null
          status?: Database["public"]["Enums"]["event_assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_admin_id?: string | null
          commentator_user_id?: string
          created_at?: string
          event_id?: string
          id?: string
          removed_at?: string | null
          role_label?: string | null
          status?: Database["public"]["Enums"]["event_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_commentator_assignments_assigned_by_admin_id_fkey"
            columns: ["assigned_by_admin_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_commentator_assignments_commentator_user_id_fkey"
            columns: ["commentator_user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_commentator_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_producer_assignments: {
        Row: {
          assigned_at: string
          assigned_by_admin_id: string | null
          created_at: string
          event_id: string
          id: string
          producer_user_id: string
          removed_at: string | null
          status: Database["public"]["Enums"]["event_assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_admin_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          producer_user_id: string
          removed_at?: string | null
          status?: Database["public"]["Enums"]["event_assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_admin_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          producer_user_id?: string
          removed_at?: string | null
          status?: Database["public"]["Enums"]["event_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_producer_assignments_assigned_by_admin_id_fkey"
            columns: ["assigned_by_admin_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_producer_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_producer_assignments_producer_user_id_fkey"
            columns: ["producer_user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      event_scorekeeper_assignments: {
        Row: {
          assigned_at: string
          assigned_by_admin_id: string | null
          created_at: string
          event_id: string
          id: string
          removed_at: string | null
          scorekeeper_user_id: string
          status: Database["public"]["Enums"]["event_assignment_status"]
          updated_at: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_admin_id?: string | null
          created_at?: string
          event_id: string
          id?: string
          removed_at?: string | null
          scorekeeper_user_id: string
          status?: Database["public"]["Enums"]["event_assignment_status"]
          updated_at?: string
        }
        Update: {
          assigned_at?: string
          assigned_by_admin_id?: string | null
          created_at?: string
          event_id?: string
          id?: string
          removed_at?: string | null
          scorekeeper_user_id?: string
          status?: Database["public"]["Enums"]["event_assignment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_scorekeeper_assignments_assigned_by_admin_id_fkey"
            columns: ["assigned_by_admin_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_scorekeeper_assignments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_scorekeeper_assignments_scorekeeper_user_id_fkey"
            columns: ["scorekeeper_user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      event_sponsorships: {
        Row: {
          active: boolean
          category_exclusive: boolean
          created_at: string
          display_duration_override: number | null
          display_weight_override: number | null
          event_id: string
          id: string
          package_id: string
          sponsor_id: string
        }
        Insert: {
          active?: boolean
          category_exclusive?: boolean
          created_at?: string
          display_duration_override?: number | null
          display_weight_override?: number | null
          event_id: string
          id?: string
          package_id: string
          sponsor_id: string
        }
        Update: {
          active?: boolean
          category_exclusive?: boolean
          created_at?: string
          display_duration_override?: number | null
          display_weight_override?: number | null
          event_id?: string
          id?: string
          package_id?: string
          sponsor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_sponsorships_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sponsorships_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "sponsor_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_sponsorships_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          circuit_id: string | null
          cover_image_url: string | null
          created_at: string
          ends_on: string | null
          id: string
          name: string
          organization_id: string
          starts_on: string | null
          status: Database["public"]["Enums"]["event_status"]
          updated_at: string
        }
        Insert: {
          circuit_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name: string
          organization_id: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Update: {
          circuit_id?: string | null
          cover_image_url?: string | null
          created_at?: string
          ends_on?: string | null
          id?: string
          name?: string
          organization_id?: string
          starts_on?: string | null
          status?: Database["public"]["Enums"]["event_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_circuit_id_fkey"
            columns: ["circuit_id"]
            isOneToOne: false
            referencedRelation: "circuits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount_cents: number
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: string
          description: string
          event_id: string
          id: string
          incurred_on: string | null
          notes: string | null
          organization_id: string
          recorded_by: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          description: string
          event_id: string
          id?: string
          incurred_on?: string | null
          notes?: string | null
          organization_id: string
          recorded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          description?: string
          event_id?: string
          id?: string
          incurred_on?: string | null
          notes?: string | null
          organization_id?: string
          recorded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_schedules: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          currency: string
          description: string | null
          division_id: string | null
          entry_type:
            | Database["public"]["Enums"]["competitor_entry_type"]
            | null
          event_id: string
          id: string
          is_addon: boolean
          name: string
          organization_id: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          currency?: string
          description?: string | null
          division_id?: string | null
          entry_type?:
            | Database["public"]["Enums"]["competitor_entry_type"]
            | null
          event_id: string
          id?: string
          is_addon?: boolean
          name: string
          organization_id: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string | null
          division_id?: string | null
          entry_type?:
            | Database["public"]["Enums"]["competitor_entry_type"]
            | null
          event_id?: string
          id?: string
          is_addon?: boolean
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_schedules_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fee_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      floors: {
        Row: {
          created_at: string
          id: string
          name: string
          sort_order: number
          venue_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          venue_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          venue_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "floors_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      heats: {
        Row: {
          created_at: string
          division_id: string
          ended_at: string | null
          event_id: string
          floor_id: string
          heat_count: number | null
          heat_number: number
          id: string
          scheduled_start: string | null
          started_at: string | null
          wod_id: string
        }
        Insert: {
          created_at?: string
          division_id: string
          ended_at?: string | null
          event_id: string
          floor_id: string
          heat_count?: number | null
          heat_number: number
          id?: string
          scheduled_start?: string | null
          started_at?: string | null
          wod_id: string
        }
        Update: {
          created_at?: string
          division_id?: string
          ended_at?: string | null
          event_id?: string
          floor_id?: string
          heat_count?: number | null
          heat_number?: number
          id?: string
          scheduled_start?: string | null
          started_at?: string | null
          wod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "heats_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heats_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heats_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "heats_wod_id_fkey"
            columns: ["wod_id"]
            isOneToOne: false
            referencedRelation: "wods"
            referencedColumns: ["id"]
          },
        ]
      }
      invitation: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          inviter_id: string
          organization_id: string
          role: string | null
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          inviter_id: string
          organization_id: string
          role?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          organization_id?: string
          role?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitation_inviter_id_fkey"
            columns: ["inviter_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lanes: {
        Row: {
          athlete_id: string | null
          created_at: string
          heat_id: string
          id: string
          lane_number: number
          team_id: string | null
        }
        Insert: {
          athlete_id?: string | null
          created_at?: string
          heat_id: string
          id?: string
          lane_number: number
          team_id?: string | null
        }
        Update: {
          athlete_id?: string | null
          created_at?: string
          heat_id?: string
          id?: string
          lane_number?: number
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lanes_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lanes_heat_id_fkey"
            columns: ["heat_id"]
            isOneToOne: false
            referencedRelation: "heats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lanes_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      member: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "member_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      operator_actions: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          event_id: string | null
          floor_id: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          floor_id?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          event_id?: string | null
          floor_id?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_actions_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_actions_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_actions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          logo: string | null
          metadata: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo?: string | null
          metadata?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          logo?: string | null
          metadata?: string | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          created_at: string
          external_account_id: string | null
          id: string
          organization_id: string
          provider: string
          status: Database["public"]["Enums"]["payment_account_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          external_account_id?: string | null
          id?: string
          organization_id: string
          provider?: string
          status?: Database["public"]["Enums"]["payment_account_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          external_account_id?: string | null
          id?: string
          organization_id?: string
          provider?: string
          status?: Database["public"]["Enums"]["payment_account_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_line_items: {
        Row: {
          amount_cents: number
          created_at: string
          description: string
          fee_schedule_id: string | null
          id: string
          payment_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          description: string
          fee_schedule_id?: string | null
          id?: string
          payment_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          description?: string
          fee_schedule_id?: string | null
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_line_items_fee_schedule_id_fkey"
            columns: ["fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "fee_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_line_items_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          fee_schedule_id: string | null
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          recorded_by: string | null
          registration_id: string
          status: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          fee_schedule_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          recorded_by?: string | null
          registration_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          fee_schedule_id?: string | null
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          recorded_by?: string | null
          registration_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          stripe_payment_intent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_fee_schedule_id_fkey"
            columns: ["fee_schedule_id"]
            isOneToOne: false
            referencedRelation: "fee_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: true
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limit: {
        Row: {
          count: number
          id: string
          key: string
          last_request: number
        }
        Insert: {
          count: number
          id?: string
          key: string
          last_request: number
        }
        Update: {
          count?: number
          id?: string
          key?: string
          last_request?: number
        }
        Relationships: []
      }
      registrations: {
        Row: {
          athlete_id: string | null
          bib_number: string | null
          created_at: string
          division_id: string
          event_id: string
          id: string
          team_id: string | null
        }
        Insert: {
          athlete_id?: string | null
          bib_number?: string | null
          created_at?: string
          division_id: string
          event_id: string
          id?: string
          team_id?: string | null
        }
        Update: {
          athlete_id?: string | null
          bib_number?: string | null
          created_at?: string
          division_id?: string
          event_id?: string
          id?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      results: {
        Row: {
          adjusted_at: string | null
          adjusted_by: string | null
          athlete_id: string | null
          capped: boolean
          created_at: string
          entered_by: string | null
          heat_id: string
          id: string
          load: number | null
          manually_adjusted: boolean
          notes: string | null
          points: number | null
          reps: number | null
          status: Database["public"]["Enums"]["result_status"]
          team_id: string | null
          tiebreak_value: number | null
          time_seconds: number | null
          updated_at: string
          wod_id: string
        }
        Insert: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          athlete_id?: string | null
          capped?: boolean
          created_at?: string
          entered_by?: string | null
          heat_id: string
          id?: string
          load?: number | null
          manually_adjusted?: boolean
          notes?: string | null
          points?: number | null
          reps?: number | null
          status?: Database["public"]["Enums"]["result_status"]
          team_id?: string | null
          tiebreak_value?: number | null
          time_seconds?: number | null
          updated_at?: string
          wod_id: string
        }
        Update: {
          adjusted_at?: string | null
          adjusted_by?: string | null
          athlete_id?: string | null
          capped?: boolean
          created_at?: string
          entered_by?: string | null
          heat_id?: string
          id?: string
          load?: number | null
          manually_adjusted?: boolean
          notes?: string | null
          points?: number | null
          reps?: number | null
          status?: Database["public"]["Enums"]["result_status"]
          team_id?: string | null
          tiebreak_value?: number | null
          time_seconds?: number | null
          updated_at?: string
          wod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "results_adjusted_by_fkey"
            columns: ["adjusted_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_entered_by_fkey"
            columns: ["entered_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_heat_id_fkey"
            columns: ["heat_id"]
            isOneToOne: false
            referencedRelation: "heats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "results_wod_id_fkey"
            columns: ["wod_id"]
            isOneToOne: false
            referencedRelation: "wods"
            referencedColumns: ["id"]
          },
        ]
      }
      session: {
        Row: {
          active_organization_id: string | null
          created_at: string
          expires_at: string
          id: string
          impersonated_by: string | null
          ip_address: string | null
          token: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          active_organization_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          impersonated_by?: string | null
          ip_address?: string | null
          token: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          active_organization_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          impersonated_by?: string | null
          ip_address?: string | null
          token?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_impersonated_by_fkey"
            columns: ["impersonated_by"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_creatives: {
        Row: {
          active: boolean
          created_at: string
          id: string
          public_url: string
          sponsor_id: string
          storage_path: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          public_url: string
          sponsor_id: string
          storage_path: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          public_url?: string
          sponsor_id?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_creatives_sponsor_id_fkey"
            columns: ["sponsor_id"]
            isOneToOne: false
            referencedRelation: "sponsors"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsor_packages: {
        Row: {
          active: boolean
          created_at: string
          display_duration_seconds: number
          display_enabled: boolean
          display_weight: number
          id: string
          name: string
          organization_id: string
          sort_order: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_duration_seconds?: number
          display_enabled?: boolean
          display_weight?: number
          id?: string
          name: string
          organization_id: string
          sort_order?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          display_duration_seconds?: number
          display_enabled?: boolean
          display_weight?: number
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "sponsor_packages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sponsors: {
        Row: {
          active: boolean
          business_name: string
          category: string | null
          created_at: string
          id: string
          logo_url: string | null
          notes: string | null
          organization_id: string
          website: string | null
        }
        Insert: {
          active?: boolean
          business_name: string
          category?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          notes?: string | null
          organization_id: string
          website?: string | null
        }
        Update: {
          active?: boolean
          business_name?: string
          category?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          notes?: string | null
          organization_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sponsors_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      standings: {
        Row: {
          athlete_id: string | null
          computed_at: string
          division_id: string
          event_id: string
          id: string
          placement: number | null
          points: number | null
          team_id: string | null
          wod_id: string | null
        }
        Insert: {
          athlete_id?: string | null
          computed_at?: string
          division_id: string
          event_id: string
          id?: string
          placement?: number | null
          points?: number | null
          team_id?: string | null
          wod_id?: string | null
        }
        Update: {
          athlete_id?: string | null
          computed_at?: string
          division_id?: string
          event_id?: string
          id?: string
          placement?: number | null
          points?: number | null
          team_id?: string | null
          wod_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "standings_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_division_id_fkey"
            columns: ["division_id"]
            isOneToOne: false
            referencedRelation: "divisions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "standings_wod_id_fkey"
            columns: ["wod_id"]
            isOneToOne: false
            referencedRelation: "wods"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          athlete_id: string
          id: string
          team_id: string
        }
        Insert: {
          athlete_id: string
          id?: string
          team_id: string
        }
        Update: {
          athlete_id?: string
          id?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_members_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_members_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          affiliate: string | null
          created_at: string
          entry_format: Database["public"]["Enums"]["entry_format"]
          id: string
          name: string
          organization_id: string
          team_size: number | null
        }
        Insert: {
          affiliate?: string | null
          created_at?: string
          entry_format?: Database["public"]["Enums"]["entry_format"]
          id?: string
          name: string
          organization_id: string
          team_size?: number | null
        }
        Update: {
          affiliate?: string | null
          created_at?: string
          entry_format?: Database["public"]["Enums"]["entry_format"]
          id?: string
          name?: string
          organization_id?: string
          team_size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "teams_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user: {
        Row: {
          ban_expires: string | null
          ban_reason: string | null
          banned: boolean | null
          created_at: string
          email: string
          email_verified: boolean
          id: string
          image: string | null
          last_sign_in_at: string | null
          name: string
          role: string | null
          updated_at: string
        }
        Insert: {
          ban_expires?: string | null
          ban_reason?: string | null
          banned?: boolean | null
          created_at?: string
          email: string
          email_verified?: boolean
          id?: string
          image?: string | null
          last_sign_in_at?: string | null
          name: string
          role?: string | null
          updated_at?: string
        }
        Update: {
          ban_expires?: string | null
          ban_reason?: string | null
          banned?: boolean | null
          created_at?: string
          email?: string
          email_verified?: boolean
          id?: string
          image?: string | null
          last_sign_in_at?: string | null
          name?: string
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          created_at: string
          event_id: string
          id: string
          name: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          event_id: string
          id?: string
          name: string
        }
        Update: {
          address?: string | null
          created_at?: string
          event_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "venues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      verification: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          identifier: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          identifier: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          identifier?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      wods: {
        Row: {
          created_at: string
          description: string | null
          event_id: string
          id: string
          lower_is_better: boolean
          name: string
          rules: string | null
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          sort_order: number
          tiebreak_type: Database["public"]["Enums"]["tiebreak_type"]
          time_cap_seconds: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          event_id: string
          id?: string
          lower_is_better?: boolean
          name: string
          rules?: string | null
          scoring_type: Database["public"]["Enums"]["scoring_type"]
          sort_order?: number
          tiebreak_type?: Database["public"]["Enums"]["tiebreak_type"]
          time_cap_seconds?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          event_id?: string
          id?: string
          lower_is_better?: boolean
          name?: string
          rules?: string | null
          scoring_type?: Database["public"]["Enums"]["scoring_type"]
          sort_order?: number
          tiebreak_type?: Database["public"]["Enums"]["tiebreak_type"]
          time_cap_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "wods_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      athlete_private_details: {
        Args: { p_athlete_ids: string[] }
        Returns: {
          date_of_birth: string
          email: string
          id: string
          phone: string
        }[]
      }
      bootstrap_athlete: {
        Args: {
          p_affiliate: string
          p_date_of_birth: string
          p_email: string
          p_first_name: string
          p_gender: Database["public"]["Enums"]["athlete_gender"]
          p_last_name: string
          p_phone?: string
        }
        Returns: string
      }
      bootstrap_organization: { Args: { p_name: string }; Returns: string }
      can_like: {
        Args: { p_athlete_id: string; p_liker: string }
        Returns: boolean
      }
      can_manage_athlete_photo: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      can_manage_event_displays: {
        Args: { p_event_id: string }
        Returns: boolean
      }
      can_manage_event_photo: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      can_manage_sponsor_creative: {
        Args: { p_object_name: string }
        Returns: boolean
      }
      can_message: {
        Args: { p_recipient: string; p_sender: string }
        Returns: boolean
      }
      check_sponsor_category_exclusive: {
        Args: {
          p_category: string
          p_event_id: string
          p_exclusive: boolean
          p_sponsorship_id: string
        }
        Returns: undefined
      }
      has_role: {
        Args: {
          p_event_id?: string
          p_organization_id: string
          p_roles: Database["public"]["Enums"]["user_role"][]
        }
        Returns: boolean
      }
      is_event_commentator: { Args: { p_event_id: string }; Returns: boolean }
      is_event_producer: { Args: { p_event_id: string }; Returns: boolean }
      is_event_scorekeeper: { Args: { p_event_id: string }; Returns: boolean }
      is_org_event_staff: {
        Args: { p_organization_id: string }
        Returns: boolean
      }
      org_member_emails: {
        Args: { p_organization_id: string }
        Returns: {
          email: string
          last_sign_in_at: string
          user_id: string
        }[]
      }
      replace_standings: {
        Args: { p_division_id: string; p_rows: Json; p_wod_id: string }
        Returns: undefined
      }
      timer_command: {
        Args: {
          p_command: string
          p_delta_seconds?: number
          p_direction?: Database["public"]["Enums"]["timer_direction"]
          p_duration_seconds?: number
          p_floor_id: string
        }
        Returns: {
          active_graphic: Database["public"]["Enums"]["active_graphic"]
          active_sponsor_id: string | null
          current_heat_id: string | null
          floor_id: string
          id: string
          lower_third_athlete_id: string | null
          timer_anchor_time: string | null
          timer_direction: Database["public"]["Enums"]["timer_direction"]
          timer_duration_seconds: number
          timer_elapsed_at_anchor: number
          timer_status: Database["public"]["Enums"]["timer_status"]
          updated_at: string
          updated_by: string | null
        }
        SetofOptions: {
          from: "*"
          to: "broadcast_state"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      active_graphic:
        | "none"
        | "heat_intro"
        | "lanes"
        | "wod"
        | "timer"
        | "score"
        | "leaderboard"
        | "lower_third"
        | "sponsor"
      athlete_gender: "male" | "female"
      competitor_entry_type: "individual" | "pair" | "team" | "custom"
      display_block_type: "current_heat" | "next_heat" | "leaderboard"
      entry_format: "pair" | "team" | "custom"
      event_assignment_status: "active" | "inactive" | "removed"
      event_status: "draft" | "scheduled" | "live" | "completed" | "archived"
      expense_category:
        | "venue"
        | "equipment"
        | "staff_judges"
        | "prizes"
        | "marketing"
        | "other"
      lift_name:
        | "deadlift"
        | "bench_press"
        | "strict_press"
        | "back_squat"
        | "front_squat"
        | "clean"
        | "squat_clean"
        | "snatch"
        | "power_snatch"
        | "run_400m"
        | "run_1_mile"
        | "run_5k"
      like_target_type: "lift" | "benchmark" | "standing"
      payment_account_status: "not_connected" | "pending" | "connected"
      payment_method_type: "unpaid" | "cash" | "manual_other" | "stripe"
      payment_status: "unpaid" | "paid" | "waived" | "refunded"
      result_status: "completed" | "dns" | "dnf" | "dq"
      scoring_type: "for_time" | "amrap" | "max_load" | "points" | "other"
      tiebreak_type: "none" | "time" | "reps" | "load" | "points"
      timer_direction: "count_up" | "count_down"
      timer_status: "idle" | "running" | "paused" | "ended"
      user_role:
        | "admin"
        | "event_director"
        | "scoring_operator"
        | "production_director"
        | "commentator"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      active_graphic: [
        "none",
        "heat_intro",
        "lanes",
        "wod",
        "timer",
        "score",
        "leaderboard",
        "lower_third",
        "sponsor",
      ],
      athlete_gender: ["male", "female"],
      competitor_entry_type: ["individual", "pair", "team", "custom"],
      display_block_type: ["current_heat", "next_heat", "leaderboard"],
      entry_format: ["pair", "team", "custom"],
      event_assignment_status: ["active", "inactive", "removed"],
      event_status: ["draft", "scheduled", "live", "completed", "archived"],
      expense_category: [
        "venue",
        "equipment",
        "staff_judges",
        "prizes",
        "marketing",
        "other",
      ],
      lift_name: [
        "deadlift",
        "bench_press",
        "strict_press",
        "back_squat",
        "front_squat",
        "clean",
        "squat_clean",
        "snatch",
        "power_snatch",
        "run_400m",
        "run_1_mile",
        "run_5k",
      ],
      like_target_type: ["lift", "benchmark", "standing"],
      payment_account_status: ["not_connected", "pending", "connected"],
      payment_method_type: ["unpaid", "cash", "manual_other", "stripe"],
      payment_status: ["unpaid", "paid", "waived", "refunded"],
      result_status: ["completed", "dns", "dnf", "dq"],
      scoring_type: ["for_time", "amrap", "max_load", "points", "other"],
      tiebreak_type: ["none", "time", "reps", "load", "points"],
      timer_direction: ["count_up", "count_down"],
      timer_status: ["idle", "running", "paused", "ended"],
      user_role: [
        "admin",
        "event_director",
        "scoring_operator",
        "production_director",
        "commentator",
      ],
    },
  },
} as const

