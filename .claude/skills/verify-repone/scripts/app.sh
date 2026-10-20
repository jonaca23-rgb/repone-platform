#!/usr/bin/env bash
# verify-repone app lifecycle.
#   app.sh start   — reuse this checkout's running server, or start `pnpm dev` and wait for /login
#   app.sh status  — who owns the port, and whether this run started it
#   app.sh stop    — stop ONLY a server this run started (never by process name)
source "$(dirname "$0")/lib.sh"
mkdir -p "$RUN_DIR"

descendants() { local p; for p in $(pgrep -P "$1" 2>/dev/null); do descendants "$p"; echo "$p"; done; }

case "${1:-status}" in
  start)
    pid="$(app_listener_pid || true)"
    if [ -n "$pid" ]; then
      if [ "$(pid_cwd "$pid")" = "$REPO_ROOT" ]; then
        echo "Reusing this checkout's server (pid $pid) at $APP_URL — not started by this run, so stop will leave it."
        exit 0
      fi
      echo "Port $APP_PORT is owned by another checkout: $(pid_cwd "$pid"). Refusing to drive it."
      echo "Stop that server, or run with PORT=<free port> (auth redirects are allowed for :3200 only)."
      exit 1
    fi
    # pnpm dev brings up Podman + Supabase + seeds + dev accounts, then next dev.
    nohup pnpm dev > "$RUN_DIR/dev.log" 2>&1 &
    echo $! > "$RUN_DIR/dev.pid"
    printf 'Starting pnpm dev (pid %s, log %s)' "$(cat "$RUN_DIR/dev.pid")" "$RUN_DIR/dev.log"
    for _ in $(seq 1 180); do
      if ! kill -0 "$(cat "$RUN_DIR/dev.pid")" 2>/dev/null; then
        echo; echo "pnpm dev exited. Last log lines:"; tail -20 "$RUN_DIR/dev.log"; rm -f "$RUN_DIR/dev.pid"; exit 1
      fi
      if [ "$(curl -s -o /dev/null -w '%{http_code}' "$APP_URL/login")" = "200" ]; then
        echo; echo "Ready: $APP_URL"; exit 0
      fi
      printf '.'; sleep 1
    done
    echo; echo "Timed out after 180s waiting for $APP_URL/login. Log: $RUN_DIR/dev.log"; exit 1
    ;;

  status)
    pid="$(app_listener_pid || true)"
    if [ -z "$pid" ]; then echo "No server on :$APP_PORT"; exit 0; fi
    owner="$(pid_cwd "$pid")"
    started=""
    [ -f "$RUN_DIR/dev.pid" ] && kill -0 "$(cat "$RUN_DIR/dev.pid")" 2>/dev/null && started=" (started by this run: pid $(cat "$RUN_DIR/dev.pid"))"
    echo "Server pid $pid on :$APP_PORT, cwd $owner$started"
    ;;

  stop)
    if [ ! -f "$RUN_DIR/dev.pid" ]; then
      echo "This run did not start a server; leaving :$APP_PORT alone."; exit 0
    fi
    root="$(cat "$RUN_DIR/dev.pid")"
    pids="$(descendants "$root") $root"
    # shellcheck disable=SC2086
    kill $pids 2>/dev/null || true
    for _ in $(seq 1 10); do [ -z "$(app_listener_pid || true)" ] && break; sleep 1; done
    rm -f "$RUN_DIR/dev.pid"
    echo "Stopped the server this run started (pids: $(echo $pids | tr "\n" " ")). Supabase keeps running (pnpm db:stop to stop it)."
    ;;

  *) echo "usage: app.sh start|status|stop"; exit 2 ;;
esac
