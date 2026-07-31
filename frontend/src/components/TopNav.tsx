import { Show, UserButton } from "@clerk/react";

export function TopNav() {

  return (
    <header className="flex items-center justify-between w-full px-8 h-16 z-50 bg-background/80 backdrop-blur-md border-b border-outline-variant shrink-0">
      <div className="flex items-center gap-10">
        <span className="text-xl font-bold text-primary tracking-tighter" style={{ fontFamily: "Inter" }}>Draftly</span>
        <nav className="hidden md:flex items-center gap-6">
          <a className="text-sm text-primary border-b-2 border-primary pb-1 font-body-md" href="/dashboard">Dashboard</a>
          <a className="text-sm text-on-surface-variant hover:text-primary transition-colors font-body-md" href="/reviews">Editor</a>
          <a className="text-sm text-on-surface-variant hover:text-primary transition-colors font-body-md" href="/settings">Settings</a>
          <a className="text-sm text-on-surface-variant hover:text-primary transition-colors font-body-md" href="/knowledge">Portal</a>
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <button className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-variant rounded-lg transition-all active:scale-90">
          <span className="material-symbols-outlined text-[22px]">search</span>
        </button>
        <button className="w-9 h-9 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-variant rounded-lg transition-all active:scale-90 relative">
          <span className="material-symbols-outlined text-[22px]">notifications</span>
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-error rounded-full ring-2 ring-background"></span>
        </button>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
