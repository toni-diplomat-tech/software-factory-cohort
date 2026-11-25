import {
  deriveNoteEditorState,
  type NoteEditorInput,
  type NoteEditorState,
  type NoteStatus,
} from "./lib/editor-state";

export type { NoteEditorInput, NoteEditorState, NoteStatus };

/**
 * What the lesson-note editor shows for a draft: its status, the character
 * count against the limit, and whether Save is worth pressing.
 */
export function noteEditorState(input: NoteEditorInput): NoteEditorState {
  return deriveNoteEditorState(input);
}
