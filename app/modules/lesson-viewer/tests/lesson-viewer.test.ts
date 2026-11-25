import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTestDb, seedBaseData, type TestDb } from "~/test/setup";
import * as schema from "~/db/schema";
import { LessonProgressStatus, QuestionType } from "~/db/schema";
import { flattenCourseLessons } from "../course.server";
import {
  calculateWatchProgress,
  getLessonProgress,
  markLessonComplete,
  markLessonInProgress,
} from "../progress.server";
import { computeResult, getBestAttempt } from "../quiz.server";

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

let studentId: number;
let lessonId: number;

beforeEach(() => {
  db = createTestDb();
  const base = seedBaseData(db);
  studentId = base.user.id;
  const mod = db
    .insert(schema.modules)
    .values({ courseId: base.course.id, title: "Basics", position: 1 })
    .returning()
    .get();
  lessonId = db
    .insert(schema.lessons)
    .values({ moduleId: mod.id, title: "Intro", position: 1 })
    .returning()
    .get().id;
});

// ─── Fixtures ───
// The module has no writer for quizzes or watch events, so rows go in
// directly. Kept in one place so a schema change touches only this block.

function addWatchEvent(positionSeconds: number) {
  db.insert(schema.videoWatchEvents)
    .values({
      userId: studentId,
      lessonId,
      eventType: "progress",
      positionSeconds,
    })
    .run();
}

/** A quiz whose questions each have one correct and one wrong option. */
function addQuiz(questionCount: number) {
  const quiz = db
    .insert(schema.quizzes)
    .values({ lessonId, title: "Check", passingScore: 0.7 })
    .returning()
    .get();
  const questions = Array.from({ length: questionCount }, (_, i) => {
    const question = db
      .insert(schema.quizQuestions)
      .values({
        quizId: quiz.id,
        questionText: `Q${i + 1}`,
        questionType:
          i % 2 === 0 ? QuestionType.MultipleChoice : QuestionType.TrueFalse,
        position: i + 1,
      })
      .returning()
      .get();
    const [right, wrong] = [true, false].map(
      (isCorrect) =>
        db
          .insert(schema.quizOptions)
          .values({ questionId: question.id, optionText: "x", isCorrect })
          .returning()
          .get().id
    );
    return { id: question.id, right, wrong };
  });
  return { id: quiz.id, questions };
}

describe("flattenCourseLessons", () => {
  it("lists every lesson in course order with its module", () => {
    const flat = flattenCourseLessons({
      modules: [
        { id: 1, title: "A", lessons: [{ id: 10, title: "a1", moduleId: 1 }] },
        {
          id: 2,
          title: "B",
          lessons: [
            { id: 20, title: "b1", moduleId: 2 },
            { id: 21, title: "b2", moduleId: 2 },
          ],
        },
      ],
    });

    expect(flat).toEqual([
      { id: 10, title: "a1", moduleId: 1, moduleTitle: "A" },
      { id: 20, title: "b1", moduleId: 2, moduleTitle: "B" },
      { id: 21, title: "b2", moduleId: 2, moduleTitle: "B" },
    ]);
  });
});

describe("calculateWatchProgress", () => {
  it("is the furthest position watched, as a rounded percentage", () => {
    addWatchEvent(30);
    addWatchEvent(61);
    addWatchEvent(10);

    expect(calculateWatchProgress(studentId, lessonId, 200)).toBe(31);
  });

  it("caps at 100 when the Student watched past the stated duration", () => {
    addWatchEvent(250);

    expect(calculateWatchProgress(studentId, lessonId, 200)).toBe(100);
  });

  it("is 0 for a video with no duration, or nothing watched", () => {
    addWatchEvent(30);

    expect(calculateWatchProgress(studentId, lessonId, 0)).toBe(0);
    expect(calculateWatchProgress(studentId + 99, lessonId, 200)).toBe(0);
  });
});

describe("lesson progress", () => {
  it("moves a lesson from in progress to completed", () => {
    expect(getLessonProgress(studentId, lessonId)).toBeUndefined();

    markLessonInProgress(studentId, lessonId);
    expect(getLessonProgress(studentId, lessonId)?.status).toBe(
      LessonProgressStatus.InProgress
    );

    markLessonComplete(studentId, lessonId);
    const progress = getLessonProgress(studentId, lessonId);
    expect(progress?.status).toBe(LessonProgressStatus.Completed);
    expect(progress?.completedAt).not.toBeNull();
  });
});

describe("computeResult", () => {
  it("grades each answer and records the attempt", () => {
    const quiz = addQuiz(4);
    const [q1, q2, q3, q4] = quiz.questions;

    const result = computeResult(studentId, quiz.id, {
      [q1.id]: q1.right,
      [q2.id]: q2.right,
      [q3.id]: q3.wrong,
    });

    expect(result).toMatchObject({
      score: 0.5,
      passed: false,
      grade: "F",
      totalCorrect: 2,
      totalQuestions: 4,
    });
    expect(result?.questionResults).toEqual([
      {
        questionId: q1.id,
        correct: true,
        selectedOptionId: q1.right,
        correctOptionId: q1.right,
      },
      {
        questionId: q2.id,
        correct: true,
        selectedOptionId: q2.right,
        correctOptionId: q2.right,
      },
      {
        questionId: q3.id,
        correct: false,
        selectedOptionId: q3.wrong,
        correctOptionId: q3.right,
      },
      {
        questionId: q4.id,
        correct: false,
        selectedOptionId: null,
        correctOptionId: null,
      },
    ]);
    expect(getBestAttempt(studentId, quiz.id)).toMatchObject({
      id: result?.attemptId,
      score: 0.5,
      passed: false,
    });
  });

  it("passes only above 70%", () => {
    const quiz = addQuiz(10);
    const answers = (correct: number) =>
      Object.fromEntries(
        quiz.questions.map((q, i) => [q.id, i < correct ? q.right : q.wrong])
      );

    expect(computeResult(studentId, quiz.id, answers(7))).toMatchObject({
      passed: false,
      grade: "C",
    });
    expect(computeResult(studentId, quiz.id, answers(8))).toMatchObject({
      passed: true,
      grade: "B",
    });
    expect(computeResult(studentId, quiz.id, answers(9))?.grade).toBe("A");
    expect(computeResult(studentId, quiz.id, answers(6))?.grade).toBe("D");
  });

  it("is null for a quiz that does not exist", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(computeResult(studentId, 999, {})).toBeNull();
  });
});
