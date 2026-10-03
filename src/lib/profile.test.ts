import { describe, expect, it } from "vitest";

import {
  isProfileImageUrl,
  profileSchema,
  profilesByEmail,
  resolveProfile,
  resolveProfileForEmail,
} from "./profile";

const GOOGLE = "https://lh3.googleusercontent.com/a/photo=s96-c";
const SET_URL = "https://images.example.test/me.png";

describe("resolveProfile", () => {
  it("shows the Profile name and picture when set", () => {
    expect(
      resolveProfile({
        rosterName: "Tony M",
        profileName: "Tony Martinez",
        profileImage: SET_URL,
        googleImage: null,
      }),
    ).toEqual({ name: "Tony Martinez", image: SET_URL });
  });

  it("falls back to the roster name and no picture when nothing is set", () => {
    expect(
      resolveProfile({
        rosterName: "Tony M",
        profileName: null,
        profileImage: null,
        googleImage: null,
      }),
    ).toEqual({ name: "Tony M", image: null });
    expect(resolveProfile({ rosterName: "Tony M" })).toEqual({
      name: "Tony M",
      image: null,
    });
  });

  it("uses the Google photo when no picture URL is set", () => {
    expect(
      resolveProfile({
        rosterName: "Tony M",
        profileName: null,
        profileImage: null,
        googleImage: GOOGLE,
      }),
    ).toEqual({ name: "Tony M", image: GOOGLE });
  });

  it("prefers a set picture URL over the Google photo", () => {
    expect(
      resolveProfile({
        rosterName: "Tony M",
        profileImage: SET_URL,
        googleImage: GOOGLE,
      }).image,
    ).toBe(SET_URL);
  });

  it("ignores a user image that isn't a Google photo", () => {
    for (const googleImage of [
      "https://evil.example.com/x.png",
      "http://lh3.googleusercontent.com/a/x",
      "https://lh3.googleusercontent.com.evil.example/x",
      "javascript:alert(1)",
    ]) {
      expect(resolveProfile({ rosterName: "Tony M", googleImage }).image).toBe(
        null,
      );
    }
  });
});

describe("profilesByEmail and resolveProfileForEmail", () => {
  const profiles = profilesByEmail([
    {
      email: "Tony.M@JahnelGroup.com",
      profileName: "Tony Martinez",
      profileImage: null,
    },
    { email: "tony.m@jahnelgroup.com", googleImage: GOOGLE },
    { email: "sam@jahnelgroup.com", googleImage: GOOGLE },
  ]);

  it("keys by lowercase email, merging the Profile and Google rows", () => {
    expect(profiles.get("tony.m@jahnelgroup.com")).toEqual({
      profileName: "Tony Martinez",
      profileImage: null,
      googleImage: GOOGLE,
    });
  });

  it("finds a Profile whatever the case of the email asked for", () => {
    expect(
      resolveProfileForEmail("TONY.M@jahnelgroup.com", profiles, "Tony M"),
    ).toEqual({ name: "Tony Martinez", image: GOOGLE });
  });

  it("falls back to the roster name, then the email's local part", () => {
    expect(
      resolveProfileForEmail("sam@jahnelgroup.com", profiles, "Sam R"),
    ).toEqual({ name: "Sam R", image: GOOGLE });
    expect(resolveProfileForEmail("sam@jahnelgroup.com", profiles)).toEqual({
      name: "sam",
      image: GOOGLE,
    });
    expect(resolveProfileForEmail("new@jahnelgroup.com", profiles)).toEqual({
      name: "new",
      image: null,
    });
  });
});

describe("profileSchema", () => {
  const parse = (input: unknown) => profileSchema.safeParse(input);

  it("trims both fields and turns empty into null", () => {
    expect(parse({ name: "  Tony  ", imageUrl: ` ${SET_URL} ` }).data).toEqual({
      name: "Tony",
      imageUrl: SET_URL,
    });
    expect(parse({ name: "   ", imageUrl: "" }).data).toEqual({
      name: null,
      imageUrl: null,
    });
    expect(parse({}).data).toEqual({ name: null, imageUrl: null });
  });

  it("limits the name to 120 characters", () => {
    expect(parse({ name: "a".repeat(120) }).success).toBe(true);
    const tooLong = parse({ name: "a".repeat(121) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0].path).toEqual(["name"]);
  });

  it("accepts an https picture URL up to 2048 characters", () => {
    const long = `https://images.example.test/${"a".repeat(2048 - 28)}`;
    expect(long).toHaveLength(2048);
    expect(parse({ imageUrl: long }).success).toBe(true);
    expect(parse({ imageUrl: `${long}a` }).success).toBe(false);
  });

  it("refuses a picture URL that isn't https with a host", () => {
    for (const imageUrl of [
      "http://images.example.test/me.png",
      "data:image/png;base64,iVBORw0KGgo=",
      "javascript:alert(1)",
      "/me.png",
      "me.png",
      "https://",
      "ftp://images.example.test/me.png",
    ]) {
      const result = parse({ imageUrl });
      expect(result.success, imageUrl).toBe(false);
      expect(result.error?.issues[0].path).toEqual(["imageUrl"]);
    }
  });
});

describe("isProfileImageUrl", () => {
  it("is true only for an https URL with a host", () => {
    expect(isProfileImageUrl(SET_URL)).toBe(true);
    expect(isProfileImageUrl("http://images.example.test/me.png")).toBe(false);
    expect(isProfileImageUrl("")).toBe(false);
  });
});
