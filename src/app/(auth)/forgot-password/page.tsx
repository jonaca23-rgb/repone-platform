import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { getAuthSession } from "@/lib/auth/session";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = { title: "Reset your password" };

export default async function ForgotPasswordPage() {
  if (await getAuthSession()) redirect("/");

  return (
    <AuthCard title="Reset your password">
      <ForgotPasswordForm />
      <p className="mt-6 text-sm">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-sm text-brand-text underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
        >
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
