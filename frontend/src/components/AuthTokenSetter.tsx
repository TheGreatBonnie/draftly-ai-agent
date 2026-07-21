import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/react";
import { setApiToken, setPendingToken } from "../api/client";

const REFRESH_INTERVAL_MS = 50 * 60 * 1000; // 50 minutes

export function AuthTokenSetter() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setApiToken(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const refresh = () => {
      const promise = getToken({ skipCache: true, template: "Draftly" }).then(
        (token) => {
          setApiToken(token);
          return token;
        }
      );
      setPendingToken(promise);
    };

    refresh();
    intervalRef.current = setInterval(refresh, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
