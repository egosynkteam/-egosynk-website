"use client";

import { useEffect } from "react";
import { legacy } from "@/lib/links";

// Links that still point at the old homepage keep working:
//  - /#bag (the "Bag" link on product, account and policy pages) opens the bag
//  - /?restore=<token> (abandoned-cart reminder emails) puts the items back in the bag
// Both live on the original store page, so send the visitor there, keeping the token.
export function LegacyHandoff() {
  useEffect(() => {
    const restore = new URLSearchParams(location.search).get("restore");
    if (restore) location.replace(`${legacy.shop}?restore=${encodeURIComponent(restore)}`);
    else if (location.hash === "#bag") location.replace(legacy.bag);
  }, []);
  return null;
}
