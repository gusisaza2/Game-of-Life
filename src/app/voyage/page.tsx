// The macro Voyage Map (design doc Section 18.1/18.2): the account-level
// counterpart to a Goal's Milestone path, using the exact same node/route
// visual language (WindingPath.tsx) at the whole-journey scale -- one
// node per Capítulo, 1 through 15, replacing the placeholder "Chapter
// complete!" toast note in CLAUDE.md's MVP scope with something that
// actually feels like unlocking a destination.
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { milestoneNameForLevel } from "@/lib/milestones";
import { WindingPath, type PathNode } from "@/components/WindingPath";

const TOTAL_CHAPTERS = 15;
// Neutral teal (the app's own accent-primary), not tied to any one Area --
// the journey itself isn't scoped to a single Area the way a Goal is.
const VOYAGE_COLOR = { accent: "#0d9488", soft: "#0d94881a" };

export default async function VoyagePage() {
  const supabase = await createClient();
  const { data: player } = await supabase.from("players").select("current_level").single();

  if (!player) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <p className="text-foreground/60">No player found.</p>
      </main>
    );
  }

  const currentLevel = player.current_level;
  const nodes: PathNode[] = Array.from({ length: TOTAL_CHAPTERS }, (_, i) => {
    const chapter = i + 1;
    const name = milestoneNameForLevel(chapter);
    return {
      id: String(chapter),
      label: name ? `Chapter ${chapter} · ${name}` : `Chapter ${chapter}`,
      status: chapter < currentLevel ? "completed" : chapter === currentLevel ? "current" : "locked",
    };
  });

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <div className="w-full max-w-md flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Voyage</h1>
        <Link href="/" className="link-hover text-sm text-foreground/50">
          ← Today
        </Link>
      </div>
      <div className="w-full max-w-md">
        <WindingPath nodes={nodes} color={VOYAGE_COLOR} />
      </div>
    </main>
  );
}
