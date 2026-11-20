# The relay for playing together

A small server that runs on Cloudflare and passes messages between the players in a room, so that nobody's
computer hosts the game. It keeps no game state. `src/index.js` is all of it.

## Putting it on Cloudflare (once)

1. Make a free account at https://dash.cloudflare.com/sign-up.
2. In the dashboard open **Workers & Pages**, press **Create application**, choose **GitHub**, sign in to GitHub when
   asked and give Cloudflare access to this repository.
3. Pick this repository. Name the project **fta6-relay** (it has to match `name` in `wrangler.jsonc`) and set
   **Root directory** to `relay`. Leave the build command empty and the deploy command as `npx wrangler deploy`.
4. Press **Save and Deploy**. When it finishes, the Worker has an address like `https://fta6-relay.<something>.workers.dev`.
   Opening it in a browser shows "FTA 6 relay: running."
5. Optional: under the Worker's **Settings**, **Build**, **Build watch paths**, set the include path to `relay/*`, so only
   changes to the relay redeploy it.

Then put that address in `NET.relay` in `src/config.js` (`wss://fta6-relay.<something>.workers.dev`) and set
`NET.enabled` to true. From then on, pushing a change under `relay/` redeploys it.

## What it costs

Nothing on Cloudflare's free plan, which cannot run up a bill: at its daily limit the relay stops answering until
midnight UTC. The limit that matters is 100,000 requests a day, with 20 incoming messages counted as one request.
Each player sends about 20 messages a second, so four players can play for roughly seven hours a day, eight players
for about three and a half. A player alone in a room sends one message a second.

## Who may use it

Pages listed in `ALLOWED_ORIGINS` in `wrangler.jsonc` (the game's public link), plus a game opened from the same
computer (`localhost`). A room holds 12 players; a player sending more than 80 messages a second is not passed on.

## Trying it without Cloudflare

`npm install` then `npx wrangler dev --port 8787` in this folder runs the same code on this computer. Open the game with
`?mp&relay=ws://127.0.0.1:8787` in the address.
