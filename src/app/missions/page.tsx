import Link from "next/link";
import { TaskBoard } from "@/components/TaskBoard";
import { loadBoard } from "@/lib/board-data";

export const dynamic = "force-dynamic";

export default async function MissionsPage() {
  const board = await loadBoard("main_task");
  if (!board) return <main className="p-6">No player found.</main>;

  return (
    <main className="flex-1 flex flex-col items-center gap-6 p-6 sm:p-12">
      <header className="flex w-full max-w-md items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Misiones</h1>
        <div className="flex items-center gap-3">
          <Link href="/chores" className="link-hover text-sm text-foreground/50">
            Chores →
          </Link>
          <Link href="/" className="link-hover text-sm text-foreground/50">
            ← Today
          </Link>
        </div>
      </header>

      <TaskBoard
        kind="mission"
        mode="page"
        tasks={board.tasks}
        completedIds={board.completedIds}
        lockedIds={board.lockedIds}
        playerId={board.playerId}
        today={board.today}
      />
    </main>
  );
}
