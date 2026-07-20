import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setApiToken } from "../api/client";

export function AuthTokenSetter() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setApiToken(null);
      return;
    }
    getToken().then((token) => setApiToken(token));
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
