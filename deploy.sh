#!/bin/bash

# FiguroAI Deployment Script
# Server: 209.182.237.241
# Domain: FiguroAI.com

echo "🚀 FiguroAI Deployment Script"
echo "=============================="

# Server details
SERVER_IP="209.182.237.241"
SERVER_USER="root"
DOMAIN="FiguroAI.com"
APP_DIR="/var/www/figuroai"

echo "📦 Building the application..."
npm run build

echo "📁 Creating deployment package..."
tar -czf figuroai-app.tar.gz dist/ package.json

echo "🔗 Deployment commands to run:"
echo ""
echo "1. Connect to server:"
echo "   sshpass -p 'BnScJyLe4Y' ssh root@209.182.237.241"
echo ""
echo "2. Create app directory:"
echo "   mkdir -p /var/www/figuroai"
echo ""
echo "3. Upload files (run from local machine):"
echo "   sshpass -p 'BnScJyLe4Y' scp figuroai-app.tar.gz root@209.182.237.241:/var/www/"
echo ""
echo "4. Extract on server:"
echo "   cd /var/www && tar -xzf figuroai-app.tar.gz -C figuroai/"
echo ""
echo "5. Configure Nginx (see nginx-config.txt)"
echo ""

echo "✅ Build complete! Follow the commands above to deploy."
