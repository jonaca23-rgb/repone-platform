// Hand-authored types matching supabase/migrations/0001_init.sql.
// Once a real Supabase project exists, replace this file with the generated
// output of `supabase gen types typescript --project-id <id> --schema public`
// — the shape below is written to match that generator's output so the swap
// is a drop-in replacement, not a rewrite of anything that imports it.

export type EventStatus = "draft" | "scheduled" | "live" | "completed" | "archived";
export type ScoringTypeDb = "for_time" | "amrap" | "max_load" | "points" | "other";
export type TiebreakTypeDb = "none" | "time" | "reps" | "load" | "points";
export type ResultStatus = "completed" | "dns" | "dnf" | "dq";
export type UserRoleDb =
  | "admin"
  | "event_director"
  | "scoring_operator"
  | "production_director"
  | "commentator";
export type SponsorTier =
  | "logo_sponsor"
  | "brand_mention"
  | "commercial_30"
  | "commercial_30_plus"
  | "wod_sponsor"
  | "presenting_sponsor";
export type ActiveGraphic =
  | "none"
  | "heat_intro"
  | "lanes"
  | "wod"
  | "timer"
  | "score"
  | "leaderboard"
  | "lower_third"
  | "sponsor";
export type TimerStatus = "idle" | "running" | "paused" | "ended";
export type TimerDirection = "count_up" | "count_down";
export type AthleteGenderDb = "male" | "female";
export type EntryFormat = "pair" | "team" | "custom";
export type CompetitorEntryType = "individual" | "pair" | "team" | "custom";
export type PaymentAccountStatus = "not_connected" | "pending" | "connected";
export type PaymentStatus = "unpaid" | "paid" | "waived" | "refunded";
export type PaymentMethodType = "unpaid" | "cash" | "manual_other" | "stripe";
export type ExpenseCategory =
  | "venue"
  | "equipment"
  | "staff_judges"
  | "prizes"
  | "marketing"
  | "other";
export type LiftNameDb =
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
  | "run_5k";

