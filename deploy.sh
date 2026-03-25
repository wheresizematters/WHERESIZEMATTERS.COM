#!/bin/bash
# SIZE. deploy script — builds frontend and deploys to EC2
set -e

SERVER="ec2-user@54.158.51.226"
KEY="$HOME/.ssh/size-api-key.pem"

echo "Building frontend..."
EXPO_PUBLIC_API_URL="" npx expo export --platform web --clear

echo "Uploading to server..."
scp -r -i "$KEY" dist/* "$SERVER:/tmp/size-dist/"

echo "Deploying..."
ssh -i "$KEY" "$SERVER" "
  # Deploy SPA as app.html (not index.html — that's the landing page)
  sudo cp -r /tmp/size-dist/* /var/www/size/
  sudo mv /var/www/size/index.html /var/www/size/app.html
  rm -rf /tmp/size-dist
"

echo "Restoring static pages..."
scp -i "$KEY" \
  public/index-landing.html \
  public/tokenomics.html \
  public/whitepaper.html \
  public/documentation.html \
  public/privacy.html \
  public/terms.html \
  public/og-image.png \
  "$SERVER:/tmp/"

ssh -i "$KEY" "$SERVER" "
  sudo cp /tmp/index-landing.html /var/www/size/index.html
  sudo cp /tmp/tokenomics.html /var/www/size/tokenomics.html
  sudo cp /tmp/whitepaper.html /var/www/size/whitepaper.html
  sudo cp /tmp/documentation.html /var/www/size/documentation.html
  sudo cp /tmp/privacy.html /var/www/size/privacy.html
  sudo cp /tmp/terms.html /var/www/size/terms.html
  sudo cp /tmp/og-image.png /var/www/size/og-image.png
"

echo "Updating API..."
ssh -i "$KEY" "$SERVER" "
  cd /opt/size-app && sudo git pull origin main 2>&1 | tail -2
  sudo pkill -f 'npx tsx' 2>/dev/null || true
  sleep 1
  cd infra/api && nohup npx tsx src/index.ts > /var/log/size-api.log 2>&1 &
  sleep 3
  curl -s localhost:3000/health
"

echo "Deploy complete!"
