# Maintaining the plugin market

GitHub Pages serves `docs/` on `main`. The custom domain is `plugins.agencyarche.com`.
Cloudflare DNS: `plugins` CNAME `tula-liuxin.github.io`, DNS only, automatic TTL.
The index is `/index.json`; it must return HTTP 200 directly over HTTPS.

When publishing a new plugin release:
1. Test and publish the release first.
2. Add a version to `docs/index.json`, using the release package version, publication time in Unix seconds, exact 40-character commit SHA and matching `engines.dsh`.
3. Keep existing releases listed when still supported. Never point an entry at a moving branch.
4. Validate with the official `@deepseek-ai/dsh-plugin-market-index` `parseMarketIndex` function.
5. Push to main; GitHub Pages deploys automatically. Check the live JSON and icon over HTTPS without redirects.

The website and index are public. Do not include credentials, chat history or private configuration.
