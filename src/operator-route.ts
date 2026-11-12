/** The legacy workbench uses the existing server host policy; bracketed IPv6 remains read-only. */
export function isLocalOperatorRoute(location: { hostname: string; pathname: string }): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
    && /^\/operator(?:\/|$)/.test(location.pathname);
}
