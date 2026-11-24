#!/usr/bin/env bash
# Puts FTA 6 (the game and the relay for playing together) on a Linux server, or refreshes one that already has it.
# For Debian and Ubuntu. Run it as root on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/financeflynn5-wq/fta6/main/server/install.sh | bash
#
# Settings go in front of "bash":
#   DOMAIN=play.example.com   a web address that already points at this server. The site then gets https (Caddy is
#                             installed for that). Without it the game is on plain http://<the server's number>/
#   BEHIND=1 PORT=8080        another web server on this machine (nginx, Caddy, Apache) already owns ports 80 and 443
#                             and will pass visitors on; the game then only listens on this machine, on PORT
#   BASE=/fta6                the game lives under a folder of a bigger website (with BEHIND=1)
#   MULTIPLAYER=off           hand the game out with playing together switched off
#   BRANCH=main  REPO=https://github.com/financeflynn5-wq/fta6
#
# What it makes: a user "fta6", the game in /opt/fta6/app, settings in /etc/fta6.env, the services "fta6" (the server)
# and "fta6-update" (looks at GitHub every two minutes and takes what is new). Running it again is safe.
set -euo pipefail

REPO=${REPO:-https://github.com/financeflynn5-wq/fta6}
BRANCH=${BRANCH:-main}
DOMAIN=${DOMAIN:-}
BEHIND=${BEHIND:-}
BASE=${BASE:-}
MULTIPLAYER=${MULTIPLAYER:-on}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS:-}
DIR=/opt/fta6

say() { printf '\n== %s\n' "$*"; }
die() { printf '\nSTOPPED: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" = 0 ] || die "run this as root (put sudo in front of bash)."
command -v apt-get >/dev/null || die "this script is for Debian and Ubuntu (it needs apt-get)."
command -v systemctl >/dev/null || die "this script needs systemd."
case "$DOMAIN" in *[!A-Za-z0-9.-]*) die "DOMAIN should be a bare web address like play.example.com";; esac
case "$BASE" in ''|/[A-Za-z0-9_-]*) ;; *) die "BASE should look like /fta6";; esac

# ---- how visitors reach it ----
if [ -n "$DOMAIN" ] && [ -n "$BEHIND" ]; then die "use DOMAIN or BEHIND=1, not both."; fi
if [ -n "$DOMAIN" ]; then MODE=caddy; PORT=${PORT:-8080}; HOST=127.0.0.1; PROXY=1
elif [ -n "$BEHIND" ]; then MODE=behind; PORT=${PORT:-8080}; HOST=127.0.0.1; PROXY=1
else MODE=direct; PORT=${PORT:-80}; HOST=0.0.0.0; PROXY=
fi

# who is listening on a port (nothing printed if nobody is)
listener() { ss -ltnpH "sport = :$1" 2>/dev/null | sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | sort -u | tr '\n' ' '; }
busy() {   # port, programs that are allowed to be there already
  local who; who=$(listener "$1"); [ -z "$who" ] && return 0
  for w in $who; do case " $2 " in *" $w "*) ;; *) return 1;; esac; done
}

say "Checking the server"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git ca-certificates curl xz-utils iproute2 >/dev/null

busy "$PORT" "node" || die "port $PORT is already used by: $(listener "$PORT"). Another website is probably running here. Run this again with BEHIND=1 PORT=8080 and let that web server pass visitors on (see server/README.md)."
if [ "$MODE" = caddy ]; then
  busy 80 "caddy" || die "port 80 is already used by: $(listener 80). Another web server is running here; use BEHIND=1 instead of DOMAIN (see server/README.md)."
  busy 443 "caddy" || die "port 443 is already used by: $(listener 443). Another web server is running here; use BEHIND=1 instead of DOMAIN (see server/README.md)."
fi

# ---- Node.js: the system's if it is new enough, otherwise a private copy from nodejs.org ----
say "Node.js"
NODE_BIN=
if command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 18 ] && command -v npm >/dev/null; then
  NODE_BIN=$(dirname "$(readlink -f "$(command -v node)")")
  echo "using the Node.js already here: $(node -v)"
