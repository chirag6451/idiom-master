#!/usr/bin/env bash
# Automates pulling latest code and restarting FiguroAI services.

set -Eeuo pipefail

PROJECT_DIR="/var/www/idiom-master"
BACKEND_DIR="$PROJECT_DIR/server"
FRONTEND_SERVICE="figuroai"
BACKEND_PROCESS="figuroai-backend"
FRONTEND_HEALTH="http://127.0.0.1:8303/"
BACKEND_HEALTH="http://127.0.0.1:3015/api/health"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

trap 'log "Deployment failed (line ${LINENO})."; exit 1' ERR

wait_for_url() {
  local url=$1
  local retries=${2:-20}
  local delay=${3:-3}
  local attempt=1
  while (( attempt <= retries )); do
    if curl -fsS --max-time 5 "$url" > /dev/null; then
      return 0
    fi
    log "Attempt $attempt to reach $url failed; retrying in ${delay}s"
    sleep "$delay"
    attempt=$((attempt + 1))
  done
  return 1
}

log "Changing directory to $PROJECT_DIR"
cd "$PROJECT_DIR"

log "Pulling latest git commits"
git pull --ff-only

log "Installing frontend dependencies"
npm install

log "Building frontend bundle"
npm run build

log "Restarting frontend service ($FRONTEND_SERVICE)"
systemctl restart "$FRONTEND_SERVICE"

wait_for_frontend() {
  local start
  start=$(date +%s)
  sleep 2
  if ! wait_for_url "$FRONTEND_HEALTH" 20 3; then
    log "Frontend health check failed; recent service status follows"
    systemctl status "$FRONTEND_SERVICE" --no-pager || true
    exit 1
  fi
  local end
  end=$(date +%s)
  log "Frontend became available in $((end - start))s"
}

log "Verifying frontend health"
wait_for_frontend

log "Changing directory to $BACKEND_DIR"
cd "$BACKEND_DIR"
  log "Frontend health check failed; recent service status follows"
  systemctl status "$FRONTEND_SERVICE" --no-pager || true
  exit 1
fi

log "Changing directory to $BACKEND_DIR"
cd "$BACKEND_DIR"

log "Installing backend dependencies"
npm install

log "Restarting backend process via PM2 ($BACKEND_PROCESS)"
pm2 restart "$BACKEND_PROCESS" --update-env
pm2 save

log "Verifying backend health"
if ! wait_for_url "$BACKEND_HEALTH"; then
  log "Backend health check failed; recent PM2 logs follow"
  pm2 logs "$BACKEND_PROCESS" --lines 40 --nostream || true
  exit 1
fi

log "All services restarted successfully"
