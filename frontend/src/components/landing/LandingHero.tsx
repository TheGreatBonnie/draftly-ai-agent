import { Show } from "@clerk/react";
import { Link } from "react-router";

export function LandingHero() {
  return (
    <section className="bg-gradient-to-b from-surface to-surface-alt px-6 py-20 text-center">
      <div className="mx-auto max-w-3xl">
        <span className="mb-5 inline-block rounded-full bg-brand-light px-3.5 py-1 text-xs font-semibold tracking-wide text-brand uppercase">
          Autonomous Documentation
        </span>

        <h1 className="mb-4 text-[42px] font-bold leading-[1.15] tracking-tight text-charcoal">
          Turn conversations into
          <br />
          documentation — automatically
        </h1>

        <p className="mx-auto mb-7 max-w-lg text-[15px] leading-relaxed text-muted">
          Draftly watches your Slack threads, Discord channels, and GitHub
          issues — then generates, reviews, and publishes docs without the
          busywork.
        </p>

        <div className="mb-6 flex items-center justify-center gap-3">
          <Show when="signed-out">
            <Link
              to="/sign-up"
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Start Free →
            </Link>
            <a
              href="#how-it-works"
              className="rounded-lg border border-border-light bg-white px-6 py-2.5 text-sm font-medium text-charcoal transition-colors hover:bg-surface"
            >
              See How It Works
            </a>
          </Show>

          <Show when="signed-in">
            <Link
              to="/dashboard"
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Go to Dashboard →
            </Link>
          </Show>
        </div>

        <div className="flex items-center justify-center gap-6 text-xs text-faint">
          <span>No credit card required</span>
          <span>•</span>
          <span>Free tier</span>
          <span>•</span>
          <span>2-min setup</span>
        </div>

        <Show when="signed-out">
          <p className="mt-5 text-sm text-muted">
            Already have an account?{" "}
            <Link
              to="/sign-in"
              className="font-medium text-charcoal underline underline-offset-2 transition-colors hover:text-brand"
            >
              Sign In
            </Link>
          </p>
        </Show>
      </div>
    </section>
  );
}
