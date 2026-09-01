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

export interface Database {
  public: {
    Tables: {
      organizations: { Row: { id: string; name: string; created_at: string } };
      events: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          status: EventStatus;
          starts_on: string | null;
          ends_on: string | null;
          created_at: string;
          updated_at: string;
        };
      };
      venues: {
        Row: { id: string; event_id: string; name: string; address: string | null; created_at: string };
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
          created_at: string;
        };
      };
      teams: {
        Row: { id: string; organization_id: string; name: string; affiliate: string | null; created_at: string };
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
    };
  };
}
