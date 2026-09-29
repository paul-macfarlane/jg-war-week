CREATE TYPE "public"."game_type" AS ENUM('head-to-head', 'best-score', 'ranked');--> statement-breakpoint
ALTER TYPE "public"."competition_format" ADD VALUE 'games';