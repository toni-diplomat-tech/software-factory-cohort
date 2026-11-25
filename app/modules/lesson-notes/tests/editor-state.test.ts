import { describe, it, expect } from "vitest";
import { noteEditorState, type NoteEditorInput } from "../index";
import { MAX_NOTE_LENGTH } from "~/lib/notes";

function state(overrides: Partial<NoteEditorInput>) {
  return noteEditorState({
    savedBody: null,
    draft: "",
    isSaving: false,
    error: undefined,
    submittedDraft: null,
    ...overrides,
  });
}

describe("noteEditorState", () => {
  it("is empty with nothing to save before the first note", () => {
    expect(state({})).toEqual({
      status: "empty",
      error: undefined,
      length: 0,
      limit: MAX_NOTE_LENGTH,
      overLimit: false,
      canSave: false,
    });
  });

  it("is saved, with Save disabled, when the draft matches the saved note", () => {
    const s = state({ savedBody: "hello", draft: "hello" });
    expect(s.status).toBe("saved");
    expect(s.canSave).toBe(false);
  });

  it("is unsaved, and saveable, once the draft differs", () => {
    const s = state({ savedBody: "hello", draft: "hello world" });
    expect(s.status).toBe("unsaved");
    expect(s.canSave).toBe(true);
    expect(s.length).toBe(11);
  });

  it("treats a first draft as unsaved", () => {
    const s = state({ draft: "a thought" });
    expect(s.status).toBe("unsaved");
    expect(s.canSave).toBe(true);
  });

  it("will not save a blank draft", () => {
    const s = state({ savedBody: "hello", draft: "   \n" });
    expect(s.status).toBe("unsaved");
    expect(s.canSave).toBe(false);
  });

  it("does not count surrounding whitespace as an unsaved change", () => {
    const s = state({ savedBody: "hello", draft: "  hello\n" });
    expect(s.status).toBe("saved");
    expect(s.canSave).toBe(false);
    expect(s.length).toBe(5);
  });

  it("measures the limit after trimming, as the server does", () => {
    const s = state({ draft: `${"x".repeat(MAX_NOTE_LENGTH)}\n\n` });
    expect(s.overLimit).toBe(false);
    expect(s.canSave).toBe(true);
  });

  it("allows a draft of exactly the limit", () => {
    const s = state({ draft: "x".repeat(MAX_NOTE_LENGTH) });
    expect(s.overLimit).toBe(false);
    expect(s.canSave).toBe(true);
  });

  it("flags and refuses a draft one character over the limit", () => {
    const s = state({ draft: "x".repeat(MAX_NOTE_LENGTH + 1) });
    expect(s.overLimit).toBe(true);
    expect(s.canSave).toBe(false);
  });

  it("is saving while a save is in flight, and cannot be saved again", () => {
    const s = state({
      savedBody: "a",
      draft: "ab",
      isSaving: true,
      error: "x",
      submittedDraft: "ab",
    });
    expect(s.status).toBe("saving");
    expect(s.canSave).toBe(false);
  });

  it("shows the error over the unsaved state", () => {
    const s = state({
      savedBody: "a",
      draft: "ab",
      error: "Too long",
      submittedDraft: "ab",
    });
    expect(s.status).toBe("error");
    expect(s.error).toBe("Too long");
    expect(s.canSave).toBe(true);
  });

  it("drops a failed save's error once the draft is edited", () => {
    const s = state({
      savedBody: "a",
      draft: "abc",
      error: "Too long",
      submittedDraft: "ab",
    });
    expect(s.status).toBe("unsaved");
    expect(s.error).toBeUndefined();
  });
});
