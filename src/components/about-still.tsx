import Image from "next/image";
import type { ComponentProps } from "react";

type StillImageProps = Omit<
  ComponentProps<typeof Image>,
  "src" | "alt" | "loading"
>;

/**
 * One About still in both schemes (the About dark stills fix):
 * `public/about/<name>.png` captured under the light Display and
 * `public/about/<name>-dark.png` under the dark one, both written by
 * `scripts/about-media.ts` at 2x. Rendered with `next/image`, so each is
 * served at a width that fits `sizes` and stays crisp. `globals.css` shows
 * only the one matching the viewer's Display (`data-still-scheme`); the other
 * is `display: none`, so screen readers read one alt text and, lazy, it is
 * never fetched.
 *
 * With `phone`, the still also has a phone-viewport capture
 * (`<name>-phone.png`, `<name>-phone-dark.png`, `data-still-size="phone"`)
 * shown below `md`, while the desktop capture (`data-still-size="desktop"`)
 * shows from `md` up, so a feature is readable at 390 as well as 1440.
 */
export function AboutStill({
  name,
  alt,
  phone,
  className,
  ...props
}: { name: string; alt: string; className?: string } & Omit<
  StillImageProps,
  "className"
> & {
    phone?: Pick<StillImageProps, "width" | "height" | "sizes" | "className">;
  }) {
  const variants = phone
    ? ([
        {
          size: "phone",
          file: `${name}-phone`,
          props: {
            ...phone,
            className: `${phone.className ?? className ?? ""} md:hidden`,
          },
        },
        {
          size: "desktop",
          file: name,
          props: { ...props, className: `${className ?? ""} hidden md:block` },
        },
      ] as const)
    : ([
        { size: "desktop", file: name, props: { ...props, className } },
      ] as const);

  return (
    <>
      {variants.flatMap((variant) =>
        (["light", "dark"] as const).map((scheme) => (
          <Image
            key={`${variant.size}-${scheme}`}
            {...(variant.props as StillImageProps)}
            src={`/about/${variant.file}${scheme === "dark" ? "-dark" : ""}.png`}
            alt={alt}
            loading="lazy"
            data-still-scheme={scheme}
            data-still-size={variant.size}
          />
        )),
      )}
    </>
  );
}
