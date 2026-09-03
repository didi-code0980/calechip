// TEA-05 — the session, read here and nowhere else above the seam. 01-plan.md section 4.3.
//
// **This file is the answer to `.ai/standards/rbac-and-security.md:114`** — *"name where the session
// is read on the client, and what happens on expiry"* — answered FOR THIS TICKET, which is the most
// a board-plane artifact may do. That line is standards plane and human-owned under RULE-01, and it
// is still owed: until a human writes it, the answer lives in a ticket artifact and in this comment,
// where the next reader will not think to look.
//
// On expiry the client emits with a null session and this hook re-resolves to `{ state:
// "signed-out" }`, which `App.tsx` routes to the sign-in screen (AC-8). There is no timer here and
// there must not be one: `persistSession` and `autoRefreshToken` are the client's own defaults, and
// a second timer would be a second source of truth about whether somebody is signed in.
import { useCallback, useEffect, useState } from "react";
// The seam, through its one door. Nothing above the seam names an implementation, and this file
// must never import `./supabase` or `./mock` (RULE-02).
import { seam, type SignInInput } from "@/lib/data";
import type { Membership, Result, Session } from "@/lib/domain/types";

export interface SessionState {
  membership: Membership;
  /**
   * True until the first resolution completes. AC-9 must not flash the sign-in screen at somebody
   * who IS signed in, and `signed-out` is indistinguishable from `not yet known` without this.
   *
   * False after the first resolution and false thereafter: a later change re-resolves without
   * returning the screen to a spinner.
   */
  resolving: boolean;
  signIn(input: SignInInput): Promise<Result<Session>>;
  signOut(): Promise<Result<void>>;
}

export function useSession(): SessionState {
  const [membership, setMembership] = useState<Membership>({ state: "signed-out" });
  const [resolving, setResolving] = useState(true);

  useEffect(() => {
    let live = true;
    // Later answers win. Two resolutions are in flight at once on an ordinary mount — this effect's
    // own, and the one the subscription's first event triggers — and without a sequence number the
    // slower of the two overwrites the newer answer with a stale one.
    let latest = 0;

    // The three states of section 4.3, resolved in this order. It re-reads the session from the
    // seam rather than trusting the one the listener carried, so there is ONE path to a membership
    // and not two that can disagree.
    async function resolve(): Promise<void> {
      const sequence = ++latest;
      let next: Membership = { state: "signed-out" };

      try {
        const session = await seam.getSession();
        if (session) {
          // AC-4's whole mechanism. "Signed in" and "on a team" are different facts, and ADR-009
          // §Consequences requires the second one's absence to be handled in the interface rather
          // than left to look like a bug.
          const member = await seam.getCurrentMember();
          next = member
            ? { state: "member", user: session.user, member }
            : { state: "member-less", user: session.user };
        }
      } catch {
        // A transport failure, or the Supabase client raising on an unusable configuration before
        // any request leaves — the throw SignUp.tsx and AllowList.tsx already had to handle. This
        // fails CLOSED: `signed-out` routes to the sign-in screen, which is the only state that
        // cannot show anybody something they may not be allowed to see. It is not a true sentence
        // about whether they are signed in, and it is the safe one.
        next = { state: "signed-out" };
      }

      if (!live || sequence !== latest) return;
      setMembership(next);
      setResolving(false);
    }

    // Subscribe BEFORE the first read, so a change arriving during that read is not missed.
    const unsubscribe = seam.onAuthStateChange(() => {
      void resolve();
    });
    void resolve();

    // The unsubscribe is not optional. A leaked subscription survives a hot reload and then
    // re-resolves against a stale closure, setting state on a component that is gone.
    return () => {
      live = false;
      unsubscribe();
    };
  }, []);

  // Both pass straight through. Neither sets state here: the seam notifies, the listener above
  // re-resolves, and that is the single path by which a membership changes. A local `setMembership`
  // beside these would be the second source of truth this hook exists to avoid.
  const signIn = useCallback((input: SignInInput) => seam.signIn(input), []);
  const signOut = useCallback(() => seam.signOut(), []);

  return { membership, resolving, signIn, signOut };
}
