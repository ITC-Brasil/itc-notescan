import { describe, expect, it } from "vitest";
import { isHumanRole } from "@/lib/auth/roles";

describe("isHumanRole", () => {
  it.each(["USER", "ADMIN", "MASTER"])("aceita %s", (role) => {
    expect(isHumanRole(role)).toBe(true);
  });

  it.each(["AGENTE", "user", "", null, undefined, 1, {}])("recusa %s", (role) => {
    expect(isHumanRole(role)).toBe(false);
  });
});
