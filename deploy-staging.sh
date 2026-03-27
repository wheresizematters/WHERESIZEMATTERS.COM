#!/bin/bash
# SIZE. staging deploy — builds and deploys to /var/www/size-staging/
set -e

SERVER="ec2-user@54.158.51.226"
KEY="$HOME/.ssh/size-api-key.pem"

echo "Building staging frontend..."
EXPO_PUBLIC_API_URL="" EXPO_PUBLIC_STAGING=true npx expo export --platform web --clear

echo "Uploading to server..."
ssh -i "$KEY" "$SERVER" "mkdir -p /tmp/size-staging-dist"
scp -r -i "$KEY" dist/* "$SERVER:/tmp/size-staging-dist/"

echo "Deploying staging..."
ssh -i "$KEY" "$SERVER" "
  sudo mkdir -p /var/www/size-staging
  sudo cp -r /tmp/size-staging-dist/* /var/www/size-staging/
  sudo mv /var/www/size-staging/index.html /var/www/size-staging/app.html
  rm -rf /tmp/size-staging-dist
"

echo "Restoring static pages to staging..."
scp -i "$KEY" \
  public/index-landing.html \
  public/tokenomics.html \
  public/whitepaper.html \
  public/documentation.html \
  public/privacy.html \
  public/terms.html \
  public/og-image.png \
  public/coin.html \
  public/gate.html \
  public/analytics.html \
  public/track.js \
  "$SERVER:/tmp/"

ssh -i "$KEY" "$SERVER" "
  sudo cp /tmp/index-landing.html /var/www/size-staging/index.html
  sudo cp /tmp/tokenomics.html /var/www/size-staging/tokenomics.html
  sudo cp /tmp/whitepaper.html /var/www/size-staging/whitepaper.html
  sudo cp /tmp/documentation.html /var/www/size-staging/documentation.html
  sudo cp /tmp/privacy.html /var/www/size-staging/privacy.html
  sudo cp /tmp/terms.html /var/www/size-staging/terms.html
  sudo cp /tmp/og-image.png /var/www/size-staging/og-image.png
  sudo cp /tmp/coin.html /var/www/size-staging/coin.html
  sudo cp /tmp/gate.html /var/www/size-staging/gate.html
  sudo cp /tmp/analytics.html /var/www/size-staging/analytics.html
  sudo cp /tmp/track.js /var/www/size-staging/track.js
"

echo "Staging deploy complete! Access at https://wheresizematters.com/staging/"
