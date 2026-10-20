import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { getAuthSession } from "@/lib/auth/session";
import { ResendButton } from "./ResendButton";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  if (await getAuthSession()) redirect("/");

  const email = [(await searchParams).email ?? ""].flat()[0];

  return (
    <AuthCard title="Confirm your email">
      <p className="text-sm">
        {email ? `We sent an email to ${email}.` : "We sent you an email."} Open the link in it to
        finish.
      </p>
      {email ? <ResendButton email={email} /> : null}
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
