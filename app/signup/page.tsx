"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: formData.get("email"),
        username: formData.get("username"),
        password: formData.get("password"),
      }),
    });

    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setErrorMessage(data.message ?? "Signup failed.");
      setIsSubmitting(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <section className="w-full max-w-md rounded-[1.75rem] border border-slate-200/80 bg-white/85 p-8 text-slate-900 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">
            ChatApp
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Create account
          </h1>
          <p className="text-sm text-slate-600">
            Sign up and stay logged in for one hour.
          </p>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Email</span>
            <input
              type="email"
              name="email"
              required
              placeholder="you@example.com"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Username</span>
            <input
              type="text"
              name="username"
              required
              placeholder="chatlover"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
          </label>

          <label className="block space-y-2 text-sm font-medium text-slate-700">
            <span>Password</span>
            <input
              type="password"
              name="password"
              required
              placeholder="••••••••"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
            />
          </label>

          {errorMessage ? (
            <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 font-medium text-white shadow-sm transition hover:border-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <div className="mt-6 flex items-center justify-between gap-3 text-sm text-slate-600">
          <Link
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            href="/login"
          >
            Go to login
          </Link>
          <Link
            className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950"
            href="/"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  );
}