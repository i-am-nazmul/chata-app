import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12 text-center">
      <div className="max-w-xl space-y-7">
        <p className="text-xs font-semibold uppercase tracking-[0.45em] text-slate-500">
          ChatApp
        </p>
        <h1 className="text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl">
          Welcome to Chat App
        </h1>
        <p className="mx-auto max-w-md text-sm leading-7 text-slate-600 sm:text-base">
          A simple place to sign in, create an account, and continue into your
          chat space.
        </p>
        <div className="grid w-full max-w-sm grid-cols-1 gap-3 text-sm font-medium sm:grid-cols-2">
          <Link
            href="/login"
            className="inline-flex w-full items-center justify-center rounded-full bg-slate-950 px-5 py-3 text-white transition hover:bg-slate-800"
          >
            Login
          </Link>
          <Link
            href="/signup"
            className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
          >
            Signup
          </Link>
        </div>
      </div>
    </main>
  );
}