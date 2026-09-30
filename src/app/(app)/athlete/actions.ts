"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";
import { createClient } from "@/lib/db/server";
import { z } from "zod";
import { requireSignedIn } from "@/lib/auth/guards";
import { friendlyAthleteWriteError } from "@/lib/db/athleteErrors";
import { sqlNull } from "@/lib/db/sqlNull";
import { Constants } from "@/lib/db/supabase.types";
import { field, parseForm } from "@/lib/validation/form";

const OnboardingForm = z.object({
  first_name: field.text("First name", { max: 100 }),
  last_name: field.text("Last name", { max: 100 }),
  affiliate: field.optionalText({ max: 200, label: "Affiliate" }),
  date_of_birth: field.optionalDate("Date of birth"),
  gender: z
    .preprocess(
      (v) => (v === "" ? undefined : v),
      field.oneOf(Constants.public.Enums.athlete_gender, "gender").optional(),
    )
    .transform((v) => v ?? null),
  email: field.email(),
  phone: field.phone(),
});

/** Ends the session; SignOutButton then leaves for /athlete/login with a full load. */
export async function athleteSignOut() {
  await auth.api.signOut({ headers: await headers() });
}

/**
 * One-time step after first sign-in: links this auth account to a new
 * `athletes` row via the bootstrap_athlete() SECURITY DEFINER function
 * (0010_athlete_open_log.sql) — a normal insert can't do this, since
 * `athletes` writes are otherwise restricted to org staff. Runs once the
 * athlete has a session, so `auth.uid()` resolves to them.
 */
export async function completeAthleteOnboarding(formData: FormData) {
  await requireSignedIn();
  const f = parseForm(OnboardingForm, formData);

  const supabase = await createClient();
  const { error } = await supabase.rpc("bootstrap_athlete", {
    p_first_name: f.first_name,
    p_last_name: f.last_name,
    p_affiliate: sqlNull(f.affiliate),
    p_date_of_birth: sqlNull(f.date_of_birth),
    p_gender: sqlNull(f.gender),
    p_email: f.email,
    p_phone: f.phone ?? undefined,
  });
  if (error) throw new Error(friendlyAthleteWriteError(error));

  revalidatePath("/athlete");
  redirect("/athlete");
}
