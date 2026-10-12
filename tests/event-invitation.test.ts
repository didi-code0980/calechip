// EVT-08 — email invitations to a public event. Every acceptance criterion that is a property of the
// data, through the mock seam; the two mails through the template; the migration read for its shape.
//
// **THE MOCK REPRODUCES `supabase/migrations/20261012100000_evt08_event_email_invitation.sql`; IT
// CANNOT PROVE IT.** `tests/permission-model.test.ts` against a real PostgreSQL is still owed
// project-wide (.ai/standards/rbac-and-security.md § Known weaknesses 1). What the function reads and
// what the roles are granted is asserted here by reading the migration, as `tests/guest-link.test.ts`
// reads EVT-06's.
//
// **PEOPLE.** Fixtures as they are. No fixture file is edited. There is no manager fixture; a
// manager's refusal is `may_manage_event`'s, which keys on `is_admin` and never on `may_decide`, and
// is asserted on the predicate the mock shares with EVT-06 (`tests/guest-link.test.ts`).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import {
  seam as mock,
  __resetEvents,
  __sentEventEmails,
  __sentInvitationEmails,
  __setCurrentMember,
} from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import { invalidInvitationEmails, parseInvitationInput } from "@/routes/EventDetail";
import {
  parseEventEmailRequest,
  parseInvitationEmailRequest,
  renderEventEmail,
  renderInvitationEmail,
  type InvitationEmailRequest,
} from "../supabase/functions/send-event-email/template";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_PENDING_SIGNUP,
  FIXTURE_REMOVED_MEMBER,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const MIGRATION = read("../supabase/migrations/20261012100000_evt08_event_email_invitation.sql");
/** The statements, with `--` comments removed — the header names things to say they are not used. */
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, "");
const SENDER = read("../supabase/functions/send-event-email/index.ts");

const OUTSIDER = "friend@outside.example";
const OUTSIDER_2 = "second@outside.example";

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Tiệc cuối năm",
  description: null,
  location: "Phòng lớn",
  startDate: "2099-03-10",
  endDate: "2099-03-10",
  scope: "public",
  inviteeIds: [],
  ...overrides,
});

async function createAs(memberId: string, overrides: Partial<SaveEventInput> = {}): Promise<string> {
  as(memberId);
  const result = await mock.createEvent(input(overrides));
  if (!result.ok) throw new Error(`createEvent refused: ${result.error.code}`);
  return result.value.id;
}

async function inviteAs(memberId: string | null, eventId: string, emails: string[]) {
  as(memberId);
  return mock.inviteToEvent(eventId, emails);
}

async function listAs(memberId: string | null, eventId: string) {
  as(memberId);
  return mock.listEventEmailInvitations(eventId);
}

async function linkOf(eventId: string) {
  as(FIXTURE_ADMIN.id);
  return mock.getEventGuestLink(eventId);
}

afterEach(() => {
  __resetEvents();
  as(null);
});

describe("EVT-08 AC-1, AC-2 — the creator and admins invite", () => {
  it("the creator's addresses come back sent, and one guest mail each is handed over", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const result = await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER, OUTSIDER_2]);
    expect(result).toEqual({
      ok: true,
      value: [
        { email: OUTSIDER, outcome: "sent" },
        { email: OUTSIDER_2, outcome: "sent" },
      ],
    });
    const mails = __sentInvitationEmails();
    expect(mails.map((m) => [m.kind, m.to])).toEqual([
      ["invitation_guest", OUTSIDER],
      ["invitation_guest", OUTSIDER_2],
    ]);
    expect(mails.every((m) => m.inviterName === FIXTURE_MEMBER.displayName)).toBe(true);
  });

  it("an admin invites to somebody else's event, and the mail names the admin", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const result = await inviteAs(FIXTURE_ADMIN.id, eventId, [OUTSIDER]);
    expect(result.ok).toBe(true);
    expect(__sentInvitationEmails()[0]?.inviterName).toBe(FIXTURE_ADMIN.displayName);
    const [row] = await listAs(FIXTURE_MEMBER.id, eventId);
    expect(row?.invitedBy).toBe(FIXTURE_ADMIN.id);
  });
});

