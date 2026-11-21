import type { Instrumentation } from "next";

/**
 * Server error reporting. Every uncaught error in a route, server component or
 * action is logged as one JSON line, which Vercel's log search, log drains and
 * alerting can filter on (`"source":"orvelia"`). No request bodies, cookies or
 * query strings are logged.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const e = err as Error & { digest?: string };
  console.error(
    JSON.stringify({
      source: "orvelia",
      level: "error",
      message: e?.message?.slice(0, 500) ?? String(err),
      digest: e?.digest,
      method: request.method,
      path: request.path.split("?")[0],
      routePath: context.routePath,
      routeType: context.routeType,
      renderSource: "renderSource" in context ? context.renderSource : undefined,
      release: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
      at: new Date().toISOString(),
    }),
  );
};
