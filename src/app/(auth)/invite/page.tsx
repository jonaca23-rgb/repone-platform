import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { googleEnabled } from "@/lib/auth/server";
import { InviteGoogle } from "./InviteGoogle";

export const metadata: Metadata = { title: "Set up your account" };

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = [params.token ?? ""].flat()[0];
  // An expired or used link comes back from BetterAuth as ?error=INVALID_TOKEN, with no token.
  const expired = [params.error ?? []].flat().length > 0;

  return (
    <AuthCard title="Set up your RepOne account">
      {token ? (
        <>
          <SetPasswordForm
            token={token}
            redirectTo="/login?invited=1"
            submitLabel="Set password and continue"
          />
          {googleEnabled ? <InviteGoogle /> : null}
        </>
      ) : expired ? (
        <p className="text-sm">This invitation link has expired. Ask the organizer to resend it.</p>
      ) : (
        <>
          <p className="text-sm">This invitation link is missing its code.</p>
          <p className="mt-6 text-sm">
            <Link
              href="/login"
              className="rounded-sm text-brand-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
            >
              Back to sign in
            </Link>
          </p>
        </>
      )}
    </AuthCard>
  );
}
