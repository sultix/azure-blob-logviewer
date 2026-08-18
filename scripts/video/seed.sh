#!/bin/bash
set -euo pipefail
cd /Users/aleksandrsultanov/Documents/Development/azure-blob-logviewer
ACC=logviewertest
RG=aicoach
CON=logviewer-demo
KEY=$(az storage account keys list -n "$ACC" -g "$RG" --query "[0].value" -o tsv)
EXP=$(date -u -v+1d +%Y-%m-%dT%H:%MZ)

sas_url() { # $1 = blob name
  local sas
  sas=$(az storage blob generate-sas --account-name "$ACC" --account-key "$KEY" \
        --container-name "$CON" --name "$1" --permissions racwd --expiry "$EXP" -o tsv)
  echo "https://${ACC}.blob.core.windows.net/${CON}/${1}?${sas}"
}

gen() { # $1 = blob name, rest = flags
  local blob="$1"; shift
  go run ./scripts/tailgen -sas-url "$(sas_url "$blob")" "$@"
}

gen app-2026-08-15.log -reset -duration 4s -interval 150ms -lines 8 -seed 11
echo "[1/6] app-2026-08-15.log"
gen app-2026-08-16.log -reset -duration 4s -interval 150ms -lines 8 -seed 22
echo "[2/6] app-2026-08-16.log"
gen app-2026-08-17.log -reset -duration 8s -interval 100ms -lines 20 -seed 33 -error-rate 0.18 -warn-rate 0.25 -stacktrace-rate 0.5
echo "[3/6] app-2026-08-17.log"
gen archived.log -reset -duration 3s -interval 200ms -lines 6 -seed 44
echo "[4/6] archived.log"
gen live.log -reset -duration 3s -interval 200ms -lines 6 -seed 55
echo "[5/6] live.log"
gen big-export.log -reset -seed-bytes 25MB -duration 1s -seed 66
echo "[6/6] big-export.log"
echo "SEED DONE"
