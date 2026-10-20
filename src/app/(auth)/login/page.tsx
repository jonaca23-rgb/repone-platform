import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { googleEnabled } from "@/lib/auth/server";
import { getAuthSession } from "@/lib/auth/session";
import { LoginForm } from "./LoginForm";
import type { OAuthFailure } from "@/components/auth/GoogleButton";

export const metadata: Metadata = { title: "Sign in" };

const NOTICES: Record<string, string> = {
  reset: "Password saved — sign in.",
  invited: "Welcome — sign in with your new password.",
  verified: "Email confirmed — sign in.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await getAuthSession()) redirect("/");

  const params = await searchParams;
  const notice = Object.keys(NOTICES).find((key) => params[key] === "1");
  // A failed Google sign-in returns to errorCallbackURL (see GoogleButton)
  // with BetterAuth's code appended: ?error=oauth&error=<code>.
  const errors = [params.error ?? []].flat();
  const oauthFailure: OAuthFailure | undefined = errors.includes("account_not_linked")
    ? "account_not_linked"
    : errors.includes("oauth")
      ? "other"
      : undefined;

  return (
    <AuthCard title="Sign in to RepOne" notice={notice ? NOTICES[notice] : undefined}>
      <LoginForm oauthFailure={oauthFailure} googleEnabled={googleEnabled} />
    </AuthCard>
  );
}
