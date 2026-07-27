import { NavLink } from "react-router";
import {
  Show,
  SignInButton,
  UserButton,
  useAuth,
  useOrganization,
} from "@clerk/react";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/reviews", label: "Reviews", icon: "description" },
  { to: "/knowledge", label: "Knowledge Base", icon: "library_books" },
  { to: "/memory", label: "Memory", icon: "memory" },
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/help", label: "Help Center", icon: "help_center" },
];

const reviewerLinks = [
  { to: "/reviewers", label: "Reviewers", icon: "rate_review" },
];

export function Sidebar() {
  const { membership, organization } = useOrganization();
  const { isSignedIn } = useAuth();
  const role = membership?.role;
  const showReviewers = role === "org:admin" || role === "org:reviewer";

  const links = [...baseLinks, ...(showReviewers ? reviewerLinks : [])];

  return (
    <aside className="glass-panel flex h-screen w-[280px] shrink-0 flex-col justify-between border-r border-white/80 px-4 py-6 z-20">
      <div>
        {/* Logo area */}
        <div className="mb-10 flex items-center gap-3 px-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brand)] to-[var(--color-mint)] text-white shadow-lg">
            <span
              className="material-symbols-outlined text-2xl font-bold"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--color-charcoal)]">
              Draftly
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
              AI Documentation
            </p>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex flex-col gap-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/dashboard"}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                  isActive
                    ? "border border-white/80 bg-white/60 text-[var(--color-brand)] shadow-sm"
                    : "text-[var(--color-muted)] hover:bg-white/40 hover:text-[var(--color-charcoal)]"
                }`
              }
            >
              <span className="material-symbols-outlined text-[20px]">
                {link.icon}
              </span>
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Bottom: User Profile */}
      <div className="mt-4 border-t border-white/40 pt-4">
        <Show when="signed-in">
          <div className="flex items-center gap-3 px-2">
            <UserButton />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--color-charcoal)]">
                {organization?.name || "Draftly"}
              </p>
              <p className="truncate text-xs text-[var(--color-muted)]">
                {isSignedIn ? "Signed in" : "Guest"}
              </p>
            </div>
          </div>
        </Show>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="w-full rounded-xl bg-[var(--color-brand)] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[var(--color-brand-hover)]">
              Sign In
            </button>
          </SignInButton>
        </Show>
      </div>
    </aside>
  );
}
