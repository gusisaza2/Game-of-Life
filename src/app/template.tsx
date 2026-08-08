"use client";

import { useEffect, useState } from "react";

// Next.js remounts template.tsx (unlike layout.tsx) on every navigation,
// which is what lets this re-trigger on each Today <-> Manage switch.
// Same mount-then-flip-a-frame-later pattern as the Goal wizard's enter
// transition (GoalWizard.tsx) -- one consistent "how things appear" feel
// across the app instead of an instant, jarring page swap.
export default function Template({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className={`flex flex-1 flex-col transition-all duration-300 ease-out ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      {children}
    </div>
  );
}
