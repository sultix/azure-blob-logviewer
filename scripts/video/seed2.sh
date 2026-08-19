#!/bin/bash
# Rest der Demo-Daten. tailgen meldet beim Ablauf von -duration "context deadline exceeded";
# das ist der normale Abbruch, deshalb "|| true".
set -uo pipefail
cd /Users/aleksandrsultanov/Documents/Development/azure-blob-logviewer
ACC=logviewertest
RG=aicoach
CON=logviewer-demo
KEY=$(az storage account keys list -n "$ACC" -g "$RG" --query "[0].value" -o tsv)
EXP=$(date -u -v+1d +%Y-%m-%dT%H:%MZ)

sas_url() {
  local sas
  sas=$(az storage blob generate-sas --account-name "$ACC" --account-key "$KEY" \
        --container-name "$CON" --name "$1" --permissions racwd --expiry "$EXP" -o tsv)
  echo "https://${ACC}.blob.core.windows.net/${CON}/${1}?${sas}"
}

blob_size() {
  az storage blob show --account-name "$ACC" --account-key "$KEY" \
    --container-name "$CON" --name "$1" --query properties.contentLength -o tsv 2>/dev/null || echo 0
}

go run ./scripts/tailgen -sas-url "$(sas_url archived.log)" -reset -duration 3s -interval 200ms -lines 6 -seed 44 || true
echo "[4/6] archived.log $(blob_size archived.log)"
go run ./scripts/tailgen -sas-url "$(sas_url live.log)" -reset -duration 3s -interval 200ms -lines 6 -seed 55 || true
echo "[5/6] live.log $(blob_size live.log)"

# 25 MB dauert laenger als jede sinnvolle -duration: unbegrenzt starten und nach Erreichen killen.
go run ./scripts/tailgen -sas-url "$(sas_url big-export.log)" -reset -seed-bytes 25MB -duration 0 \
   -interval 5s -lines 3 -seed 66 > /tmp/tailgen-big.log 2>&1 &
BIGPID=$!
for _ in $(seq 1 120); do
  sleep 5
  SZ=$(blob_size big-export.log)
  echo "big-export.log: $SZ bytes"
  if [ "${SZ:-0}" -ge 26214400 ]; then break; fi
  kill -0 "$BIGPID" 2>/dev/null || break
done
pkill -P "$BIGPID" 2>/dev/null
kill "$BIGPID" 2>/dev/null
sleep 1
echo "[6/6] big-export.log $(blob_size big-export.log)"
echo "SEED DONE"
