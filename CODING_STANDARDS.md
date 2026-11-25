# Coding standards

## Fail with a thrown response, not a return value

A loader or an action that cannot continue throws. It does not return an
error shape for the component to unpack.

```ts
if (!course) throw data("Course not found", { status: 404 });
```

The route then has one success path. A returned error shape gives every
component a second path to forget about.

## Parse untrusted input with a schema, at the edge

Form data, search parameters and request bodies get a zod schema before the
values reach any query. Parse once, at the boundary; after that the value has
a type and you do not check it again. Coerce numbers through the schema, not
`Number()`: `Number("")` is `0`, and an empty `lessonId` once opened lesson 0
for every Student.

## Check permission in the action, not only the loader

A loader guard does not protect an action. They are separate requests. For a
week anybody who was signed in could approve a refund by posting to
`/admin/refunds`.

## A route does not query data a module owns

Once a module owns a feature's data, the route asks the module for it and
does not import `~/db` or `drizzle-orm` itself. The instructor analytics
route gets everything from `instructorAnalytics`. A query in the loader
splits the feature's rules across two files, and the module's tests stop
covering what the page shows. `npm run lint:boundaries` fails a route that
imports the database connection, except the routes listed in
`.dependency-cruiser-known-violations.json`, which predate the rule. See
[app/modules/README.md](./app/modules/README.md).

## Arrange tests through the module under test

Test setup calls the module's own functions. When the function you need does
not exist, add it to the module rather than inserting rows directly, so a
change to how the module stores its data leaves its tests alone.

## Keep files under 5000 tokens

Keep every file under 5000 tokens.

## Wrap related writes in a transaction

Two writes that must both land, or neither, go in a transaction. If the second
one fails and the first stayed, you have invented a state nothing knows how to
read. (The refund bug: the refund was approved, the enrollment was never
ended, and the Student kept the course.)

## Do not read from the database in a loop

One query per item is N+1 queries. Use a join, or one query with an `IN`. The
notes loader ran one query per lesson, forty lessons per course.

## Paginate anything that can grow

A query with no limit is fine on a seeded database and fatal on a real one.
If the row count is a function of how long the product has been alive, add a
limit. The instructor's students page timed out on the first big course.

## Soft-delete anything a person can point at

If another row references it, or a person has a link to it, do not delete it.
Mark it deleted and filter it out on read. Deleting a lesson used to take the
Students' notes and bookmarks with it.

## Enumerations live in the schema file

A status string that the code compares against is an enum in `app/db/schema.ts`,
not a literal repeated in six places. Refund status was `"pending"` in four
files and `"Pending"` in one.

## Inject the clock

A function that calls `Date.now()` cannot be tested at a fixed moment. Take
the time as an argument. The refund window tests failed every night at
midnight until we did this. `npm run lint:oxlint` enforces this in `app/modules/`.

## Keep secrets on the server

Anything the browser can read is public. A secret is read only in a
`.server` file.

## Do not put a side effect in the render path

Rendering is for working out what the output is, not for doing something.
Anything that touches the outside world belongs in an effect or an action.

## Derive, do not store

If a value can be worked out from another value you already hold, work it out.
Storing it gives you two things that must agree, and one day they will not.

```ts
// Bad
const [items, setItems] = useState(rows);
const [count, setCount] = useState(rows.length);

// Good
const [items, setItems] = useState(rows);
const count = items.length;
```

## A status message describes the current state

A message the UI shows about the last request (an error, "Saved") describes
the input that request sent. Once that input changes, the message no longer
applies: clear it, or derive it from the input. A save error that outlived
the Student's next edit left the note card stuck on the error, with
"Unsaved changes" never coming back.

## Exercise a UI change at its extremes

A form or a display is checked empty, at its limit, over its limit, and with
one long unbroken line (a URL, or 2,001 × "x"). A note textarea once passed
every normal case and then pushed the whole page sideways on a long line.

## A comment explains why

Name and extract until a comment is unnecessary. A comment earns its place
only for a _why_ the code cannot express: a constraint, a decision, a link to
the ADR behind it. A comment that restates _what_ the code does goes stale the
first time the code changes.
