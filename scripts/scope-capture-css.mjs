import { transform } from "lightningcss";

export function scopeCaptureCss(source) {
  const scope = { type: "pseudo-class", kind: "where", selectors: [[{ type: "type", name: "studio-footer" }]] };
  const isDocumentRoot = (part) => (part?.type === "pseudo-class" && ["root", "host"].includes(part.kind))
    || (part?.type === "type" && ["html", "body", "studio-footer"].includes(part.name))
    || (part?.type === "pseudo-class" && ["where", "is"].includes(part.kind)
      && part.selectors.every((selector) => selector.length === 1 && isDocumentRoot(selector[0])));
  const scoped = transform({
    filename: "food-capture-footer.css",
    code: Buffer.from(source),
    minify: true,
    visitor: {
      Selector(selector) {
        if (selector.some((part) => part.type === "nesting")) return selector;
        return isDocumentRoot(selector[0])
          ? [scope, ...selector.slice(1)]
          : [scope, { type: "combinator", value: "descendant" }, ...selector];
      },
    },
  });
  return Buffer.from(scoped.code).toString();
}
