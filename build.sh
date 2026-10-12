#!/bin/sh
# The site has no real build step: it is served exactly as it is in the repo. This only
# stamps which commit is live into version.json, so the page footer can show it.
# Cloudflare Pages sets CF_PAGES_COMMIT_SHA; Netlify sets COMMIT_REF.
COMMIT="${CF_PAGES_COMMIT_SHA:-$COMMIT_REF}"
printf '{"commit":"%s","built":"%s"}' "$(echo "$COMMIT" | cut -c1-7)" "$(date -u '+%Y-%m-%d %H:%M UTC')" > version.json
echo "Stamped version.json: $(cat version.json)"
