import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve("src");
const files = readdirSync(root).filter((file) => file.endsWith(".tsx"));
const failures = [];
const controls = /<(button|input|select|textarea|label|table|thead|tbody|tr|th|td|details|summary|dialog|article)\b/g;
for (const file of files) {
  const source = readFileSync(resolve(root, file), "utf8");
  const report = (index, message) => failures.push(file + ":" + (source.slice(0, index).split("\n").length) + " " + message);
  for (const match of source.matchAll(controls)) report(match.index, "Use the shared UI component for " + match[1]);
  for (const match of source.matchAll(/<(?:div|section|p)\b[^>]*\brole="(?:dialog|alertdialog|checkbox|radio|combobox)"/g)) report(match.index, "Use the shared interactive primitive");
  for (const match of source.matchAll(/<a\b/g)) {
    if (!/<Button\b[^>]*\basChild\b[^>]*>\s*$/.test(source.slice(Math.max(0, match.index - 500), match.index))) report(match.index, "Compose links with shared Button or NavigationMenuLink");
  }
  for (const match of source.matchAll(/document\.createElement\(["'](?:button|input|select|textarea)["']\)/g)) report(match.index, "Use shared UI in bootstrap feedback");
}
if (failures.length) throw new Error(failures.join("\n"));
console.log("Shared UI audit passed for " + files.length + " React surfaces.");
