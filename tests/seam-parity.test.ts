// One of the two mandatory unit tests named in .ai/standards/testing-standards.md.
//
// It imports every implementation of the data-access seam and asserts identical exported key sets
// and equal arity per export. That is what makes swapping the mock for the real one a configuration
// change rather than a rewrite.
//
// Parity is necessary and NOT sufficient: matching names and arity does not prove matching return
// shapes, and a mock returning a field the real implementation cannot produce passes this and breaks
// at runtime. Where a shape is subtle, assert it separately.

import { describe, expect, it } from "vitest";
import { seam as mock } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";

type AnySeam = Record<string, unknown>;

const implementations: Array<[string, AnySeam]> = [
  ["mock", mock as unknown as AnySeam],
  ["supabase", real as unknown as AnySeam],
];

const [reference, ...others] = implementations;
if (!reference) throw new Error("no seam implementations registered");
const [referenceName, referenceImpl] = reference;

describe("data-access seam parity", () => {
  it("every implementation exports the same names", () => {
    const expected = Object.keys(referenceImpl).sort();
    expect(expected.length, "the seam exports nothing, so parity proves nothing").toBeGreaterThan(0);

    for (const [name, impl] of others) {
      expect(Object.keys(impl).sort(), `${name} does not match ${referenceName}`).toEqual(expected);
    }
  });

  it("every shared export has the same arity", () => {
    for (const key of Object.keys(referenceImpl)) {
      const a = referenceImpl[key];
      if (typeof a !== "function") continue;
      for (const [name, impl] of others) {
        const b = impl[key];
        expect(typeof b, `${name}.${key} is not a function while ${referenceName}.${key} is`).toBe(
          "function",
        );
        expect((b as (...args: unknown[]) => unknown).length, `${name}.${key} arity`).toBe(a.length);
      }
    }
  });
});
