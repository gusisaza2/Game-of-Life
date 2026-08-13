// The Avatar's "persistent but secondary" presence (design doc Section
// 12.1): a small corner badge on Today, expanding on tap into the Avatar
// Growth Rings view (Section 20) -- five per-area rings arranged around
// the Avatar, each reusing AreaIcon.tsx so they never read as the same
// metaphor as the per-Habit Streak rings elsewhere on the page. Also owns
// the one-time-per-crossing "ring just hit 100%" full-screen celebration
// (Section 20.4) and a lightweight avatar customization form.

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { updateAvatar } from "@/app/actions";
import { Avatar } from "@/components/Avatar";
import { GrowthRing } from "@/components/GrowthRing";
import { AreaIcon } from "@/components/AreaIcon";
import {
  SKIN_TONES,
  HAIR_COLORS,
  EYE_COLORS,
  HAIR_STYLES,
  GENDERS,
  type AvatarConfig,
} from "@/lib/avatar";

type Ring = { areaName: string; fill: number; color: string };

// CENTER (and so the overall canvas size, CENTER*2) stays fixed -- it's
// already near the safe limit for the 375px mobile viewport (320px canvas
// vs ~327px available inside the max-w-md overlay's padding). Only the
// visual elements grow by 10%, which still leaves enough clearance
// between the ring cluster and the avatar at the unchanged RING_RADIUS.
const RING_RADIUS = 118;
const CENTER = 160;
const AVATAR_SIZE = 121;
const RING_SIZE = 68;

function ringPosition(i: number) {
  const angle = (-90 + i * 72) * (Math.PI / 180);
  return { x: CENTER + RING_RADIUS * Math.cos(angle), y: CENTER + RING_RADIUS * Math.sin(angle) };
}

function Overlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => setEntered(true));
    return () => {
      document.body.style.overflow = previousOverflow;
      cancelAnimationFrame(id);
    };
  }, []);

  return createPortal(
    <div
      className={`fixed inset-0 z-50 overflow-y-auto bg-background transition-opacity duration-300 ease-out ${
        entered ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-6 transition-transform duration-300 ease-out ${
          entered ? "translate-y-0" : "translate-y-4"
        }`}
      >
        <div className="flex items-center justify-end">
          <button type="button" onClick={onClose} className="link-hover text-xs text-foreground/45">
            Close
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function AvatarWidget({
  playerId,
  config,
  rings,
}: {
  playerId: string;
  config: AvatarConfig;
  rings: Ring[];
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AvatarConfig>(config);
  const [celebration, setCelebration] = useState<Ring | null>(null);
  const [isPending, startTransition] = useTransition();
  const prevFillsRef = useRef<Record<string, number> | null>(null);

  const fillKey = rings.map((r) => `${r.areaName}:${r.fill.toFixed(3)}`).join("|");

  useEffect(() => {
    const prev = prevFillsRef.current;
    if (prev) {
      const justFilled = rings.find((r) => (prev[r.areaName] ?? 0) < 1 && r.fill >= 1);
      if (justFilled) setCelebration(justFilled);
    }
    prevFillsRef.current = Object.fromEntries(rings.map((r) => [r.areaName, r.fill]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fillKey]);

  function saveAvatar() {
    startTransition(async () => {
      await updateAvatar(playerId, draft);
      setEditing(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open your Avatar"
        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-foreground/20 bg-surface transition-colors hover:bg-surface-hover"
      >
        <Avatar config={config} size={40} />
      </button>

      {open && (
        <Overlay onClose={() => setOpen(false)}>
          <div className="flex flex-1 flex-col items-center justify-center">
            <div className="relative" style={{ width: CENTER * 2, height: CENTER * 2 }}>
              <div
                className="absolute overflow-hidden rounded-full border-2 border-foreground/15 bg-surface"
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  left: CENTER,
                  top: CENTER,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <Avatar config={editing ? draft : config} size={AVATAR_SIZE} />
              </div>
              {rings.map((ring, i) => {
                const { x, y } = ringPosition(i);
                return (
                  <div
                    key={ring.areaName}
                    className="absolute"
                    style={{ left: x, top: y, transform: "translate(-50%, -50%)" }}
                  >
                    <GrowthRing
                      areaName={ring.areaName}
                      fill={ring.fill}
                      color={ring.color}
                      size={RING_SIZE}
                      strokeWidth={9}
                    />
                  </div>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!editing) setDraft(config);
              setEditing((v) => !v);
            }}
            className={
              editing
                ? "link-hover self-center rounded-lg border border-foreground/20 px-6 py-2.5 text-sm font-medium text-foreground/60"
                : "btn-primary self-center rounded-lg px-6 py-2.5 text-sm font-medium"
            }
          >
            {editing ? "Cancel" : "Edit avatar"}
          </button>

          {editing && (
            <div className="flex flex-col gap-3 rounded-lg border border-foreground/20 bg-surface p-4">
              <label className="text-xs text-foreground/60">
                Gender
                <select
                  value={draft.gender}
                  onChange={(e) => setDraft({ ...draft, gender: e.target.value as AvatarConfig["gender"] })}
                  className="mt-1 block w-full rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm text-foreground"
                >
                  {GENDERS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-foreground/60">
                Hair style
                <select
                  value={draft.hairStyle}
                  onChange={(e) => setDraft({ ...draft, hairStyle: e.target.value as AvatarConfig["hairStyle"] })}
                  className="mt-1 block w-full rounded border border-foreground/20 bg-transparent px-2 py-1 text-sm text-foreground"
                >
                  {HAIR_STYLES.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.label}
                    </option>
                  ))}
                </select>
              </label>

              <SwatchRow label="Skin tone" options={SKIN_TONES} value={draft.skinTone} onChange={(id) => setDraft({ ...draft, skinTone: id })} />
              <SwatchRow label="Hair color" options={HAIR_COLORS} value={draft.hairColor} onChange={(id) => setDraft({ ...draft, hairColor: id })} />
              <SwatchRow label="Eye color" options={EYE_COLORS} value={draft.eyeColor} onChange={(id) => setDraft({ ...draft, eyeColor: id })} />

              <button
                type="button"
                onClick={saveAvatar}
                disabled={isPending}
                className="btn-primary self-start rounded px-3 py-1 text-sm disabled:opacity-60"
              >
                Save
              </button>
            </div>
          )}
        </Overlay>
      )}

      {celebration && (
        <Overlay onClose={() => setCelebration(null)}>
          <div className="flex flex-1 flex-col items-center justify-center gap-4">
            <span style={{ color: celebration.color }} className="h-20 w-20">
              <AreaIcon areaName={celebration.areaName} className="h-full w-full" />
            </span>
            <p className="text-xl font-semibold" style={{ color: celebration.color }}>
              ¡{celebration.areaName} al 100% hoy!
            </p>
            <p className="text-sm text-foreground/60">Llegaste al máximo posible de hoy.</p>
          </div>
        </Overlay>
      )}
    </>
  );
}

function SwatchRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: string; hex: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-foreground/60">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-label={opt.id}
            className="h-6 w-6 shrink-0 rounded-full"
            style={{
              backgroundColor: opt.hex,
              boxShadow: value === opt.id ? "0 0 0 2px var(--background), 0 0 0 4px var(--accent-primary)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}
