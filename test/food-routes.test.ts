import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isLocalOperatorRoute } from "../src/operator-route";

describe("Food operator and publication boundaries", () => {
  it("retains the local workbench without mounting it on public or deceptive hosts", () => {
    for (const hostname of ["localhost", "127.0.0.1", "::1"]) {
      expect(isLocalOperatorRoute({ hostname, pathname: "/operator" })).toBe(true);
      expect(isLocalOperatorRoute({ hostname, pathname: "/" })).toBe(false);
    }
    for (const hostname of ["[::1]", "food.significanthobbies.com", "localhost.example.com", "127.0.0.1.example.com"]) {
      expect(isLocalOperatorRoute({ hostname, pathname: "/operator/reviews" })).toBe(false);
    }
    expect(isLocalOperatorRoute({ hostname: "localhost", pathname: "/operators" })).toBe(false);
  });
  it("verifies the same live Food target that each publication workflow writes", async () => {
    for (const name of ["publish-automatic-evidence", "publish-machine-evidence", "publish-official-brand-discoveries"]) {
      const workflow = await readFile(`.github/workflows/${name}.yml`, "utf8");
      expect(workflow).toContain("LIVE_BASE_URL: https://food.significanthobbies.com");
      expect(workflow).not.toContain("https://protein.significanthobbies.com");
    }
  });
});
