"use client";

import * as React from "react";
import { markNotificationsRead } from "@/app/app/calendar/actions";

/** Marks the notifications shown on screen as read once the page has been seen. */
export function MarkRead({ ids }: { ids: string[] }) {
  const done = React.useRef(false);
  React.useEffect(() => {
    if (done.current) return;
    done.current = true;
    void markNotificationsRead(ids);
  }, [ids]);
  return null;
}
