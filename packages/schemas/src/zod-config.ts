import { z } from "zod";

// Zod's JIT probes `new Function`, which our Content-Security-Policy forbids
// (no 'unsafe-eval'). Jitless parsing is plenty fast for form-sized input.
// Imported first by index.ts so it runs before any schema is built.
z.config({ jitless: true });
