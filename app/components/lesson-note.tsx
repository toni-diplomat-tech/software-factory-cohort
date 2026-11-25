import { useState } from "react";
import { useFetcher } from "react-router";
import { Check, Loader2, Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader } from "~/components/ui/card";
import { Textarea } from "~/components/ui/textarea";
import { cn, formatRelativeTime } from "~/lib/utils";
import { noteEditorState, type NoteEditorState } from "~/modules/lesson-notes";

type SavedNote = { body: string; updatedAt: string } | null;

export function LessonNote({ note }: { note: SavedNote }) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [draft, setDraft] = useState(note?.body ?? "");
  const state = noteEditorState({
    savedBody: note?.body ?? null,
    draft,
    isSaving: fetcher.state !== "idle",
    error: fetcher.data?.error,
  });

  return (
    <Card className="mb-8 gap-4 py-5">
      <CardHeader className="flex items-center justify-between gap-3 px-5">
        <NoteTitle />
        <NoteStatusLabel
          state={state}
          updatedAt={note?.updatedAt}
          error={fetcher.data?.error}
        />
      </CardHeader>

      <CardContent className="px-5">
        <fetcher.Form method="post">
          <input type="hidden" name="intent" value="save-note" />
          <Textarea
            name="body"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Jot down key ideas, questions, or anything you want to remember from this lesson."
            aria-label="Your notes"
            aria-invalid={state.overLimit || undefined}
            className="min-h-32 resize-y leading-relaxed"
          />
          <NoteFooter state={state} />
        </fetcher.Form>
      </CardContent>
    </Card>
  );
}

function NoteTitle() {
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-8 items-center justify-center rounded-md bg-muted">
        <NotebookPen className="size-4 text-muted-foreground" />
      </div>
      <div>
        <h2 className="text-sm leading-none font-semibold">Your notes</h2>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
          <Lock className="size-3" />
          Private to you
        </p>
      </div>
    </div>
  );
}

function NoteFooter({ state }: { state: NoteEditorState }) {
  return (
    <div className="mt-3 flex items-center justify-end gap-3">
      <span
        className={cn(
          "text-xs tabular-nums text-muted-foreground",
          state.overLimit && "font-medium text-destructive"
        )}
      >
        {state.length.toLocaleString("en")} / {state.limit.toLocaleString("en")}
      </span>
      <Button type="submit" size="sm" disabled={!state.canSave}>
        {state.status === "saving" ? "Saving…" : "Save note"}
      </Button>
    </div>
  );
}

function NoteStatusLabel({
  state,
  updatedAt,
  error,
}: {
  state: NoteEditorState;
  updatedAt: string | undefined;
  error: string | undefined;
}) {
  const base = "flex items-center gap-1.5 text-right text-xs";
  switch (state.status) {
    case "saving":
      return (
        <span className={cn(base, "text-muted-foreground")}>
          <Loader2 className="size-3 animate-spin" />
          Saving
        </span>
      );
    case "error":
      return (
        <span role="alert" className={cn(base, "text-destructive")}>
          {error}
        </span>
      );
    case "unsaved":
      return (
        <span className={cn(base, "text-amber-600 dark:text-amber-500")}>
          <span className="size-1.5 rounded-full bg-current" />
          Unsaved changes
        </span>
      );
    case "saved":
      return (
        <span
          suppressHydrationWarning
          className={cn(base, "text-muted-foreground")}
        >
          <Check className="size-3" />
          Saved {updatedAt && formatRelativeTime(updatedAt)}
        </span>
      );
    case "empty":
      return null;
  }
}
