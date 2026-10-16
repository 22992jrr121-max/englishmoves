import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Dock } from "@/components/Dock";
import { NotesFab } from "@/components/NotesFab";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const hideDock = path.startsWith("/onboarding");
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <div className={hideDock ? "" : "pb-32"}>
        <Outlet />
      </div>
      {!hideDock && <Dock />}
      {!hideDock && <NotesFab />}
    </div>
  );
}
