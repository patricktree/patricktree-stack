import invariant from 'tiny-invariant';
import * as xml2js from 'xml2js';
import { z } from 'zod';

import { log } from '#pkg/logger.js';

const schema_sitemapindex = z.object({
  sitemapindex: z.object({
    sitemap: z.array(
      z.object({
        loc: z.array(z.string()).min(1),
      }),
    ),
  }),
});
const schema_urlset = z.object({
  urlset: z.object({
    url: z.array(
      z.object({
        loc: z.array(z.string()).min(1),
      }),
    ),
  }),
});
const schema_sitemap = z.union([schema_sitemapindex, schema_urlset]);

export async function* fetchSitemapLinks(url: URL): AsyncGenerator<string[], void, unknown> {
  const queue: URL[] = [url];
  log(`Added URL to queue: ${url.href}`);

  while (queue.length > 0) {
    const currentUrl = queue.shift();
    invariant(currentUrl);
    log(`Processing URL from queue: ${currentUrl.href}`);

    // Fetch sitemap data
    const response = await fetchUrl(currentUrl);
    const data = await response.text();
    const parser = new xml2js.Parser();
    const result = (await parser.parseStringPromise(data)) as unknown;
    const parsed = schema_sitemap.parse(result);

    if ('sitemapindex' in parsed) {
      // Enqueue nested sitemaps
      const sitemaps = parsed.sitemapindex.sitemap.map((entry) => {
        invariant(entry.loc.length === 1);
        invariant(entry.loc[0]);
        return entry.loc[0];
      });
      for (const sitemapUrl of sitemaps) {
        const newUrl = new URL(sitemapUrl);
        queue.push(newUrl);
        log(`Added URL to queue: ${newUrl.href}`);
      }
    } else if ('urlset' in parsed) {
      // Yield URLs from the set
      const links = parsed.urlset.url.map((entry) => {
        invariant(entry.loc.length === 1);
        invariant(entry.loc[0]);
        return entry.loc[0];
      });
      yield links;
    }
  }
}

async function fetchUrl(url: URL): Promise<Response> {
  log(`Fetching URL: ${url.href}`);
  let attempts = 1;
  let response: Response | undefined;
  while (attempts <= 3 && !response) {
    try {
      log(`Attempt ${attempts} for ${url.href}`);
      response = await fetch(url.href);
    } catch {
      log(`Attempt ${attempts} failed for ${url.href}`);
    }
    attempts++;
  }

  if (!response?.ok || !`${response.status}`.startsWith('2')) {
    throw new Error(
      `could not fetch URL! url.href=${url.href}, !!response=${!!response}, response.status=${response?.status}`,
    );
  }

  return response;
}
