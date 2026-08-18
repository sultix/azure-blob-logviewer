#!/bin/bash
# Segment 6: tailgen schreibt waehrend der Aufnahme in live.log.
set -uo pipefail
REPO=/Users/aleksandrsultanov/Documents/Development/azure-blob-logviewer
VID=/Users/aleksandrsultanov/Documents/Development/azure-blob-logviewer/scripts/video
ACC=logviewertest; RG=aicoach; CON=logviewer-demo; BLOB=live.log

KEY=$(az storage account keys list -n "$ACC" -g "$RG" --query "[0].value" -o tsv)
EXP=$(date -u -v+1d +%Y-%m-%dT%H:%MZ)
SAS=$(az storage blob generate-sas --account-name "$ACC" --account-key "$KEY" \
      --container-name "$CON" --name "$BLOB" --permissions racwd --expiry "$EXP" -o tsv)
URL="https://${ACC}.blob.core.windows.net/${CON}/${BLOB}?${SAS}"

cd "$REPO"
go run ./scripts/tailgen -sas-url "$URL" -interval 1500ms -lines 4 -error-rate 0.15 -warn-rate 0.25 \
   -duration 0 > "$VID/tailgen-live.log" 2>&1 &
TG=$!
sleep 6   # ein paar Zeilen Vorlauf, damit der Live-Modus sofort etwas zeigt

cd "$VID"
node record.mjs 06
RC=$?

pkill -P "$TG" 2>/dev/null
kill "$TG" 2>/dev/null
exit $RC
