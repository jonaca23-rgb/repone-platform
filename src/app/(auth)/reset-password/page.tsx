import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { SetPasswordForm } from "@/components/auth/SetPasswordForm";

export const metadata: Metadata = { title: "Choose a new password" };

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
        <p className="text-sm">
          This link has expired or was already used.{" "}
          <Link
            href="/forgot-password"
            className="rounded-sm text-brand-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            Send a new one
          </Link>
        </p>
      )}
    </AuthCard>
  );
}
