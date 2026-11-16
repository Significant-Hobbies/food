import { describe, expect, it } from "vitest";
import { scopeCaptureCss } from "../scripts/scope-capture-css.mjs";
import { readFileSync } from "node:fs";
import { transform } from "lightningcss";

describe("optional capture stylesheet isolation", () => {
  it("retargets document defaults to the footer and scopes utility selectors inside media rules", () => {
    const css = scopeCaptureCss(":root,:host,html,body{--example:1} .flex{display:flex}@media(min-width:600px){.wide{display:grid}} ");
    expect(css).not.toMatch(/:root|:host/);
    expect(css).toContain(":where(studio-footer){--example:1}");
    expect(css).toContain(":where(studio-footer) .flex{display:flex}");
    expect(css).toContain(":where(studio-footer) .wide{display:grid}");
  });

  it("preserves animation keyframes and declarations", () => {
    const css = scopeCaptureCss("@keyframes reveal{from{opacity:0}to{opacity:1}} .motion{animation:reveal 1s}");
    expect(css).toContain("@keyframes reveal");
    expect(css).toContain("0%{opacity:0}");
    expect(css).toContain(":where(studio-footer) .motion{animation:1s reveal}");
  });

  it("keeps nested state selectors under their already scoped parent", () => {
    const css = scopeCaptureCss(".item{&:hover{color:red}}");
    expect(css).toContain(":where(studio-footer) .item");
    expect(css).not.toContain(":where(studio-footer) &");
    expect(css).toContain("&:hover");
  });

  it("scopes every style rule in the actual installed footer artifact", () => {
    const css = scopeCaptureCss(readFileSync("node_modules/@saas-maker/ui/footer.css", "utf8"));
    const selectors: string[] = [];
    transform({ filename: "scoped-footer.css", code: Buffer.from(css), visitor: { Rule: { style(rule) {
      for (const selector of rule.value.selectors) selectors.push(JSON.stringify(selector[0]));
    } } } });
    expect(selectors.length).toBeGreaterThan(200);
    expect(css).not.toMatch(/:root|:host/);
    expect(css).toMatch(/:where\(studio-footer\)\{[^}]*--radius:/);
    for (const selector of selectors) expect(JSON.parse(selector)).toEqual({ type: "pseudo-class", kind: "where", selectors: [[{ type: "type", name: "studio-footer" }]] });
  });
});
