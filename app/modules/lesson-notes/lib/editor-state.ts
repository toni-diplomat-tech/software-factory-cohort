import { MAX_NOTE_LENGTH } from "~/lib/notes";

export type NoteStatus = "saving" | "error" | "unsaved" | "saved" | "empty";

export type NoteEditorInput = {
  savedBody: string | null;
  draft: string;
  isSaving: boolean;
  error: string | undefined;
  submittedDraft: string | null;
};

export type NoteEditorState = {
  status: NoteStatus;
  error: string | undefined;
  length: number;
  limit: number;
  overLimit: boolean;
  canSave: boolean;
};

function statusOf(
  input: NoteEditorInput,
  error: string | undefined,
  dirty: boolean
): NoteStatus {
  if (input.isSaving) return "saving";
  if (error) return "error";
  if (dirty) return "unsaved";
  return input.savedBody === null ? "empty" : "saved";
}

export function noteEditorState(input: NoteEditorInput): NoteEditorState {
  // The server trims a note before it checks and stores it, so compare and
  // count the trimmed draft: trailing whitespace is not an unsaved change.
  const body = input.draft.trim();
  const length = body.length;
  const overLimit = length > MAX_NOTE_LENGTH;
  const dirty = body !== (input.savedBody ?? "");
  const blank = body === "";
  // A failed save's error describes the draft that was sent. Once the Student
  // edits it, the error no longer applies and the status goes back to unsaved.
  const error = input.draft === input.submittedDraft ? input.error : undefined;
  return {
    status: statusOf(input, error, dirty),
    error,
    length,
    limit: MAX_NOTE_LENGTH,
    overLimit,
    // The server rejects blank and over-long notes; disabling Save here keeps
    // the Student from a round trip that can only fail.
    canSave: dirty && !blank && !overLimit && !input.isSaving,
  };
}
