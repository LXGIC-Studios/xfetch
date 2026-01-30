/**
 * JSON output formatter - pretty-printed JSON
 */

export interface JsonOptions {
  pretty?: boolean;
  indent?: number;
}

export function formatJson(data: unknown, options: JsonOptions = {}): string {
  const { pretty = true, indent = 2 } = options;
  return JSON.stringify(data, null, pretty ? indent : 0);
}

export function outputJson(data: unknown, options: JsonOptions = {}): void {
  console.log(formatJson(data, options));
}
