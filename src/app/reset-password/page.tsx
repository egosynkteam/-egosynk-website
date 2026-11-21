import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, textLink } from "@/components/auth";
import { ResetPasswordForm } from "@/components/auth-forms";
import { legacy } from "@/lib/links";

// Opened from the reset email (/reset-password?token=…); the token never reaches analytics
// (consent.js strips it, and the form removes it from the address bar).
export const metadata: Metadata = { title: "Set a new password", robots: { index: false } };

export default function ResetPassword() {
  return (
    <AuthShell
      eyebrow="Account"
      title={<>New <span className="text-rust">password</span></>}
      sub="Choose a new password for your account."
      footer={<p><Link href={legacy.login} className={textLink}>Back to log in</Link></p>}
    >
      <ResetPasswordForm />
    </AuthShell>
  );
}
