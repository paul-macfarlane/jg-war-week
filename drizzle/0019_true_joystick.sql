CREATE TABLE "profile" (
	"email" varchar(254) PRIMARY KEY NOT NULL,
	"name" varchar(120),
	"image_url" varchar(2048),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "profile_email_lowercase" CHECK ("profile"."email" = lower("profile"."email"))
);
