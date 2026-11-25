/**
 * What the lesson-note editor shows for a draft: its status, the character
 * count against the limit, and whether Save is worth pressing.
 */
export {
  deriveNoteEditorState as noteEditorState,
  type NoteEditorInput,
  type NoteEditorState,
  type NoteStatus,
} from "./lib/editor-state";
