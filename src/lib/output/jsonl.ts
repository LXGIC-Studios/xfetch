/**
 * JSONL output formatter - line-delimited JSON for streaming
 * Each line is a valid JSON object
 */

export interface JsonlOptions {
  // Future options if needed
}

/**
 * Extract items from various data structures
 */
function extractItems(data: unknown): unknown[] {
  if (Array.isArray(data)) {
    return data;
  }
  
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    // Handle common wrapper formats
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.tweets)) return obj.tweets;
    if (Array.isArray(obj.users)) return obj.users;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.results)) return obj.results;
  }
  
  // Single item
  return [data];
}

export function formatJsonl(data: unknown, _options: JsonlOptions = {}): string {
  const items = extractItems(data);
  return items.map(item => JSON.stringify(item)).join('\n');
}

export function outputJsonl(data: unknown, options: JsonlOptions = {}): void {
  const items = extractItems(data);
  // Output line by line for true streaming
  for (const item of items) {
    console.log(JSON.stringify(item));
  }
}

/**
 * Stream JSONL output - useful for large datasets
 */
export function* streamJsonl(data: unknown): Generator<string> {
  const items = extractItems(data);
  for (const item of items) {
    yield JSON.stringify(item);
  }
}
