"use client";

import { useEffect, useRef, useState } from "react";
import MentionPicker, { type MentionEntity } from "@/components/investigation/MentionPicker";
import {
  buildMentionMarkup,
  detectMention,
  type MentionState,
} from "@/lib/investigation/clueText";

// A text field that understands @mentions, wrapping the investigation board's
// existing MentionPicker and the shared markup helpers in lib/investigation/
// clueText.ts. Nothing about either is investigation-specific — the markup is
// @[Name](kanka:ID) wherever it appears — so this reuses them rather than
// growing a second dialect of the same syntax.
//
// The picker installs capture-phase handlers for Arrow/Enter/Escape/Tab and
// stops propagation, so a parent's own Enter-to-save and Escape-to-cancel do
// not fire while it is open. That is why this component can take an ordinary
// onKeyDown and leave the interaction to the caller.

/**
 * The entity list, fetched once per page rather than once per field.
 *
 * Two composers and an open editor would otherwise each pull the whole campaign
 * roster. The promise is cached, not the result, so concurrent mounts share one
 * request instead of racing.
 */
let entitiesPromise: Promise<MentionEntity[]> | null = null;

function loadEntities(): Promise<MentionEntity[]> {
  entitiesPromise ??= fetch("/api/investigation/mentions")
    .then((res) => (res.ok ? res.json() : { entities: [] }))
    .then((data) => (data.entities ?? []) as MentionEntity[])
    .catch(() => {
      // Don't cache a failure — a field mounted after the network recovers
      // should try again.
      entitiesPromise = null;
      return [];
    });
  return entitiesPromise;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Render a textarea instead of a single-line input. */
  multiline?: boolean;
  rows?: number;
  maxLength?: number;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => void;
  onBlur?: () => void;
}

export default function MentionField({
  value,
  onChange,
  multiline = false,
  rows = 3,
  maxLength,
  placeholder,
  autoFocus,
  className,
  onKeyDown,
  onBlur,
}: Props) {
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);
  const [entities, setEntities] = useState<MentionEntity[]>([]);
  const [mention, setMention] = useState<MentionState | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadEntities().then((list) => {
      if (!cancelled) setEntities(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-evaluate after every change of text or caret position.
  const syncMention = () => {
    const el = ref.current;
    if (!el) return;
    setMention(detectMention(el.value, el.selectionStart ?? el.value.length));
  };

  const pick = (entity: MentionEntity) => {
    const el = ref.current;
    if (!el || !mention) return;

    const markup = buildMentionMarkup(entity.name, entity.entityId);
    const next = value.slice(0, mention.atIndex) + markup + " " + value.slice(mention.endIndex);

    // maxLength only constrains typing — this writes the value programmatically
    // and would sail past it, leaving the server to reject the whole line for
    // length. Refuse the insert instead: truncating is not an option here,
    // since a clipped @[Name](kanka:123) is broken markup rather than short
    // text. The menu stays open, so the field is visibly unchanged and the
    // picked name is still there to choose once there is room.
    if (maxLength !== undefined && next.length > maxLength) return;

    onChange(next);
    setMention(null);

    // Restore the caret after the inserted markup, once React has painted the
    // new value — otherwise it jumps to the end of the field.
    const caret = mention.atIndex + markup.length + 1;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const shared = {
    ref,
    value,
    maxLength,
    placeholder,
    autoFocus,
    className,
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      onChange(e.target.value);
      // The caret is already at its new position on the element itself.
      setMention(detectMention(e.target.value, e.target.selectionStart ?? e.target.value.length));
    },
    onKeyUp: syncMention,
    onClick: syncMention,
    onKeyDown,
    onBlur: () => {
      // A click on a picker row blurs the field first; committing here would
      // save before the pick lands.
      if (mention) return;
      onBlur?.();
    },
  };

  return (
    <div className="relative">
      {multiline ? (
        <textarea {...shared} rows={rows} />
      ) : (
        <input {...shared} type="text" />
      )}

      {mention && (
        <MentionPicker
          entities={entities}
          query={mention.query}
          onPick={pick}
          onClose={() => setMention(null)}
        />
      )}
    </div>
  );
}
