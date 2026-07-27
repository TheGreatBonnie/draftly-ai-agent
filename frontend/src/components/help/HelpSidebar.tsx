import { NavLink } from "react-router";

const links = [
  { to: "/help", label: "Getting Started", end: true },
  { to: "/help/slack", label: "Slack" },
  { to: "/help/discord", label: "Discord" },
  { to: "/help/github", label: "GitHub" },
  { to: "/help/reviews", label: "Reviews" },
  { to: "/help/knowledge", label: "Knowledge Base" },
];

export function HelpSidebar() {
  return (
    <nav className="w-52 shrink-0 border-r border-border bg-surface">
      <div className="px-4 pt-5 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-faint">
          Help Center
        </span>
      </div>
      <ul className="space-y-0.5 px-2">
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                `block rounded-md px-3 py-1.5 text-sm transition-colors ${
                  isActive
                    ? "bg-brand-light font-medium text-brand"
                    : "text-muted hover:bg-gray-100 hover:text-charcoal"
                }`
              }
            >
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
