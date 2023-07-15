import playwright from 'playwright';
import invariant from 'tiny-invariant';
import { z } from 'zod';

import { arrays } from '@pkerschbaum/commons-ecma/util/arrays';
import { check } from '@pkerschbaum/commons-ecma/util/assert';
import { binaryUtils } from '@pkerschbaum/commons-node/utils/binary';

import { fetchFaviconURLs } from '#pkg/favicon.js';

export const schema_faviconsForWebsites = z.object({
  websites: z.record(
    z.string().url(),
    z
      .object({
        iconURLs: z.object({
          light: z.string().url().optional(),
          dark: z.string().url().optional(),
        }),
      })
      .optional(),
  ),

  icons: z.record(z.string().url(), z.object({ dataURL: z.string().min(1) }).optional()),
});
export type FaviconsForWebsites = z.infer<typeof schema_faviconsForWebsites>;

export async function fetchFavicons(hrefs: string[]): Promise<FaviconsForWebsites> {
  // Preparation: start browser
  const browser = await initializeBrowserInstance();

  // Step #1: Use puppeteer to go to every href and fetch the URLs for both its light favicon and dark favicon
  const websites: FaviconsForWebsites['websites'] = {};
  for (const href of hrefs) {
    // we fetch favicon URLs one after another so that we do not overwhelm the pptr browser instance
    const faviconURLs = await fetchFaviconURLs(new URL(href), { browser });
    websites[href] = {
      iconURLs: {
        light: faviconURLs.icons.light?.href,
        dark: faviconURLs.icons.dark?.href,
      },
    };
  }

  // Step #2: Gather a list of favicon URLs we need to fetch (with duplicates removed)
  let allIconURLs: URL[] = [];
  for (const entry of Object.values(websites)) {
    invariant(entry);
    if (check.isNonEmptyString(entry.iconURLs.light)) {
      allIconURLs.push(new URL(entry.iconURLs.light));
    }
    if (check.isNonEmptyString(entry.iconURLs.dark)) {
      allIconURLs.push(new URL(entry.iconURLs.dark));
    }
  }
  allIconURLs = arrays.uniqueValues(allIconURLs);

  // Step #3: Go to every favicon URL and store the favicon as a data URL
  const icons: FaviconsForWebsites['icons'] = {};
  await Promise.all(
    allIconURLs.map(async (url) => {
      const response = await fetchUrl(url);
      const blob = await response.blob();
      const dataURL = await binaryUtils.convertBlobToDataURL(blob);
      icons[url.href] = { dataURL };
    }),
  );

  // Step #4: Close the puppeteer browser and return the favicons
  await browser.close();
  return {
    websites,
    icons,
  };
}

async function initializeBrowserInstance() {
  const launchOptions: playwright.LaunchOptions = {
    headless: true,
    args: ['--no-sandbox'],
  };
  return await playwright.chromium.launch(launchOptions);
}

async function fetchUrl(url: URL): Promise<Response> {
  let attempts = 1;
  let response;
  while (attempts <= 3 && !response) {
    try {
      response = await fetch(url.href);
    } catch {
      // ignore
    }
    attempts++;
  }

  if (!response?.ok || !`${response.status}`.startsWith('2')) {
    throw new Error(`could not fetch`);
  }

  return response;
}