describe("EVT-08 AC-3 — nobody else invites", () => {
  it.each([
    ["a member who did not create it", FIXTURE_APPROVED_MEMBER.id],
    ["a member of another team", FIXTURE_OTHER_TEAM_MEMBER.id],
    ["a removed member", FIXTURE_REMOVED_MEMBER.id],
    ["signed out", null],
  ])("%s is refused, and nothing is saved, opened or handed over", async (_label, who) => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const result = await inviteAs(who, eventId, [OUTSIDER]);
    expect(result).toMatchObject({ ok: false, error: { code: "event_not_permitted" } });
    expect(await listAs(FIXTURE_ADMIN.id, eventId)).toEqual([]);
    expect(await linkOf(eventId)).toBeNull();
    expect(__sentInvitationEmails()).toEqual([]);
  });

  it("an event that does not exist gets the same answer", async () => {
    const missing = await inviteAs(FIXTURE_ADMIN.id, "ec000000-0000-4000-8000-999999999999", [OUTSIDER]);
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const refused = await inviteAs(FIXTURE_APPROVED_MEMBER.id, eventId, [OUTSIDER]);
    expect(missing).toEqual(refused);
  });

  it("the function checks may_manage_event first, as 42501", () => {
    expect(MIGRATION_SQL).toMatch(
      /not coalesce\(public\.may_manage_event\(p_event_id, v_uid\), false\)[\s\S]*?errcode = '42501'/,
    );
  });
});

describe("EVT-08 AC-4 — public events only", () => {
  it.each([
    ["team", [] as string[]],
    ["named", [FIXTURE_APPROVED_MEMBER.id]],
  ] as const)("a %s event is refused for its creator and an admin, opening nothing", async (scope, ids) => {
    const eventId = await createAs(FIXTURE_MEMBER.id, { scope, inviteeIds: [...ids] });
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_ADMIN.id]) {
      const result = await inviteAs(who, eventId, [OUTSIDER]);
      expect(result).toMatchObject({ ok: false, error: { code: "invitation_not_public" } });
    }
    expect(await linkOf(eventId)).toBeNull();
    expect(await listAs(FIXTURE_ADMIN.id, eventId)).toEqual([]);
    expect(__sentInvitationEmails()).toEqual([]);
  });

  it("an event moved off public accepts no more, and keeps its link and its list", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER]);
    const link = await linkOf(eventId);
    as(FIXTURE_MEMBER.id);
    const moved = await mock.updateEvent(eventId, input({ scope: "team" }));
    expect(moved.ok).toBe(true);
    const result = await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER_2]);
    expect(result).toMatchObject({ ok: false, error: { code: "invitation_not_public" } });
    expect(await linkOf(eventId)).toEqual(link);
    expect((await listAs(FIXTURE_MEMBER.id, eventId)).map((i) => i.email)).toEqual([OUTSIDER]);
    expect(__sentInvitationEmails()).toHaveLength(1);
  });
});

describe("EVT-08 AC-5 — inviting opens the event to guests", () => {
  it("opens a never-opened event, and the mail carries that link", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    expect(await linkOf(eventId)).toBeNull();
    await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER]);
    const link = await linkOf(eventId);
    expect(link).not.toBeNull();
    expect(__sentInvitationEmails()[0]?.guestToken).toBe(link?.token);
  });

  it("keeps an open event's link unchanged", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    as(FIXTURE_MEMBER.id);
    const opened = await mock.openEventToGuests(eventId);
    await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER]);
    expect(await linkOf(eventId)).toEqual(opened.ok ? opened.value : null);
  });

  it("reopens a closed event even when every address was invited before", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER]);
    as(FIXTURE_MEMBER.id);
    await mock.closeEventToGuests(eventId);
    expect(await linkOf(eventId)).toBeNull();
    const again = await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER]);
    expect(again).toEqual({ ok: true, value: [{ email: OUTSIDER, outcome: "ignored" }] });
    expect(await linkOf(eventId)).not.toBeNull();
    expect(__sentInvitationEmails()).toHaveLength(1);
  });

  it("the function opens with on conflict do nothing", () => {
    expect(MIGRATION_SQL).toMatch(
      /insert into public\.event_guest_link \(event_id\) values \(p_event_id\)\s+on conflict \(event_id\) do nothing/,
    );
  });
});

