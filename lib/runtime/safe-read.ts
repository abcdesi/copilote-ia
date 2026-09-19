export async function safeRead<T>(
  label: string,
  operation: () => Promise<T>,
  fallback: T
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[runtime-read] ${label}`, error);
    return fallback;
  }
}
