"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState("");

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");

    const supabase = createClient();
    const next = searchParams.get("next") ?? "/dashboard";
    const idea = searchParams.get("idea");
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
    } else {
      setStatus("sent");
    }
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
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        No password. Enter your email and we&apos;ll send you a sign-in link.
      </p>

      {status === "sent" ? (
        <div className="mt-10 border-l-2 border-flame pl-4">
          <p className="font-medium">Check your email</p>
          <p className="mt-1 text-sm text-ink-soft">
            A sign-in link is on its way to {email}. It may take a minute.
            Check your spam folder if it does not show up.
          </p>
          <button
            type="button"
            onClick={() => setStatus("idle")}
            className="mt-4 text-sm font-medium text-flame transition hover:underline"
          >
            use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-10">
          <div className="flex items-center gap-3 border-b-2 border-ink py-3 focus-within:border-flame">
            <input
              type="email"
              required
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
              {status === "sending" ? "sending…" : "send link →"}
            </button>
          </div>
          {status === "error" && (
            <p className="mt-3 text-sm text-flame">{errorMessage}</p>
          )}
        </form>
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
