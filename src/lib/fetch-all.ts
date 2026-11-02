// Supabase/PostgREST silently caps any single response at 1000 rows -- no
// error, the result just stops. That's fine for "this month", but the
// all-time history (Habit Stats' month browser, the CSV export) would
// quietly lose its oldest or newest entries once task_logs grows past
// 1000, with nothing to indicate anything was cut. Pages through the
// query until a short page comes back.
//
// The caller's query must have a stable total order (e.g. a date plus a
// unique id), or rows can repeat or be skipped across page boundaries.
const PAGE_SIZE = 1000;

export async function fetchAllRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return rows;
  }
}
