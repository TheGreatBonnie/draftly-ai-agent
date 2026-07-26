import gettingStarted from "../docs/getting-started.md?raw";
import { HelpArticle } from "../components/help/HelpArticle";

export function Help() {
  return <HelpArticle content={gettingStarted} />;
}
