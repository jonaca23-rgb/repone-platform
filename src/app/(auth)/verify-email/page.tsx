import { redirect } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { getAuthSession } from "@/lib/auth/session";
import { ResendButton } from "./ResendButton";

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  if (await getAuthSession()) redirect("/");

  const email = [(await searchParams).email ?? ""].flat()[0];

  return (
    <AuthCard title="Confirm your email">
      <p className="text-sm text-white/80">
        {email ? `We sent an email to ${email}.` : "We sent you an email."} Open the link in it to
        finish.
      </p>
      {email ? <ResendButton email={email} /> : null}
      <p className="mt-6 text-sm text-white/50">
        <Link href="/login" className="text-repone-red underline">
          Back to sign in
        </Link>
      </p>
    </AuthCard>
  );
}
