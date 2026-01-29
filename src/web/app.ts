import { validate } from "../core/validator.js";
import type { Diagnostic, ValidationResult } from "../core/types.js";

declare const __VERSION__: string;

// Set version in footer
const versionEl = document.getElementById("version");
if (versionEl) versionEl.textContent = __VERSION__;

// --- Tab switching ---

const tabButtons = document.querySelectorAll<HTMLButtonElement>(".tab-btn");
const tabPanels = document.querySelectorAll<HTMLDivElement>(".tab-panel");

tabButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabButtons.forEach((b) => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    tabPanels.forEach((p) => {
      p.classList.remove("active");
      p.setAttribute("hidden", "");
    });

    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const panel = document.getElementById(`panel-${btn.dataset.tab}`);
    if (panel) {
      panel.classList.add("active");
      panel.removeAttribute("hidden");
    }
  });
});

// --- Validate: Paste ---

const xmlInput = document.getElementById("xml-input") as HTMLTextAreaElement;
const btnPaste = document.getElementById(
  "btn-validate-paste"
) as HTMLButtonElement;

btnPaste.addEventListener("click", () => {
  const xml = xmlInput.value.trim();
  if (!xml) return;
  showResults(validate(xml));
});

// --- Validate: Upload ---

const fileInput = document.getElementById("file-input") as HTMLInputElement;
const btnUpload = document.getElementById(
  "btn-validate-upload"
) as HTMLButtonElement;

fileInput.addEventListener("change", () => {
  btnUpload.disabled = !fileInput.files?.length;
});

btnUpload.addEventListener("click", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    const xml = reader.result as string;
    showResults(validate(xml));
  };
  reader.readAsText(file);
});

// --- Validate: URL ---

const urlInput = document.getElementById("url-input") as HTMLInputElement;
const btnUrl = document.getElementById("btn-validate-url") as HTMLButtonElement;

btnUrl.addEventListener("click", async () => {
  const url = urlInput.value.trim();
  if (!url) return;

  btnUrl.disabled = true;
  btnUrl.textContent = "Fetching...";

  try {
    // Use our proxy to avoid CORS issues
    const proxyUrl = `/api/fetch?url=${encodeURIComponent(url)}`;
    const response = await fetch(proxyUrl);
    const data = await response.json();

    if (data.error) {
      showError(data.error);
      return;
    }

    showResults(validate(data.xml));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    showError(`Failed to fetch URL: ${msg}`);
  } finally {
    btnUrl.disabled = false;
    btnUrl.textContent = "Fetch & Validate";
  }
});

// --- Results rendering using safe DOM methods ---

const resultsEl = document.getElementById("results") as HTMLDivElement;

function clearResults(): void {
  while (resultsEl.firstChild) {
    resultsEl.removeChild(resultsEl.firstChild);
  }
}

function el(
  tag: string,
  className?: string,
  textContent?: string
): HTMLElement {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent) element.textContent = textContent;
  return element;
}

function showError(message: string): void {
  clearResults();
  const banner = el("div", "banner invalid", "Error");
  const msg = el("p", undefined, message);
  resultsEl.appendChild(banner);
  resultsEl.appendChild(msg);
}

function showResults(result: ValidationResult): void {
  clearResults();

  const errors = result.diagnostics.filter((d) => d.severity === "error");
  const warnings = result.diagnostics.filter((d) => d.severity === "warning");
  const infos = result.diagnostics.filter((d) => d.severity === "info");

  // Banner
  const banner = el(
    "div",
    result.valid ? "banner valid" : "banner invalid",
    result.valid ? "Valid appcast.xml" : "Invalid appcast.xml"
  );
  resultsEl.appendChild(banner);

  // Summary
  const parts = [];
  parts.push(`${result.errorCount} error${result.errorCount !== 1 ? "s" : ""}`);
  parts.push(
    `${result.warningCount} warning${result.warningCount !== 1 ? "s" : ""}`
  );
  parts.push(`${result.infoCount} info`);
  const summary = el("p", "summary", parts.join(", "));
  resultsEl.appendChild(summary);

  // Sections
  if (errors.length > 0) {
    resultsEl.appendChild(renderSection("Errors", "errors", errors, true));
  }
  if (warnings.length > 0) {
    resultsEl.appendChild(
      renderSection("Warnings", "warnings", warnings, errors.length === 0)
    );
  }
  if (infos.length > 0) {
    resultsEl.appendChild(renderSection("Info", "infos", infos, false));
  }
}

function renderSection(
  title: string,
  cssClass: string,
  diagnostics: Diagnostic[],
  startOpen: boolean
): HTMLElement {
  const section = el("div", "section");

  const header = el(
    "div",
    `section-header ${cssClass}${startOpen ? " open" : ""}`,
    `${title} (${diagnostics.length})`
  );

  const body = el("div", `section-body${startOpen ? " open" : ""}`);

  for (const d of diagnostics) {
    body.appendChild(renderDiagnostic(d));
  }

  header.addEventListener("click", () => {
    header.classList.toggle("open");
    body.classList.toggle("open");
  });

  section.appendChild(header);
  section.appendChild(body);
  return section;
}

function renderDiagnostic(d: Diagnostic): HTMLElement {
  const diag = el("div", `diagnostic ${d.severity}`);

  // Header row with ID and location
  const headerRow = el("div", "diag-header");
  headerRow.appendChild(el("span", "diag-id", d.id));
  if (d.line) {
    const loc = d.column ? `${d.line}:${d.column}` : `${d.line}`;
    headerRow.appendChild(el("span", "diag-location", `line ${loc}`));
  }
  diag.appendChild(headerRow);

  // Message
  diag.appendChild(el("div", "diag-message", d.message));

  // Path
  if (d.path) {
    diag.appendChild(el("div", "diag-path", d.path));
  }

  // Fix suggestion
  if (d.fix) {
    diag.appendChild(el("div", "diag-fix", d.fix));
  }

  return diag;
}
