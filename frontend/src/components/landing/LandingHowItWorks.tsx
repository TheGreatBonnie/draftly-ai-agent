const steps = [
  {
    number: "1",
    bg: "bg-brand-light",
    color: "text-brand",
    title: "Connect Your Channels",
    description:
      "Link Slack, Discord, and GitHub. Draftly starts listening for support conversations automatically.",
  },
  {
    number: "2",
    bg: "bg-sage-light",
    color: "text-sage",
    title: "AI Generates Docs",
    description:
      "When a thread is flagged, Draftly researches, drafts, and evaluates documentation through an 8-stage pipeline.",
  },
  {
    number: "3",
    bg: "bg-sand-light",
    color: "text-sand",
    title: "Review & Publish",
    description:
      "Approve, revise, or reject via Slack, email, or the dashboard. Approved docs publish back to your tools.",
  },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="bg-surface px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[1.5px] text-brand">
            How It Works
          </span>
          <h2 className="mb-1.5 text-[26px] font-bold text-charcoal">
            Three steps to better docs
          </h2>
          <p className="text-sm text-muted">
            Connect your tools, let Draftly work, review and publish.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.number} className="text-center">
              <div
                className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-xl font-bold ${s.bg} ${s.color}`}
              >
                {s.number}
              </div>
              <h3 className="mb-1.5 text-[15px] font-semibold text-charcoal">
                {s.title}
              </h3>
              <p className="mx-auto max-w-[260px] text-[13px] leading-relaxed text-muted">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
