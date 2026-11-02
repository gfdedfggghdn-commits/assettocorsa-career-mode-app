import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MyTeam Career Mode — Assetto Corsa season manager" },
      {
        name: "description",
        content:
          "Build your own team, sign sponsors and drivers, develop the car and upload your Assetto Corsa race results to advance a full career.",
      },
      { property: "og:title", content: "MyTeam Career Mode — Assetto Corsa season manager" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      {
        property: "og:description",
        content:
          "Build your own team, sign sponsors and drivers, develop the car and upload your Assetto Corsa race results to advance a full career.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20 text-center">
      <p className="label-caps">Assetto Corsa · Season Manager</p>
      <h1 className="mt-4 max-w-3xl text-5xl leading-[0.95] font-bold uppercase sm:text-7xl">
        My<span className="text-primary">Team</span> Career Mode
      </h1>
      <p className="mt-6 max-w-xl text-muted-foreground">
        Run your own team as number one driver. Build the databases once, reuse them across saves,
        develop the car, manage sponsors and contracts, and advance the season by uploading each
        race result straight out of Assetto Corsa.
      </p>
      <div className="mt-10 flex flex-wrap justify-center gap-3">
        {signedIn ? (
          <Button asChild size="lg">
            <Link to="/careers">Go to your careers</Link>
          </Button>
        ) : (
          <Button asChild size="lg">
            <Link to="/auth">Sign in to start</Link>
          </Button>
        )}
      </div>

      <div className="mt-20 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
        {[
          {
            t: "Your databases",
            d: "Sponsors, drivers, teams, engines and tracks — editable, and saveable as sets you can reuse in any future save.",
          },
          {
            t: "One upload per race",
            d: "Drop in the result file. The round, standings, prize money and contract windows all follow automatically.",
          },
          {
            t: "A real state machine",
            d: "Sponsor and contract windows must be resolved before the next race. No skipping steps.",
          },
        ].map((c) => (
          <div key={c.t} className="panel p-5">
            <h3 className="headline text-lg">{c.t}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
