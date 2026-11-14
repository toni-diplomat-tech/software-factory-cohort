import { beforeEach, describe, expect, it, vi } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import * as schema from "~/db/schema";
import { setCurrentUserId } from "~/lib/session";

// The route talks to the database through `~/db`; point it at a fresh
// in-memory database for each test.
const testDb = vi.hoisted(() => ({
  current: undefined as unknown,
}));

vi.mock("~/db", () => ({
  db: new Proxy(
    {},
    {
      get(_target, prop) {
        const target = testDb.current as object;
        const value = Reflect.get(target, prop);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }
  ),
}));

const { action } = await import("./courses.$slug.refund");

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

function freshDb(): TestDb {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  return db;
}

let db: TestDb;

beforeEach(() => {
  db = freshDb();
  testDb.current = db;
});

function daysAgo(days: number): string {
  const when = new Date();
  when.setDate(when.getDate() - days);
  return when.toISOString();
}

/** A learner who bought the course `slug` with the given purchase date. */
function seedPurchase(
  options: { purchasedAt?: string; amountPaid?: number } = {}
) {
  const instructor = db
    .insert(schema.users)
    .values({
      name: "Ines Instructor",
      email: "ines@example.com",
      role: schema.UserRole.Instructor,
    })
    .returning()
    .get();
  const learner = db
    .insert(schema.users)
    .values({
      name: "Lena Learner",
      email: "lena@example.com",
      role: schema.UserRole.Student,
    })
    .returning()
    .get();
  const category = db
    .insert(schema.categories)
    .values({ name: "Code", slug: "code" })
    .returning()
    .get();
  const course = db
    .insert(schema.courses)
    .values({
      title: "Testing Things",
      slug: "testing-things",
      description: "A course",
      salesCopy: "Buy it",
      instructorId: instructor.id,
      categoryId: category.id,
      status: schema.CourseStatus.Published,
      price: 10000,
    })
    .returning()
    .get();
  const purchase = db
    .insert(schema.purchases)
    .values({
      userId: learner.id,
      courseId: course.id,
      amountPaid: options.amountPaid ?? 10000,
      createdAt: options.purchasedAt ?? daysAgo(1),
    })
    .returning()
    .get();
  return { learner, course, purchase };
}

async function submitRefundRequest(options: {
  userId?: number;
  reason?: string;
}) {
  const headers = new Headers();
  if (options.userId !== undefined) {
    const blank = new Request("http://localhost/");
    const cookie = await setCurrentUserId(blank, options.userId);
    headers.set("Cookie", cookie.split(";")[0]);
  }
  const body = new FormData();
  body.set("reason", options.reason ?? "It was not what I expected at all.");
  const request = new Request(
    "http://localhost/courses/testing-things/refund",
    { method: "POST", headers, body }
  );
  return action({
    request,
    params: { slug: "testing-things" },
    context: {},
  } as Parameters<typeof action>[0]);
}

/** The learner-facing message of the error the action throws. */
async function refundRequestError(
  submission: Promise<unknown>
): Promise<string> {
  try {
    await submission;
  } catch (thrown) {
    const message = (thrown as { data?: unknown }).data;
    if (typeof message === "string") return message;
    throw thrown;
  }
  throw new Error("Expected the Refund Request to be rejected");
}

describe("submitting a Refund Request", () => {
  it("asks a logged-out visitor to log in to request a refund", async () => {
    seedPurchase();

    expect(await refundRequestError(submitRefundRequest({}))).toBe(
      "You must be logged in to request a refund."
    );
  });

  it("refuses a Refund Request for a claimed team seat", async () => {
    const { learner, course, purchase } = seedPurchase();
    const team = db.insert(schema.teams).values({}).returning().get();
    db.insert(schema.coupons)
      .values({
        teamId: team.id,
        courseId: course.id,
        code: "SEAT-1",
        purchaseId: purchase.id,
        redeemedByUserId: learner.id,
        redeemedAt: daysAgo(1),
      })
      .run();

    expect(
      await refundRequestError(submitRefundRequest({ userId: learner.id }))
    ).toBe("A claimed team seat cannot be refunded.");
  });

  it("refuses a Refund Request once the learner has watched two hours", async () => {
    const { learner, course } = seedPurchase();
    const courseModule = db
      .insert(schema.modules)
      .values({ courseId: course.id, title: "Module", position: 1 })
      .returning()
      .get();
    const lesson = db
      .insert(schema.lessons)
      .values({ moduleId: courseModule.id, title: "Lesson", position: 1 })
      .returning()
      .get();
    db.insert(schema.videoWatchEvents)
      .values({
        userId: learner.id,
        lessonId: lesson.id,
        eventType: "progress",
        positionSeconds: 2 * 60 * 60,
      })
      .run();

    expect(
      await refundRequestError(submitRefundRequest({ userId: learner.id }))
    ).toBe(
      "You have watched too much of this course to request a refund."
    );
  });

  it("refuses a Refund Request after the fourteen-day window", async () => {
    const { learner } = seedPurchase({ purchasedAt: daysAgo(15) });

    expect(
      await refundRequestError(submitRefundRequest({ userId: learner.id }))
    ).toBe("The 14-day window to request a refund has closed.");
  });

  it("refuses a second Refund Request while one is already Requested", async () => {
    const { learner, purchase } = seedPurchase();
    db.insert(schema.refunds)
      .values({
        purchaseId: purchase.id,
        status: schema.RefundStatus.Requested,
        reason: "Changed my mind about it.",
      })
      .run();

    expect(
      await refundRequestError(submitRefundRequest({ userId: learner.id }))
    ).toBe("You have already requested a refund for this purchase.");
  });

  it("asks for a longer reason without mentioning cancelling", async () => {
    const { learner } = seedPurchase();

    const result = await submitRefundRequest({
      userId: learner.id,
      reason: "meh",
    });

    expect(result).toMatchObject({
      data: {
        errors: {
          reason: "Tell us a little more about why you want a refund.",
        },
      },
    });
  });

  it("emails the learner the amount they paid, not the course's current price", async () => {
    // A full-price purchase (no purchasing-power country) made when the course
    // cost $79.00; the course's list price has since gone up to $100.00.
    const { learner } = seedPurchase({ amountPaid: 7900 });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      await submitRefundRequest({ userId: learner.id });

      const logged = log.mock.calls.map((call) => String(call[0])).join("\n");
      expect(logged).toContain("to=lena@example.com");
      expect(logged).toContain("$79.00, the amount you paid");
      expect(logged).not.toContain("$100.00");
    } finally {
      log.mockRestore();
    }
  });
});
