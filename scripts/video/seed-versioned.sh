#!/bin/bash
# Legt eine versionierte, danach geloeschte Demo-Datei an.
# Zeigt den Fall: geloeschte Datei mit vorhandener Version -> oeffnet direkt, ohne Dialog.
set -uo pipefail
cd /Users/aleksandrsultanov/Documents/Development/azure-blob-logviewer
ACC=logviewertest
RG=aicoach
CON=logviewer-demo
BLOB=versioned.log
KEY=$(az storage account keys list -n "$ACC" -g "$RG" --query "[0].value" -o tsv)
EXP=$(date -u -v+1d +%Y-%m-%dT%H:%MZ)
SAS=$(az storage blob generate-sas --account-name "$ACC" --account-key "$KEY" \
      --container-name "$CON" --name "$BLOB" --permissions racwd --expiry "$EXP" -o tsv)
URL="https://${ACC}.blob.core.windows.net/${CON}/${BLOB}?${SAS}"

# Zwei Schreibvorgaenge -> zwei Versionen
go run ./scripts/tailgen -sas-url "$URL" -reset -duration 3s -interval 200ms -lines 6 -seed 77 || true
go run ./scripts/tailgen -sas-url "$URL" -reset -duration 3s -interval 200ms -lines 6 -seed 78 || true

az storage blob delete --account-name "$ACC" --account-key "$KEY" \
   --container-name "$CON" --name "$BLOB" --delete-snapshots include >/dev/null

echo "--- Blobs inkl. geloeschte/Versionen ---"
az storage blob list --account-name "$ACC" --account-key "$KEY" --container-name "$CON" \
   --include dv --query "[].{name:name, deleted:deleted, hasVersionsOnly:hasVersionsOnly, versionId:versionId, current:isCurrentVersion}" -o table
echo "SEED VERSIONED DONE"