describe("EVT-08 AC-6 — each address is invited once per event", () => {
  it("a repeat in any case or spacing, later or in the same submission, is one row and one mail", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const first = await inviteAs(FIXTURE_MEMBER.id, eventId, ["Friend@Outside.example", " friend@outside.EXAMPLE "]);
    expect(first).toEqual({ ok: true, value: [{ email: "Friend@Outside.example", outcome: "sent" }] });
    const second = await inviteAs(FIXTURE_ADMIN.id, eventId, [OUTSIDER, OUTSIDER_2]);
    expect(second).toEqual({
      ok: true,
      value: [
        { email: OUTSIDER, outcome: "ignored" },
        { email: OUTSIDER_2, outcome: "sent" },
      ],
    });
    const rows = await listAs(FIXTURE_MEMBER.id, eventId);
    expect(rows.map((r) => r.email).sort()).toEqual(["Friend@Outside.example", OUTSIDER_2].sort());
    expect(__sentInvitationEmails()).toHaveLength(2);
  });

  it("the same address is invited to a different event as normal", async () => {
    const one = await createAs(FIXTURE_MEMBER.id);
    const two = await createAs(FIXTURE_MEMBER.id, { name: "Another" });
    await inviteAs(FIXTURE_MEMBER.id, one, [OUTSIDER]);
    const result = await inviteAs(FIXTURE_MEMBER.id, two, [OUTSIDER]);
    expect(result).toEqual({ ok: true, value: [{ email: OUTSIDER, outcome: "sent" }] });
  });

  it("two racing submissions invite the address once; the other reads ignored", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    as(FIXTURE_MEMBER.id);
    const [a, b] = await Promise.all([
      mock.inviteToEvent(eventId, [OUTSIDER]),
      mock.inviteToEvent(eventId, [OUTSIDER]),
    ]);
    const outcomes = [a, b].map((r) => (r.ok ? r.value[0]?.outcome : null)).sort();
    expect(outcomes).toEqual(["ignored", "sent"]);
    expect(__sentInvitationEmails()).toHaveLength(1);
  });

  it("the unique index is on lower(email), and the insert does nothing on conflict", () => {
    expect(MIGRATION_SQL).toMatch(
      /create unique index if not exists event_email_invitation_event_email\s+on public\.event_email_invitation \(event_id, lower\(email\)\)/,
    );
    expect(MIGRATION_SQL).toMatch(/values \(p_event_id, v_addr, v_uid\)\s+on conflict do nothing/);
  });
});

describe("EVT-08 AC-7 — the inviter never learns who is a member", () => {
  it("a member's address and an outsider's give results of the same shape", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const member = FIXTURE_APPROVED_MEMBER.email ?? "";
    const result = await inviteAs(FIXTURE_MEMBER.id, eventId, [member, OUTSIDER]);
    expect(result).toEqual({
      ok: true,
      value: [
        { email: member, outcome: "sent" },
        { email: OUTSIDER, outcome: "sent" },
      ],
    });
    const rows = await listAs(FIXTURE_MEMBER.id, eventId);
    expect(rows.map((r) => Object.keys(r).sort())).toEqual([
      ["createdAt", "email", "eventId", "id", "invitedBy"],
      ["createdAt", "email", "eventId", "id", "invitedBy"],
    ]);
  });

  it.each([
    ["a member with event email off", "off"],
    ["the inviter's own address", "self"],
    ["a pending sign-up's address", "pending"],
    ["a removed member's address", "removed"],
  ])("%s still comes back sent", async (_label, kind) => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    let address = FIXTURE_APPROVED_MEMBER.email ?? "";
    if (kind === "off") {
      as(FIXTURE_APPROVED_MEMBER.id);
      await mock.setEventEmailEnabled(false);
    }
    if (kind === "self") address = FIXTURE_MEMBER.email ?? "";
    if (kind === "pending") address = FIXTURE_PENDING_SIGNUP.email ?? "";
    if (kind === "removed") address = FIXTURE_REMOVED_MEMBER.email ?? "";
    const result = await inviteAs(FIXTURE_MEMBER.id, eventId, [address]);
    expect(result).toEqual({ ok: true, value: [{ email: address, outcome: "sent" }] });
  });

  it("invite_to_event's body reads neither member nor auth.users", () => {
    const body = /function public\.invite_to_event[\s\S]*?\n\$\$;/.exec(MIGRATION_SQL)?.[0] ?? "";
    expect(body).not.toBe("");
    expect(body).not.toMatch(/public\.member\b/);
    expect(body).not.toMatch(/auth\.users/);
    expect(body).toMatch(/returns table \(email text, outcome text\)/);
  });

  it("the table has no column for the version, the member or whether a mail left", () => {
    const table = /create table if not exists public\.event_email_invitation \(([\s\S]*?)\n\);/.exec(
      MIGRATION_SQL,
    )?.[1];
    const columns = (table ?? "")
      .split("\n")
      .map((line) => /^\s{2}([a-z_]+)\s/.exec(line)?.[1])
      .filter((c): c is string => c !== undefined && c !== "constraint");
    expect(columns).toEqual(["id", "event_id", "email", "invited_by", "created_at"]);
  });
});

