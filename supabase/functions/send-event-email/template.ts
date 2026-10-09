// EVT-05 — the event email's words and layout. 01-plan.md §§ 2b, 4.4 and 4.5. ADR-051, ADR-053.
//
// **IMPORTS NOTHING**, so both the Deno Edge Runtime (`index.ts`) and Vitest
// (`tests/event-email.test.ts`) load it as it is. It is pure: a request in, a subject and two bodies
// out. It never sends, reads the database, or decides who receives anything — the trigger
// `email_notification()` in `supabase/migrations/20261009090000_evt05_event_email.sql` has decided
// that before a request exists (ADR-053 decision 3).
//
// **EVERY INTERPOLATED VALUE IS ESCAPED IN THE HTML AND LEFT AS WRITTEN IN THE SUBJECT AND THE TEXT**
// (AC-10). An event name, a location and both display names are typed by people; `<b>x</b>` is shown
// as those characters and never as markup. Vietnamese diacritics pass through untouched — escaping
// touches `& < > " '` only.
//
// **TABLE LAYOUT AND INLINE STYLES ONLY** (§ 2b): email clients drop `<style>` blocks and ignore flex.
// No image, no mascot, no tracking pixel. Never Quicksand (`CLAUDE.md` § Visual direction).

/** EVT-05. The five notification kinds that may produce an email (ADR-051 decision 4). */
export type EventEmailKind =
  | "event_created"
  | "event_invited"
  | "attendance_approved"
  | "attendance_rejected"
  | "attendance_removed";

