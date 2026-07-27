import { AccordionItem } from "../AccordionItem";

const faqs = [
  {
    question: "How does Draftly generate documentation?",
    answer:
      "Draftly monitors your support channels for new conversations, then runs them through an 8-stage AI pipeline that researches, drafts, and evaluates documentation using rubric-based grading. Each document goes through iterative refinement until it meets quality thresholds.",
  },
  {
    question: "What platforms does Draftly support?",
    answer:
      "Draftly integrates with Slack, Discord, GitHub (via GitHub App webhooks), and CLI. You can ingest conversations from any of these platforms and publish documentation back to them.",
  },
  {
    question: "Do I need to approve every document?",
    answer:
      "By default, yes — Draftly uses a human-in-the-loop workflow where documents are queued for review before publishing. You can approve, request changes, or reject each document via Slack, email, or the dashboard.",
  },
  {
    question: "Can I customize the documentation templates?",
    answer:
      "Draftly generates documentation based on your existing knowledge base and the content of support conversations. You can influence output by curating your knowledge base documents and configuring research skills for different topic types.",
  },
  {
    question: "Is my data secure?",
    answer:
      "Draftly runs on CockroachDB with multi-tenant isolation per organization. All data is scoped to your org, and authentication is handled via Clerk with JWT verification. Documents are only published when you explicitly approve them.",
  },
];

export function LandingFAQ() {
  return (
    <section id="faq" className="bg-white px-6 py-20">
      <div className="mx-auto max-w-[600px]">
        <div className="mb-10 text-center">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-[1.5px] text-brand">
            FAQ
          </span>
          <h2 className="text-[26px] font-bold text-charcoal">
            Frequently asked questions
          </h2>
        </div>

        <div className="border-t border-border">
          {faqs.map((faq) => (
            <AccordionItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
