import { describe, expect, it } from "vitest";
import { productSchema, movementSchema, categorySchema } from "@/lib/validation/catalog";

describe("productSchema", () => {
  it("normalizes SKU to uppercase and parses specifications JSON", () => {
    const result = productSchema.safeParse({
      sku: "rlm-6205-2rs",
      name: "Rolamento 6205-2RS",
      description: "",
      categoryId: "",
      manufacturer: "NSK",
      model: "",
      unit: "UN",
      minCommercialQuantity: "50",
      status: "ACTIVE",
      specifications: JSON.stringify([{ key: "Diâmetro interno", value: "25 mm" }]),
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sku).toBe("RLM-6205-2RS");
      expect(result.data.minCommercialQuantity).toBe(50);
      expect(result.data.specifications).toEqual([{ key: "Diâmetro interno", value: "25 mm" }]);
    }
  });

  it("rejects a SKU with invalid characters", () => {
    const result = productSchema.safeParse({
      sku: "rlm 6205/2rs!",
      name: "Rolamento",
      minCommercialQuantity: "1",
      status: "ACTIVE",
      unit: "UN",
    });
    expect(result.success).toBe(false);
  });

  it("rejects malformed specifications JSON", () => {
    const result = productSchema.safeParse({
      sku: "RLM-1",
      name: "Rolamento",
      minCommercialQuantity: "1",
      status: "ACTIVE",
      unit: "UN",
      specifications: "{not json",
    });
    expect(result.success).toBe(false);
  });
});

describe("movementSchema", () => {
  it("accepts a positive ENTRADA quantity", () => {
    const result = movementSchema.safeParse({ productId: "p1", type: "ENTRADA", quantity: "10" });
    expect(result.success).toBe(true);
  });

  it("rejects a negative SAIDA quantity", () => {
    const result = movementSchema.safeParse({ productId: "p1", type: "SAIDA", quantity: "-10" });
    expect(result.success).toBe(false);
  });

  it("accepts a negative AJUSTE quantity", () => {
    const result = movementSchema.safeParse({ productId: "p1", type: "AJUSTE", quantity: "-10" });
    expect(result.success).toBe(true);
  });

  it("rejects a zero quantity for any type", () => {
    const result = movementSchema.safeParse({ productId: "p1", type: "AJUSTE", quantity: "0" });
    expect(result.success).toBe(false);
  });
});

describe("categorySchema", () => {
  it("accepts a category without a parent", () => {
    const result = categorySchema.safeParse({ name: "Rolamentos", description: "", parentId: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a name shorter than 2 characters", () => {
    const result = categorySchema.safeParse({ name: "R" });
    expect(result.success).toBe(false);
  });
});