else
  case "$(uname -m)" in x86_64) ARCH=x64;; aarch64|arm64) ARCH=arm64;; *) die "unknown kind of processor: $(uname -m)";; esac
  SRC=https://nodejs.org/dist/latest-v22.x
  TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
  curl -fsSL "$SRC/SHASUMS256.txt" -o "$TMP/sums"
  FILE=$(awk -v a="linux-$ARCH.tar.xz" '$2 ~ a"$" {print $2}' "$TMP/sums" | head -1)
  [ -n "$FILE" ] || die "could not find Node.js for this server at $SRC"
  curl -fsSL "$SRC/$FILE" -o "$TMP/$FILE"
  (cd "$TMP" && grep " $FILE\$" sums | sha256sum -c --quiet -) || die "the Node.js download is damaged."
  rm -rf "$DIR/node"; mkdir -p "$DIR/node"
  tar -xJf "$TMP/$FILE" -C "$DIR/node" --strip-components=1
  NODE_BIN=$DIR/node/bin
  echo "installed a private copy: $("$NODE_BIN/node" -v) in $DIR/node"
fi

# ---- the game ----
say "The game"
id fta6 >/dev/null 2>&1 || useradd --system --home-dir "$DIR" --shell /usr/sbin/nologin fta6
mkdir -p "$DIR"; chown fta6:fta6 "$DIR"
as() { runuser -u fta6 -- env HOME="$DIR" PATH="$NODE_BIN:/usr/bin:/bin" "$@"; }
if [ -d "$DIR/app/.git" ]; then
  (cd "$DIR/app" && as git remote set-url origin "$REPO" && as git fetch --quiet --depth 1 origin "$BRANCH" && as git reset --quiet --hard FETCH_HEAD)
else
  rm -rf "$DIR/app"
  as git clone --quiet --depth 1 --branch "$BRANCH" "$REPO" "$DIR/app"
fi
[ -f "$DIR/app/server/server.js" ] || die "branch $BRANCH of $REPO has no server/ folder yet."
(cd "$DIR/app/server" && as npm ci --omit=dev --ignore-scripts --no-audit --no-fund --silent)
echo "the game is in $DIR/app at $(cd "$DIR/app" && as git rev-parse --short HEAD)"

# ---- settings and services ----
say "Services"
cat > /etc/fta6.env <<EOF
# FTA 6 server settings (server/server.js explains them). After a change: systemctl restart fta6
PORT=$PORT
HOST=$HOST
MULTIPLAYER=$MULTIPLAYER
BASE=$BASE
ALLOWED_ORIGINS=$ALLOWED_ORIGINS
BEHIND_PROXY=$PROXY
EOF
cat > /etc/fta6-update.conf <<EOF
BRANCH=$BRANCH
NODE_BIN=$NODE_BIN
EOF

cat > /etc/systemd/system/fta6.service <<EOF
[Unit]
Description=FTA 6: the game and the relay for playing together
After=network-online.target
Wants=network-online.target

[Service]
User=fta6
Group=fta6
WorkingDirectory=$DIR/app/server
EnvironmentFile=/etc/fta6.env
ExecStart=$NODE_BIN/node server.js
Restart=always
RestartSec=2
# may open port 80, and nothing else beyond an ordinary program
AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
PrivateDevices=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
LimitNOFILE=8192
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF

# The updater is a fixed copy kept outside the game's folder: it runs as root only to restart the service, and does
# everything that touches what came from GitHub as the user fta6.
cat > /usr/local/sbin/fta6-update <<'EOF'
#!/usr/bin/env bash
# Takes the newest version of FTA 6 from GitHub. Restarts the server only if the server's own code changed.
set -euo pipefail
. /etc/fta6-update.conf
DIR=/opt/fta6
cd "$DIR/app"
as() { runuser -u fta6 -- env HOME="$DIR" PATH="$NODE_BIN:/usr/bin:/bin" "$@"; }
before=$(as git rev-parse HEAD)
as git fetch --quiet --depth 1 origin "$BRANCH"
after=$(as git rev-parse FETCH_HEAD)
[ "$before" = "$after" ] && exit 0
server=$(as git diff --name-only "$before" "$after" -- server 2>/dev/null | head -1 || echo unknown)
lock=$(as git diff --name-only "$before" "$after" -- server/package-lock.json 2>/dev/null | head -1 || echo unknown)
as git reset --quiet --hard "$after"
if [ -n "$lock" ]; then (cd server && as npm ci --omit=dev --ignore-scripts --no-audit --no-fund --silent); fi
if [ -n "$server" ]; then systemctl restart fta6; fi
echo "FTA 6 updated: ${before:0:7} -> ${after:0:7}${server:+ (server restarted)}"
EOF
chmod 755 /usr/local/sbin/fta6-update

