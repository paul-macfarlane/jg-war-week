"use client";

import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";

import { authClient } from "@/auth/client";
import { Avatar } from "@/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DISPLAY_CHANGE_EVENT,
  DISPLAY_STORAGE_KEY,
  type Display,
  parseDisplay,
} from "@/lib/display";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const satisfies readonly {
  value: Display;
  label: string;
  icon: typeof Sun;
}[];

/** Applies a Display to `<html>` (System: no attribute). */
function applyDisplay(display: Display) {
  const html = document.documentElement;
  if (display === "system") delete html.dataset.display;
  else html.dataset.display = display;
}

function subscribe(onChange: () => void) {
  // Another tab changed the Display: the page follows, not only the menu.
  const onStorage = (event: StorageEvent) => {
    if (event.key === DISPLAY_STORAGE_KEY) {
      applyDisplay(parseDisplay(event.newValue));
    }
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(DISPLAY_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(DISPLAY_CHANGE_EVENT, onChange);
  };
}

function readDisplay(): Display {
  try {
    return parseDisplay(window.localStorage.getItem(DISPLAY_STORAGE_KEY));
  } catch {
    // Storage blocked: the Display this page applied is the one it shows.
    const applied = document.documentElement.dataset.display;
    return applied === "light" || applied === "dark" ? applied : "system";
  }
}

/** Stores the Display and applies it to `<html>`. */
function chooseDisplay(display: Display) {
  try {
    window.localStorage.setItem(DISPLAY_STORAGE_KEY, display);
  } catch {
    // Storage refused (private mode): the choice lasts until reload.
  }
  applyDisplay(display);
  window.dispatchEvent(new Event(DISPLAY_CHANGE_EVENT));
}

/**
 * The account menu: an avatar button (initials) in the top-right of the
 * participant and admin headers, opening the viewer's name and email,
 * Display (Light / Dark / System, stored per device), Admin (or, in admin,
 * Back to War Week), the Slack channel and Sign out.
 */
export function AccountMenu({
  name,
  email,
  edition,
  primaryColor,
  canOpenAdmin,
  inAdmin = false,
  slackUrl,
}: {
  name: string;
  email: string;
  edition: string;
  primaryColor: string;
  /** An Organizer, or anyone who hosts a Competition. */
  canOpenAdmin: boolean;
  /** In admin the Admin item reads "Back to War Week". */
  inAdmin?: boolean;
  /** The War Week's Slack channel; no item when empty. */
  slackUrl?: string | null;
}) {
  const router = useRouter();
  const display = useSyncExternalStore(
    subscribe,
    readDisplay,
    () => "system" as const,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className="focus-visible:ring-ring -my-1.5 flex size-11 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 md:size-10"
      >
        <Avatar name={name} teamColor={null} primaryColor={primaryColor} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 px-2 py-2">
            <span className="text-foreground truncate text-sm font-medium">
              {name}
            </span>
            <span className="truncate">{email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Display</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={display}
            onValueChange={(value) => chooseDisplay(parseDisplay(value))}
          >
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <DropdownMenuRadioItem
                key={value}
                value={value}
                className="min-h-11 md:min-h-8"
              >
                <Icon aria-hidden />
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {canOpenAdmin && (
          <DropdownMenuItem
            className="min-h-11 md:min-h-8"
            render={
              <Link
                href={inAdmin ? `/${edition}` : "/admin"}
                prefetch={false}
              />
            }
          >
            {inAdmin ? "Back to War Week" : "Admin"}
          </DropdownMenuItem>
        )}
        {slackUrl && (
          <DropdownMenuItem
            className="min-h-11 md:min-h-8"
            render={<a href={slackUrl} target="_blank" rel="noreferrer" />}
          >
            Join the Slack channel
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          className="min-h-11 md:min-h-8"
          onClick={async () => {
            await authClient.signOut();
            router.push("/");
            router.refresh();
          }}
        >
          <LogOut aria-hidden />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
