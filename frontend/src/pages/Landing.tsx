import { OrganizationList, Show } from "@clerk/react";
import { Link } from "react-router";

export function Landing() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <span className="text-xl font-bold">Draftly</span>
        <Show when="signed-out">
          <Link
            to="/sign-in"
            className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium hover:bg-gray-200"
          >
            Sign In
          </Link>
        </Show>
        <Show when="signed-in">
          <Link
            to="/dashboard"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Dashboard
          </Link>
        </Show>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <Show when="signed-in">
          <OrganizationList
            afterSelectOrganizationUrl="/dashboard"
            afterCreateOrganizationUrl="/dashboard"
          />
        </Show>
        <Show when="signed-out">
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
        </Show>
      </main>
    </div>
  );
}
