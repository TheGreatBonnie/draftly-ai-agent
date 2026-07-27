import { useEffect, useMemo, useState } from "react";

interface TOCItem {
  id: string;
  text: string;
}

interface DocTOCProps {
  content: string;
}

function extractHeadings(markdown: string): TOCItem[] {
  const headings: TOCItem[] = [];
  const regex = /^## (.+)$/gm;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    const text = match[1];
    const id = text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    headings.push({ id, text });
  }
  return headings;
}

export function DocTOC({ content }: DocTOCProps) {
  const [activeId, setActiveId] = useState<string>("");
  const headings = useMemo(() => extractHeadings(content), [content]);

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px" },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  const handleClick = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
      setActiveId(id);
    }
  };

  return (
    <div className="mb-6">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-faint)]">
        On this page
      </div>
      <nav className="flex flex-col gap-1.5">
        {headings.map((heading) => {
          const isActive = heading.id === activeId;
          return (
            <button
              key={heading.id}
              onClick={() => handleClick(heading.id)}
              className={`text-left text-xs transition-colors ${
                isActive
                  ? "border-l-2 border-[var(--color-brand)] pl-2 text-[var(--color-brand)]"
                  : "pl-2 text-[var(--color-muted)] hover:text-[var(--color-charcoal)]"
              }`}
            >
              {heading.text}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
