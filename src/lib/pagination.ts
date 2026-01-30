import ora, { Ora } from 'ora';
import fs from 'fs';
import path from 'path';
import type { PaginatedResult } from '../types/twitter.js';

export interface PaginationOptions {
  all?: boolean;
  maxPages?: number;
  resume?: string;
  delay?: number;
  silent?: boolean;
}

export interface CursorState {
  cursor?: string;
  pagesFetched: number;
  totalItems: number;
  lastUpdated: string;
  query?: string;
}

export interface PaginationProgress {
  page: number;
  items: number;
  total: number;
  cursor?: string;
}

type FetchPage<T> = (cursor?: string) => Promise<PaginatedResult<T>>;

export class Paginator<T> {
  private options: PaginationOptions;
  private spinner: Ora | null = null;
  private state: CursorState;

  constructor(options: PaginationOptions = {}) {
    this.options = {
      delay: 1000,
      silent: false,
      ...options,
    };
    this.state = {
      pagesFetched: 0,
      totalItems: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Load cursor state from resume file
   */
  loadState(resumeFile?: string): CursorState | null {
    const file = resumeFile || this.options.resume;
    if (!file) return null;

    try {
      const resolved = path.resolve(file);
      if (fs.existsSync(resolved)) {
        const data = JSON.parse(fs.readFileSync(resolved, 'utf-8'));
        this.state = data;
        return data;
      }
    } catch (e) {
      // Ignore errors, start fresh
    }
    return null;
  }

  /**
   * Save cursor state to resume file
   */
  saveState(cursor?: string, additionalData?: Record<string, unknown>): void {
    if (!this.options.resume) return;

    const state: CursorState = {
      cursor,
      pagesFetched: this.state.pagesFetched,
      totalItems: this.state.totalItems,
      lastUpdated: new Date().toISOString(),
      ...additionalData,
    };

    try {
      const resolved = path.resolve(this.options.resume);
      const dir = path.dirname(resolved);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(resolved, JSON.stringify(state, null, 2));
    } catch (e) {
      // Ignore save errors
    }
  }

  /**
   * Clear resume file on successful completion
   */
  clearState(): void {
    if (!this.options.resume) return;

    try {
      const resolved = path.resolve(this.options.resume);
      if (fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    } catch (e) {
      // Ignore errors
    }
  }

  /**
   * Fetch all pages with progress tracking
   */
  async fetchAll(
    fetchFn: FetchPage<T>,
    onProgress?: (progress: PaginationProgress) => void
  ): Promise<{ items: T[]; pagesLoaded: number; complete: boolean }> {
    const allItems: T[] = [];
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = this.options.maxPages || (this.options.all ? Infinity : 1);

    // Load previous state if resuming
    const savedState = this.loadState();
    if (savedState?.cursor) {
      cursor = savedState.cursor;
      pageCount = savedState.pagesFetched;
      this.state = savedState;
      if (!this.options.silent) {
        console.log(`Resuming from page ${pageCount + 1}, cursor: ${cursor?.slice(0, 20)}...`);
      }
    }

    // Start spinner
    if (!this.options.silent) {
      this.spinner = ora({
        text: this.getSpinnerText(pageCount, allItems.length),
        color: 'cyan',
      }).start();
    }

    try {
      while (hasMore && pageCount < maxPages) {
        const result = await fetchFn(cursor);
        
        allItems.push(...result.items);
        pageCount++;
        this.state.pagesFetched = pageCount;
        this.state.totalItems = allItems.length;

        // Update progress
        if (this.spinner) {
          this.spinner.text = this.getSpinnerText(pageCount, allItems.length);
        }

        if (onProgress) {
          onProgress({
            page: pageCount,
            items: result.items.length,
            total: allItems.length,
            cursor: result.cursor,
          });
        }

        // Check if we should continue
        hasMore = result.hasMore && !!result.cursor;
        cursor = result.cursor;

        // Save state for resume
        this.saveState(cursor);

        // Delay between requests (skip on last page)
        if (hasMore && pageCount < maxPages && this.options.delay) {
          await this.sleep(this.options.delay);
        }
      }

      // Complete - clear resume file
      if (!hasMore || !this.options.all) {
        this.clearState();
      }

      if (this.spinner) {
        const icon = hasMore ? '⏸' : '✓';
        this.spinner.succeed(`${icon} Fetched ${allItems.length} items across ${pageCount} page(s)`);
      }

      return {
        items: allItems,
        pagesLoaded: pageCount,
        complete: !hasMore,
      };
    } catch (error: any) {
      // Save state on error for resume
      this.saveState(cursor);

      if (this.spinner) {
        this.spinner.fail(`Error on page ${pageCount + 1}: ${error.message}`);
      }

      // Check if rate limited
      if (this.isRateLimitError(error)) {
        const waitTime = this.extractRateLimitWait(error);
        if (!this.options.silent) {
          console.log(`Rate limited. Resume with: --resume ${this.options.resume || 'cursor.json'}`);
          if (waitTime) {
            console.log(`Retry after: ${Math.ceil(waitTime / 1000)} seconds`);
          }
        }
      }

      throw error;
    }
  }

  /**
   * Stream pages one at a time (generator pattern)
   */
  async *stream(
    fetchFn: FetchPage<T>
  ): AsyncGenerator<{ items: T[]; page: number; cursor?: string; hasMore: boolean }> {
    let cursor: string | undefined;
    let hasMore = true;
    let pageCount = 0;
    const maxPages = this.options.maxPages || (this.options.all ? Infinity : 1);

    // Load previous state if resuming
    const savedState = this.loadState();
    if (savedState?.cursor) {
      cursor = savedState.cursor;
      pageCount = savedState.pagesFetched;
    }

    while (hasMore && pageCount < maxPages) {
      const result = await fetchFn(cursor);
      pageCount++;
      this.state.pagesFetched = pageCount;
      this.state.totalItems += result.items.length;

      yield {
        items: result.items,
        page: pageCount,
        cursor: result.cursor,
        hasMore: result.hasMore,
      };

      hasMore = result.hasMore && !!result.cursor;
      cursor = result.cursor;

      // Save state for resume
      this.saveState(cursor);

      // Delay between requests
      if (hasMore && pageCount < maxPages && this.options.delay) {
        await this.sleep(this.options.delay);
      }
    }

    // Clear resume file on completion
    if (!hasMore) {
      this.clearState();
    }
  }

  private getSpinnerText(page: number, total: number): string {
    const maxPages = this.options.maxPages;
    const pageInfo = maxPages && maxPages !== Infinity
      ? `Page ${page}/${maxPages}`
      : `Page ${page}`;
    return `${pageInfo} | ${total} items fetched`;
  }

  private isRateLimitError(error: any): boolean {
    return (
      error.message?.includes('Rate') ||
      error.message?.includes('429') ||
      error.message?.includes('limit')
    );
  }

  private extractRateLimitWait(error: any): number | null {
    // Try to extract from error message or headers
    const match = error.message?.match(/(\d+)\s*seconds?/i);
    if (match) {
      return parseInt(match[1]) * 1000;
    }
    return null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Convenience function for simple pagination
 */
export async function fetchAllPages<T>(
  fetchFn: FetchPage<T>,
  options: PaginationOptions = {}
): Promise<T[]> {
  const paginator = new Paginator<T>(options);
  const result = await paginator.fetchAll(fetchFn);
  return result.items;
}

/**
 * Create pagination options from CLI flags
 */
export function createPaginationOptions(cliOptions: {
  all?: boolean;
  maxPages?: string;
  resume?: string;
  delay?: string;
}): PaginationOptions {
  return {
    all: cliOptions.all,
    maxPages: cliOptions.maxPages ? parseInt(cliOptions.maxPages) : undefined,
    resume: cliOptions.resume,
    delay: cliOptions.delay ? parseInt(cliOptions.delay) : 1000,
  };
}
