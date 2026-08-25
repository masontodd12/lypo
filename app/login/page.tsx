"use client";

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/site-url";

/**
 * Sign-in by six-digit code, with the emailed link still working.
 *
 * The link alone was not reliable. Magic links are single use, and mail
 * scanners fetch every URL in a message to check it is safe, which spends
 * the token before the person ever clicks. They then land on an
 * otp_expired error for a link they never used. A code cannot be consumed by
 * something fetching it, and on a phone it saves bouncing out to the mail
 * app and back.
 *
 * Both work: the same token backs the link and the code, so whichever the
 * email shows, and whichever the person reaches for, signs them in.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [status, setStatus] = useState<
    "idle" | "sending" | "verifying" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const codeRef = useRef<HTMLInputElement>(null);

  // An expired link bounces back here rather than into the app, so say what
  // happened. Landing on a plain sign-in form reads as "it never arrived",
  // and they request another link and hit the same wall.
  //
  // Derived rather than pushed into state by an effect: it is a fact about
  // the current URL, so it is already known at render, and copying it into
  // state only creates a frame where the page contradicts the address bar.
  const failedCode = searchParams.get("error_code");
  const failedReason = searchParams.get("error_description");
  const linkError =
    failedCode === "otp_expired"
      ? "That link had already been used or had expired. Enter your email and we will send a fresh code."
      : (failedReason ?? "");

  /** The link failure only matters until they do something about it. */
  const shownError = errorMessage || (step === "email" ? linkError : "");

  const next = safeNext(searchParams.get("next"));
  const idea = searchParams.get("idea");

  /** Where to land once signed in, carrying an idea through if there is one. */
  function destination() {
    if (!idea) return next;
    const url = new URL(next, window.location.origin);
    url.searchParams.set("idea", idea);
    return `${url.pathname}${url.search}`;
  }

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMessage("");

    const supabase = createClient();
    const redirect = new URL("/auth/callback", window.location.origin);
    redirect.searchParams.set("next", next);
    if (idea) redirect.searchParams.set("idea", idea);

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirect.toString() },
    });

    if (error) {
      setErrorMessage(error.message);
      setStatus("error");
      return;
    }
    setStatus("idle");
    setStep("code");
    // The code box is the only thing to do next, so put the cursor in it.
    setTimeout(() => codeRef.current?.focus(), 50);
  }

  async function verify(submitted?: string) {
    const token = (submitted ?? code).replace(/\D/g, "");
    if (token.length !== 6) return;
    setStatus("verifying");
    setErrorMessage("");

    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      setErrorMessage(
        /expired/i.test(error.message)
          ? "That code has expired. Send a new one."
          : "That code is not right. Check it and try again.",
      );
      setStatus("error");
      setCode("");
      codeRef.current?.focus();
      return;
    }

    // The session lives in cookies now, but the server has already rendered
    // this page as signed out. Without the refresh the destination can load
    // from cache still believing there is no user.
    router.replace(destination());
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link
        href="/"
        className="font-display text-sm font-semibold tracking-[0.4em]"
      >
        LYPO<span className="text-flame">.</span>
      </Link>

      <h1 className="font-display mt-10 text-4xl font-semibold tracking-tight">
        sign in<span className="text-flame">.</span>
      </h1>

      {step === "email" ? (
        <>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            No password. Enter your email and we&apos;ll send you a six-digit
            code.
          </p>
          <form onSubmit={sendCode} className="mt-10">
            <div className="flex items-center gap-3 border-b-2 border-ink py-3 focus-within:border-flame">
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="w-full bg-transparent text-sm outline-none placeholder:text-faint"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="shrink-0 text-sm font-medium text-flame transition hover:translate-x-0.5 disabled:opacity-50"
              >
                {status === "sending" ? "sending…" : "send code →"}
              </button>
            </div>
            {shownError && (
              <p className="mt-3 text-sm text-flame">{shownError}</p>
            )}
          </form>
        </>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            We sent a six-digit code to{" "}
            <span className="font-medium">{email}</span>. It may take a minute.
            Check your spam folder if it does not show up.
          </p>

          <form
            className="mt-8"
            onSubmit={(e) => {
              e.preventDefault();
              void verify();
            }}
          >
            <label htmlFor="code" className="lypo-label text-faint">
              your code
            </label>
            <input
              id="code"
              ref={codeRef}
              value={code}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                setCode(digits);
                setErrorMessage("");
                // Six digits and there is nothing left to decide, so go.
                if (digits.length === 6) void verify(digits);
              }}
              placeholder="000000"
              aria-label="Six-digit sign-in code"
              className="mt-2 w-full border-b-2 border-ink bg-transparent py-3 font-mono text-2xl tracking-[0.4em] outline-none placeholder:text-faint focus:border-flame"
            />

            <button
              type="submit"
              disabled={status === "verifying" || code.length !== 6}
              className="mt-6 w-full rounded-full bg-flame py-3 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
            >
              {status === "verifying" ? "signing in…" : "sign in"}
            </button>

            {errorMessage && (
              <p className="mt-3 text-sm text-flame">{errorMessage}</p>
            )}
          </form>

          <p className="mt-6 text-xs leading-relaxed text-ink-soft">
            The email also has a sign-in link, which works just as well. If the
            link says it has expired, use the code instead.
          </p>

          <div className="mt-4 flex items-center gap-4 text-sm">
            <button
              type="button"
              onClick={(e) => void sendCode(e)}
              disabled={status === "sending"}
              className="font-medium text-flame transition hover:underline disabled:opacity-50"
            >
              {status === "sending" ? "sending…" : "send a new code"}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep("email");
                setCode("");
                setErrorMessage("");
                setStatus("idle");
              }}
              className="text-faint transition hover:text-flame"
            >
              use a different email
            </button>
          </div>
        </>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
