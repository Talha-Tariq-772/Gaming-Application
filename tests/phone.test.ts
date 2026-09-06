import { describe, expect, it } from "vitest";
import { formatPhoneDisplay, normalisePhone } from "@/src/lib/phone";

describe("normalisePhone — accepted shapes", () => {
  const cases: Array<[string, string]> = [
    ["03001234567", "+923001234567"],
    ["3001234567", "+923001234567"],
    ["+923001234567", "+923001234567"],
    ["00923001234567", "+923001234567"],
    ["0300 123 4567", "+923001234567"],
    ["0300-123-4567", "+923001234567"],
    ["+92 300 123 4567", "+923001234567"],
    ["(0300) 123-4567", "+923001234567"],
    ["92 300 1234567", "+923001234567"],
    ["0092 300 1234567", "+923001234567"],
    ["  03001234567  ", "+923001234567"],
  ];

  for (const [input, expected] of cases) {
    it(`normalises "${input}"`, () => {
      expect(normalisePhone(input)).toBe(expected);
    });
  }

  it("normalises every mobile prefix (Jazz/Telenor/Zong/Ufone/SCOM all start with 3)", () => {
    expect(normalisePhone("03111234567")).toBe("+923111234567");
    expect(normalisePhone("03211234567")).toBe("+923211234567");
    expect(normalisePhone("03331234567")).toBe("+923331234567");
    expect(normalisePhone("03451234567")).toBe("+923451234567");
  });
});

describe("normalisePhone — rejections", () => {
  const rejected = [
    "",
    "not-a-phone-number",
    "02112345678", // Karachi landline
    "04212345678", // Lahore landline
    "051123456", // Islamabad landline, wrong length too
    "+1 300 123 4567", // wrong country code
    "+923001234567890", // too long
    "030012345", // too short
    "+92300123456", // one digit short
    "abcdefghijk",
    "+92 4001234567", // starts with 4, not 3
];

  for (const input of rejected) {
    it(`rejects "${input}"`, () => {
      expect(normalisePhone(input)).toBeNull();
    });
  }
});

describe("formatPhoneDisplay", () => {
  it("formats a normalised E.164 number for display", () => {
    expect(formatPhoneDisplay("+923001234567")).toBe("0300 123 4567");
  });

  it("round-trips through normalisePhone for every accepted shape", () => {
    const normalised = normalisePhone("+92 300 123 4567")!;
    expect(formatPhoneDisplay(normalised)).toBe("0300 123 4567");
  });
});
