import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/careers/$careerId/complete")({
  head: () => ({
    meta: [
      { title: "Season complete — MyTeam Career" },
      { name: "description", content: "Review your finished season before starting the next one." },
      { property: "og:title", content: "Season complete — MyTeam Career" },
      { property: "og:description", content: "Review your finished season before starting the next one." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CompletePage,
});

function CompletePage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <p className="label-caps">Season</p>
      <h1 className="headline text-3xl">Season complete</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The end-of-season summary is still being built.
      </p>
    </main>
  );
}
