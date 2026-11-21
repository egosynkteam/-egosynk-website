import { legacy } from "./links";

// Where to go after signing in or up: only a page on this site, i.e. a path starting with one
// "/" (not "//host" or "/\host"), so a crafted ?redirect= link can't send someone to another
// site or run a javascript: URL. tests/pages.test.js checks this exact rule.
const SAME_SITE = /^\/(?![/\\])/;

export function safeRedirect(wanted: string | null | undefined, fallback: string = legacy.account) {
  return wanted && SAME_SITE.test(wanted) ? wanted : fallback;
}