/** EVT-05 § 4.3. The body `email_notification()` posts. */
export interface EventEmailRequest {
  notificationId: string;
  kind: EventEmailKind;
  to: string;
  recipientName: string;
  actorName: string;
  event: {
    id: string;
    name: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    location: string | null;
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const KINDS: readonly EventEmailKind[] = [
  "event_created",
  "event_invited",
  "attendance_approved",
  "attendance_rejected",
  "attendance_removed",
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A real calendar date in YYYY-MM-DD, or null. `2026-02-30` is refused, not rolled into March. */
function parseIsoDate(value: string): { year: number; month: number; day: number } | null {
  const match = ISO_DATE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { year, month, day };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";

/** AC-13. The request, or null when `input` is not exactly that shape — every string non-empty
 *  except `location`, which is a string or null; `kind` one of the five; both dates YYYY-MM-DD with
 *  `endDate >= startDate`. */
export function parseEventEmailRequest(input: unknown): EventEmailRequest | null {
  if (!isRecord(input)) return null;
  const { notificationId, kind, to, recipientName, actorName, event } = input;
  if (!nonEmpty(notificationId) || !nonEmpty(to) || !nonEmpty(recipientName) || !nonEmpty(actorName)) {
    return null;
  }
  if (typeof kind !== "string" || !(KINDS as readonly string[]).includes(kind)) return null;
  if (!isRecord(event)) return null;

  const { id, name, startDate, endDate, location } = event;
  if (!nonEmpty(id) || !nonEmpty(name)) return null;
  if (typeof startDate !== "string" || typeof endDate !== "string") return null;
  if (!parseIsoDate(startDate) || !parseIsoDate(endDate)) return null;
  // Lexical order is date order for a zero-padded YYYY-MM-DD.
  if (endDate < startDate) return null;
  if (location !== null && typeof location !== "string") return null;

  return {
    notificationId,
    kind: kind as EventEmailKind,
    to,
    recipientName,
    actorName,
    event: { id, name, startDate, endDate, location },
  };
}

/** AC-11. `12 Oct 2026`, `12–14 Oct 2026`, `30 Oct – 2 Nov 2026`, `30 Dec 2026 – 2 Jan 2027`.
 *  English month abbreviations; an en dash, unspaced within a month, spaced across months. */
export function formatEventDates(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return endDate === startDate ? startDate : `${startDate} – ${endDate}`;

  const month = (m: number): string => MONTHS[m - 1] ?? "";
  if (start.year !== end.year) {
    return (
      `${start.day} ${month(start.month)} ${start.year} – ` +
      `${end.day} ${month(end.month)} ${end.year}`
    );
  }
  if (start.month !== end.month) {
    return `${start.day} ${month(start.month)} – ${end.day} ${month(end.month)} ${end.year}`;
  }
  if (start.day !== end.day) {
    return `${start.day}–${end.day} ${month(end.month)} ${end.year}`;
  }
  return `${start.day} ${month(start.month)} ${start.year}`;
}

/** `& < > " '`, and nothing else — a diacritic is not markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** § 4.4. The subject and the headline (the EVT-04 in-app sentence) for each kind. */
function wordsFor(kind: EventEmailKind, actor: string, event: string): { subject: string; headline: string } {
  switch (kind) {
    case "event_created":
      return { subject: `${actor} announced ${event}`, headline: `${actor} announced ${event}.` };
    case "event_invited":
      return { subject: `${actor} invited you to ${event}`, headline: `${actor} invited you to ${event}.` };
    case "attendance_approved":
      return {
        subject: `Your request to join ${event} was approved`,
        headline: `Your request to join ${event} was approved.`,
      };
    case "attendance_rejected":
      return {
        subject: `Your request to join ${event} was declined`,
        headline: `Your request to join ${event} was declined.`,
      };
    case "attendance_removed":
      return { subject: `You were removed from ${event}`, headline: `You were removed from ${event}.` };
  }
}

/** § 2b. The event panel's tint: peach-pink for approved, mint for created and invited, lavender for
 *  rejected and removed. */
const PANEL_TINT: Record<EventEmailKind, string> = {
  event_created: "#E8F6EF",
  event_invited: "#E8F6EF",
  attendance_approved: "#FDEDEF",
  attendance_rejected: "#EFEAFB",
  attendance_removed: "#EFEAFB",
};

const PAGE = "#F4F2FA";
const BORDER = "#ECE8F5";
const PRIMARY = "#2A2145"; // `--color-primary`, src/index.css
const INK = "#241F45"; // `--color-ink`, src/index.css
const GREY = "#6E6A80";
const FONT = "'Nunito', 'Baloo 2', 'Segoe UI', Arial, sans-serif";

const GREETING = (name: string): string => `Hi ${name},`;
const BUTTON = "Open the event";
const FOOTER_LEAD = "You got this email because you are on CaleChip. Event email can be turned off on your ";
const FOOTER_LINK = "Profile";

/** AC-8 to AC-11. `appUrl` has no trailing slash (the caller strips one). Every interpolated value is
 *  HTML-escaped in `html` (`& < > " '`) and left as written in `subject` and `text`. */
export function renderEventEmail(request: EventEmailRequest, appUrl: string): RenderedEmail {
  const { kind, recipientName, actorName, event } = request;
  const { subject, headline } = wordsFor(kind, actorName, event.name);
  const dates = formatEventDates(event.startDate, event.endDate);
  const location = event.location !== null && event.location.trim() !== "" ? event.location : null;
  const eventUrl = `${appUrl}/events/${encodeURIComponent(event.id)}`;
  const profileUrl = `${appUrl}/profile`;

  const textLines = [
    GREETING(recipientName),
    "",
    headline,
    "",
    event.name,
    dates,
    ...(location !== null ? [location] : []),
    "",
    `${BUTTON}: ${eventUrl}`,
    "",
    `${FOOTER_LEAD}${FOOTER_LINK}.`,
    `Turn event email off: ${profileUrl}`,
  ];
  const text = textLines.join("\n");

  const e = escapeHtml;
  const locationRow =
    location !== null
      ? `<tr><td style="padding:4px 0 0 0;font-family:${FONT};font-size:14px;color:${INK};">` +
        `&#128205; ${e(location)}</td></tr>`
      : "";

  const html =
    `<!doctype html>` +
    `<html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${e(subject)}</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&display=swap" rel="stylesheet">` +
    `</head>` +
    `<body style="margin:0;padding:0;background-color:${PAGE};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">` +
    `<tr><td align="center" style="padding:32px 16px;">` +
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">` +
    // Header
    `<tr><td style="padding:0 0 16px 4px;font-family:${FONT};font-size:20px;font-weight:700;color:${PRIMARY};text-align:left;">CaleChip</td></tr>` +
    // Card
    `<tr><td style="background-color:#FFFFFF;border:1px solid ${BORDER};border-radius:20px;padding:32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="font-family:${FONT};font-size:15px;color:${GREY};padding:0 0 8px 0;">${e(GREETING(recipientName))}</td></tr>` +
    `<tr><td style="font-family:${FONT};font-size:20px;font-weight:700;line-height:1.35;color:${INK};padding:0 0 20px 0;">${e(headline)}</td></tr>` +
    // Event panel
    `<tr><td style="background-color:${PANEL_TINT[kind]};border-radius:14px;padding:16px 20px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr><td style="font-family:${FONT};font-size:16px;font-weight:700;color:${INK};padding:0 0 6px 0;">${e(event.name)}</td></tr>` +
    `<tr><td style="font-family:${FONT};font-size:14px;color:${INK};">&#128197; ${e(dates)}</td></tr>` +
    locationRow +
    `</table>` +
    `</td></tr>` +
    // Button
    `<tr><td style="padding:24px 0 0 0;">` +
    `<a href="${e(eventUrl)}" style="display:inline-block;background-color:${PRIMARY};color:#FFFFFF;font-family:${FONT};font-size:14px;font-weight:700;text-decoration:none;border-radius:999px;padding:12px 24px;">${BUTTON}</a>` +
    `</td></tr>` +
    `</table>` +
    `</td></tr>` +
    // Footer
    `<tr><td style="padding:16px 4px 0 4px;font-family:${FONT};font-size:12px;line-height:1.5;color:${GREY};">` +
    `${e(FOOTER_LEAD)}<a href="${e(profileUrl)}" style="color:${PRIMARY};text-decoration:underline;">${FOOTER_LINK}</a>.` +
    `</td></tr>` +
    `</table>` +
    `</td></tr>` +
    `</table>` +
    `</body></html>`;

  return { subject, html, text };
}
