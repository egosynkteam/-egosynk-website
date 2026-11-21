"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Field, Notice, Submit, postJson, textLink } from "./auth";
import { legacy } from "@/lib/links";
import { safeRedirect } from "@/lib/safe-redirect";

type Msg = { tone: "error" | "ok"; text: string } | null;
const FAILED = "Something went wrong. Try again.";

// ?redirect= is read when the form is sent, not during render, so these pages stay static.
const redirectTarget = () => safeRedirect(new URLSearchParams(location.search).get("redirect"));
const form = (e: React.FormEvent<HTMLFormElement>) => Object.fromEntries(new FormData(e.currentTarget).entries());

export function LoginForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { ok, data } = await postJson("login", form(e));
    if (ok) return location.assign(redirectTarget());
    setMsg({ tone: "error", text: data.error || "Login failed" });
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="grid gap-5">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
      <div className="grid gap-2">
        <Field label="Password" name="password" type="password" autoComplete="current-password" required />
        <Link href={legacy.forgotPassword} className={`justify-self-end text-small ${textLink}`}>Forgot password?</Link>
      </div>
      <Submit busy={busy} busyText="Logging in…">Log in</Submit>
    </form>
  );
}

export function SignupForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { ok, data } = await postJson("signup", form(e));
    if (ok) return location.assign(redirectTarget());
    setMsg({ tone: "error", text: data.error || "Signup failed" });
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="grid gap-5">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Field label="Full name" name="name" autoComplete="name" required autoFocus />
      <Field label="Email" name="email" type="email" autoComplete="email" required />
      <Field label="Phone (optional)" name="phone" type="tel" inputMode="numeric" autoComplete="tel-national" pattern="[6-9][0-9]{9}" maxLength={10} placeholder="10-digit mobile" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={8} required hint="At least 8 characters" />
      <Submit busy={busy} busyText="Creating…">Create account</Submit>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const el = e.currentTarget;
    setMsg(null);
    setBusy(true);
    const { ok, data } = await postJson("request-password-reset", { email: form(e).email });
    // Same answer whether or not the email has an account, so the page can't be used to find accounts.
    setMsg(ok ? { tone: "ok", text: data.message || "If that email has an account, a reset link has been sent." } : { tone: "error", text: FAILED });
    if (ok) el.reset();
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="grid gap-5">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus />
      <Submit busy={busy} busyText="Sending…">Send reset link</Submit>
    </form>
  );
}

// Reads ?token= once, then takes it out of the address bar (history, analytics, screenshots).
// The ref keeps the token when the effect runs again (React does that in development), since by
// then it's no longer in the address bar.
function useLinkToken() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const read = useRef<string | null>(null);
  useEffect(() => {
    const t = read.current ?? new URLSearchParams(location.search).get("token");
    read.current = t;
    if (t && location.search) history.replaceState(null, "", location.pathname);
    setToken(t);
  }, []);
  return token;
}

export function ResetPasswordForm() {
  const token = useLinkToken();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMsg(null);
    setBusy(true);
    const { ok, data } = await postJson("reset-password", { token, password: form(e).password });
    if (ok) {
      setDone(true);
      setMsg({ tone: "ok", text: "Password updated. Taking you to log in…" });
      setTimeout(() => location.assign(legacy.login), 1500);
      return;
    }
    setMsg({ tone: "error", text: data.error || "Could not reset password." });
    setBusy(false);
  }
  if (token === undefined) return <p className="text-dim">Checking your link…</p>;
  if (!token) return <Notice tone="error">No reset token in this link. Ask for a new one from <Link href={legacy.forgotPassword} className={textLink}>Forgot password</Link>.</Notice>;
  return (
    <form onSubmit={submit} className="grid gap-5">
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      {!done && (
        <>
          <Field label="New password" name="password" type="password" autoComplete="new-password" minLength={8} required autoFocus hint="At least 8 characters" />
          <Submit busy={busy} busyText="Saving…">Set new password</Submit>
        </>
      )}
    </form>
  );
}

type Verify = { state: "checking" } | { state: "ok" } | { state: "failed"; text: string };

export function VerifyEmail() {
  const token = useLinkToken();
  const [result, setResult] = useState<Verify>({ state: "checking" });
  // The token works once; a second request (the effect re-running) would report it as used.
  const sent = useRef(false);
  useEffect(() => {
    if (token === undefined || sent.current) return;
    sent.current = true;
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- outcome of reading the address bar
      setResult({ state: "failed", text: "No verification token in this link." });
      return;
    }
    fetch(`/.netlify/functions/verify-email?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        setResult(res.ok && data.ok ? { state: "ok" } : { state: "failed", text: data.error || "This link is invalid or expired." });
      })
      .catch(() => setResult({ state: "failed", text: "Something went wrong. Try again, or email support@egosynk.com." }));
  }, [token]);

  if (result.state === "checking") return <p className="text-dim">Verifying…</p>;
  return (
    <div className="grid gap-5">
      {result.state === "ok"
        ? <Notice tone="ok">Your email is verified.</Notice>
        : <Notice tone="error">{result.text}</Notice>}
      <a href={legacy.account} className="btn btn-ghost w-full">Go to your account</a>
    </div>
  );
}
