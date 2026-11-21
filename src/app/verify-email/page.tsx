import type { Metadata } from "next";
import { AuthShell } from "@/components/auth";
import { VerifyEmail } from "@/components/auth-forms";

// Opened from the sign-up email (/verify-email?token=…).
export const metadata: Metadata = { title: "Verify your email", robots: { index: false } };

export default function VerifyEmailPage() {
  return (
    <AuthShell eyebrow="Account" title={<>Verify your <span className="text-rust">email</span></>}>
      <VerifyEmail />
    </AuthShell>
  );
}
