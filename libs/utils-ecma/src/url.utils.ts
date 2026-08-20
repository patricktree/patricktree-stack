import { check } from "#src/assert.utils.ts";

export const urlUtils = {
  createReadableTextFromUrl,
  generateUrlFragmentFromText,
};

function createReadableTextFromUrl(url: URL): string {
  let readableText = url.host;
  if (check.isNonEmptyString(url.port)) {
    readableText += `:${url.port}`;
  }
  readableText += url.pathname;
  if (check.isNonEmptyString(url.search)) {
    readableText += url.search;
  }
  if (check.isNonEmptyString(url.hash)) {
    readableText += url.hash;
  }

  return readableText;
}

/** https://tomekdev.com/posts/anchors-for-headings-in-mdx#override-heading-component */
function generateUrlFragmentFromText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\d a-z]/g, "")
    .replace(/ /g, "-");
}
