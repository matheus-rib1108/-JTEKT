import { describe, expect, it } from "vitest";
import { buildLocationCode, deriveStatusAfterAllocationChange } from "@/server/warehouse/engine";

describe("buildLocationCode", () => {
  it("matches the brief's example format (A-03-R12-N04-P08)", () => {
    expect(buildLocationCode("A", "03", "R12", "N04", "P08")).toBe("A-03-R12-N04-P08");
  });

  it("uppercases every segment", () => {
    expect(buildLocationCode("a", "03", "r12", "n04", "p08")).toBe("A-03-R12-N04-P08");
  });
});

describe("deriveStatusAfterAllocationChange", () => {
  it("flips AVAILABLE to OCCUPIED once something is allocated", () => {
    expect(deriveStatusAfterAllocationChange("AVAILABLE", 10)).toBe("OCCUPIED");
  });

  it("flips OCCUPIED back to AVAILABLE once nothing is allocated", () => {
    expect(deriveStatusAfterAllocationChange("OCCUPIED", 0)).toBe("AVAILABLE");
  });

  it("never touches RESERVED regardless of allocation", () => {
    expect(deriveStatusAfterAllocationChange("RESERVED", 10)).toBe("RESERVED");
    expect(deriveStatusAfterAllocationChange("RESERVED", 0)).toBe("RESERVED");
  });

  it("never touches BLOCKED regardless of allocation", () => {
    expect(deriveStatusAfterAllocationChange("BLOCKED", 10)).toBe("BLOCKED");
    expect(deriveStatusAfterAllocationChange("BLOCKED", 0)).toBe("BLOCKED");
  });
});