describe("EVT-08 AC-8, AC-9 — which mail, to whom", () => {
  it("an outsider, a pending sign-up and a removed member get the guest version", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const pending = FIXTURE_PENDING_SIGNUP.email ?? "";
    const removed = FIXTURE_REMOVED_MEMBER.email ?? "";
    await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER, pending, removed]);
    const mails = __sentInvitationEmails();
    expect(mails.map((m) => m.kind)).toEqual(["invitation_guest", "invitation_guest", "invitation_guest"]);
    expect(mails.map((m) => m.to)).toEqual([OUTSIDER, pending, removed]);
  });

  it("an approved member gets the member version, with no token, matching case-insensitively", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const address = (FIXTURE_APPROVED_MEMBER.email ?? "").toUpperCase();
    await inviteAs(FIXTURE_MEMBER.id, eventId, [address]);
    expect(__sentInvitationEmails()).toEqual([
      expect.objectContaining({
        kind: "invitation_member",
        to: FIXTURE_APPROVED_MEMBER.email,
        guestToken: null,
      }),
    ]);
  });

  it("nothing for a member with event email off, or for the inviter", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    as(FIXTURE_APPROVED_MEMBER.id);
    await mock.setEventEmailEnabled(false);
    await inviteAs(FIXTURE_MEMBER.id, eventId, [FIXTURE_APPROVED_MEMBER.email ?? "", FIXTURE_MEMBER.email ?? ""]);
    expect(__sentInvitationEmails()).toEqual([]);
    expect(await listAs(FIXTURE_MEMBER.id, eventId)).toHaveLength(2);
  });

  const event = {
    id: "ec000000-0000-4000-8000-000000000001",
    name: "Tiệc <b>cuối</b> năm & 'bạn'",
    startDate: "2099-03-10",
    endDate: "2099-03-10",
    location: "Phòng lớn",
  };
  const token = "a".repeat(64);
  const guest: InvitationEmailRequest = {
    invitationId: "ei1",
    kind: "invitation_guest",
    to: OUTSIDER,
    inviterName: "Quân <i>",
    recipientName: null,
    event,
    guestToken: token,
  };

  it("the guest mail: subject, greeting, button to the guest page, no profile link, escaped", () => {
    const mail = renderInvitationEmail(guest, "https://app.example");
    expect(mail.subject).toBe(`Quân <i> invited you to ${event.name}`);
    expect(mail.text).toContain(`Hi there,`);
    expect(mail.text).toContain(`Quân <i> invited you to ${event.name}.`);
    expect(mail.text).toContain(`View & register: https://app.example/guest/${token}`);
    expect(mail.text).toContain("You got this email because Quân <i> invited you to an event on CaleChip.");
    expect(mail.text).not.toContain("/profile");
    expect(mail.html).not.toContain("/profile");
    expect(mail.html).toContain(`href="https://app.example/guest/${token}"`);
    expect(mail.html).toContain("Quân &lt;i&gt;");
    expect(mail.html).not.toContain("<i>");
    expect(mail.html).not.toContain("<b>cuối</b>");
    expect(mail.html).toContain("Tiệc &lt;b&gt;cuối&lt;/b&gt; năm &amp; &#39;bạn&#39;");
  });

  it("the member mail is EVT-05's event_invited mail in every word", () => {
    const member: InvitationEmailRequest = {
      ...guest,
      kind: "invitation_member",
      recipientName: "Ngà",
      guestToken: null,
    };
    expect(renderInvitationEmail(member, "https://app.example")).toEqual(
      renderEventEmail(
        {
          notificationId: "ei1",
          kind: "event_invited",
          to: OUTSIDER,
          recipientName: "Ngà",
          actorName: "Quân <i>",
          event,
        },
        "https://app.example",
      ),
    );
  });

  it("the parser takes exactly the two shapes, and EVT-05's parser takes neither", () => {
    expect(parseInvitationEmailRequest(guest)).toEqual(guest);
    expect(parseEventEmailRequest(guest)).toBeNull();
    expect(parseInvitationEmailRequest({ ...guest, guestToken: null })).toBeNull();
    expect(parseInvitationEmailRequest({ ...guest, guestToken: "ABC" })).toBeNull();
    expect(parseInvitationEmailRequest({ ...guest, recipientName: "x" })).toBeNull();
    expect(parseInvitationEmailRequest({ ...guest, kind: "invitation_member", recipientName: "x" })).toBeNull();
    expect(
      parseInvitationEmailRequest({ ...guest, kind: "invitation_member", recipientName: "x", guestToken: null }),
    ).not.toBeNull();
    expect(parseInvitationEmailRequest({ ...guest, kind: "event_invited" })).toBeNull();
    expect(parseInvitationEmailRequest({ ...guest, event: { ...event, endDate: "2099-03-09" } })).toBeNull();
  });

  it("the sender's log names the invitation id and kind, never the address or the token", () => {
    expect(SENDER).toContain("logName: `invitation ${invitation.invitationId} (${invitation.kind})`");
    expect(SENDER).not.toMatch(/console\.(error|log)\([^)]*\.to\b/);
    expect(SENDER).not.toMatch(/console\.(error|log)\([^)]*guestToken/);
  });

  it("EVT-05's mails are not touched by inviting", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const before = __sentEventEmails().length;
    await inviteAs(FIXTURE_MEMBER.id, eventId, [FIXTURE_APPROVED_MEMBER.email ?? "", OUTSIDER]);
    expect(__sentEventEmails()).toHaveLength(before);
  });
});

