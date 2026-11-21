import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, textLink } from "@/components/auth";
import { ForgotPasswordForm } from "@/components/auth-forms";
import { legacy } from "@/lib/links";

export const metadata: Metadata = { title: "Forgot password", robots: { index: false }, alternates: { canonical: legacy.forgotPassword } };

export default function ForgotPassword() {
  return (
    <AuthShell
      eyebrow="Account"
      title={<>Reset your <span className="text-rust">password</span></>}
      sub="Enter the email on your account and we'll send you a link to set a new password."
      footer={<p><Link href={legacy.login} className={textLink}>Back to log in</Link></p>}
    >
      <ForgotPasswordForm />
    </AuthShell>
  );
}
