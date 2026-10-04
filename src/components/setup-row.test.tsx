import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SetupListRow } from "./setup-row";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const ok = async () => ({ ok: true as const });

function render(props: Partial<Parameters<typeof SetupListRow>[0]>) {
  return renderToStaticMarkup(
    <ul>
      <SetupListRow
        id="team-red"
        name="Red"
        label="Team Red"
        details="2 Participants"
        {...props}
      />
    </ul>,
  );
}

/** Each `<button>` or `<a>`'s accessible name (aria-label) and its text. */
function controls(html: string) {
  return [...html.matchAll(/<(button|a)\b([^>]*)>(.*?)<\/\1>/g)].map(
    ([, tag, attrs, inner]) => ({
      tag,
      label: /aria-label="([^"]*)"/.exec(attrs)?.[1],
      href: /href="([^"]*)"/.exec(attrs)?.[1],
      text: inner.replace(/<[^>]+>/g, ""),
    }),
  );
}

describe("SetupListRow", () => {
  it("shows the row's name and details beside visible Edit and Delete buttons", () => {
    const html = render({
      form: () => null,
      onDelete: ok,
      deleteTitle: "Delete Team Red?",
    });
    expect(html).toContain("Red");
    expect(html).toContain("2 Participants");
    expect(controls(html)).toEqual([
      { tag: "button", label: "Edit Team Red", href: undefined, text: "Edit" },
      {
        tag: "button",
        label: "Delete Team Red",
        href: undefined,
        text: "Delete",
      },
    ]);
  });

  it("has no whole-row button: the name is plain text", () => {
    const html = render({ form: () => null, onDelete: ok });
    expect(controls(html).some((c) => c.text.includes("Red"))).toBe(false);
  });

  it("has no Delete when the viewer may not delete the row", () => {
    const html = render({ form: () => null });
    expect(controls(html).map((c) => c.text)).toEqual(["Edit"]);
  });

  it("links Edit to a full-page editor when given an href", () => {
    const html = render({
      editHref: "/admin/announcements/a1",
      onDelete: ok,
    });
    expect(controls(html)).toEqual([
      {
        tag: "a",
        label: "Edit Team Red",
        href: "/admin/announcements/a1",
        text: "Edit",
      },
      {
        tag: "button",
        label: "Delete Team Red",
        href: undefined,
        text: "Delete",
      },
    ]);
  });

  it("keeps the row's own controls (aside) before Edit and Delete", () => {
    const html = render({
      aside: <Link href="/xi/competitions/c1">Participant view</Link>,
      form: () => null,
      onDelete: ok,
    });
    expect(controls(html).map((c) => c.text)).toEqual([
      "Participant view",
      "Edit",
      "Delete",
    ]);
  });
});
