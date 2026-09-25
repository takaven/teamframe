"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const LEGACY_DESTINATIONS: Record<string, string> = {
  "#documents": "/documents-and-policies#documents",
  "#policies": "/documents-and-policies#policies",
  "#check-in": "/home#check-in",
};

/** Keeps important pre-split bookmarks useful without making /me a second Home. */
export function LegacyMeHashRedirect() {
  const router = useRouter();

  useEffect(() => {
    const destination = LEGACY_DESTINATIONS[window.location.hash];
    if (destination) router.replace(destination);
  }, [router]);

  return null;
}
