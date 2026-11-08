// MIR-16-e AC-9, AC-10 — the member seam's two-way mapping between the database's `org_admin` and
// the application's `"admin"` (ADR-084 decision 2; .ai/board/tickets/MIR-16-e/01-plan.md § 4.4,
// § 4.5).
//
// The real seam cannot run without a provisioned project, so this pins its source text, the shape
// tests/member-rpc-roster-team.test.ts uses. The database half is supabase/tests/300.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(repoRoot + "src/lib/data/supabase.ts", "utf8");

describe("MIR-16-e: the member seam maps org_admin to the application's admin, both ways", () => {
  it("AC-9: fromDbRole maps \"org_admin\" to \"admin\"", () => {
    const match = source.match(
      /const fromDbRole = \(role: DbMemberRole\): MemberRole => \(role === "org_admin" \? "admin" : role\);/,
    );
    expect(match).not.toBeNull();
  });

  it("AC-9: toMember's role: uses fromDbRole(", () => {
    const toMember = source.slice(source.indexOf("function toMember"));
    expect(toMember.slice(0, toMember.indexOf("}"))).toContain("role: fromDbRole(row.role)");
  });

  it("AC-10: the set_member_role rpc statement passes p_role: toDbRole(", () => {
    const start = source.indexOf('.rpc("set_member_role"');
    expect(start).toBeGreaterThan(-1);
    const end = source.indexOf(";", start);
    const statement = source.slice(start, end < 0 ? undefined : end);
    expect(statement).toContain("p_role: toDbRole(role)");
  });

  it("AC-10: toDbRole maps \"admin\" to \"org_admin\"", () => {
    const match = source.match(
      /const toDbRole = \(role: MemberRole\): DbMemberRole => \(role === "admin" \? "org_admin" : role\);/,
    );
    expect(match).not.toBeNull();
  });

  it("MemberRow types role as DbMemberRole", () => {
    const memberRow = source.slice(
      source.indexOf("interface MemberRow"),
      source.indexOf("}", source.indexOf("interface MemberRow")),
    );
    expect(memberRow).toContain("role: DbMemberRole;");
  });
});
