import { Outlet } from "react-router";
import { LandingNav } from "../landing/LandingNav";
import { HelpSidebar } from "./HelpSidebar";

export function HelpLayout() {
  return (
    <div className="flex h-screen flex-col">
      <LandingNav />
      <div className="flex min-h-0 flex-1">
        <HelpSidebar />
        <main className="flex-1 overflow-y-auto bg-white p-8">
          <div className="mx-auto max-w-3xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
