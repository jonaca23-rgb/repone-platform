import { describe, expect, it } from "vitest";
import { z } from "zod";
import { field, imageUpload, parseForm, ValidationError } from "./form";
import { NONE } from "./none";

const form = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
};

const schema = z.object({
  name: field.text("Division name"),
  note: field.optionalText(),
  lanes: field.int("Lanes", { min: 1, max: 20 }),
  cap: field.optionalNumber("Time cap", { min: 0 }),
  addon: field.checkbox(),
  eventId: field.id("Event"),
  type: field.oneOf(["for_time", "amrap"] as const, "scoring type"),
});

const valid = {
  name: "  Rx Female  ",
  note: "",
  lanes: "8",
  cap: "",
  eventId: "00000000-0000-0000-0000-000000000010",
  type: "amrap",
};

describe("parseForm", () => {
  it("trims text, turns blank optionals into null, coerces numbers and checkboxes", () => {
    expect(parseForm(schema, form({ ...valid, addon: "on" }))).toEqual({
      name: "Rx Female",
      note: null,
      lanes: 8,
      cap: null,
      addon: true,
      eventId: "00000000-0000-0000-0000-000000000010",
      type: "amrap",
    });
  });

  it("treats a missing checkbox as false", () => {
    expect(parseForm(schema, form(valid)).addon).toBe(false);
  });

  it("accepts the seed's non-RFC-version ids", () => {
    expect(() => parseForm(schema, form(valid))).not.toThrow();
  });

  it.each([
    [{ name: "   " }, "Division name is required."],
    [{ name: undefined }, "Division name is required."],
    [{ lanes: "0" }, "Lanes must be at least 1."],
    [{ lanes: "21" }, "Lanes must be at most 20."],
    [{ lanes: "abc" }, "Lanes must be a number."],
    [{ cap: "-5" }, "Time cap must be at least 0."],
    [{ eventId: "not-an-id" }, "Event is missing or invalid."],
    [{ type: "hacked" }, "Choose a valid scoring type."],
  ])("rejects %o with a message a person can act on", (patch, message) => {
    const entries = { ...valid, ...patch } as Record<string, string | undefined>;
    const clean = Object.fromEntries(Object.entries(entries).filter(([, v]) => v !== undefined));
    const run = () => parseForm(schema, form(clean as Record<string, string>));
    expect(run).toThrow(ValidationError);
    expect(run).toThrow(message);
  });

  it('reads a Select\'s "__none" item as a blank field', () => {
    const s = z.object({
      circuit: field.optionalId("Circuit"),
      gender: field.optionalOneOf(["male", "female"] as const, "gender"),
      label: field.optionalChoice({ label: "Role label" }),
    });
    expect(parseForm(s, form({ circuit: NONE, gender: NONE, label: NONE }))).toEqual({
      circuit: null,
      gender: null,
      label: null,
    });
    expect(parseForm(s, form({ circuit: "", gender: "female", label: "co_commentator" }))).toEqual({
      circuit: null,
      gender: "female",
      label: "co_commentator",
    });
  });

  it('keeps "__none" typed into a free-text field', () => {
    const s = z.object({ name: field.text("Name"), note: field.optionalText() });
    expect(parseForm(s, form({ name: NONE, note: NONE }))).toEqual({ name: NONE, note: NONE });
  });

  it("caps text length", () => {
    expect(() => parseForm(schema, form({ ...valid, name: "x".repeat(201) }))).toThrow(
      "Division name is too long.",
    );
  });
});

describe("field.clock", () => {
  const s = z.object({ t: field.clock("Time") });
  it("reads a judge's mm:ss or plain seconds; blank is null", () => {
    expect(parseForm(s, form({ t: "3:45" })).t).toBe(225);
    expect(parseForm(s, form({ t: "90" })).t).toBe(90);
    expect(parseForm(s, form({ t: "" })).t).toBeNull();
  });
  it("rejects anything else instead of silently dropping it", () => {
    expect(() => parseForm(s, form({ t: "3m45" }))).toThrow("Time must be a time like 3:45");
  });
});

describe("field.phone", () => {
  const s = z.object({ p: field.phone() });
  it.each([
    "787-555-0100",
    "+1 (787) 555-0100",
    "787.555.0100",
    "787-555-0100 ext 12",
    "7875550100 x3",
  ])("accepts %s", (p) => expect(parseForm(s, form({ p })).p).toBe(p));
  it("blank is null", () => expect(parseForm(s, form({ p: "" })).p).toBeNull());
  it.each(["call me", "123", "<script>"])("rejects %s", (p) =>
    expect(() => parseForm(s, form({ p }))).toThrow("Phone number isn't valid."),
  );
});

describe("imageUpload", () => {
  const file = (type: string, bytes = 10, name = "photo.png") =>
    new File([new Uint8Array(bytes)], name, { type });

  it("accepts an allowed image and names its extension from the verified type, not the filename", () => {
    expect(imageUpload(file("image/jpeg", 10, "evil.html"))).toMatchObject({ ext: "jpg" });
    expect(imageUpload(file("image/png")).ext).toBe("png");
  });
  it.each([
    [null, "Choose an image file to upload."],
    [file("image/png", 0), "Choose an image file to upload."],
    [file("image/svg+xml"), "Please upload a JPEG, PNG, WebP, GIF or HEIC image."],
    [file("text/html"), "Please upload a JPEG, PNG, WebP, GIF or HEIC image."],
    [file("image/png", 8 * 1024 * 1024 + 1), "Image must be under 8MB."],
  ])("rejects %#", (value, message) => {
    expect(() => imageUpload(value)).toThrow(message);
  });
});

describe("parseForm field errors", () => {
  it("names every invalid field, first message first", () => {
    const twoFields = z.object({ name: field.text("Name"), email: field.text("Email") });
    try {
      parseForm(twoFields, form({ name: "", email: "" }));
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ValidationError);
      const v = err as ValidationError;
      expect(v.message).toBe("Name is required.");
      expect(v.fieldErrors).toEqual({ name: ["Name is required."], email: ["Email is required."] });
    }
  });
});
