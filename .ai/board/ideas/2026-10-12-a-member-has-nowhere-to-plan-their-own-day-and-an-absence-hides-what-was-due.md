---
stage: TRIAGE
agent: product
produced_at: 2026-10-12T10:27:12Z
inputs_read:
  - CLAUDE.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/templates/idea.md
  - .ai/board/backlog.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: ""
verdict_reason: ""
ticket_id: ""
awaiting_adrs: []
operator_request: "Tôi muốn thêm tính năng cho riêng mỗi user. Về việc lên danh sách task cho ngày. Brainstorm cho idea này"
---

# A member has nowhere to plan their own day, and an absence hides what was due on it

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

## Problem

*Derived from the request above and the brainstorm that followed it. The operator stated a
solution, not a problem.*

A member's work for a given day lives outside CaleChip, so when they declare PTO the product cannot
tell them what was due on those days. The charter's own cost, *"a handover arranged the night
before"* (`.ai/00-charter.md`), begins exactly there: the person booking the leave does not see, at
the moment of booking, what they had planned for the days they are leaving. Separately, unfinished
work from earlier days has no place to resurface, so it quietly drops.

## Who has it

Every member, daily for their own planning, and at the moment of declaring PTO.

## Evidence

The operator's request, verbatim above. A brainstorm (2026-10-12) offered four directions:
- A: tasks on a day, warned when that day becomes PTO.
- B: a handover list.
- C: a WFH-day plan.
- D: a plain to-do list.

**The operator chose: "đi theo hướng A"**, and answered the brainstorm's seven questions in one
message, quoted verbatim:

> 1. Tạm thời scope sẽ là riêng tuyệt đối
> 2. có hẳn 1 danh sách theo ngày. Ví dụ hôm nay thứ 3, khi bật app lên mà task trước thứ 3 còn chưa
>    tick done thì hiện thông báo cho user để tick hoàn thành hoặc cho 1 option move tất cả qua thứ 3.
> 3. Chưa cần bây giờ. Note lại vào todo để sau này làm
> 4. Nhắc lúc book PTO, Và cả trong trang task
> 5. có cho phép lặp lại. Note lại vào todo để sau này làm
> 6. Không đồng bộ
> 7. 1 trang riêng. Trên calendar hiện tại chỉ hiện cho thấy số lượng task và số lượng hoàn thành
>    trong ngày (nếu có). Ví dụ "icon task" 5/10

The brainstorm questions they answer, in order:
1. Private or team-visible.
2. A dated list, with carry-over.
3. Handover (B) now.
4. Where the PTO reminder shows.
5. Recurrence, priority, labels.
6. Sync with ClickUp or Jira.
7. Where tasks are displayed.

Follow-up questions at `/idea`, with each answer as picked, verbatim:

**F1: confirming the ADR.** Asked: *"CaleChip có thêm dữ liệu riêng tư đầu tiên: task cá nhân theo
ngày, chỉ chủ sở hữu đọc và ghi được, admin cũng không đọc được, ngoại lệ với nguyên tắc minh bạch
của charter. Task không bao giờ mang giờ (ước tính hay đã làm), để không chạm refusal 3. Charter
được bổ sung một đoạn ghi điều này." Đúng ý anh/chị không?*
**Answer: "Task chỉ có 2 trạng thái done hay chưa. Không mang thời gian cụ thể, chỉ tính theo ngày,
qua ngày hôm sau thì gọi là quá hạn".** The answer restates and sharpens the no-time half. The
privacy half, owner-only with admins included, rests on answer 1, *"riêng tuyệt đối"*. `/triage`
should read the two together. If it judges that "admin cũng không đọc được" needs words of its own,
that is the one question to ask.

**Q8: what a task carries.** A: a title and done/not done; B: as A plus a short plain-text note;
C: as B plus a priority.
**Answer: "B: + ghi chú ngắn".**

**Q9: when the overdue prompt shows.** A: once a day, dismissable; B: every time the app opens while
overdue tasks remain; C: as A plus delete. In each, the prompt offers ticking tasks done or moving
all of them to today.
**Answer: "B: Mỗi lần mở app".**

