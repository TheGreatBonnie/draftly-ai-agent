import { Show } from "@clerk/react";
import { Link } from "react-router";

export function LandingNav() {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand">
            <span className="text-sm font-bold text-white">D</span>
          </div>
          <span className="text-lg font-bold text-charcoal">Draftly</span>
        </Link>

        <nav className="flex items-center gap-6">
          <a
            href="#features"
            className="text-sm text-muted transition-colors hover:text-charcoal"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-sm text-muted transition-colors hover:text-charcoal"
          >
            How It Works
          </a>
          <a
            href="#faq"
            className="text-sm text-muted transition-colors hover:text-charcoal"
          >
            FAQ
          </a>

          <Show when="signed-out">
            <Link
              to="/sign-in"
              className="text-sm text-muted transition-colors hover:text-charcoal"
            >
              Sign In
            </Link>
            <Link
              to="/sign-up"
              className="rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-charcoal-light"
            >
              Get Started
            </Link>
          </Show>

          <Show when="signed-in">
            <Link
              to="/dashboard"
              className="rounded-lg bg-charcoal px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-charcoal-light"
            >
              Dashboard
            </Link>
          </Show>
        </nav>
      </div>
    </header>
  );
}
