// The in-memory implementation. Component tests run against this.
// Parity with supabase.ts is asserted by the seam-parity test, not by convention.
import type { DataSeam } from "./index";

export const seam: DataSeam = {
  async ready() {
    return true;
  },
};