**Q10: which calendar view shows the task count** (the viewer's own tasks only). Month / Week / Year.
**Answer: "Week".**

**Q11: what the PTO reminder does.** It never blocks saving (refusal 6). A: a warning only, in the
PTO form like the overload warning, listing the tasks; B: as A plus "move all to the next working
day after the PTO".
**Answer: "A: Chỉ cảnh báo".**

**Q12: PTO only, or WFH too.**
**Answer: "A: Chỉ PTO".**

**Q13: which dates a task may be created on.** A: today and later, with past tasks still viewable,
tickable and movable; B: any date.
**Answer: "A: Hôm nay và tương lai".**

## Impact if ignored

Members keep their day's work somewhere else. Booking PTO keeps happening blind to what was planned
for those days, and the handover is still arranged the night before.

## Constraints already known

- **A new ADR is owed. It is the first private data in the product.** Today every member reads the
  whole team's calendar by design (`.ai/00-charter.md` § *Who uses it*). A task is readable and
  writable by its owner only, and not by an admin or a manager (answer 1, *"riêng tuyệt đối"*).
  The charter gains a paragraph recording this exception. The confirmation is F1 together with
  answer 1; see § Evidence.
- **Charter refusal 3 stands.** A task has exactly two states, done and not done. It carries no
  time, no estimate and no hours, only a date. It is *overdue* once its date has passed while it
  is not done (F1).
- **Charter refusal 6 stands.** The PTO reminder never blocks saving (Q11-A).
- **The reminder fires for PTO only** (Q12-A). It shows in the PTO entry form, where the overload
  warning already shows (CAL-07), and on the task page (answer 4). An admin or manager creating or
  editing another person's entry (CAL-03) cannot read that person's tasks, so no reminder is shown
  to them. A task is not an entry, and INV-04, INV-05 and INV-07 are not engaged: tasks never
  enter an absence count.
- **The week view shows only the viewer's own count** (Q10, answer 7). The count is an icon plus
  done/total, e.g. 5/10, and shows only on days that have tasks. Month and year views get nothing.
  `CLAUDE.md` § *Visual direction*: density wins on the grid, so the count must not cost a row.

## Out of scope

**Deferred by the operator: the "todo" the operator asked to note, each a later idea:**
- **Handover**, i.e. giving a task to a colleague (direction B; answer 3 *"Note lại vào todo để
  sau này làm"*).
- **Recurring tasks** (answer 5 *"có cho phép lặp lại. Note lại vào todo để sau này làm"*).

Decided against:
- Sync with ClickUp, Jira or any tracker (answer 6).
- Any time on a task: hours, estimates, a time of day (F1, refusal 3).
- Priority and labels (Q8-B).
- Moving tasks automatically on PTO (Q11-A).
- A reminder for WFH (Q12-A).
- Creating a task on a past date (Q13-A).
- A task count on the month or year views (Q10).
- Any reader but the owner, admins included (answer 1).
- Directions C (WFH-day plan) and D (plain to-do), as offered at the brainstorm.

## Open questions

None the operator owns, unless `/triage` finds F1 plus answer 1 insufficient for the ADR (see
§ Evidence). Assumptions this file made rather than asked, each cheap to reverse and each PLAN's to
overrule:

1. **The overdue prompt lists every not-done task dated before today.** Each can be ticked done
   individually. One action, "move all to today", re-dates all of them to today. It closes for the
   current page load and returns on the next app open (Q9-B).
2. **"Today" is the member's local calendar date in the browser.** The product has no per-user
   timezone.
3. **Tasks can be edited, deleted, re-dated and un-ticked** on the task page.
4. **The task page is one dated list.** It opens on today, has navigation by day, and includes a
   way to see overdue tasks. Its layout is `tech-lead-design`'s under the visual carve-out.
5. **A removed member's tasks stay**, unreadable by anyone, consistent with soft delete
   (TEA-04). Nothing reads them.
