import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { UserRole } from "~/db/schema";
import { markdown } from "~/lib/text";
import { getCourseWithDetails } from "../course.server";
import { getLessonThread, renderThread } from "../thread.server";

// The module reads the app's shared `db`. Point it at a fresh in-memory
// database for each test.
let db: TestDb;
vi.mock("~/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const value = Reflect.get(db, prop);
        return typeof value === "function" ? value.bind(db) : value;
      },
    }
  ),
}));

let base: ReturnType<typeof seedBaseData>;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  base = seedBaseData(db);
  const mod = addModule("Basics", 1);
  lessonId = addLesson(mod, "Intro", 1);
});

// ─── Fixtures ───
// The module has no writer for outlines or comments, so rows go in directly.
// Kept in one place so a schema change touches only this block.

function addModule(title: string, position: number) {
  return db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title, position })
    .returning()
    .get().id;
}

function addLesson(moduleId: number, title: string, position: number) {
  return db
    .insert(schema.lessons)
    .values({ moduleId, title, position })
    .returning()
    .get().id;
}

let minute = 0;

function addComment(
  userId: number,
  body: string,
  options: { parentId?: number; deleted?: boolean } = {}
) {
  minute += 1;
  return db
    .insert(schema.comments)
    .values({
      lessonId,
      userId,
      body: markdown(body),
      parentId: options.parentId ?? null,
      createdAt: new Date(Date.UTC(2026, 9, 6, 12, minute)).toISOString(),
      deletedAt: options.deleted ? "2026-10-07T00:00:00.000Z" : null,
    })
    .returning()
    .get().id;
}

function addAdmin() {
  return db
    .insert(schema.users)
    .values({
      name: "Ada Admin",
      email: "ada@example.com",
      role: UserRole.Admin,
    })
    .returning()
    .get().id;
}

describe("getCourseWithDetails", () => {
  it("orders modules and their lessons by position", () => {
    const later = addModule("Advanced", 3);
    const middle = addModule("Middle", 2);
    addLesson(later, "Second", 2);
    addLesson(later, "First", 1);
    addLesson(middle, "Only", 1);

    const course = getCourseWithDetails(base.course.id);

    expect(course?.instructorName).toBe(base.instructor.name);
    expect(course?.categoryName).toBe(base.category.name);
    expect(
      course?.modules.map((m) => [m.title, m.lessons.map((l) => l.title)])
    ).toEqual([
      ["Basics", ["Intro"]],
      ["Middle", ["Only"]],
      ["Advanced", ["First", "Second"]],
    ]);
  });

  it("is null for a course that does not exist", () => {
    expect(getCourseWithDetails(999)).toBeNull();
  });
});

describe("getLessonThread", () => {
  it("nests replies under their question, oldest first", () => {
    const question = addComment(base.user.id, "Why?");
    const other = addComment(base.user.id, "And how?");
    addComment(base.instructor.id, "Because.", { parentId: question });

    const thread = getLessonThread(lessonId);

    expect(thread.map((c) => c.id)).toEqual([question, other]);
    expect(thread[0].replies.map((r) => r.body)).toEqual(["Because."]);
    expect(thread[1].replies).toEqual([]);
  });

  it("marks the course's instructor and platform admins", () => {
    const adminId = addAdmin();
    addComment(base.user.id, "Student");
    addComment(base.instructor.id, "Instructor");
    addComment(adminId, "Admin");

    const authors = getLessonThread(lessonId).map((c) => c.author);

    expect(
      authors.map((a) => [a.name, a.isInstructor, a.isPlatformAdmin])
    ).toEqual([
      [base.user.name, false, false],
      [base.instructor.name, true, false],
      ["Ada Admin", false, true],
    ]);
  });

  it("blanks a deleted question but keeps it while it has replies", () => {
    const kept = addComment(base.user.id, "secret", { deleted: true });
    addComment(base.instructor.id, "Answer", { parentId: kept });
    addComment(base.user.id, "gone", { deleted: true });

    const thread = getLessonThread(lessonId);

    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({
      id: kept,
      deleted: true,
      body: "",
      editedAt: null,
    });
    expect(thread[0].replies).toHaveLength(1);
  });

  it("drops deleted replies", () => {
    const question = addComment(base.user.id, "Q");
    addComment(base.instructor.id, "old", {
      parentId: question,
      deleted: true,
    });

    expect(getLessonThread(lessonId)[0].replies).toEqual([]);
  });

  it("is empty for a lesson that does not exist", () => {
    expect(getLessonThread(999)).toEqual([]);
  });
});

describe("renderThread", () => {
  it("sanitises every body, replies included, and leaves deleted ones empty", async () => {
    const question = addComment(base.user.id, "**hi**\n\n<script>x()</script>");
    addComment(base.instructor.id, "<img src=x onerror=y()>", {
      parentId: question,
    });
    const deleted = addComment(base.user.id, "bye", { deleted: true });
    addComment(base.user.id, "reply", { parentId: deleted });

    const [first, second] = await renderThread(getLessonThread(lessonId));

    expect(first.bodyHtml).toContain("<strong>hi</strong>");
    expect(first.bodyHtml).not.toContain("<script");
    expect(first.replies[0].bodyHtml).not.toContain("<img");
    expect(second.bodyHtml).toBe("");
    expect(second.replies[0].bodyHtml).toContain("reply");
  });
});
