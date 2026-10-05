#!/usr/bin/env bash
# Vercel's build (vercel.json `buildCommand`): migrate the deployment's
# database first, then build, so new code never goes live before its
# migration and a failed migration fails the deploy.
#
# Only production (`main`) and the `staging` branch migrate. Every other
# preview shares staging's DATABASE_URL, so a feature branch's preview must
# never migrate it. CI and local `pnpm build` don't use this script.
set -euo pipefail

if [ "${VERCEL_ENV:-}" = "production" ] || [ "${VERCEL_GIT_COMMIT_REF:-}" = "staging" ]; then
  echo "Migrating the ${VERCEL_ENV} database (${VERCEL_GIT_COMMIT_REF}) before the build."
  pnpm db:migrate
else
  echo "No migration: ${VERCEL_ENV:-local} build of ${VERCEL_GIT_COMMIT_REF:-unknown}."
fi

pnpm build
