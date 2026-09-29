#!/usr/bin/env bash
# Wrapper around the Supabase CLI.
#
# The CLI talks to a Docker-compatible socket. On machines where Podman stands
# in for Docker, DOCKER_HOST has to point at Podman's socket or every `supabase`
# command fails with a confusing "cannot connect" error.
set -euo pipefail

if ! command -v docker >/dev/null 2>&1 && command -v podman >/dev/null 2>&1; then
  if [ -z "${DOCKER_HOST:-}" ]; then
    socket="$(podman machine inspect podman-machine-default \
      --format '{{.ConnectionInfo.PodmanSocket.Path}}' 2>/dev/null || true)"
    if [ -n "$socket" ]; then
      export DOCKER_HOST="unix://$socket"
    fi
  fi
fi

exec supabase "$@"
