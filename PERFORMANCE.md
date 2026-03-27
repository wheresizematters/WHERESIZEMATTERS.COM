# SIZE. Performance & Infrastructure

Pre-launch nginx optimizations and EC2 scaling plan.

## Nginx Optimizations

Apply these to `/etc/nginx/nginx.conf` (or the relevant server block) before launch.

### 1. Enable Gzip Compression

```nginx
http {
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_min_length 256;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml
        font/woff2;
}
```

### 2. Cache Headers for Static Assets

```nginx
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 30d;
    add_header Cache-Control "public, no-transform";
    access_log off;
}

# HTML files — short cache, must revalidate
location ~* \.html$ {
    expires 5m;
    add_header Cache-Control "no-cache";
}
```

### 3. Enable HTTP/2

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    # ... ssl certs ...
}
```

### 4. Worker Connections

```nginx
worker_processes auto;           # match CPU cores (2 on t3.small)

events {
    worker_connections 1024;     # default 512 is too low for launch traffic
    multi_accept on;
    use epoll;
}
```

### 5. Client Body Buffer Size

```nginx
http {
    client_body_buffer_size 16k;     # most POST bodies fit in one buffer
    client_max_body_size 10m;        # allow image uploads for verification
    client_header_buffer_size 1k;
    large_client_header_buffers 4 8k;
}
```

### 6. Keepalive Timeout

```nginx
http {
    keepalive_timeout 65;
    keepalive_requests 100;

    # Upstream keepalive to Express backend
    upstream api {
        server 127.0.0.1:3000;
        keepalive 32;
    }
}
```

### 7. Proxy Optimizations (for Express backend)

```nginx
location /api/ {
    proxy_pass http://api;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_buffering on;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;
}
```

## EC2 Scaling Notes

| Metric | Current | Upgrade Trigger |
|--------|---------|-----------------|
| Instance | t3.small (2 vCPU, 2GB RAM) | >100 concurrent users or sustained >70% CPU |
| Cost | ~$15/mo | t3.medium ~$30/mo, t3.large ~$60/mo |

### When to Upgrade

- Sustained CPU above 70% for 5+ minutes
- Memory usage above 80%
- API response times above 500ms (p95)
- More than 100 concurrent WebSocket connections

### How to Upgrade

1. Stop the EC2 instance in AWS Console
2. Actions > Instance Settings > Change Instance Type
3. Select `t3.medium` (2 vCPU, 4GB RAM) or `t3.large` (2 vCPU, 8GB RAM)
4. Start the instance (public IP stays the same if using Elastic IP)
5. Verify services came back up: `systemctl status nginx` and check the API

### Alternative: CloudFront CDN

Put CloudFront in front for static assets to offload nginx:

1. Create a CloudFront distribution pointing to the EC2 origin
2. Set origin path to `/` with the EC2 public IP or domain
3. Cache behavior: cache static assets (`/static/*`, `/*.js`, `/*.css`, `/og-image.png`)
4. Pass `/api/*` and `/ws` directly to origin (no caching)
5. Use the CloudFront domain or attach `wheresizematters.com` via Route 53

This handles global edge caching, DDoS protection (Shield Standard is free), and reduces EC2 load significantly. Most landing page / gate page hits would never touch the origin.

### Quick Health Checks

```bash
# CPU and memory
top -bn1 | head -5

# Nginx connections
ss -s

# API health
curl -s localhost:3000/api/v1/health | jq .

# Disk space
df -h /
```
