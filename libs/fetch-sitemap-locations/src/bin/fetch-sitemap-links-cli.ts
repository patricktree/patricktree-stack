import * as commander from '@commander-js/extra-typings';

import { fetchSitemapLinks } from '#pkg/fetch-sitemap-links.js';
import { loggerAsyncLocalStorage } from '#pkg/logger.js';

const program = new commander.Command()
  .addArgument(new commander.Argument('<url>').argParser((v) => new URL(v)))
  .addOption(new commander.Option('--debug').default(false));
program.parse();
const [url] = program.processedArgs;
const { debug } = program.opts();

await loggerAsyncLocalStorage.run({ enableLogging: debug }, async () => {
  for await (const links of fetchSitemapLinks(url)) {
    console.log(links.join('\n'));
  }
});
