import { createFileRoute } from "@tanstack/react-router";
import { SageWorkspace } from "@/components/sage-workspace";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Sage Bot — Your dispenser" },
      { name: "description", content: "Manage private medicine schedules and monitor your Sage Bot dispenser." },
      { property: "og:title", content: "Sage Bot — Your dispenser" },
      { property: "og:description", content: "Manage your medicine schedule and dispenser." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SageWorkspace,
});