export function pathToFileURL(filePath: string): URL {
  const normalized = (filePath || '').replace(/\\/g, '/');
  const prefixed = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return new URL(`file://${prefixed}`);
}
