# SIZE. Staging Environment

## Overview

Staging is served at `https://wheresizematters.com/staging/` from `/var/www/size-staging/` on the same EC2 instance (54.158.51.226). It shares the same API backend and database as production — only the frontend is separate.

Access requires the same TOTP code gate as production.

## Deploy

From `/Users/ebk/size-app`:

```bash
./deploy-staging.sh
```

This builds the Expo frontend with `EXPO_PUBLIC_STAGING=true`, uploads it to `/var/www/size-staging/`, and copies all static pages.

## Nginx Configuration

Add the following block inside the existing `server` block for `wheresizematters.com` (the HTTPS server on port 443). Place it **before** the main `location /` block:

```nginx
    # ── Staging ──────────────────────────────────────────────
    location /staging/ {
        alias /var/www/size-staging/;

        # TOTP cookie gate — same as production
        if ($cookie_size_access != "1") {
            rewrite ^/staging/(.*)$ /staging/gate.html break;
        }

        # Static pages
        location = /staging/ {
            if ($cookie_size_access != "1") {
                rewrite ^ /staging/gate.html break;
            }
            alias /var/www/size-staging/;
            try_files /index.html =404;
        }

        location = /staging/app {
            if ($cookie_size_access != "1") {
                rewrite ^ /staging/gate.html break;
            }
            alias /var/www/size-staging/;
            try_files /app.html =404;
        }

        location = /staging/tokenomics {
            alias /var/www/size-staging/;
            try_files /tokenomics.html =404;
        }

        location = /staging/whitepaper {
            alias /var/www/size-staging/;
            try_files /whitepaper.html =404;
        }

        location = /staging/documentation {
            alias /var/www/size-staging/;
            try_files /documentation.html =404;
        }

        location = /staging/privacy {
            alias /var/www/size-staging/;
            try_files /privacy.html =404;
        }

        location = /staging/terms {
            alias /var/www/size-staging/;
            try_files /terms.html =404;
        }

        location = /staging/coin {
            alias /var/www/size-staging/;
            try_files /coin.html =404;
        }

        location = /staging/analytics {
            if ($cookie_size_access != "1") {
                rewrite ^ /staging/gate.html break;
            }
            alias /var/www/size-staging/;
            try_files /analytics.html =404;
        }

        # SPA fallback for /staging/app/* routes
        location ~ ^/staging/app/ {
            if ($cookie_size_access != "1") {
                rewrite ^ /staging/gate.html break;
            }
            alias /var/www/size-staging/;
            try_files $uri /app.html =404;
        }

        # Static assets (JS, CSS, images, fonts)
        try_files $uri $uri/ =404;
    }
```

The `/api/` proxy block already exists at the server level and will work for staging too, since both production and staging call the same `/api/v1/...` endpoints (including the TOTP verify endpoint at `/api/v1/analytics/verify-totp`).

## Simpler Alternative

If the nested `location` blocks cause issues with nginx's `if` + `alias` interaction, a simpler approach is to use a separate `server` block on a subdomain:

```nginx
server {
    listen 443 ssl;
    server_name staging.wheresizematters.com;

    ssl_certificate     /etc/letsencrypt/live/wheresizematters.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/wheresizematters.com/privkey.pem;

    root /var/www/size-staging;

    # TOTP gate
    set $gate 0;
    if ($cookie_size_access != "1") {
        set $gate 1;
    }

    location = / {
        if ($gate) { rewrite ^ /gate.html break; }
        try_files /index.html =404;
    }

    location = /app {
        if ($gate) { rewrite ^ /gate.html break; }
        try_files /app.html =404;
    }

    location /app/ {
        if ($gate) { rewrite ^ /gate.html break; }
        try_files $uri /app.html;
    }

    location = /tokenomics { try_files /tokenomics.html =404; }
    location = /whitepaper { try_files /whitepaper.html =404; }
    location = /documentation { try_files /documentation.html =404; }
    location = /privacy { try_files /privacy.html =404; }
    location = /terms { try_files /terms.html =404; }
    location = /coin { try_files /coin.html =404; }

    location = /analytics {
        if ($gate) { rewrite ^ /gate.html break; }
        try_files /analytics.html =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ =404;
    }
}
```

For the subdomain approach you would also need:
1. A DNS A record for `staging.wheresizematters.com` pointing to `54.158.51.226`
2. An SSL cert covering the subdomain (run `sudo certbot --nginx -d staging.wheresizematters.com`)

## Notes

- Staging uses the **same API and database** as production. There is no separate staging DB.
- The `EXPO_PUBLIC_STAGING=true` env var is set during build so the frontend can optionally show a staging banner or modify behavior.
- The TOTP gate cookie (`size_access=1`) is shared across paths on the same domain, so if you're already authenticated on production, staging at `/staging/` will also be accessible (and vice versa).
