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
// No tracking pixel. Never Quicksand (`CLAUDE.md` § Visual direction).
//
// **SOLO 2026-10-09 — RESTYLED TO THE OPERATOR'S MOCKUP, IN ENGLISH.** Header with the logo avatar,
// the product name and a per-kind badge; a detail panel of labelled rows with white chips; a full-width
// button; the opt-out sentence; a footer strip (MMLabs, CaleChip, Contact). The one image is the logo,
// `${appUrl}/logo.png` (`public/logo.png`), with alt text and the name beside it in text, so the mail
// still reads with images blocked. There is no time of day in the request, so the date chip carries
// the weekday instead.

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


const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** SOLO 2026-10-09. The weekday line under the date: `Monday` for one day, `Mon – Wed` for a range,
 *  empty when a date does not parse. Computed from the date alone — there is no time of day. */
export function formatEventWeekdays(startDate: string, endDate: string): string {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return "";
  const dow = (d: { year: number; month: number; day: number }): number =>
    new Date(Date.UTC(d.year, d.month - 1, d.day)).getUTCDay();
  if (startDate === endDate) return WEEKDAYS_LONG[dow(start)] ?? "";
  return `${WEEKDAYS[dow(start)] ?? ""} – ${WEEKDAYS[dow(end)] ?? ""}`;
}

/** § 4.4, plus the SOLO 2026-10-09 restyle: the subject and the headline (the EVT-04 in-app sentence,
 *  unchanged), and the badge, the intro line and the button label for each kind. */
