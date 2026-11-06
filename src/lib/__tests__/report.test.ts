import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fillReport } from "@/lib/report";
import { renderMarkdown } from "@/lib/markdown";

const md = fs.readFileSync(path.join(__dirname, "../../../report/report.md"), "utf8");
describe("report", () => {
  it("every placeholder resolves", () => expect(fillReport(md)).not.toMatch(/\{\{/));
  it("unknown placeholders fail", () => expect(() => fillReport("{{nope}}")).toThrow());
  it("renders a table of contents", () => expect(renderMarkdown(fillReport(md)).toc.length).toBeGreaterThan(6));
});
