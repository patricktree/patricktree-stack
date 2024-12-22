import type playwright from 'playwright';

const PUPPETEER_NAVIGATION_TIMEOUT = 30 * 1000; // 30 seconds

type FetchFaviconURLsOptions = { browser: playwright.Browser };
export type FetchFaviconURLsResult = {
  icons: {
    light: undefined | URL;
    dark: undefined | URL;
  };
};
export async function fetchFaviconURLs(
  website: URL,
  options: FetchFaviconURLsOptions,
): Promise<FetchFaviconURLsResult> {
  console.log('Opening two pages (one for light/dark color scheme each)');
  async function createPage(colorScheme: 'light' | 'dark') {
    const context = await options.browser.newContext({ colorScheme, ignoreHTTPSErrors: true });
    const page = await context.newPage();
    return page;
  }

  const [pageLight, pageDark] = await Promise.all([createPage('light'), createPage('dark')]);

  console.log('Fetching URLs of Favicons in parallel');
  const [light, dark] = await Promise.all([
    gotoPageAndExtractFaviconURLFromPage(pageLight, website),
    gotoPageAndExtractFaviconURLFromPage(pageDark, website),
  ]);

  console.log('Closing the pages');
  await Promise.all([pageLight.close(), pageDark.close()]);

  return { icons: { light, dark } };
}

async function gotoPageAndExtractFaviconURLFromPage(page: playwright.Page, website: URL) {
  console.log(`Going to URL ${website.href}`);
  await page.goto(website.href, {
    waitUntil: 'load',
    timeout: PUPPETEER_NAVIGATION_TIMEOUT,
  });

  const relativeIconURL = await page
    .$("link[rel='icon']")
    .then(async (handle) => handle?.getProperty('href'))
    .then(async (jsHandle) => jsHandle?.jsonValue() as Promise<unknown>);

  const absoluteIconURL =
    typeof relativeIconURL === 'string'
      ? // If we have an <link> element with rel='icon', return the URL for that
        new URL(relativeIconURL, website)
      : // As an alternative, return just /favicon.ico
        new URL('/favicon.ico', website);

  return absoluteIconURL;
}
