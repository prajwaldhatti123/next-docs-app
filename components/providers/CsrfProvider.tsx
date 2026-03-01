"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

interface CsrfContextValue {
  csrfToken: string;
  ready: boolean;
}

const CsrfContext = createContext<CsrfContextValue>({
  csrfToken: "",
  ready: false,
});

/** Wrap your layout or page with this to share a single CSRF token. */
export function CsrfProvider({ children }: { children: ReactNode }) {
  const [csrfToken, setCsrfToken] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Called once per page mount — idempotent endpoint returns same token
    fetch("/api/csrf")
      .then((r) => r.json())
      .then((d) => {
        setCsrfToken(d.token ?? "");
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  return (
    <CsrfContext.Provider value={{ csrfToken, ready }}>
      {children}
    </CsrfContext.Provider>
  );
}

/** Returns the shared CSRF token and a ready flag. */
export function useCsrf(): CsrfContextValue {
  return useContext(CsrfContext);
}
