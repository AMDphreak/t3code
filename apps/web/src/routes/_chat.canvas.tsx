import { createFileRoute } from "@tanstack/react-router";

import { ConversationCanvas } from "../components/canvas/ConversationCanvas";
import { SidebarInset } from "../components/ui/sidebar";

export const Route = createFileRoute("/_chat/canvas")({
  component: CanvasRoute,
});

function CanvasRoute() {
  return (
    <SidebarInset className="flex min-h-0 flex-col">
      <ConversationCanvas />
    </SidebarInset>
  );
}