export interface Database {
  public: {
    Tables: {
      organizations: { Row: { id: string; name: string; created_at: string } };
      circuits: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          description: string | null;
          starts_on: string | null;
          ends_on: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      events: {
        Row: {
          id: string;
          organization_id: string;
          circuit_id: string | null;
          name: string;
          status: EventStatus;
          starts_on: string | null;
          ends_on: string | null;
          cover_image_url: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      venues: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          address: string | null;
          created_at: string;
        };
      };
      floors: {
        Row: { id: string; venue_id: string; name: string; sort_order: number; created_at: string };
      };
      divisions: {
        Row: { id: string; event_id: string; name: string; sort_order: number; created_at: string };
      };
      athletes: {
        Row: {
          id: string;
          organization_id: string;
          first_name: string;
          last_name: string;
          affiliate: string | null;
          photo_url: string | null;
          date_of_birth: string | null;
          gender: AthleteGenderDb | null;
          auth_user_id: string | null;
          email: string;
          phone: string | null;
          created_at: string;
        };
      };
      athlete_lifts: {
        Row: {
          id: string;
          athlete_id: string;
          lift: LiftNameDb;
          // Exactly one of these two is set, depending on `lift` — the 9
          // barbell lifts use weight_lbs, the 3 run benchmarks
          // (run_400m/run_1_mile/run_5k, added 0014) use time_seconds. See
          // WEIGHT_LIFT_NAMES/TIME_LIFT_NAMES in src/lib/constants/lifts.ts.
          weight_lbs: number | null;
          time_seconds: number | null;
          created_at: string;
          updated_at: string;
        };
      };
      athlete_benchmarks: {
        Row: {
          id: string;
          athlete_id: string;
          name: string;
          result_display: string;
          created_at: string;
          updated_at: string;
        };
      };
      teams: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          affiliate: string | null;
          entry_format: EntryFormat;
          team_size: number | null;
          created_at: string;
        };
      };
      team_members: {
        Row: { id: string; team_id: string; athlete_id: string };
      };
      registrations: {
        Row: {
          id: string;
          event_id: string;
          division_id: string;
          athlete_id: string | null;
          team_id: string | null;
          bib_number: string | null;
          created_at: string;
        };
      };
      wods: {
        Row: {
          id: string;
          event_id: string;
          name: string;
          description: string | null;
          rules: string | null;
          scoring_type: ScoringTypeDb;
          time_cap_seconds: number | null;
          tiebreak_type: TiebreakTypeDb;
          lower_is_better: boolean;
          sort_order: number;
          created_at: string;
        };
      };
      heats: {
        Row: {
          id: string;
          event_id: string;
          floor_id: string;
          wod_id: string;
          division_id: string;
          heat_number: number;
          heat_count: number | null;
          scheduled_start: string | null;
          started_at: string | null;
          ended_at: string | null;
          created_at: string;
        };
      };
      lanes: {
        Row: {
          id: string;
          heat_id: string;
          lane_number: number;
          athlete_id: string | null;
          team_id: string | null;
          created_at: string;
        };
      };
      results: {
        Row: {
          id: string;
          heat_id: string;
          wod_id: string;
          athlete_id: string | null;
          team_id: string | null;
          time_seconds: number | null;
          reps: number | null;
          load: number | null;
          points: number | null;
          capped: boolean;
          status: ResultStatus;
          tiebreak_value: number | null;
          notes: string | null;
          entered_by: string | null;
          manually_adjusted: boolean;
          adjusted_by: string | null;
          adjusted_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      standings: {
        Row: {
          id: string;
          event_id: string;
          division_id: string;
          wod_id: string | null;
          athlete_id: string | null;
          team_id: string | null;
          placement: number | null;
          points: number | null;
          computed_at: string;
        };
      };
      sponsors: {
        Row: {
          id: string;
          organization_id: string;
          event_id: string | null;
          business_name: string;
          logo_url: string | null;
          website: string | null;
          category: string | null;
          category_exclusive: boolean;
          tier: SponsorTier;
          active: boolean;
          commercial_video_url: string | null;
          notes: string | null;
          created_at: string;
        };
      };
      broadcast_state: {
        Row: {
          id: string;
          floor_id: string;
          current_heat_id: string | null;
          active_graphic: ActiveGraphic;
          lower_third_athlete_id: string | null;
          active_sponsor_id: string | null;
          timer_status: TimerStatus;
          timer_direction: TimerDirection;
          timer_duration_seconds: number;
          timer_elapsed_at_anchor: number;
          timer_anchor_time: string | null;
          updated_at: string;
          updated_by: string | null;
        };
      };
      operator_actions: {
        Row: {
          id: string;
          event_id: string | null;
          floor_id: string | null;
          user_id: string | null;
          action: string;
          details: Record<string, unknown> | null;
          created_at: string;
        };
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          organization_id: string;
          event_id: string | null;
          role: UserRoleDb;
          created_at: string;
        };
      };
      fee_schedules: {
        Row: {
          id: string;
          organization_id: string;
          event_id: string;
          division_id: string | null;
          entry_type: CompetitorEntryType | null;
          name: string;
          description: string | null;
          amount_cents: number;
          currency: string;
          is_addon: boolean;
          active: boolean;
          created_at: string;
        };
      };
      payment_accounts: {
        Row: {
          id: string;
          organization_id: string;
          provider: string;
          status: PaymentAccountStatus;
          external_account_id: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      payments: {
        Row: {
          id: string;
          registration_id: string;
          fee_schedule_id: string | null;
          amount_cents: number;
          currency: string;
          status: PaymentStatus;
          payment_method: PaymentMethodType;
          stripe_payment_intent_id: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      payment_line_items: {
        Row: {
          id: string;
          payment_id: string;
          fee_schedule_id: string | null;
          description: string;
          amount_cents: number;
          created_at: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          organization_id: string;
          event_id: string;
          category: ExpenseCategory;
          description: string;
          amount_cents: number;
          currency: string;
          incurred_on: string | null;
          notes: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      messages: {
        Row: {
          id: string;
          sender_id: string;
          recipient_id: string;
          body: string;
          read_at: string | null;
          created_at: string;
        };
      };
      athlete_likes: {
        Row: {
          id: string;
          liker_user_id: string;
          athlete_id: string;
          target_type: LikeTargetType;
          target_id: string;
          created_at: string;
        };
      };
      event_scorekeeper_assignments: {
        Row: {
          id: string;
          event_id: string;
          scorekeeper_user_id: string;
          assigned_by_admin_id: string | null;
          status: EventAssignmentStatus;
          assigned_at: string;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      event_producer_assignments: {
        Row: {
          id: string;
          event_id: string;
          producer_user_id: string;
          assigned_by_admin_id: string | null;
          status: EventAssignmentStatus;
          assigned_at: string;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      event_commentator_assignments: {
        Row: {
          id: string;
          event_id: string;
          commentator_user_id: string;
          assigned_by_admin_id: string | null;
          role_label: string | null;
          status: EventAssignmentStatus;
          assigned_at: string;
          removed_at: string | null;
          created_at: string;
          updated_at: string;
        };
      };
    };
  };
}

export type LikeTargetType = "lift" | "benchmark" | "standing";
// Shared status for the three event-scoped staff assignment tables
// (0024_event_role_assignments.sql) — Scorekeeper/Producer/Commentator are
// per-event, unlike Admin, which stays the org-wide `user_roles` row.
export type EventAssignmentStatus = "active" | "inactive" | "removed";
