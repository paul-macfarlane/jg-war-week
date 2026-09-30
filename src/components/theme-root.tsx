"use client";

import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";

const ThemeContainerContext = createContext<HTMLElement | null>(null);

/**
 * The nearest themed root's DOM node, or null outside of one. Base UI
 * Select/Popover/Combobox popups portal into `<body>` by default, which
 * sits outside every themed root and would not see its `style` CSS
 * variables; passing this as the popup's `container` keeps the edition's
 * Appearance Theme applied.
 */
export function useThemeContainer(): HTMLElement | null {
  return useContext(ThemeContainerContext);
}

type ThemeRootProps = {
  /**
   * Element tag for the root. Defaults to "div"; use "li" where the parent
   * requires list-item semantics (e.g. an `ArchiveCard` inside a `<ul>`).
   */
  as?: "div" | "li";
  style?: CSSProperties;
  /**
   * Pins the root to one color scheme whatever the viewer's Display, for
   * the Setup form's two previews. Rendered as `data-scheme`.
   */
  scheme?: "dark" | "light";
  className?: string;
  children?: ReactNode;
};

/**
 * Renders a War Week's themed root (Appearance Theme colors set as inline
 * `style`, per `warWeekThemeStyle`) and publishes its own DOM node through
 * context via `useThemeContainer`, so themed popups can portal inside it.
 */
export function ThemeRoot({
  as = "div",
  style,
  scheme,
  className,
  children,
}: ThemeRootProps) {
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const containerRef = useCallback(
    (node: HTMLElement | null) => setContainer(node),
    [],
  );
  const Tag = as;

  return (
    <Tag
      ref={containerRef}
      style={style}
      data-theme-root={style ? "" : undefined}
      data-scheme={scheme}
      className={className}
    >
      <ThemeContainerContext.Provider value={container}>
        {children}
      </ThemeContainerContext.Provider>
    </Tag>
  );
}
