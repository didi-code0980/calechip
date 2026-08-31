// The routed shell. 02-design.md section 1.3 and section 6.2.
//
// `data-testid="app-root"` KEEPS its name and moves onto the element wrapping <Routes>, so the
// scaffold smoke test in tests/e2e/smoke.spec.ts keeps passing without being edited — which is why
// that file is deliberately absent from allowed_paths.
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { seamName } from "./lib/data";
import SignUp from "./routes/SignUp";

export default function App() {
  return (
    <BrowserRouter>
      <main data-testid="app-root" className="min-h-screen bg-slate-50 p-8 font-sans">
        {/* Design section 6.2 rule 2. A build with no VITE_SUPABASE_URL resolves to the in-memory
            seam rather than to a screen that throws — but a SILENT fallback to a fake datastore is
            worse than the crash it replaces: a deployment that forgets one environment variable
            would accept sign-ups into memory and look entirely normal. This banner is permanent and
            not dismissible, and it is also how a test asserts which implementation it drove. */}
        {seamName === "mock" ? (
          <p
            data-testid="seam-banner"
            data-seam="mock"
            role="status"
            className="mx-auto mb-6 max-w-md rounded-xl bg-amber-100 px-4 py-2 text-center text-sm text-amber-900"
          >
            Bản chạy thử — dữ liệu chỉ nằm trong bộ nhớ trình duyệt và sẽ mất khi tải lại trang.
          </p>
        ) : null}

        <Routes>
          <Route path="/signup" element={<SignUp />} />
          {/* Temporary, and named as such: this half of TEA-01 has exactly one screen, and a route
              that renders nothing would leave the ticket unexercisable. The sign-in half replaces
              this with /signin and /. */}
          <Route path="*" element={<Navigate to="/signup" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
