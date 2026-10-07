import Image from "next/image";
import type { ComponentProps } from "react";

/**
 * One About still in both schemes (the About dark stills fix):
 * `public/about/<name>.png` captured under the light Display and
 * `public/about/<name>-dark.png` under the dark one, both written by
 * `scripts/about-media.ts` at 2x. Rendered with `next/image`, so each is
 * served at a width that fits `sizes` and stays crisp. `globals.css` shows
 * only the one matching the viewer's Display (`data-still-scheme`); the other
 * is `display: none`, so screen readers read one alt text and, lazy, it is
 * never fetched.
 */
export function AboutStill({
  name,
  alt,
  ...props
}: { name: string; alt: string } & Omit<
  ComponentProps<typeof Image>,
  "src" | "alt" | "loading"
>) {
  return (
    <>
      <Image
        {...props}
        src={`/about/${name}.png`}
        alt={alt}
        loading="lazy"
        data-still-scheme="light"
      />
      <Image
        {...props}
        src={`/about/${name}-dark.png`}
        alt={alt}
        loading="lazy"
        data-still-scheme="dark"
      />
    </>
  );
}
