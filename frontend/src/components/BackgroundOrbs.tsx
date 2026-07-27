export function BackgroundOrbs() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {/* Sage orb - top left */}
      <div
        className="absolute -left-32 -top-32 h-[500px] w-[500px] rounded-full opacity-[0.08]"
        style={{
          background: "var(--color-sage)",
          filter: "blur(100px)",
          animation: "float 20s infinite alternate ease-in-out",
        }}
      />
      {/* Brand orb - bottom right */}
      <div
        className="absolute -bottom-40 -right-32 h-[600px] w-[600px] rounded-full opacity-[0.06]"
        style={{
          background: "var(--color-brand)",
          filter: "blur(100px)",
          animation: "float 20s infinite alternate ease-in-out",
          animationDelay: "-10s",
        }}
      />
    </div>
  );
}
