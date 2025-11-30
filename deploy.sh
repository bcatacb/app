#!/bin/bash

# Beat Analyzer Deployment Script
# For Debian 13 VPS

set -e

echo "🎵 Beat Analyzer Deployment Script"
echo "=================================="

# Configuration
APP_NAME="beat-analyzer"
DOMAIN="your-domain.com"  # CHANGE THIS
EMAIL="admin@your-domain.com"  # CHANGE THIS

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   log_error "This script should not be run as root!"
   exit 1
fi

# Update system
log_info "Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Install Docker
log_info "Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    log_info "Docker installed. Please log out and log back in to use docker without sudo."
fi

# Install Docker Compose
log_info "Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo apt install -y docker-compose-plugin
fi

# Install Nginx and Certbot
log_info "Installing Nginx and Certbot..."
sudo apt install -y nginx certbot python3-certbot-nginx

# Create app directory
APP_DIR="/opt/$APP_NAME"
sudo mkdir -p $APP_DIR
sudo chown $USER:$USER $APP_DIR

# Copy application files
log_info "Copying application files..."
cp -r . $APP_DIR/
cd $APP_DIR

# Generate secure secrets
log_info "Generating secure secrets..."
JWT_SECRET=$(openssl rand -base64 64)
MONGO_PASSWORD=$(openssl rand -base64 32)

# Create production environment file
log_info "Creating production environment file..."
cat > .env << EOF
# Production Environment Configuration
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=$MONGO_PASSWORD
DB_NAME=beat_analyzer_prod

# Application Configuration
CORS_ORIGINS=https://$DOMAIN
JWT_SECRET_KEY=$JWT_SECRET
MAX_FILE_SIZE=100MB

# File Storage
FILE_STORAGE_PATH=/app/uploads
UPLOAD_EXPIRY_DAYS=30

# Monitoring
ENABLE_HEALTH_CHECK=true
LOG_LEVEL=INFO
EOF

# Update nginx configuration
log_info "Configuring Nginx..."
sed -i "s/your-domain.com/$DOMAIN/g" nginx.conf

# Build and start containers
log_info "Building and starting containers..."
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Wait for services to start
log_info "Waiting for services to start..."
sleep 30

# Setup SSL certificate
log_info "Setting up SSL certificate..."
sudo certbot --nginx -d $DOMAIN --email $EMAIL --agree-tos --non-interactive

# Setup automatic SSL renewal
log_info "Setting up automatic SSL renewal..."
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -

# Create backup script
log_info "Setting up backup script..."
cat > backup.sh << 'EOF'
#!/bin/bash

# Backup script for Beat Analyzer
APP_NAME="beat-analyzer"
BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup MongoDB
docker exec beat-analyzer-mongo mongodump --out /tmp/backup
docker cp beat-analyzer-mongo:/tmp/backup $BACKUP_DIR/mongo_$DATE

# Backup uploaded files
docker cp beat-analyzer-backend:/app/uploads $BACKUP_DIR/uploads_$DATE

# Compress backups
tar -czf $BACKUP_DIR/beat_analyzer_backup_$DATE.tar.gz -C $BACKUP_DIR mongo_$DATE uploads_$DATE

# Clean up
rm -rf $BACKUP_DIR/mongo_$DATE $BACKUP_DIR/uploads_$DATE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "beat_analyzer_backup_*.tar.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_DIR/beat_analyzer_backup_$DATE.tar.gz"
EOF

chmod +x backup.sh

# Setup daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * $APP_DIR/backup.sh") | crontab -

# Create monitoring script
log_info "Setting up monitoring script..."
cat > monitor.sh << 'EOF'
#!/bin/bash

APP_NAME="beat-analyzer"
LOG_FILE="/var/log/$APP_NAME-monitor.log"

# Check if containers are running
check_container() {
    if docker ps --format "table {{.Names}}" | grep -q "$1"; then
        echo "$(date): $1 is running" >> $LOG_FILE
        return 0
    else
        echo "$(date): $1 is down! Restarting..." >> $LOG_FILE
        cd /opt/$APP_NAME
        docker-compose restart $1
        return 1
    fi
}

check_container "beat-analyzer-backend"
check_container "beat-analyzer-mongo"
check_container "beat-analyzer-nginx"

# Check disk space
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
    echo "$(date): Disk usage is ${DISK_USAGE}%" >> $LOG_FILE
fi

# Check memory usage
MEM_USAGE=$(free | awk 'NR==2{printf "%.0f", $3*100/$2}')
if [ $MEM_USAGE -gt 85 ]; then
    echo "$(date): Memory usage is ${MEM_USAGE}%" >> $LOG_FILE
fi
EOF

chmod +x monitor.sh

# Setup monitoring every 5 minutes
(crontab -l 2>/dev/null; echo "*/5 * * * * $APP_DIR/monitor.sh") | crontab -

# Create update script
log_info "Creating update script..."
cat > update.sh << 'EOF'
#!/bin/bash

APP_NAME="beat-analyzer"
APP_DIR="/opt/$APP_NAME"

echo "Updating Beat Analyzer..."
cd $APP_DIR

# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d

echo "Update completed!"
EOF

chmod +x update.sh

# Show status
log_info "Checking application status..."
docker-compose ps

echo ""
log_info "🎉 Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your DNS to point $DOMAIN to this server's IP"
echo "2. Wait for DNS propagation (usually 5-30 minutes)"
echo "3. Visit https://$DOMAIN to access your application"
echo "4. Register your first user account"
echo ""
echo "Useful commands:"
echo "- Check logs: docker-compose logs -f"
echo "- Check status: docker-compose ps"
echo "- Backup: ./backup.sh"
echo "- Monitor: ./monitor.sh"
echo "- Update: ./update.sh"
echo ""
log_warn "Remember to:"
echo "- Change the domain name in nginx.conf if needed"
echo "- Set up proper firewall rules"
echo "- Monitor disk space and backups"
