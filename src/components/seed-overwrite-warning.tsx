/** Settings' warning that reloading the seed replaces what's edited here. */
export function SeedOverwriteWarning() {
  return (
    <p
      role="note"
      className="rounded-md border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm"
    >
      <strong>Heads up:</strong> reloading this War Week&apos;s seed file (
      <code>pnpm seed:load</code>) overwrites the setup edited here with the
      seed&apos;s values. Update the seed too, or don&apos;t reload it.
    </p>
  );
}
