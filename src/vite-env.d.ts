/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "mock" forces the mock seam even when a URL is set — src/lib/data/index.ts:390. */
  readonly VITE_DATA_SEAM?: "mock";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
