const features = [
  {
    icon: "🔗",
    iconBg: "bg-brand-light",
    title: "Multi-Platform Ingest",
    description:
      "Slack, Discord, GitHub, or CLI — every conversation becomes a documentation source.",
  },
  {
    icon: "🤖",
    iconBg: "bg-sage-light",
    title: "AI Research Pipeline",
    description:
      "8-stage LangGraph workflow with rubric-based grading. Docs generated and iterated automatically.",
  },
  {
    icon: "✋",
    iconBg: "bg-sand-light",
    title: "Human-in-the-Loop",
    description:
      "Review, approve, or request changes before anything publishes. Slack and email notifications.",
  },
  {
    icon: "🧠",
    iconBg: "bg-blue-50",
    title: "Semantic Memory",
    description:
      "3072-dimension vector embeddings. Your docs get smarter over time with episodic and organizational memory.",
  },
  {
    icon: "📊",
    iconBg: "bg-purple-50",
    title: "Confidence Scoring",
    description:
      "Every document gets a confidence score. Know exactly what's ready to publish and what needs attention.",
  },
  {
    icon: "🔄",
    iconBg: "bg-pink-50",
    title: "Versioned Docs",
    description:
      "Track document history. See what changed, when, and why. Roll back to any version.",
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="bg-white px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <div className="mb-10 text-center">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[1.5px] text-brand">
            Features
          </span>
          <h2 className="mb-1.5 text-[26px] font-bold text-charcoal">
            Everything you need to ship docs
          </h2>
          <p className="text-sm text-muted">
            From support thread to published documentation in under 5 minutes.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-[11px] border border-border bg-surface p-5"
            >
              <div
                className={`mb-3.5 flex h-9 w-9 items-center justify-center rounded-[9px] text-base ${f.iconBg}`}
              >
                {f.icon}
              </div>
              <h3 className="mb-1 text-sm font-semibold text-charcoal">
                {f.title}
              </h3>
              <p className="text-xs leading-relaxed text-muted">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
