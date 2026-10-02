import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const token = [(await searchParams).token ?? ""].flat()[0];

  return (
    <AuthCard title="Choose a new password">
      {token ? (
        <SetPasswordForm token={token} redirectTo="/login?reset=1" submitLabel="Save password" />
      ) : (
        <p className="text-sm text-white/80">
          This link has expired or was already used.{" "}
          <Link href="/forgot-password" className="text-repone-red underline">
            Send a new one
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
