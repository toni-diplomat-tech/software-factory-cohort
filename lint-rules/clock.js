// CODING_STANDARDS.md, "Inject the clock": a function that reads the current
// time cannot be tested at a fixed moment. Take `now` as an argument.
// `new Date(value)` is fine; only the argument-less forms read the clock.

const isDateNow = (callee) =>
  callee.type === "MemberExpression" &&
  !callee.computed &&
  callee.object.type === "Identifier" &&
  callee.object.name === "Date" &&
  callee.property.name === "now";

const noAmbientTime = {
  meta: {
    type: "problem",
    messages: {
      ambient:
        "This reads the clock, so it cannot be tested at a fixed moment. Take `now: Date` as an argument (CODING_STANDARDS.md, Inject the clock).",
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isDateNow(node.callee))
          context.report({ node, messageId: "ambient" });
      },
      NewExpression(node) {
        if (
          node.callee.type === "Identifier" &&
          node.callee.name === "Date" &&
          node.arguments.length === 0
        ) {
          context.report({ node, messageId: "ambient" });
        }
      },
    };
  },
};

export default {
  meta: { name: "clock" },
  rules: { "no-ambient-time": noAmbientTime },
};
