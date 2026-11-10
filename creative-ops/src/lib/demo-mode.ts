export function isDemoLoginEnabled(
  nodeEnv: string | undefined,
  enableDemoLogin: string | undefined,
  demoDatabaseIsolated: string | undefined,
): boolean {
  return nodeEnv !== "production" || (
    enableDemoLogin === "true" && demoDatabaseIsolated === "true"
  );
}
