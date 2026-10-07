"use client";

import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type GroupTab = { slug: string; name: string; content: ReactNode };

/**
 * The Participant Competitions list's Group tabs. The open tab is in the
 * URL as ?group=<slug>, written with history replace so choosing tabs adds
 * no history entries and Back from a Competition returns to the open tab.
 * Every panel stays mounted, so each Group's Competitions are in the HTML.
 */
export function CompetitionGroupTabs({
  tabs,
  initial,
}: {
  tabs: GroupTab[];
  initial: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState(initial);

  return (
    <Tabs
      value={value}
      onValueChange={(next) => {
        const slug = String(next);
        setValue(slug);
        router.replace(`${pathname}?group=${encodeURIComponent(slug)}`, {
          scroll: false,
        });
      }}
    >
      <TabsList className="w-full flex-wrap justify-start gap-1 group-data-horizontal/tabs:h-auto">
        {tabs.map((tab) => (
          <TabsTrigger
            key={tab.slug}
            value={tab.slug}
            className="h-auto min-h-11 max-w-full flex-none px-3 text-left whitespace-normal"
          >
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.slug}
          value={tab.slug}
          keepMounted
          className="pt-2"
        >
          {tab.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}
