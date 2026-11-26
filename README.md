# BTC-007 News

Live site: https://polite-lotus-yhf8.here.now/

A news and market site that uses Equation News public data, with an independently designed interface. Telegram is not included.

Open `index.html` after a static deploy, or republish the folder with here.now using slug `polite-lotus-yhf8`.

## KOL trading channel (`?ch=kol-trading`)

`kol.js` renders Binance public copy-trading data for the traders in `KOL_LIST`. Binance rejects requests from here.now proxy routes (CloudFront 403), so an always-on poller on the box (`/workspace/kol-trading-poller/poller.py`, started with `run.sh`) reads the public endpoints about every 2s and writes one snapshot per trader into the Site Data collection `kol_feed` (declared in `.herenow/data.json`, public read, owner-only writes). The page reads `./.herenow/data/kol_feed` every 3s while the tab is visible. To add a trader, add it to `KOL_LIST` in `kol.js` and `KOLS` in the poller.

## Hype top-10 traders channel (`?ch=trader-leaderboard`)

`traders.js` renders the top 10 Hyperliquid traders by 30-day PnL (only addresses with a perpetual fill in the last 7 days), using Hyperliquid's public no-login API. A poller on the box (`/workspace/hl-leaderboard-poller/poller.py`, started with `run.sh`, outside the repo) reads `stats-data.hyperliquid.xyz/Mainnet/leaderboard` every 10 minutes, follows the 10 addresses' fills over the `wss://api.hyperliquid.xyz/ws` `userFills` subscription (HTTP `userFills` fallback), reads `clearinghouseState` and `portfolio` (30D max drawdown estimate), and writes one snapshot per trader into the Site Data collection `trader_feed` (declared in `.herenow/data.json`, public read, owner-only writes). The page reads it every 2s while the tab is visible. Rows reuse the `kol-*` styles.
