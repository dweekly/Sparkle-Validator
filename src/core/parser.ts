import { SaxesParser, SaxesAttributeNS } from "saxes";
import type {
  XmlDocument,
  XmlElement,
  XmlText,
  XmlAttribute,
  Diagnostic,
} from "./types.js";

export interface ParseResult {
  document: XmlDocument;
  /** Parse-level diagnostics (E001 for malformed XML) */
  diagnostics: Diagnostic[];
}

/**
 * Parse an XML string into an XmlDocument tree using saxes in namespace-aware
 * strict mode, tracking line/column positions for every node.
 */
export function parseXml(xml: string): ParseResult {
  const diagnostics: Diagnostic[] = [];
  const namespaces: Record<string, string> = {};
  let root: XmlElement | undefined;
  const stack: XmlElement[] = [];

  const parser = new SaxesParser({ xmlns: true, position: true });

  parser.on("error", (err) => {
    diagnostics.push({
      id: "E001",
      severity: "error",
      message: `Not well-formed XML: ${err.message}`,
      line: parser.line,
      column: parser.column,
    });
    // Resume parsing to collect as many diagnostics as possible
    // @ts-expect-error -- resume to continue collecting errors
    parser.resume?.();
  });

  parser.on("opentagstart", (_node) => {
    // Collect namespace declarations from the opening tag
    // (they'll be available after the full tag is parsed)
  });

  parser.on("opentag", (node) => {
    // Collect namespace declarations
    if (node.ns) {
      for (const [prefix, uri] of Object.entries(node.ns)) {
        if (uri) {
          namespaces[prefix] = uri;
        }
      }
    }

    const attributes: Record<string, XmlAttribute> = {};
    for (const [qname, attr] of Object.entries(node.attributes)) {
      const saxAttr = attr as SaxesAttributeNS;
      attributes[qname] = {
        name: saxAttr.local,
        qname,
        namespace: saxAttr.uri,
        prefix: saxAttr.prefix,
        value: saxAttr.value,
      };
    }

    const element: XmlElement = {
      type: "element",
      name: node.local,
      qname: node.name,
      namespace: node.uri,
      prefix: node.prefix,
      attributes,
      children: [],
      line: parser.line,
      column: parser.column,
      parent: stack.length > 0 ? stack[stack.length - 1] : undefined,
    };

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(element);
    } else {
      root = element;
    }

    stack.push(element);
  });

  parser.on("closetag", () => {
    stack.pop();
  });

  parser.on("text", (text) => {
    // Only capture non-whitespace-only text or text inside elements
    if (stack.length > 0 && text.trim().length > 0) {
      const textNode: XmlText = {
        type: "text",
        text,
        line: parser.line,
        column: parser.column,
      };
      stack[stack.length - 1].children.push(textNode);
    }
  });

  parser.on("cdata", (cdata) => {
    if (stack.length > 0) {
      const textNode: XmlText = {
        type: "text",
        text: cdata,
        line: parser.line,
        column: parser.column,
      };
      stack[stack.length - 1].children.push(textNode);
    }
  });

  // Write the XML string to the parser
  parser.write(xml);
  parser.close();

  return {
    document: { root, namespaces },
    diagnostics,
  };
}
