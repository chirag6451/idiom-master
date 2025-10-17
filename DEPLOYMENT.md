# FiguroAI Deployment Guide

## Environment Variables Setup

### Local Development
1. Copy `.env.local` (already configured)
2. Variables are prefixed with `VITE_` for Vite compatibility
3. Never commit `.env.local` to git

### Production/Staging Deployment

#### Option 1: Build-time Environment Variables (Recommended for Static Hosting)

1. **Create production env file on your local machine:**
   ```bash
   cp .env.production.example .env.production
   # Edit .env.production with your production API key
   ```

2. **Build with production variables:**
   ```bash
   npm run build
   ```
   The build process will embed `VITE_GEMINI_API_KEY` into the bundle.

3. **Deploy the `dist` folder** to your server

#### Option 2: Server Environment Variables

For server deployment (e.g., Nginx + Node):

1. **SSH into your server:**
   ```bash
   ssh root@your-server-ip
   ```

2. **Set environment variable:**
   ```bash
   # Add to /etc/environment (system-wide)
   echo 'VITE_GEMINI_API_KEY=your_api_key_here' | sudo tee -a /etc/environment
   
   # Or add to nginx configuration
   # Or use a process manager like PM2 with env file
   ```

3. **Reload environment:**
   ```bash
   source /etc/environment
   ```

## Deployment Steps for FiguroAI.com

### Prerequisites
- Node.js installed on server
- Nginx configured
- Domain DNS pointing to server IP

### Step 1: Build Application
```bash
# On your local machine
npm run build
```

### Step 2: Upload to Server
```bash
# Create deployment package
tar -czf figuroai-dist.tar.gz dist/

# Upload to server (replace with your credentials)
scp figuroai-dist.tar.gz root@209.182.237.241:/var/www/
```

### Step 3: Extract on Server
```bash
# SSH into server
ssh root@209.182.237.241

# Extract files
cd /var/www
mkdir -p figuroai
tar -xzf figuroai-dist.tar.gz -C figuroai/
```

### Step 4: Configure Nginx
```bash
# Copy nginx configuration
sudo nano /etc/nginx/sites-available/figuroai.com

# Enable site
sudo ln -s /etc/nginx/sites-available/figuroai.com /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
```

### Step 5: Setup SSL (Optional but Recommended)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d figuroai.com -d www.figuroai.com
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_GEMINI_API_KEY` | Google Gemini API Key | Yes |

## Security Notes

⚠️ **IMPORTANT:**
- Never commit `.env.local` or `.env.production` to git
- Keep API keys secure and rotate them regularly
- Use different API keys for development and production
- Monitor API usage to detect unauthorized access

## Troubleshooting

### API Key Not Working
- Ensure variable is prefixed with `VITE_`
- Rebuild the application after changing env variables
- Check browser console for error messages

### Build Errors
- Run `npm install` to ensure all dependencies are installed
- Clear cache: `rm -rf node_modules dist && npm install`
- Check Node.js version compatibility

## Support
For issues, check the error messages in browser console or contact support.