describe("EVT-08 AC-10, AC-11 — what an address must look like, and no cap", () => {
  it.each([
    ["nothing", []],
    ["only blanks", ["  ", ""]],
    ["one malformed among good ones", [OUTSIDER, "not-an-address"]],
    ["one over 254 characters", [`${"a".repeat(250)}@x.example`]],
  ])("%s refuses the whole submission", async (_label, emails) => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const result = await inviteAs(FIXTURE_MEMBER.id, eventId, emails);
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_invitation_email" } });
    expect(await listAs(FIXTURE_MEMBER.id, eventId)).toEqual([]);
    expect(await linkOf(eventId)).toBeNull();
    expect(__sentInvitationEmails()).toEqual([]);
  });

  it("an address is stored trimmed, with its case as first entered", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    await inviteAs(FIXTURE_MEMBER.id, eventId, ["  Mixed@Case.Example  "]);
    expect((await listAs(FIXTURE_MEMBER.id, eventId))[0]?.email).toBe("Mixed@Case.Example");
  });

  it("the real seam refuses before the round trip", async () => {
    const result = await real.inviteToEvent("ec000000-0000-4000-8000-000000000001", ["nope"]);
    expect(result).toMatchObject({ ok: false, error: { code: "invalid_invitation_email" } });
  });

  it("a long submission invites every address", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    const many = Array.from({ length: 300 }, (_, i) => `person${i}@outside.example`);
    const result = await inviteAs(FIXTURE_MEMBER.id, eventId, many);
    expect(result.ok && result.value.every((r) => r.outcome === "sent")).toBe(true);
    expect(result.ok && result.value).toHaveLength(300);
  });

  it("the function and the table check the same shape and ceiling", () => {
    expect(MIGRATION_SQL).toContain("errcode = 'EV008'");
    expect(MIGRATION_SQL.match(/\^\[\^@\[:space:\]\]\+@\[\^@\[:space:\]\]\+\\\.\[\^@\[:space:\]\]\+\$/g)).toHaveLength(2);
  });
});

