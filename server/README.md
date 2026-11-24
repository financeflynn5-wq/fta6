# The game's own server

One small program (`server.js`) that does two jobs on a server we rent (Hetzner):

- hands out the game's files, so the game has its own address;
- is the relay for playing together: every player connects to it and it passes their messages to the others in
  the same room. Nobody's computer hosts a room, and a player's computer only carries its own messages.

A page this server hands out is marked, and the game sees the mark and switches "Play together" on, with the relay at
the page's own address. Copies of the game anywhere else (GitHub Pages, a folder) stay single-player. Nothing in
`src/config.js` has to change.

## Putting it on the server (once)

Log in to the server as root and run one line. It works on Debian and Ubuntu.

    curl -fsSL https://raw.githubusercontent.com/financeflynn5-wq/fta6/main/server/install.sh | bash

That puts the game on `http://<the server's number>/`. With a web address that already points at the server, say so
and the site gets https as well (the script installs Caddy for it):

    curl -fsSL https://raw.githubusercontent.com/financeflynn5-wq/fta6/main/server/install.sh | DOMAIN=play.example.com bash

If the server already runs a website (something owns ports 80 and 443), the script stops and says so rather than
touching it. Then run it with `BEHIND=1`, which keeps the game on port 8080 of the machine only, and have the web
server that is already there pass visitors on. For nginx, inside the site's `server { }` block:

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300s;
    }

For Caddy: `reverse_proxy 127.0.0.1:8080` inside the site's block. To put the game under a folder of a bigger site
(`example.com/fta6/`), add `BASE=/fta6` and use `location /fta6/` (keep the folder in the address that is passed on).

Hetzner's own firewall (in the Hetzner console, if one is attached to the server) has to let ports 80 and 443 in.

## New versions

The server looks at the `main` branch on GitHub every two minutes and takes what is new, so pushing to `main` is all
it takes. Browsers ask the server whether each file changed, so players get the new version on their next visit. If
the server's own code changed it restarts; games that are in a room join it again by themselves a moment later.

## Looking after it

    systemctl status fta6            is it running
    journalctl -u fta6 -f            what it says
    curl localhost:8080/health       how many players in how many rooms (port 80 without a web server in front)
    nano /etc/fta6.env               settings; then: systemctl restart fta6
    systemctl start fta6-update      take the newest version right now

Settings are explained at the top of `server.js`. `MULTIPLAYER=off` hands the game out single-player and shuts the relay.

## Limits

A room holds 12 players. A player sending more than 80 messages a second is not passed on; a message over 6,000
bytes is dropped. The server takes 600 connections at once and 16 from one address. Each player sends about 20
small messages a second (about 30 KB a second up, and that much per other player down), so a full room of 12 uses
about 4 Mbit/s of the server's line. The smallest Hetzner server is plenty.

## Trying it on your own computer

`npm install` then `npm start` in this folder, and open `http://localhost:8080/`. Two windows that join the same room
code see each other.

`relay/` in this repository is the same relay written for Cloudflare. It is not used.
