import fs from "node:fs";
import path from "node:path";
import { fillReport } from "@/lib/report";
import { renderMarkdown } from "@/lib/markdown";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-static";

export default function ReportPage() {
  const md = fs.readFileSync(path.join(process.cwd(), "report", "report.md"), "utf8");
  const { html, toc } = renderMarkdown(fillReport(md));
  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
      <aside className="no-print lg:sticky lg:top-4 self-start text-sm">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted">Sommaire</div>
        <ol className="space-y-1">{toc.map((t) => <li key={t.id}><a className="text-muted hover:text-accent" href={`#${t.id}`}>{t.text}</a></li>)}</ol>
        <div className="mt-4"><PrintButton /></div>
      </aside>
      <article className="prose-report rounded-lg border border-line bg-panel p-5 sm:p-8 min-w-0" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