function wordsFor(
  kind: EventEmailKind,
  actor: string,
  event: string,
): { subject: string; headline: string; badge: string; intro: string; button: string } {
  switch (kind) {
    case "event_created":
      return {
        subject: `${actor} announced ${event}`,
        headline: `${actor} announced ${event}.`,
        badge: "New event",
        intro: "There's a new event on the team calendar.",
        button: "View event",
      };
    case "event_invited":
      return {
        subject: `${actor} invited you to ${event}`,
        headline: `${actor} invited you to ${event}.`,
        badge: "Invitation",
        intro: "Save the date — we'd love to have you there.",
        button: "View & join",
      };
    case "attendance_approved":
      return {
        subject: `Your request to join ${event} was approved`,
        headline: `Your request to join ${event} was approved.`,
        badge: "Approved ★",
        intro: "You're on the list. See you there!",
        button: "View event",
      };
    case "attendance_rejected":
      return {
        subject: `Your request to join ${event} was declined`,
        headline: `Your request to join ${event} was declined.`,
        badge: "Declined",
        intro: "The organiser couldn't fit you in this time.",
        button: "View event",
      };
    case "attendance_removed":
      return {
        subject: `You were removed from ${event}`,
        headline: `You were removed from ${event}.`,
        badge: "Removed",
        intro: "You're no longer on the list for this event.",
        button: "View event",
      };
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
const MUTED = "#9A93B8"; // captions and labels, the mockup's lavender-grey
const PILL_BORDER = "#DCD5F2";
// The mockup's button is #A98BE8; white on it is about 2.6:1, so this is the same hue, deep enough for
// white text to read.
const BUTTON_BG = "#7C5CD6";
const FONT = "'Nunito', 'Baloo 2', 'Segoe UI', Arial, sans-serif";

const PRODUCT_NAME = "CaleChip";
const CAPTION = "TEAM CALENDAR";
const MMLABS_URL = "https://mmlabs.online";
// TODO(verify): the Contact link's target. The operator left it empty on 2026-10-09, so it renders as
// plain text with no href until there is one.
const CONTACT_LABEL = "Contact";

const GREETING = (name: string): string => `Hi ${name},`;
const FOOTER_LEAD = "You got this email because you are on CaleChip. Event email can be turned off on your ";
const FOOTER_LINK = "Profile";

/** AC-8 to AC-11. `appUrl` has no trailing slash (the caller strips one). Every interpolated value is
 *  HTML-escaped in `html` (`& < > " '`) and left as written in `subject` and `text`. */
export function renderEventEmail(request: EventEmailRequest, appUrl: string): RenderedEmail {
  const { kind, recipientName, actorName, event } = request;
  const { subject, headline, badge, intro, button } = wordsFor(kind, actorName, event.name);
  const dates = formatEventDates(event.startDate, event.endDate);
  const weekdays = formatEventWeekdays(event.startDate, event.endDate);
  const location = event.location !== null && event.location.trim() !== "" ? event.location : null;
  const eventUrl = `${appUrl}/events/${encodeURIComponent(event.id)}`;
  const profileUrl = `${appUrl}/profile`;
  const logoUrl = `${appUrl}/logo.png`;

  const textLines = [
    GREETING(recipientName),
    "",
    headline,
    intro,
    "",
    event.name,
    weekdays !== "" ? `${dates} (${weekdays})` : dates,
    ...(location !== null ? [location] : []),
    "",
    `${button}: ${eventUrl}`,
    "",
    `${FOOTER_LEAD}${FOOTER_LINK}.`,
    `Turn event email off: ${profileUrl}`,
    "",
    `MMLabs: ${MMLABS_URL}`,
    `${PRODUCT_NAME}: ${appUrl}`,
  ];
  const text = textLines.join("\n");

  const e = escapeHtml;
  const td = (style: string, body: string): string => `<td style="font-family:${FONT};${style}">${body}</td>`;

  // One labelled row of the detail panel: label on the left, a white rounded chip on the right.
  const panelRow = (label: string, chip: string, divider: boolean): string =>
    `<tr><td style="padding:14px 0;${divider ? `border-top:1px solid ${PILL_BORDER};` : ""}">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    td(`font-size:14px;font-weight:700;color:${MUTED};vertical-align:middle;padding-right:12px;`, label) +
    `<td align="right" style="vertical-align:middle;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr>` +
    `<td style="background-color:#FFFFFF;border-radius:16px;padding:10px 14px;text-align:right;font-family:${FONT};">${chip}</td>` +
    `</tr></table>` +
    `</td>` +
    `</tr></table>` +
    `</td></tr>`;

  const chipMain = (value: string): string =>
    `<div style="font-size:15px;font-weight:700;color:${INK};line-height:1.35;">${value}</div>`;
  const chipSub = (value: string): string =>
    `<div style="font-size:12px;color:${GREY};line-height:1.4;padding-top:2px;">${value}</div>`;

  const eventRow = panelRow("Event", chipMain(e(event.name)), false);
  const whenRow = panelRow(
    "&#128338; When",
    chipMain(e(dates)) + (weekdays !== "" ? chipSub(e(weekdays)) : ""),
    true,
  );
  const locationRow = location !== null ? panelRow("&#128205; Where", chipMain(e(location)), true) : "";

  const footerLink = (label: string, href: string | null): string =>
    href !== null
      ? `<a href="${e(href)}" style="color:${MUTED};text-decoration:none;">${label}</a>`
      : `<span style="color:${MUTED};">${label}</span>`;
  const footerDot = `<span style="color:${PILL_BORDER};padding:0 10px;">&#8226;</span>`;

  const html =
    `<!doctype html>` +
    `<html lang="en"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${e(subject)}</title>` +
    `<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">` +
    `</head>` +
    `<body style="margin:0;padding:0;background-color:${PAGE};">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE};">` +
    `<tr><td align="center" style="padding:32px 12px;">` +
    // Card
    `<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background-color:#FFFFFF;border:1px solid ${BORDER};border-radius:28px;box-shadow:0 12px 32px rgba(42,33,69,0.10);">` +
    // Header: logo avatar, name and caption on the left; the kind badge on the right
    `<tr><td style="padding:28px 32px 8px 32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="44" style="width:44px;vertical-align:middle;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td width="44" height="44" align="center" valign="middle" style="width:44px;height:44px;background-color:${PRIMARY};border-radius:50%;text-align:center;vertical-align:middle;">` +
    `<img src="${e(logoUrl)}" width="32" height="32" alt="${PRODUCT_NAME}" style="display:block;margin:0 auto;width:32px;height:32px;border:0;outline:none;text-decoration:none;font-family:${FONT};font-size:9px;color:#FFFFFF;">` +
    `</td></tr></table>` +
    `</td>` +
    `<td style="vertical-align:middle;padding-left:12px;font-family:${FONT};">` +
    `<div style="font-size:18px;font-weight:800;color:${INK};line-height:1.2;">${PRODUCT_NAME}</div>` +
    `<div style="font-size:11px;font-weight:700;letter-spacing:0.08em;color:${MUTED};line-height:1.4;">${CAPTION}</div>` +
    `</td>` +
    `<td align="right" style="vertical-align:middle;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="right"><tr>` +
    `<td style="background-color:${PAGE};border:1px solid ${PILL_BORDER};border-radius:999px;padding:5px 12px;font-family:${FONT};font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:${INK};white-space:nowrap;">&#9993; ${e(badge)}</td>` +
    `</tr></table>` +
    `</td>` +
    `</tr></table>` +
    `</td></tr>` +
    // Headline, greeting, intro
    `<tr><td style="padding:24px 32px 0 32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr>${td(`font-size:24px;font-weight:800;line-height:1.3;color:${INK};padding:0 0 18px 0;`, e(headline))}</tr>` +
    `<tr>${td(`font-size:15px;font-weight:700;color:${INK};padding:0 0 8px 0;`, e(GREETING(recipientName)))}</tr>` +
    `<tr>${td(`font-size:15px;line-height:1.6;color:${GREY};padding:0 0 24px 0;`, e(intro))}</tr>` +
    `</table>` +
    `</td></tr>` +
    // Detail panel
    `<tr><td style="padding:0 32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PANEL_TINT[kind]};border:1px solid ${PILL_BORDER};border-radius:20px;">` +
    `<tr><td style="padding:18px 22px 8px 22px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">` +
    `<tr>${td(`font-size:12px;font-weight:800;letter-spacing:0.08em;color:${MUTED};padding:0 0 4px 0;`, "EVENT DETAILS")}</tr>` +
    eventRow +
    whenRow +
    locationRow +
    `</table>` +
    `</td></tr>` +
    `</table>` +
    `</td></tr>` +
    // Button, full width
    `<tr><td style="padding:28px 32px 0 32px;">` +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>` +
    `<td align="center" style="background-color:${BUTTON_BG};border-radius:16px;">` +
    `<a href="${e(eventUrl)}" style="display:block;padding:15px 24px;font-family:${FONT};font-size:16px;font-weight:800;color:#FFFFFF;text-decoration:none;text-align:center;">${e(button)} &#8250;</a>` +
    `</td>` +
    `</tr></table>` +
    `</td></tr>` +
    // Opt-out sentence
    `<tr><td style="padding:24px 32px 28px 32px;font-family:${FONT};font-size:12px;line-height:1.5;color:${GREY};text-align:center;">` +
    `${e(FOOTER_LEAD)}<a href="${e(profileUrl)}" style="color:${PRIMARY};text-decoration:underline;">${FOOTER_LINK}</a>.` +
    `</td></tr>` +
    // Footer strip
    `<tr><td align="center" style="background-color:${PAGE};border-top:1px solid ${BORDER};border-radius:0 0 28px 28px;padding:20px 32px;font-family:${FONT};font-size:12px;font-weight:800;letter-spacing:0.08em;text-transform:uppercase;">` +
    footerLink("MMLabs", MMLABS_URL) +
    footerDot +
    footerLink(PRODUCT_NAME, appUrl) +
    footerDot +
    footerLink(CONTACT_LABEL, null) +
    `</td></tr>` +
    `</table>` +
    `</td></tr>` +
    `</table>` +
    `</body></html>`;

  return { subject, html, text };
}
