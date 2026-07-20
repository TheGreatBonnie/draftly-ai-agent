import { useEffect } from "react";
import { useAuth } from "@clerk/react";
import { setApiToken, setPendingToken } from "../api/client";

export function AuthTokenSetter() {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) {
      setApiToken(null);
      return;
    }
    const promise = getToken({ skipCache: true }).then((token) => {
      setApiToken(token);
      return token;
    });
    setPendingToken(promise);
  }, [getToken, isLoaded, isSignedIn]);

  return null;
}
