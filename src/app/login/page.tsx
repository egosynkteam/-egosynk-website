import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, textLink } from "@/components/auth";
import { LoginForm } from "@/components/auth-forms";
import { legacy } from "@/lib/links";

export const metadata: Metadata = { title: "Log in", robots: { index: false }, alternates: { canonical: legacy.login } };

export default function Login() {
  return (
    <AuthShell
      eyebrow="Account"
      title={<>Welcome <span className="text-rust">back.</span></>}
      sub="Log in to see your orders, track parcels and check out faster."
      footer={<>
        <p>New here? <Link href={legacy.signup} className={textLink}>Create an account</Link></p>
        <p className="mono text-micro text-steel">Or <Link href="/" className={textLink}>keep shopping as a guest</Link>. No account needed to buy.</p>
      </>}
    >
      <LoginForm />
    </AuthShell>
  );
}
