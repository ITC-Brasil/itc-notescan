"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

export function SessionProvider({ children }: { children: React.ReactNode }) {
  return (
    // In the APK the app returns from background constantly (multitasking). The
    // default focus revalidation re-fetches /api/auth/session on every resume;
    // a null/transient result there would bounce the user to login. The JWT
    // cookie (7-day maxAge) is the source of truth, so disable focus/offline
    // refetch and let the session persist across resumes.
    <NextAuthSessionProvider refetchOnWindowFocus={false} refetchWhenOffline={false}>
      {children}
    </NextAuthSessionProvider>
  );
}
