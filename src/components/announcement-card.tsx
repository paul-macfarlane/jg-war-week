import { RichText } from "@/components/rich-text";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type AnnouncementCardData,
  formatPublishedAt,
} from "@/lib/announcements";
import { videoEmbedUrl } from "@/lib/video";

/** One Announcement: title, author and time, body, then any video embeds. */
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
          <RichText content={announcement.body} />
          {announcement.videoUrls.map((url, index) => {
            const src = videoEmbedUrl(url);
            if (!src) return null;
            return (
              <iframe
                key={`${index}-${url}`}
                src={src}
                title={`Video: ${announcement.title}`}
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                className="aspect-video w-full rounded-lg"
              />
            );
          })}
        </CardContent>
      </Card>
    </article>
  );
}
