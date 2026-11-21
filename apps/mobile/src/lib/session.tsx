import type { Session } from "@supabase/supabase-js";
import * as React from "react";
import { supabase } from "./supabase";

type SessionState = { session: Session | null; loading: boolean; userId: string | null; email: string | null };

const SessionContext = React.createContext<SessionState>({ session: null, loading: true, userId: null, email: null });

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<{ session: Session | null; loading: boolean }>({ session: null, loading: true });

  React.useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => mounted && setState({ session: data.session, loading: false }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setState({ session, loading: false }));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value = React.useMemo(
    () => ({ ...state, userId: state.session?.user.id ?? null, email: state.session?.user.email ?? null }),
    [state],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export const useSession = () => React.useContext(SessionContext);

/** For screens inside the signed-in area, where the guard guarantees a user. */
export function useUserId(): string {
  const { userId } = useSession();
  if (!userId) throw new Error("useUserId outside the signed-in area");
  return userId;
}
