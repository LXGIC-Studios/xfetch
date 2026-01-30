/**
 * CSV output formatter using csv-stringify
 */

import { stringify } from 'csv-stringify/sync';

export interface CsvOptions {
  headers?: boolean;
  delimiter?: string;
  columns?: string[];
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
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.tweets)) return obj.tweets;
    if (Array.isArray(obj.users)) return obj.users;
    if (Array.isArray(obj.data)) return obj.data;
    if (Array.isArray(obj.results)) return obj.results;
  }
  
  return [data];
}

/**
 * Flatten nested objects for CSV output
 */
function flattenObject(obj: unknown, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  if (obj === null || obj === undefined) {
    return result;
  }
  
  if (typeof obj !== 'object') {
    return { [prefix || 'value']: String(obj) };
  }
  
  if (Array.isArray(obj)) {
    // Convert arrays to JSON string
    return { [prefix || 'value']: JSON.stringify(obj) };
  }
  
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const newKey = prefix ? `${prefix}_${key}` : key;
    
    if (value === null || value === undefined) {
      result[newKey] = '';
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      // Flatten nested objects (but not too deep)
      if (prefix.split('_').length < 2) {
        Object.assign(result, flattenObject(value, newKey));
      } else {
        result[newKey] = JSON.stringify(value);
      }
    } else if (Array.isArray(value)) {
      result[newKey] = JSON.stringify(value);
    } else {
      result[newKey] = String(value);
    }
  }
  
  return result;
}

/**
 * Get all unique columns from items
 */
function getColumns(items: Record<string, string>[]): string[] {
  const columnSet = new Set<string>();
  for (const item of items) {
    for (const key of Object.keys(item)) {
      columnSet.add(key);
    }
  }
  return Array.from(columnSet);
}

export function formatCsv(data: unknown, options: CsvOptions = {}): string {
  const { headers = true, delimiter = ',', columns } = options;
  
  const items = extractItems(data);
  
  if (items.length === 0) {
    return '';
  }
  
  // Flatten all items
  const flatItems = items.map(item => flattenObject(item));
  
  // Determine columns
  const cols = columns || getColumns(flatItems);
  
  // Build rows
  const rows = flatItems.map(item => 
    cols.map(col => item[col] ?? '')
  );
  
  return stringify(headers ? [cols, ...rows] : rows, {
    delimiter,
  });
}

export function outputCsv(data: unknown, options: CsvOptions = {}): void {
  const output = formatCsv(data, options);
  if (output) {
    process.stdout.write(output);
  }
}
