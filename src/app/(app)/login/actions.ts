"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth/server";

/** Ends the session; SignOutButton then leaves for /login with a full load. */
export async function signOut() {
  await auth.api.signOut({ headers: await headers() });
}
