import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useCareer } from "@/lib/career/api";

export const Route = createFileRoute("/_authenticated/careers/$careerId/")({
  head: () => ({ meta: [
    { title: "Continue career — AC Career Mode" },
    { name: "description", content: "Continue your Assetto Corsa MyTeam or Driver Career season." },
    { property: "og:title", content: "Continue career — AC Career Mode" },
    { property: "og:description", content: "Continue your Assetto Corsa MyTeam or Driver Career season." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CareerRouter,
});

function CareerRouter() {
  const { careerId } = Route.useParams();
  const { data: career } = useCareer(careerId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!career) return;
    const to =
      career.state === "PRESEASON"
        ? "/careers/$careerId/preseason"
        : career.state === "SEASON_COMPLETE"
          ? "/careers/$careerId/complete"
          : "/careers/$careerId/dashboard";
    navigate({ to, params: { careerId }, replace: true });
  }, [career, careerId, navigate]);

  return <div className="p-10 text-sm text-muted-foreground">Loading career…</div>;
}
