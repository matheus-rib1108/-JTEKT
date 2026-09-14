import { z } from "zod";

/**
 * An optional trimmed string field, safe to use with both HTML forms and
 * FormData built by hand.
 *
 * Why this exists: `FormData.get("x")` returns `null` when the key is
 * simply absent (as opposed to `""` when an `<input>` exists but is empty).
 * The common `z.string().optional().or(z.literal(""))` pattern accepts
 * `undefined` and `""` but NOT `null`, so any caller that omits a field
 * entirely — every quick-action button that builds `new FormData()` by
 * hand rather than rendering a full `<form>` — fails validation with a
 * generic "Invalid input" error. This normalizes null/""/undefined to
 * `undefined` before validating length.
 */
export function optionalText(maxLength: number) {
  return z.preprocess(
    (value) => (value === null || value === "" ? undefined : value),
    z.string().trim().max(maxLength).optional(),
  );
}
