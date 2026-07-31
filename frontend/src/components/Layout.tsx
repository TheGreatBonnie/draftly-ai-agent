import { Outlet } from "react-router";
import { AuthTokenSetter } from "./AuthTokenSetter";
import { Sidebar } from "./Sidebar";
import { TopNav } from "./TopNav";

export function Layout() {
  return (
    <div className="flex h-screen bg-surface relative">
      <div className="fixed inset-0 grid-bg opacity-40 z-0" />
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="scanline" />
      </div>
      <AuthTokenSetter />
      <Sidebar />
      <div className="flex flex-1 flex-col ml-64 relative z-10">
        <TopNav />
        <main className="flex-1 overflow-y-auto p-8 scrollbar-thin">
          <div className="max-w-[1600px] mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
