import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const checkout = process.cwd();
const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { encoding: "utf8" }).trim();
const repository = dirname(common);
const guard = join(dirname(repository), "saas-maker/tooling/scripts/fleet-deploy-guard.sh");
if (!existsSync(guard)) throw new Error("The maintained Fleet deployment guard is required. Deploy from the owner workspace.");
execFileSync("bash", [guard, basename(repository), "--checkout", checkout], { stdio: "inherit" });
execFileSync("pnpm", ["release:preflight"], { stdio: "inherit" });
const sha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
execFileSync("pnpm", ["exec", "wrangler", "deploy", "--config", resolve("dist/food/wrangler.json"), "--strict", "--tag", sha], { stdio: "inherit" });
