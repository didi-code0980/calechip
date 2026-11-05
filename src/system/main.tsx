// MIR-18 — the system panel's entry. 01-plan.md §§ 2b, 4.5; ADR-074 decision 6.
//
// IMPORTS NOTHING FROM THE MEMBER APP: not `App.tsx`, `components/`, `routes/`, `hooks/` or
// `@/lib/data`. Only React, the panel's own seam and the shared stylesheet. No router — the screen is
// a function of `SystemGate` plus the enrolment value held here.
//
// The layout is the Tech Lead's own (§ 2b, "Visual reference: none").
import { StrictMode, useEffect, useState, type FormEvent, type JSX } from "react";
import { createRoot } from "react-dom/client";
import {
  systemSeam,
  systemSeamName,
  type SystemGate,
  type TotpEnrolment,
} from "@/lib/data/system";
import "../index.css";

const START_ENROLMENT_FAILED = "Could not start set-up. Reload to try again.";

const fieldClass = "w-full rounded-pill bg-field px-4 py-3 text-ink outline-none";
const primaryButtonClass =
  "w-full rounded-pill bg-primary px-4 py-3 font-semibold text-white disabled:opacity-60";
const textButtonClass = "text-sm font-semibold text-ink-2 underline-offset-2 hover:underline";

function CodeForm({
  onSubmit,
  error,
  busy,
}: {
  onSubmit: (code: string) => void;
  error: string | null;
  busy: boolean;
}): JSX.Element {
  const [code, setCode] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit(code);
  };
  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <input
        data-testid="system-code-input"
        aria-label="6-digit code"
        className={`${fieldClass} text-center text-lg tracking-[0.4em]`}
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
      <button data-testid="system-code-submit" type="submit" className={primaryButtonClass} disabled={busy}>
        Verify
      </button>
      {error ? (
        <p data-testid="system-code-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function SystemPanel(): JSX.Element {
  const [gate, setGate] = useState<SystemGate | null>(null);
  const [enrolment, setEnrolment] = useState<TotpEnrolment | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Every transition goes through here, so the enrolment is started exactly when `enrol` arrives.
  const arrive = async (next: SystemGate) => {
    setCodeError(null);
    setEnrolment(null);
    if (next.state === "enrol") {
      try {
        setEnrolment(await systemSeam.startEnrolment());
      } catch {
        setCodeError(START_ENROLMENT_FAILED);
      }
    }
    setGate(next);
  };

  useEffect(() => {
    let live = true;
    void systemSeam.gate().then((next) => {
      if (live) void arrive(next);
    });
    return () => {
      live = false;
    };
  }, []); // The gate is read once, on mount.

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setSignInError(null);
    const result = await systemSeam.signIn(email, password);
    setBusy(false);
    if (!result.ok) {
      setSignInError(result.error.message);
      return;
    }
    setPassword("");
    await arrive(result.value);
  };

  const verify = async (code: string) => {
    setBusy(true);
    setCodeError(null);
    const result = await systemSeam.verifyCode(code, enrolment?.factorId);
    setBusy(false);
    if (!result.ok) {
      setCodeError(result.error.message);
      return;
    }
    await arrive(result.value);
  };

  const signOut = async () => {
    await systemSeam.signOut();
    setSignInError(null);
    await arrive({ state: "signed-out" });
  };

  const backToSignIn = () => {
    setSignInError(null);
    setGate({ state: "signed-out" });
  };

  let screen: JSX.Element;
  if (gate === null) {
    screen = (
      <p data-testid="system-loading" role="status" className="text-ink-3">
        Loading…
      </p>
    );
  } else if (gate.state === "signed-out") {
    screen = (
      <form data-testid="system-signin-form" className="flex flex-col gap-3" onSubmit={signIn}>
        <h1 className="mb-2 text-xl font-bold text-ink">Sign in to the system panel</h1>
        <input
          data-testid="system-signin-email"
          aria-label="Email"
          placeholder="Email"
          type="email"
          autoComplete="username"
          className={fieldClass}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <input
          data-testid="system-signin-password"
          aria-label="Password"
          placeholder="Password"
          type="password"
          autoComplete="current-password"
          className={fieldClass}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <button data-testid="system-signin-submit" type="submit" className={primaryButtonClass} disabled={busy}>
          Sign in
        </button>
        {signInError ? (
          <p data-testid="system-signin-error" role="alert" className="text-sm text-danger">
            {signInError}
          </p>
        ) : null}
      </form>
    );
  } else if (gate.state === "not-system-admin") {
    screen = (
      <div data-testid="system-not-authorised" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-ink">No access</h1>
        <p className="text-ink-2">This account has no access to the system panel.</p>
        <button
          data-testid="system-not-authorised-back"
          type="button"
          className={`${textButtonClass} self-start`}
          onClick={backToSignIn}
        >
          Back to sign in
        </button>
      </div>
    );
  } else if (gate.state === "enrol") {
    screen = (
      <div data-testid="system-enrol" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-ink">Set up two-step sign-in</h1>
        <p className="text-ink-2">
          Scan this code with an authenticator app, then enter the 6-digit code it shows.
        </p>
        {enrolment ? (
          <>
            <div className="flex justify-center">
              <img
                data-testid="system-enrol-qr"
                src={enrolment.qrCode}
                alt="Authenticator set-up code"
                width={176}
                height={176}
                className="h-44 w-44 rounded-xl bg-white p-2"
              />
            </div>
            <div>
              <p className="text-xs text-ink-3">Or enter this key</p>
              <p data-testid="system-enrol-secret" className="font-mono text-xs break-all text-ink-2">
                {enrolment.secret}
              </p>
            </div>
          </>
        ) : null}
        <CodeForm onSubmit={(code) => void verify(code)} error={codeError} busy={busy || !enrolment} />
      </div>
    );
  } else if (gate.state === "verify") {
    screen = (
      <div data-testid="system-verify" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-ink">Enter your code</h1>
        <p className="text-ink-2">Open your authenticator app and enter the 6-digit code.</p>
        <CodeForm onSubmit={(code) => void verify(code)} error={codeError} busy={busy} />
        <button
          data-testid="system-signout"
          type="button"
          className={`${textButtonClass} self-center`}
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    );
  } else {
    screen = (
      <div data-testid="system-signed-in" className="flex flex-col gap-3">
        <h1 className="text-xl font-bold text-ink">System panel</h1>
        <p className="text-ink-2">
          Signed in as <span data-testid="system-signed-in-email">{gate.email}</span>
        </p>
        <span className="self-start rounded-pill bg-wfh px-3 py-1 text-xs font-semibold text-wfh-ink">
          Two-step verified
        </span>
        <p className="py-6 text-center text-ink-3">Nothing to manage here yet.</p>
        <button
          data-testid="system-signout"
          type="button"
          className="w-full rounded-pill bg-field px-4 py-3 font-semibold text-ink"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div data-testid="system-panel-root" className="min-h-screen bg-bg px-4 py-10 font-sans">
      {/* Written out again rather than imported: the panel does not import `App.tsx` (§ 4.5). */}
      {systemSeamName === "mock" ? (
        <p
          data-testid="seam-banner"
          data-seam="mock"
          role="status"
          className="mx-auto mb-6 max-w-md rounded-xl bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
        >
          Demo build — data lives only in this browser and is lost when you reload the page.
        </p>
      ) : null}
      <div className="mx-auto max-w-sm">
        <p className="mb-3 text-center text-xs font-semibold tracking-wide text-ink-3 uppercase">
          CaleChip · System
        </p>
        <div className="rounded-card bg-card p-8">{screen}</div>
      </div>
    </div>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from system.html");

createRoot(root).render(
  <StrictMode>
    <SystemPanel />
  </StrictMode>,
);
