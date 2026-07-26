import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface HelpArticleProps {
  content: string;
}

export function HelpArticle({ content }: HelpArticleProps) {
  return (
    <article className="prose">
      <Markdown remarkPlugins={[remarkGfm]}>{content}</Markdown>
    </article>
  );
}
