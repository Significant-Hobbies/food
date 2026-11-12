/** The legacy evidence workbench remains local-only until operator authentication exists. */
export function isLocalOperatorRoute(location: { hostname: string; pathname: string }): boolean {
  return ["localhost", "127.0.0.1", "::1"].includes(location.hostname)
    && /^\/operator(?:\/|$)/.test(location.pathname);
}
