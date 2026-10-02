import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { getAuthSession } from "@/lib/auth/session";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export default async function ForgotPasswordPage() {
  if (await getAuthSession()) redirect("/");

  return (
    <AuthCard title="Reset your password">
      <ForgotPasswordForm />
      <p className="mt-6 text-sm text-white/50">
        <Link href="/login" className="text-repone-red underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
