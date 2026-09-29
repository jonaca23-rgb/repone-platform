// Pure, framework-free computation of an athlete's competitive age/gender
// category. No UI or DB imports — unit-tested in isolation like the rest of
// lib/scoring, and reusable from server actions or scripts.
//
// RepOne rule: age is computed AS OF THE EVENT DATE (not "today"), so an
// athlete's category doesn't silently shift depending on when a page is
// viewed. Only 4 categories are tracked today; under-35 athletes return null.

export type Gender = "male" | "female";
export type AgeCategory = "35_44_male" | "35_44_female" | "45_plus_male" | "45_plus_female";

export const AGE_CATEGORY_LABELS: Record<AgeCategory, string> = {
  "35_44_male": "35-44 Male",
  "35_44_female": "35-44 Female",
  "45_plus_male": "45+ Male",
  "45_plus_female": "45+ Female",
};

export function computeAgeCategory(
  dateOfBirth: string | null | undefined,
  gender: Gender | null | undefined,
  asOfDate: string | Date,
): AgeCategory | null {
  if (!dateOfBirth || !gender) return null;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  // date_of_birth comes from Postgres as a date-only string ("1990-05-14")
  // with no timezone, so it's parsed as UTC midnight — read it back in UTC.
  const dobY = dob.getUTCFullYear();
  const dobM = dob.getUTCMonth();
  const dobD = dob.getUTCDate();

  let refY: number;
  let refM: number;
  let refD: number;
  if (typeof asOfDate === "string") {
    const ref = new Date(asOfDate);
    if (Number.isNaN(ref.getTime())) return null;
    refY = ref.getUTCFullYear();
    refM = ref.getUTCMonth();
    refD = ref.getUTCDate();
  } else {
    // A real Date instance (e.g. `new Date()` for "today") represents a
    // specific instant — read its calendar date in local time, since that's
    // the calendar date a human means by "today".
    refY = asOfDate.getFullYear();
    refM = asOfDate.getMonth();
    refD = asOfDate.getDate();
  }

  let age = refY - dobY;
  const hadBirthdayByRefDate = refM > dobM || (refM === dobM && refD >= dobD);
  if (!hadBirthdayByRefDate) age -= 1;

  if (age < 35) return null;
  if (age <= 44) return gender === "male" ? "35_44_male" : "35_44_female";
  return gender === "male" ? "45_plus_male" : "45_plus_female";
}
