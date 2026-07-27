import { Show, SignInButton, UserButton, useAuth, useOrganization } from "@clerk/react";
import { useLocation, Link } from "react-router";

const routeLabels: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/reviewers": "Reviewers",
  "/reviews": "Reviews",
  "/knowledge": "Knowledge Base",
  "/memory": "Memory",
  "/settings": "Settings",
  "/help": "Help Center",
};

function getBreadcrumb(pathname: string): { label: string; path: string }[] {
  const crumbs: { label: string; path: string }[] = [];

  if (pathname === "/dashboard") {
    crumbs.push({ label: "Dashboard", path: "/dashboard" });
    return crumbs;
  }

  crumbs.push({ label: "Dashboard", path: "/dashboard" });

  const segments = pathname.split("/").filter(Boolean);
  let accumulated = "";
  for (const segment of segments) {
    accumulated += `/${segment}`;
    const label =
      routeLabels[accumulated] ||
      routeLabels[`/${segment}`] ||
      segment.charAt(0).toUpperCase() + segment.slice(1);
    crumbs.push({ label, path: accumulated });
  }

  return crumbs;
}

export function Header() {
  const location = useLocation();
  const crumbs = getBreadcrumb(location.pathname);
  const { organization } = useOrganization();
  const { isSignedIn } = useAuth();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--color-border)] bg-white px-4">
      {/* Left: Logo + app name */}
      <div className="flex items-center gap-2">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--color-brand)]">
          <span className="text-xs font-bold text-white">D</span>
        </div>
        <span className="text-sm font-semibold text-[var(--color-charcoal)]">
          Draftly
        </span>
      </div>

      {/* Center: Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-[var(--color-muted)]">
        {crumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1">
            {i > 0 && <span className="text-[var(--color-faint)]">/</span>}
            {i === crumbs.length - 1 ? (
              <span className="font-medium text-[var(--color-charcoal)]">
                {crumb.label}
              </span>
            ) : (
              <Link to={crumb.path} className="hover:text-[var(--color-charcoal)]">
                {crumb.label}
              </Link>
            )}
          </span>
        ))}
      </nav>

      {/* Right: Org name + actions */}
      <div className="flex items-center gap-3">
        {isSignedIn && (
          <span className="rounded-md bg-[var(--color-brand-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-brand)]">
            {organization?.name || "No Org"}
          </span>
        )}
        <Link
          to="/settings"
          className="rounded-md p-1 text-[var(--color-faint)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-charcoal)]"
          title="Settings"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </Link>
        <Show when="signed-out">
          <SignInButton mode="modal">
            <button className="rounded-md bg-[var(--color-brand)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[var(--color-brand-hover)]">
              Sign In
            </button>
          </SignInButton>
        </Show>
        <Show when="signed-in">
          <UserButton afterSignOutUrl="/" />
        </Show>
      </div>
    </header>
  );
}