cat > /etc/systemd/system/fta6-update.service <<EOF
[Unit]
Description=FTA 6: take the newest version from GitHub
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/fta6-update
EOF
cat > /etc/systemd/system/fta6-update.timer <<EOF
[Unit]
Description=FTA 6: look for a new version every two minutes

[Timer]
OnBootSec=1min
OnUnitActiveSec=2min
RandomizedDelaySec=15

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --quiet fta6.service fta6-update.timer
systemctl restart fta6.service
systemctl restart fta6-update.timer

# ---- https, when there is a web address ----
if [ "$MODE" = caddy ]; then
  say "https for $DOMAIN"
  if ! command -v caddy >/dev/null; then
    if ! apt-get install -y -qq caddy >/dev/null 2>&1; then
      apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https gnupg >/dev/null
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
      apt-get update -qq && apt-get install -y -qq caddy >/dev/null
    fi
  fi
  mkdir -p /etc/caddy
  cat > /etc/caddy/fta6.caddy <<EOF
# FTA 6 (written by server/install.sh)
$DOMAIN {
	reverse_proxy 127.0.0.1:$PORT
}
EOF
  CF=/etc/caddy/Caddyfile
  if [ ! -s "$CF" ] || grep -q '/usr/share/caddy' "$CF"; then          # none yet, or the sample one Caddy ships with
    [ -s "$CF" ] && cp "$CF" "$CF.before-fta6"
    echo 'import /etc/caddy/fta6.caddy' > "$CF"
  elif ! grep -q 'fta6.caddy' "$CF"; then                               # somebody's own: add one line, keep a copy
    cp "$CF" "$CF.before-fta6"
    printf '\nimport /etc/caddy/fta6.caddy\n' >> "$CF"
  fi
  if ! caddy validate --config "$CF" --adapter caddyfile >/dev/null 2>&1; then
    [ -f "$CF.before-fta6" ] && cp "$CF.before-fta6" "$CF"
    die "Caddy did not accept its settings; they were put back as they were. The game itself is running on port $PORT of this machine."
  fi
  systemctl enable --quiet caddy
  systemctl reload caddy 2>/dev/null || systemctl restart caddy
fi

# the server's own firewall, if it has one switched on (Hetzner's cloud firewall is separate: allow the same ports there)
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q 'Status: active'; then
  if [ "$MODE" = caddy ]; then ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null; fi
  if [ "$MODE" = direct ]; then ufw allow "$PORT"/tcp >/dev/null; fi
fi

# ---- did it work? ----
say "Checking"
ok=
for _ in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "http://127.0.0.1:$PORT$BASE/health" 2>/dev/null; then ok=1; break; fi
  sleep 1
done
[ -n "$ok" ] || { journalctl -u fta6 -n 20 --no-pager || true; die "the server did not answer. The lines above are what it said."; }

ADDR=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
say "Done"
case "$MODE" in
  caddy)  echo "The game:  https://$DOMAIN/   (the first visit can take a minute while the https certificate is made)";;
  direct) if [ "$PORT" = 80 ]; then echo "The game:  http://$ADDR/"; else echo "The game:  http://$ADDR:$PORT/"; fi;;
  behind) echo "The game is on http://127.0.0.1:$PORT$BASE/ of this machine. Point your web server at it (see server/README.md).";;
esac
echo "Look at it:    systemctl status fta6      journalctl -u fta6 -f"
echo "New versions:  pushed to the $BRANCH branch on GitHub, they are live here within about two minutes."
