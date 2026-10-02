import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/AuthCard";
import { googleEnabled } from "@/lib/auth/server";
import { getAuthSession } from "@/lib/auth/session";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignUpPage() {
  if (await getAuthSession()) redirect("/");

  return (
    <AuthCard title="Create your RepOne account">
      <SignUpForm googleEnabled={googleEnabled} />
    </AuthCard>
  );
}
