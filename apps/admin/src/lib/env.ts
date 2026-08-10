function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  apiUrl: requireEnv("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL),
  adminAppUrl: requireEnv("NEXT_PUBLIC_ADMIN_APP_URL", process.env.NEXT_PUBLIC_ADMIN_APP_URL),
};
