import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";
import { googleEnabled } from "@/lib/auth/server";
import { InviteGoogle } from "./InviteGoogle";

export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = [(await searchParams).token ?? ""].flat()[0];

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
      ) : (
        <p className="text-sm text-white/80">
          This invitation link has expired. Ask the organizer to resend it.
        </p>
      )}
    </AuthCard>
  );
}
