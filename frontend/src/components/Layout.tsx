import { Outlet } from "react-router";
import { AuthTokenSetter } from "./AuthTokenSetter";
import { Sidebar } from "./Sidebar";

export function Layout() {
  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F4F7FB" }}>
      <AuthTokenSetter />

      {/* Background orbs */}
      <div
        className="bg-orb"
        style={{
          width: 600,
          height: 600,
          background: "#4ECDC4",
          top: -100,
          left: -100,
        }}
      />
      <div
        className="bg-orb"
        style={{
          width: 700,
          height: 700,
          background: "#FF6B6B",
          bottom: -200,
          right: -100,
        }}
      />

      <Sidebar />
      <main className="flex-1 overflow-y-auto p-8">
        <Outlet />
      </main>
    </div>
  );
}
