// Adds what seeds/demo/xii-scale.json can't hold (Hosts, the generated Bracket, ticks, Games) to a loaded XII: `pnpm seed:demo:scale` runs it.
import { loadEnvConfig } from "@next/env";

import { isLocalDatabaseUrl } from "@/db/local-url";

loadEnvConfig(process.cwd());

async function main() {
  if (
    !isLocalDatabaseUrl(process.env.DATABASE_URL, process.env.DATABASE_DRIVER)
  ) {
    console.error(
      "The scale fixture refuses a non-local DATABASE_URL (localhost, 127.0.0.1 or [::1] only): it is demo data",
    );
    process.exit(1);
  }
  const { applyScaleFixture } = await import("@/seed/scale");
  await applyScaleFixture();
  console.log("Applied the XII scale fixture");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
