import { NavLink } from "react-router";
import { useOrganization } from "@clerk/react";

const baseLinks = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/docs", label: "Documentation" },
  { to: "/knowledge", label: "Knowledge Base" },
  { to: "/memory", label: "Memory" },
  { to: "/settings", label: "Settings" },
];

const reviewerLinks = [{ to: "/reviewers", label: "Reviewers" }];

export function Sidebar() {
  const { membership } = useOrganization();
  const role = membership?.role;
  const showReviewers = role === "org:admin" || role === "org:reviewer";

  const links = [...baseLinks, ...(showReviewers ? reviewerLinks : [])];

  return (
    <aside className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 p-4">
      <nav className="flex flex-col gap-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.to === "/dashboard"}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-100 text-blue-700"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
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
