// Priority stars when creating or editing a Mission or chore (habits have none).
export function PrioritySelect({ defaultValue = 0, small = false }: { defaultValue?: number; small?: boolean }) {
  return (
    <label className={`flex items-center gap-2 text-foreground/60 ${small ? "text-xs" : "text-sm"}`}>
      Priority
      <select
        name="priority"
        defaultValue={String(defaultValue)}
        className={`rounded border border-foreground/20 bg-transparent px-2 py-1 ${small ? "text-xs" : "text-sm"}`}
      >
        <option value="0">No stars</option>
        <option value="1">★</option>
        <option value="2">★★</option>
        <option value="3">★★★</option>
      </select>
    </label>
  );
}
