"use client";

import { useState, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/components/use-media-query";
import {
  type InstallPlatform,
  detectInstallPlatform,
} from "@/lib/install-platform";
import {
  getInstallPrompt,
  promptInstall,
  subscribeInstallPrompt,
} from "@/lib/install-prompt";

const STANDALONE_QUERY = "(display-mode: standalone)";

type Visitor = { platform: InstallPlatform; standalone: boolean };

// null on the server and during hydration, so nothing renders until mounted.
function useVisitor(): Visitor | null {
  const standaloneDisplay = useMediaQuery(STANDALONE_QUERY, null);
  if (standaloneDisplay === null) return null;
  return {
    platform: detectInstallPlatform(
      navigator.userAgent,
      navigator.maxTouchPoints,
    ),
    standalone:
      standaloneDisplay ||
      // iOS Safari's own flag for a Home Screen launch.
      (navigator as Navigator & { standalone?: boolean }).standalone === true,
  };
}

const PLATFORM_LABEL: Record<Exclude<InstallPlatform, "other">, string> = {
  ios: "iPhone and iPad",
  android: "Android",
};

/**
 * Shows the Add to Home Screen steps for the visitor's device, with the
 * other platform's steps one tap away. Renders nothing until mounted, since
 * the platform is only known in the browser.
 */
export function InstallInstructions() {
  const visitor = useVisitor();
  const [chosen, setChosen] = useState<InstallPlatform | null>(null);

  if (!visitor) return null;

  if (visitor.standalone) {
    return (
      <p className="border-border rounded-lg border px-4 py-3 font-medium">
        You&apos;re using the installed app.
      </p>
    );
  }

  const shown = chosen ?? visitor.platform;
  const others = (["ios", "android"] as const).filter((p) => p !== shown);

  return (
    <div className="flex flex-col gap-4">
      {shown === "ios" && <IosSteps />}
      {shown === "android" && <AndroidSteps />}
      {shown === "other" && (
        <p className="text-foreground/80">
          Open JG War Week on your phone to add it to your home screen. On a
          computer, Chrome and Edge offer an install button in the address bar.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {others.map((platform) => (
          <Button
            key={platform}
            variant="outline"
            onClick={() => setChosen(platform)}
          >
            Show {PLATFORM_LABEL[platform]} steps
          </Button>
        ))}
      </div>
    </div>
  );
}

function Steps({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <section className="border-border flex flex-col gap-3 rounded-lg border px-4 py-4">
      <h2 className="font-semibold">{title}</h2>
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

function IosSteps() {
  return (
    <Steps
      title={`${PLATFORM_LABEL.ios} (Safari)`}
      steps={[
        "Open JG War Week in Safari.",
        <>
          Tap the <strong>Share</strong> button (the square with an arrow
          pointing up).
        </>,
        <>
          Scroll down and tap <strong>Add to Home Screen</strong>.
        </>,
        <>
          Tap <strong>Add</strong>, then open JG War Week from your Home Screen.
        </>,
      ]}
    />
  );
}

function AndroidSteps() {
  const installPrompt = useSyncExternalStore(
    subscribeInstallPrompt,
    getInstallPrompt,
    () => null,
  );

  return (
    <div className="flex flex-col gap-4">
      {installPrompt && (
        <Button size="lg" onClick={() => void promptInstall()}>
          Install
        </Button>
      )}
      <Steps
        title={
          installPrompt ? "Or install it by hand (Chrome)" : "Android (Chrome)"
        }
        steps={[
          "Open JG War Week in Chrome.",
          <>
            Tap the <strong>⋮</strong> menu in the top-right corner.
          </>,
          <>
            Tap <strong>Install app</strong> (or{" "}
            <strong>Add to Home screen</strong>).
          </>,
          <>
            Tap <strong>Install</strong>, then open JG War Week from your home
            screen.
          </>,
        ]}
      />
    </div>
  );
}
