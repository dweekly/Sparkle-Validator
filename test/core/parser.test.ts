import { describe, it, expect } from "vitest";
import { parseXml } from "../../src/core/parser.js";

describe("parseXml", () => {
  it("parses well-formed XML into a tree", () => {
    const xml = `<?xml version="1.0"?>
<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel>
    <title>Test</title>
  </channel>
</rss>`;
    const { document, diagnostics } = parseXml(xml);
    expect(diagnostics).toHaveLength(0);
    expect(document.root).toBeDefined();
    expect(document.root!.name).toBe("rss");
    expect(document.root!.attributes["version"]?.value).toBe("2.0");
  });

  it("collects namespace declarations", () => {
    const xml = `<rss version="2.0" xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
  <channel><title>T</title><item><sparkle:version>1</sparkle:version><enclosure url="x" length="1" type="t"/></item></channel>
</rss>`;
    const { document } = parseXml(xml);
    expect(document.namespaces["sparkle"]).toBe(
      "http://www.andymatuschak.org/xml-namespaces/sparkle"
    );
  });

  it("tracks line and column positions", () => {
    const xml = `<?xml version="1.0"?>
<root>
  <child>text</child>
</root>`;
    const { document } = parseXml(xml);
    expect(document.root).toBeDefined();
    expect(document.root!.line).toBeGreaterThan(0);
  });

  it("captures text nodes", () => {
    const xml = `<root><child>hello world</child></root>`;
    const { document } = parseXml(xml);
    const child = document.root!.children[0];
    expect(child.type).toBe("element");
    if (child.type === "element") {
      expect(child.children).toHaveLength(1);
      expect(child.children[0].type).toBe("text");
      if (child.children[0].type === "text") {
        expect(child.children[0].text).toBe("hello world");
      }
    }
  });

  it("captures CDATA sections as text", () => {
    const xml = `<root><desc><![CDATA[<h1>HTML</h1>]]></desc></root>`;
    const { document } = parseXml(xml);
    const desc = document.root!.children[0];
    if (desc.type === "element") {
      const text = desc.children[0];
      expect(text.type).toBe("text");
      if (text.type === "text") {
        expect(text.text).toBe("<h1>HTML</h1>");
      }
    }
  });

  it("reports E001 for malformed XML", () => {
    const xml = `<root><unclosed>`;
    const { diagnostics } = parseXml(xml);
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics[0].id).toBe("E001");
    expect(diagnostics[0].severity).toBe("error");
  });

  it("sets parent references", () => {
    const xml = `<root><child><grandchild/></child></root>`;
    const { document } = parseXml(xml);
    const child = document.root!.children[0];
    if (child.type === "element") {
      expect(child.parent).toBe(document.root);
      const grandchild = child.children[0];
      if (grandchild.type === "element") {
        expect(grandchild.parent).toBe(child);
      }
    }
  });

  it("handles namespaced elements", () => {
    const xml = `<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
      <sparkle:version>123</sparkle:version>
    </rss>`;
    const { document } = parseXml(xml);
    const version = document.root!.children[0];
    if (version.type === "element") {
      expect(version.name).toBe("version");
      expect(version.prefix).toBe("sparkle");
      expect(version.namespace).toBe(
        "http://www.andymatuschak.org/xml-namespaces/sparkle"
      );
    }
  });

  it("handles namespaced attributes", () => {
    const xml = `<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle">
      <enclosure sparkle:edSignature="sig123" />
    </rss>`;
    const { document } = parseXml(xml);
    const enc = document.root!.children[0];
    if (enc.type === "element") {
      const sig = enc.attributes["sparkle:edSignature"];
      expect(sig).toBeDefined();
      expect(sig.value).toBe("sig123");
    }
  });
});
