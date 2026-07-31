import { NavLink } from "react-router";
import { Show, UserButton, useAuth, useOrganization } from "@clerk/react";

const links = [
  { to: "/dashboard", label: "Command Center", icon: "terminal" },
  { to: "/reviews", label: "Drafts", icon: "edit_note" },
  { to: "/reviewers", label: "Reviewers", icon: "group" },
  { to: "/knowledge", label: "Documentation", icon: "auto_stories" },
  { to: "/memory", label: "Memory", icon: "database" },
  { to: "/improvements", label: "Improvements", icon: "trending_up" },
  { to: "/settings", label: "Integrations", icon: "hub" },
];

const bottomLinks = [
  { to: "/settings", label: "Settings", icon: "settings" },
  { to: "/help", label: "Support", icon: "help" },
];

export function Sidebar() {
  const { organization } = useOrganization();
  const { isSignedIn } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-screen flex flex-col z-40 bg-surface-container-low border-r border-outline-variant w-64">
      {/* Logo */}
      <div className="flex flex-col gap-1 px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shadow-[0_0_12px_rgba(192,193,255,0.3)]">
            <span className="material-symbols-outlined text-on-primary-container text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>terminal</span>
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-black text-on-surface tracking-tighter leading-none" style={{ fontFamily: "Inter" }}>DRAFTLY</span>
            <span className="text-[11px] font-mono text-secondary flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary pulse-ring inline-block"></span>
              STATUS: WATCHING
            </span>
          </div>
        </div>
      </div>

      {/* New Draft Button */}
      <div className="px-4 mb-5">
        <button className="w-full py-2.5 px-4 bg-primary text-on-primary-container rounded-lg font-bold flex items-center justify-center gap-2 hover:glow-primary transition-all active:scale-[0.97] shadow-[0_0_8px_rgba(192,193,255,0.25)]">
          <span className="material-symbols-outlined text-[20px]">add</span>
          New Draft
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 px-3 flex-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/dashboard"}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3.5 py-2.5 rounded-lg transition-all duration-200 text-sm ${
                isActive
                  ? "bg-primary-container text-on-primary-container font-semibold"
                  : "text-on-surface-variant hover:bg-surface-container"
              }`
            }
          >
            <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Bottom */}
      <div className="mt-auto border-t border-outline-variant pt-3 pb-5 px-3 flex flex-col gap-0.5">
        <Show when="signed-in">
          <div className="flex items-center gap-3 px-3.5 py-2 mb-2">
            <UserButton />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-on-surface">
                {organization?.name || "Draftly"}
              </p>
              <p className="truncate text-xs font-mono text-on-surface-variant/60">
                {isSignedIn ? "Signed in" : "Guest"}
              </p>
            </div>
          </div>
        </Show>
        {bottomLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className="flex items-center gap-3 px-3.5 py-2 text-on-surface-variant hover:bg-surface-container rounded-lg transition-all duration-200 text-sm"
          >
            <span className="material-symbols-outlined text-[20px]">{link.icon}</span>
            <span>{link.label}</span>
          </NavLink>
        ))}
      </div>
    </aside>
  );
}