describe("EVT-08 AC-12, AC-13, AC-14 — the invited list", () => {
  it("the creator and admins read it newest first; nobody else does", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER]);
    await new Promise((r) => setTimeout(r, 5));
    await inviteAs(FIXTURE_ADMIN.id, eventId, [OUTSIDER_2]);
    expect((await listAs(FIXTURE_MEMBER.id, eventId)).map((i) => i.email)).toEqual([OUTSIDER_2, OUTSIDER]);
    expect(await listAs(FIXTURE_ADMIN.id, eventId)).toHaveLength(2);
    expect(await listAs(FIXTURE_APPROVED_MEMBER.id, eventId)).toEqual([]);
    expect(await listAs(FIXTURE_OTHER_TEAM_MEMBER.id, eventId)).toEqual([]);
    expect(await listAs(null, eventId)).toEqual([]);
  });

  it("the select policy is may_manage_event; no write is granted", () => {
    expect(MIGRATION_SQL).toMatch(
      /create policy event_email_invitation_select_manage on public\.event_email_invitation\s+for select to authenticated\s+using \(event_id is not null and public\.may_manage_event\(event_id, \(select auth\.uid\(\)\)\)\)/,
    );
    expect(MIGRATION_SQL).not.toMatch(/for (insert|update|delete)/);
    expect(MIGRATION_SQL).toContain(
      "grant select (id, event_id, email, invited_by, created_at) on public.event_email_invitation to authenticated;",
    );
    expect(MIGRATION_SQL).not.toMatch(/grant (insert|update|delete)[^;]*event_email_invitation/);
    expect(MIGRATION_SQL).not.toMatch(/grant [^;]* to anon/);
  });

  it("deleting the event keeps the rows and hands nothing over", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    await inviteAs(FIXTURE_MEMBER.id, eventId, [OUTSIDER]);
    const sent = __sentInvitationEmails().length;
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(eventId)).ok).toBe(true);
    expect(__sentInvitationEmails()).toHaveLength(sent);
    expect(await listAs(FIXTURE_ADMIN.id, eventId)).toEqual([]);
    expect(MIGRATION_SQL).toMatch(/references public\.event\(id\) on delete set null/);
  });
});

describe("EVT-08 AC-15 — the rest of the product is as it was", () => {
  it("members, notifications and the event are untouched", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id);
    as(FIXTURE_MEMBER.id);
    const event = await mock.getEvent(eventId);
    const members = await mock.listMembers();
    as(FIXTURE_APPROVED_MEMBER.id);
    const notifications = await mock.listNotifications();
    await inviteAs(FIXTURE_MEMBER.id, eventId, [FIXTURE_APPROVED_MEMBER.email ?? "", OUTSIDER]);
    as(FIXTURE_MEMBER.id);
    expect(await mock.getEvent(eventId)).toEqual(event);
    expect(await mock.listMembers()).toEqual(members);
    as(FIXTURE_APPROVED_MEMBER.id);
    expect(await mock.listNotifications()).toEqual(notifications);
  });
});

describe("EVT-08 § 4.5 — the panel's helpers", () => {
  it("splits on commas, semicolons, spaces and new lines, dropping empties", () => {
    expect(parseInvitationInput(" a@b.c, d@e.f;g@h.i\n\nj@k.l  ")).toEqual(["a@b.c", "d@e.f", "g@h.i", "j@k.l"]);
    expect(parseInvitationInput("  ")).toEqual([]);
  });

  it("names the malformed entries in order", () => {
    expect(invalidInvitationEmails(["a@b.c", "nope", "x@y", `${"a".repeat(250)}@x.example`])).toEqual([
      "nope",
      "x@y",
      `${"a".repeat(250)}@x.example`,
    ]);
  });
});
