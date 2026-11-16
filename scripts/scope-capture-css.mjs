import { transform } from "lightningcss";

export function scopeCaptureCss(source) {
  const scope = { type: "pseudo-class", kind: "where", selectors: [[{ type: "type", name: "studio-footer" }]] };
  const scoped = transform({
    filename: "food-capture-footer.css",
    code: Buffer.from(source),
    minify: true,
    visitor: {
      Selector(selector) {
        if (selector.some((part) => part.type === "nesting")) return selector;
        const first = selector[0];
        const root = first?.type === "pseudo-class" && ["root", "host"].includes(first.kind);
        const element = first?.type === "type" && ["html", "body", "studio-footer"].includes(first.name);
        return root || element
          ? [scope, ...selector.slice(1)]
          : [scope, { type: "combinator", value: "descendant" }, ...selector];
      },
    },
  });
  return Buffer.from(scoped.code).toString();
}
