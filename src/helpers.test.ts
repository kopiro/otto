import { extractWithPattern } from "./helpers";

describe("extractWithPattern", () => {
  const example = [
    { payload: { errors: { unknown_language: "hello" } } },
    { payload: { errors: { number: 1 } } },
    { randomstuff: 42 },
  ];

  test("it works", () => {
    expect(extractWithPattern(example, "[].payload.errors.unknown_language")).toBe("hello");
    expect(extractWithPattern(example, "[].randomstuff")).toBe(42);
  });

  test("returns null value", () => {
    expect(extractWithPattern(example, "random")).toBeUndefined();
  });
});
