import { RichText } from "@/components/rich-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type AnnouncementCardData,
  formatPublishedAt,
} from "@/lib/announcements";

/** One Announcement: title, author and time, then the body (videos included). */
export function AnnouncementCard({
  announcement,
  headingLevel = "h2",
}: {
  announcement: AnnouncementCardData;
  /** The title element's heading level, so a page nests headings correctly. */
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <article>
      <Card className="gap-3">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            <Heading className="text-lg font-semibold">
              {announcement.title}
            </Heading>
            {announcement.pinned ? <Badge>Pinned</Badge> : null}
          </CardTitle>
          <p className="text-foreground/60 text-xs">
            {announcement.authorName} ·{" "}
            {formatPublishedAt(announcement.publishedAt)}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {/* Body headings sit one below the title's own level. */}
          <RichText
            content={announcement.body}
            headingFloor={headingLevel === "h2" ? 3 : 4}
            videoTitle={`Video: ${announcement.title}`}
          />
        </CardContent>
      </Card>
    </article>
  );
}
