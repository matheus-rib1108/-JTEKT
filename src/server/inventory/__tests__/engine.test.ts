import { describe, expect, it } from "vitest";
import { applyMovementToSnapshot, InventoryError, type InventorySnapshot } from "@/server/inventory/engine";

const baseSnapshot: InventorySnapshot = {
  quantityOnHand: 100,
  quantityReserved: 10,
  quantityBlocked: 5,
  quantityAvailableToSell: 60,
};
// free stock = 100 - 10 - 5 = 85

describe("applyMovementToSnapshot", () => {
  it("ENTRADA increases quantityOnHand only", () => {
    const next = applyMovementToSnapshot(baseSnapshot, "ENTRADA", 50);
    expect(next.quantityOnHand).toBe(150);
    expect(next.quantityReserved).toBe(10);
    expect(next.quantityBlocked).toBe(5);
  });

  it("SAIDA decreases quantityOnHand when within free stock", () => {
    const next = applyMovementToSnapshot(baseSnapshot, "SAIDA", 20);
    expect(next.quantityOnHand).toBe(80);
  });

  it("SAIDA throws when it would exceed free stock", () => {
    expect(() => applyMovementToSnapshot(baseSnapshot, "SAIDA", 90)).toThrow(InventoryError);
  });

  it("AJUSTE accepts a negative delta as long as it does not go below zero", () => {
    const next = applyMovementToSnapshot(baseSnapshot, "AJUSTE", -30);
    expect(next.quantityOnHand).toBe(70);
  });

  it("AJUSTE throws if the result would be negative", () => {
    expect(() => applyMovementToSnapshot(baseSnapshot, "AJUSTE", -1000)).toThrow(InventoryError);
  });

  it("RESERVA increases quantityReserved within free stock", () => {
    const next = applyMovementToSnapshot(baseSnapshot, "RESERVA", 40);
    expect(next.quantityReserved).toBe(50);
  });

  it("RESERVA throws when it would exceed free stock", () => {
    expect(() => applyMovementToSnapshot(baseSnapshot, "RESERVA", 90)).toThrow(InventoryError);
  });

  it("LIBERACAO_RESERVA decreases quantityReserved", () => {
    const next = applyMovementToSnapshot(baseSnapshot, "LIBERACAO_RESERVA", 5);
    expect(next.quantityReserved).toBe(5);
  });

  it("LIBERACAO_RESERVA throws when releasing more than reserved", () => {
    expect(() => applyMovementToSnapshot(baseSnapshot, "LIBERACAO_RESERVA", 999)).toThrow(InventoryError);
  });

  it("BLOQUEIO increases quantityBlocked within free stock", () => {
    const next = applyMovementToSnapshot(baseSnapshot, "BLOQUEIO", 10);
    expect(next.quantityBlocked).toBe(15);
  });

  it("DESBLOQUEIO decreases quantityBlocked", () => {
    const next = applyMovementToSnapshot(baseSnapshot, "DESBLOQUEIO", 5);
    expect(next.quantityBlocked).toBe(0);
  });

  it("clamps quantityAvailableToSell down when a movement shrinks free stock below it", () => {
    // free stock after: 100 - 10 - 75 = 15, below the current availableToSell (60)
    const next = applyMovementToSnapshot(baseSnapshot, "BLOQUEIO", 70);
    expect(next.quantityBlocked).toBe(75);
    expect(next.quantityAvailableToSell).toBe(15);
  });

  it("never lets quantityAvailableToSell go negative when clamped", () => {
    const tightSnapshot: InventorySnapshot = {
      quantityOnHand: 15,
      quantityReserved: 0,
      quantityBlocked: 0,
      quantityAvailableToSell: 10,
    };
    const next = applyMovementToSnapshot(tightSnapshot, "SAIDA", 15);
    expect(next.quantityOnHand).toBe(0);
    expect(next.quantityAvailableToSell).toBe(0);
  });
});
