"use client";

import { useEffect } from "react";
import { recoveryRedirectDestination } from "@/lib/auth/recovery";

export function RecoveryRedirect() {
  useEffect(() => {
    const destination = recoveryRedirectDestination(window.location.hash);
    if (destination) {
      window.location.replace(destination);
    }
  }, []);

  return null;
}
