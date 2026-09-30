// App-facing names for the database types. Everything here is an alias into
// supabase.types.ts, which `pnpm db:types` generates from the migrations (CI
// fails if it's stale) — so these always match the real schema. Import from
// here, not from the generated file, to keep the friendly names in one place.
import type { Database } from "./supabase.types";

export type { Database, Json } from "./supabase.types";

type Enums = Database["public"]["Enums"];
type Tables = Database["public"]["Tables"];

export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

export type ActiveGraphic = Enums["active_graphic"];
export type AthleteGenderDb = Enums["athlete_gender"];
export type CompetitorEntryType = Enums["competitor_entry_type"];
export type EntryFormat = Enums["entry_format"];
export type EventAssignmentStatus = Enums["event_assignment_status"];
export type EventStatus = Enums["event_status"];
export type ExpenseCategory = Enums["expense_category"];
export type LiftNameDb = Enums["lift_name"];
export type LikeTargetType = Enums["like_target_type"];
export type PaymentAccountStatus = Enums["payment_account_status"];
export type PaymentMethodType = Enums["payment_method_type"];
export type PaymentStatus = Enums["payment_status"];
export type ResultStatus = Enums["result_status"];
export type ScoringTypeDb = Enums["scoring_type"];
export type SponsorTier = Enums["sponsor_tier"];
export type TiebreakTypeDb = Enums["tiebreak_type"];
export type TimerDirection = Enums["timer_direction"];
export type TimerStatus = Enums["timer_status"];
export type UserRoleDb = Enums["user_role"];
