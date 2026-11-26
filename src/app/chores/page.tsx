import Link from "next/link";
import { TaskBoard } from "@/components/TaskBoard";
import { loadBoard } from "@/lib/board-data";

export const dynamic = "force-dynamic";

export default async function ChoresPage() {
  const board = await loadBoard("chore");
  if (!board) return <main className="p-6">No player found.</main>;

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <header className="flex w-full max-w-md items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Chores</h1>
        <div className="flex items-center gap-3">
          <Link href="/missions" className="link-hover text-sm text-foreground/50">
            Misiones →
          </Link>
          <Link href="/" className="link-hover text-sm text-foreground/50">
            ← Today
          </Link>
        </div>
      </header>

      <TaskBoard
        kind="chore"
        mode="page"
        tasks={board.tasks}
        completedIds={board.completedIds}
        lockedIds={board.lockedIds}
        activeChores={board.activeChores}
        playerId={board.playerId}
        today={board.today}
      />
    </main>
  );
}
