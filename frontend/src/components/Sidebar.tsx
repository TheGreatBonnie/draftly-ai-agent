import { NavLink } from "react-router";
import { useOrganization } from "@clerk/react";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/docs", label: "Documentation" },
  { to: "/knowledge", label: "Knowledge Base" },
  { to: "/memory", label: "Memory" },
  { to: "/settings", label: "Settings" },
  { to: "/help", label: "Help Center" },
];

const reviewerLinks = [{ to: "/reviewers", label: "Reviewers" }];

export function Sidebar() {
  const { membership } = useOrganization();
  const role = membership?.role;
  const showReviewers = role === "org:admin" || role === "org:reviewer";

  const links = [...baseLinks, ...(showReviewers ? reviewerLinks : [])];

  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/dashboard"}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--color-brand-light)] text-[var(--color-brand)]"
                  : "text-[var(--color-muted)] hover:bg-[var(--color-surface-alt)] hover:text-[var(--color-charcoal)]"
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
