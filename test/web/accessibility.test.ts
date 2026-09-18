import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("Web UI accessibility & semantics (R12)", () => {
  const htmlPath = resolve(process.cwd(), "src/web/index.html");
  const html = readFileSync(htmlPath, "utf-8");
  const cssPath = resolve(process.cwd(), "src/web/style.css");
  const css = readFileSync(cssPath, "utf-8");
  const appPath = resolve(process.cwd(), "src/web/app.ts");
  const app = readFileSync(appPath, "utf-8");

  it("index.html contains accessible validation options group with clear labels", () => {
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Validation Options"');
    expect(html).toContain('id="target-sparkle-version-input"');
    expect(html).toContain('id="require-signed-feed-checkbox"');
    expect(html).toContain('for="target-sparkle-version-input"');
  });

  it("index.html has polite live region for results", () => {
    expect(html).toContain('id="results" aria-live="polite"');
  });

  it("app.ts creates native buttons with aria-expanded and aria-controls for result sections", () => {
    // Verifies clickable section headers are native buttons, not divs
    expect(app).toContain('document.createElement("button")');
    expect(app).toContain('button.type = "button"');
    expect(app).toContain('button.setAttribute("aria-expanded"');
    expect(app).toContain('button.setAttribute("aria-controls"');
    expect(app).toContain('body.setAttribute("role", "region")');
    expect(app).toContain('body.setAttribute("hidden", "")');
    expect(app).toContain('body.removeAttribute("hidden")');
  });

  it("app.ts sets predictable focus on results upon completion or error", () => {
    expect(app).toContain("resultsEl.tabIndex = -1;");
    expect(app).toContain("resultsEl.focus();");
  });

  it("style.css defines button resets and visible focus styles for section headers", () => {
    expect(css).toContain(".section-header {");
    expect(css).toContain("border: none;");
    expect(css).toContain(".section-header:focus-visible {");
    expect(css).toContain("outline:");
  });

  it("app.ts extracts validation options and passes them to validator", () => {
    expect(app).toContain("target-sparkle-version-input");
    expect(app).toContain("require-signed-feed-checkbox");
    expect(app).toContain("getValidationOptions(");
    expect(app).toContain("validate(xml, getValidationOptions())");
  });
});
