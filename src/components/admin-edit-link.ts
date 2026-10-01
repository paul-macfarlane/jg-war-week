import { buttonVariants } from "@/components/ui/button";

/** An admin list row's outline "Edit" link, at least 44px on phones. */
export const adminEditLinkClass = buttonVariants({
  variant: "outline",
  className: "min-h-11 min-w-11 sm:min-h-0 sm:min-w-0",
});
