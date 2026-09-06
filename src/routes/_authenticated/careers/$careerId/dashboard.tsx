import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/careers/$careerId/dashboard")({
  head: () => ({
    meta: [
      { title: "Season dashboard — MyTeam Career" },
      { name: "description", content: "Run your season: development, sponsors, standings and race results." },
      { property: "og:title", content: "Season dashboard — MyTeam Career" },
      { property: "og:description", content: "Run your season: development, sponsors, standings and race results." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <main className="mx-auto max-w-4xl px-5 py-14">
      <p className="label-caps">Season</p>
      <h1 className="headline text-3xl">Dashboard</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        The season dashboard is still being built.
      </p>
    </main>
  );
}
