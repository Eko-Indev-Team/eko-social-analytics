#!/usr/bin/env bash
set -Eeuo pipefail

[ "${EUID}" -eq 0 ] || { echo "run as root" >&2; exit 1; }
id rainbow >/dev/null 2>&1 || { echo "rainbow user does not exist" >&2; exit 1; }

script_dir="$(cd "$(dirname "$0")" && pwd)"
wrapper="/usr/local/sbin/eko-social-analytics-deploy"
app_root="/srv/apps/eko-social-analytics"
nginx_routes="/etc/nginx/eko-platform/routes.d"

install -d -o rainbow -g rainbow -m 0750 "$app_root" "$app_root/releases" "$app_root/backups"
install -d -o root -g root -m 0750 /var/log/eko-deploy
install -d -o root -g root -m 0750 "$nginx_routes"
install -o root -g root -m 0750 "$script_dir/eko-social-analytics-deploy" "$wrapper"

if ! grep -Fqx 'include /etc/nginx/eko-platform/routes.conf;' /etc/nginx/conf.d/recon.conf; then
  echo "recon.conf is missing the managed route include; add it inside the indev.eko.in HTTPS server before enabling deploys" >&2
  exit 1
fi
if [ ! -f /etc/nginx/eko-platform/routes.conf ]; then
  echo "missing /etc/nginx/eko-platform/routes.conf" >&2
  exit 1
fi

cat > /etc/sudoers.d/eko-social-analytics-rainbow <<'EOF'
rainbow ALL=(root) NOPASSWD: /usr/local/sbin/eko-social-analytics-deploy *
EOF
chmod 0440 /etc/sudoers.d/eko-social-analytics-rainbow
visudo -cf /etc/sudoers.d/eko-social-analytics-rainbow

if [ ! -f "$app_root/.env" ]; then
  cat >&2 <<'EOF'
Rainbow bootstrap complete, but the application runtime file is missing.
Create /srv/apps/eko-social-analytics/.env as root, fill production values, then:
  chown rainbow:rainbow /srv/apps/eko-social-analytics/.env
  chmod 0600 /srv/apps/eko-social-analytics/.env
EOF
fi

echo "Rainbow deployment bootstrap installed"
echo "Rainbow is not added to the sudo or docker groups"
