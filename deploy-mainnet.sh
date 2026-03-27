#!/bin/bash
# SIZE. — Deploy to Base Mainnet
# Usage: ./deploy-mainnet.sh <SIZE_TOKEN_ADDRESS> <STAKING_CONTRACT_ADDRESS>
set -e

TOKEN_ADDRESS="${1:?Usage: ./deploy-mainnet.sh <SIZE_TOKEN_ADDRESS> <STAKING_ADDRESS>}"
STAKING_ADDRESS="${2:?Usage: ./deploy-mainnet.sh <SIZE_TOKEN_ADDRESS> <STAKING_ADDRESS>}"
SERVER="ec2-user@54.158.51.226"
KEY="$HOME/.ssh/size-api-key.pem"

echo "═══════════════════════════════════════"
echo "  SIZE. — Deploying to Base Mainnet"
echo "═══════════════════════════════════════"
echo "Token: $TOKEN_ADDRESS"
echo "Staking: $STAKING_ADDRESS"
echo ""

# 1. Update web3.ts
echo "Updating lib/web3.ts..."
sed -i '' "s/export const BASE_CHAIN_ID = 84532;/export const BASE_CHAIN_ID = 8453;/" lib/web3.ts
sed -i '' "s/export const BASE_CHAIN_ID_HEX = '0x14a34';/export const BASE_CHAIN_ID_HEX = '0x2105';/" lib/web3.ts
sed -i '' "s|export const TOKEN_ADDRESS = '.*';|export const TOKEN_ADDRESS = '$TOKEN_ADDRESS';|" lib/web3.ts
sed -i '' "s|export const RPC_URL = '.*';|export const RPC_URL = 'https://base-mainnet.core.chainstack.com/1f396980c6a698065bdf9bbebbb7fd78';|" lib/web3.ts
# Fix chain name
sed -i '' "s/chainName: 'Base Sepolia'/chainName: 'Base'/" lib/web3.ts
sed -i '' "s|rpcUrls: \['https://sepolia.base.org'\]|rpcUrls: ['https://mainnet.base.org']|" lib/web3.ts
sed -i '' "s|blockExplorerUrls: \['https://sepolia.basescan.org'\]|blockExplorerUrls: ['https://basescan.org']|" lib/web3.ts

# 2. Update staking.ts
echo "Updating lib/staking.ts..."
sed -i '' "s|export const STAKING_CONTRACT_ADDRESS = '.*';|export const STAKING_CONTRACT_ADDRESS = '$STAKING_ADDRESS';|" lib/staking.ts

# 3. Update coin.html
echo "Updating public/coin.html..."
sed -i '' "s/const BASE_CHAIN = 84532;/const BASE_CHAIN = 8453;/" public/coin.html
sed -i '' "s/0x14a34/0x2105/g" public/coin.html
sed -i '' "s/chainName: 'Base Sepolia'/chainName: 'Base'/" public/coin.html
sed -i '' "s|rpcUrls: \['https://sepolia.base.org'\]|rpcUrls: ['https://mainnet.base.org']|" public/coin.html
sed -i '' "s|blockExplorerUrls: \['https://sepolia.basescan.org'\]|blockExplorerUrls: ['https://basescan.org']|" public/coin.html

# 4. Build
echo ""
echo "Building frontend..."
EXPO_PUBLIC_API_URL="" npx expo export --platform web --clear

# 5. Deploy (same as deploy.sh)
echo "Deploying to server..."
ssh -i "$KEY" "$SERVER" "mkdir -p /tmp/size-dist"
scp -r -i "$KEY" dist/* "$SERVER:/tmp/size-dist/"
ssh -i "$KEY" "$SERVER" "
  sudo cp -r /tmp/size-dist/* /var/www/size/
  sudo mv /var/www/size/index.html /var/www/size/app.html
  rm -rf /tmp/size-dist
"

# Restore static pages
for f in index-landing.html tokenomics.html whitepaper.html documentation.html privacy.html terms.html og-image.png coin.html gate.html analytics.html track.js; do
  scp -i "$KEY" "public/$f" "$SERVER:/tmp/$f"
done
ssh -i "$KEY" "$SERVER" "
  sudo cp /tmp/index-landing.html /var/www/size/index.html
  sudo cp /tmp/tokenomics.html /var/www/size/tokenomics.html
  sudo cp /tmp/whitepaper.html /var/www/size/whitepaper.html
  sudo cp /tmp/documentation.html /var/www/size/documentation.html
  sudo cp /tmp/privacy.html /var/www/size/privacy.html
  sudo cp /tmp/terms.html /var/www/size/terms.html
  sudo cp /tmp/og-image.png /var/www/size/og-image.png
  sudo cp /tmp/coin.html /var/www/size/coin.html
  sudo cp /tmp/gate.html /var/www/size/gate.html
  sudo cp /tmp/analytics.html /var/www/size/analytics.html
  sudo cp /tmp/track.js /var/www/size/track.js
"

# Pull API code and restart
ssh -i "$KEY" "$SERVER" "
  cd /opt/size-app && sudo git pull origin main
  ps aux | grep tsx | grep -v grep | awk '{print \$2}' | xargs kill 2>/dev/null
  sleep 2
  cd infra/api && nohup npx tsx src/index.ts > /var/log/size-api.log 2>&1 &
"

echo ""
echo "═══════════════════════════════════════"
echo "  MAINNET DEPLOYMENT COMPLETE"
echo "═══════════════════════════════════════"
echo ""
echo "Next steps:"
echo "  1. Deploy smart contracts to Base mainnet:"
echo "     cd contracts"
echo "     SIZE_TOKEN_ADDRESS=$TOKEN_ADDRESS npx hardhat run deploy/002_deploy_all.ts --network base"
echo "  2. Update contracts/addresses.json with mainnet addresses"
echo "  3. Verify contracts on BaseScan:"
echo "     npx hardhat verify --network base <ADDRESS> <CONSTRUCTOR_ARGS>"
echo "  4. Test everything on the live site"
echo "  5. Toggle gate OFF in admin dashboard when ready"
echo ""
