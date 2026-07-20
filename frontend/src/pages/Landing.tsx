import { Link } from "react-router";

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">Draftly</span>
        <Link
          to="/sign-in"
          className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200"
        >
          Sign In
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="mb-4 text-5xl font-bold tracking-tight">
          Ship better code with AI-powered reviews
        </h1>
        <p className="mb-8 max-w-xl text-lg text-gray-600">
          Draftly integrates with GitHub to automate code review workflows,
          catch issues before they ship, and help your team move faster.
        </p>
        <Link
          to="/sign-up"
          className="rounded-md bg-blue-600 px-6 py-3 text-base font-medium text-white hover:bg-blue-700"
        >
          Get Started
        </Link>
      </main>
    </div>
  );
}
