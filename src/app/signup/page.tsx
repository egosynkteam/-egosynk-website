import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell, textLink } from "@/components/auth";
import { SignupForm } from "@/components/auth-forms";
import { legacy } from "@/lib/links";

export const metadata: Metadata = { title: "Create an account", robots: { index: false }, alternates: { canonical: legacy.signup } };

export default function Signup() {
  return (
    <AuthShell
      eyebrow="Account"
      title={<>Join <span className="text-rust">EGOSYNK</span></>}
      sub="Faster checkout, a saved address and your order history in one place."
      footer={<>
        <p>Already have an account? <Link href={legacy.login} className={textLink}>Log in</Link></p>
        <p className="mono text-micro text-steel">By creating an account you agree to our <Link href={legacy.terms} className={textLink}>terms</Link> and <Link href={legacy.privacy} className={textLink}>privacy policy</Link>.</p>
      </>}
    >
      <SignupForm />
    </AuthShell>
  );
}
