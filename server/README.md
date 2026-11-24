# The game's own server

One small program (`server.js`) that does two jobs on Flynn's game server (Hetzner):

- hands out the game's files, so the game has its own address;
- is the relay for playing together: every player connects to it and it passes their messages to the others in
  the same room. Nobody's computer hosts a room, and a player's computer only carries its own messages.

A page this server hands out is marked, and the game sees the mark and switches "Play together" on, with the relay at
the page's own address. Copies of the game anywhere else (GitHub Pages, a folder) stay single-player. Nothing in
`src/config.js` has to change.

## On the server

It runs beside Flynn's other server games and goes up the same way, with `deploy.mjs` in `C:\Dev\GameServer` on
Flynn's PC. Its entry in `games.json` there:

    {
      "id": "fta6",
      "name": "FTA 6",
      "dir": "C:\\Dev\\ThreeJSProjects\\FTA6",
      "subdomain": "fta",
      "port": 5188,
      "build": false,
      "start": "server/server.js",
      "env": { "HOST": "127.0.0.1", "BEHIND_PROXY": "1" },
      "exclude": ["relay", "dev", "*.md", ".nojekyll"]
    }

`C:\Dev\ThreeJSProjects\FTA6` is a git clone of this repository. To put a new version up, on Flynn's PC:

    git -C C:\Dev\ThreeJSProjects\FTA6 pull
    cd C:\Dev\GameServer
    node deploy.mjs fta6

The deploy tool uploads the folder, runs `npm ci` (the one dependency is `ws`, in the top-level `package.json`),
restarts the service and puts the old version back if the new one does not start. Games in a room join it again by
themselves a moment after a restart. `node deploy.mjs status` reads `/healthz`.

## Settings (environment)

`PORT`, `HOST`, `MULTIPLAYER=off` (single-player, relay shut), `BASE=/folder` (if a web server in front does not strip a
folder from the address), `ALLOWED_ORIGINS` (other sites whose copy may use this relay; its own always may),
`BEHIND_PROXY=1` (take visitors' addresses from the web server in front). Explained at the top of `server.js`.

## Limits

A room holds 12 players. A player sending more than 80 messages a second is not passed on; a message over 6,000
bytes is dropped. The server takes 600 connections at once and 16 from one address. Each player sends about 20
small messages a second (about 30 KB a second up, and that much per other player down), so a full room of 12 uses
about 4 Mbit/s of the server's line. It needs about 60 MB of memory.

## Trying it on your own computer

`npm install` then `npm start` at the top of the repository, and open `http://localhost:8080/`. Two windows that
join the same room code see each other.

`relay/` in this repository is the same relay written for Cloudflare. It is not used.
