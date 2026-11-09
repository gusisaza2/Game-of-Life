"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getNowTimeString, getTodayDateString } from "@/lib/today";

export type Now = { date: string; time: string };

const TICK_MS = 30_000;

// The current Bogota date and time, kept up to date while the page is open.
//
// Server components compute "now" once, at render, so a page left open would
// freeze on that moment (and an app reopened hours later would still show the
// old time until reloaded). This hook starts from the server's value -- so
// the first render matches the server HTML exactly -- and then follows the
// clock: it ticks every 30 s, snaps to the real time the moment the tab
// becomes visible again, and asks the server for fresh data when the day
// rolls over or the player comes back to the tab.
//
// It reads the same fixed UTC-5 clock as the rest of the app (today.ts), not
// the device's timezone, so the app agrees with itself wherever the phone is.
export function useNow(initial: Now): Now {
  const router = useRouter();
  const [now, setNow] = useState<Now>(initial);
  // The date the server data was rendered for; a side effect like a refresh
  // doesn't belong inside a state updater, so the check lives here.
  const renderedDate = useRef(initial.date);

  useEffect(() => {
    const read = (): Now => ({ date: getTodayDateString(), time: getNowTimeString() });
    const tick = () => {
      const next = read();
      // The day changed under an open page: what the server rendered
      // (today's items, "tomorrow" labels...) is stale.
      if (renderedDate.current !== next.date) {
        renderedDate.current = next.date;
        router.refresh();
      }
      setNow(next);
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const next = read();
      renderedDate.current = next.date;
      setNow(next);
      router.refresh();
    };

    // Snap to the real time right after mount (the server value may be a
    // little old by the time the page hydrates), then keep ticking.
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, TICK_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return now;
}
