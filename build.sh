#!/usr/bin/env bash
set -e

# Inject Supabase env vars into config.js at build time
cat > config.js <<EOF
window.CRM_CONFIG = {
  SUPABASE_URL: '${SUPABASE_URL}',
  SUPABASE_KEY: '${SUPABASE_KEY}',
};
EOF

echo "config.js generated."
