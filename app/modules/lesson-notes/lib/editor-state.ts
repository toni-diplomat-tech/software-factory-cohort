import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteStatus = "saving" | "error" | "unsaved" | "saved" | "empty";

export type NoteEditorInput = {
  savedBody: string | null;
  draft: string;
  isSaving: boolean;
  error: string | undefined;
};

export type NoteEditorState = {
  status: NoteStatus;
  length: number;
  limit: number;
  overLimit: boolean;
  canSave: boolean;
};

function statusOf(input: NoteEditorInput, dirty: boolean): NoteStatus {
  if (input.isSaving) return "saving";
  if (input.error) return "error";
  if (dirty) return "unsaved";
  return input.savedBody === null ? "empty" : "saved";
}

export function deriveNoteEditorState(input: NoteEditorInput): NoteEditorState {
  // The server trims a note before it checks and stores it, so compare and
  // count the trimmed draft: trailing whitespace is not an unsaved change.
  const body = input.draft.trim();
  const length = body.length;
  const overLimit = length > MAX_NOTE_LENGTH;
  const dirty = body !== (input.savedBody ?? "");
  const blank = body === "";
  return {
    status: statusOf(input, dirty),
    length,
    limit: MAX_NOTE_LENGTH,
    overLimit,
    // The server rejects blank and over-long notes; disabling Save here keeps
    // the Student from a round trip that can only fail.
    canSave: dirty && !blank && !overLimit && !input.isSaving,
  };
}
