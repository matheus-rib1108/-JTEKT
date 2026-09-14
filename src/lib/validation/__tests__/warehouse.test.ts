import { describe, expect, it } from "vitest";
import { nonStandardSchema, warehouseSchema, bulkGenerateSchema, allocationSchema } from "@/lib/validation/warehouse";

describe("nonStandardSchema", () => {
  it("parses the form string 'false' as boolean false (regression: z.coerce.boolean() would make this true)", () => {
    const result = nonStandardSchema.safeParse({ storageLocationId: "loc1", isNonStandard: "false" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isNonStandard).toBe(false);
  });

  it("parses the form string 'true' as boolean true", () => {
    const result = nonStandardSchema.safeParse({ storageLocationId: "loc1", isNonStandard: "true" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isNonStandard).toBe(true);
  });

  it("rejects any value other than the literal strings 'true'/'false'", () => {
    const result = nonStandardSchema.safeParse({ storageLocationId: "loc1", isNonStandard: "yes" });
    expect(result.success).toBe(false);
  });
});

describe("warehouseSchema", () => {
  it("uppercases the warehouse code", () => {
    const result = warehouseSchema.safeParse({ code: "a", name: "Galpão A" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.code).toBe("A");
  });
});

describe("bulkGenerateSchema", () => {
  it("accepts a reasonable level/position count", () => {
    const result = bulkGenerateSchema.safeParse({
      warehouseId: "w1",
      corridor: "03",
      rack: "R12",
      levelCount: "4",
      positionsPerLevel: "8",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a count above the sanity limit", () => {
    const result = bulkGenerateSchema.safeParse({
      warehouseId: "w1",
      corridor: "03",
      rack: "R12",
      levelCount: "999",
      positionsPerLevel: "8",
    });
    expect(result.success).toBe(false);
  });
});

describe("allocationSchema", () => {
  it("accepts a zero quantity (used to remove an allocation)", () => {
    const result = allocationSchema.safeParse({ productId: "p1", storageLocationId: "loc1", quantity: "0" });
    expect(result.success).toBe(true);
  });

  it("rejects a negative quantity", () => {
    const result = allocationSchema.safeParse({ productId: "p1", storageLocationId: "loc1", quantity: "-1" });
    expect(result.success).toBe(false);
  });
});
