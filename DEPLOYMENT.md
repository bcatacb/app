# Beat Analyzer - Deployment Guide

## Overview
This guide covers deploying the Beat Analyzer audio analysis application to a Debian 13 VPS using Docker and Nginx.

## Prerequisites

### Server Requirements
- **OS**: Debian 13 (Trixie)
- **RAM**: Minimum 4GB (8GB+ recommended for ML processing)
- **Storage**: Minimum 50GB SSD
- **Network**: Public IP with domain name pointing to it

### Software Requirements
- Docker & Docker Compose
- Nginx
- SSL certificate (Let's Encrypt recommended)

## Quick Deployment

### 1. Prepare Server
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install -y docker-compose-plugin

# Install Nginx and Certbot
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 2. Deploy Application
```bash
# Clone or upload the application
git clone <your-repo> beat-analyzer
cd beat-analyzer

# Make deployment script executable
chmod +x deploy.sh

# Run deployment (update DOMAIN and EMAIL in script first)
./deploy.sh
```

### 3. Configure Domain
```bash
# Update nginx.conf with your domain
sed -i 's/your-domain.com/your-actual-domain.com/g' nginx.conf

# Get SSL certificate
sudo certbot --nginx -d your-domain.com --email admin@your-domain.com --agree-tos --non-interactive
```

## Manual Deployment Steps

### 1. Environment Configuration
Copy and customize `.env.production`:
```bash
cp .env.production .env
```

Update these values:
```env
# Database
MONGO_ROOT_PASSWORD=your-secure-password
DB_NAME=beat_analyzer_prod

# Application
CORS_ORIGINS=https://your-domain.com
JWT_SECRET_KEY=your-super-long-random-secret

# File Storage
MAX_FILE_SIZE=100MB
FILE_STORAGE_PATH=/app/uploads
```

### 2. Nginx Configuration
Update `nginx.conf`:
- Replace `your-domain.com` with your actual domain
- Update SSL certificate paths if using custom certificates
- Adjust rate limiting if needed

### 3. Docker Deployment
```bash
# Build and start services
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f
```

## Service Architecture

### Docker Services
1. **MongoDB**: Database for user data and track metadata
2. **Backend**: FastAPI application with ML models
3. **Nginx**: Reverse proxy with SSL termination

### Data Persistence
- **Database**: MongoDB data in `mongodb_data` volume
- **Uploads**: User files in `uploads_data` volume
- **Logs**: Application logs in `./logs` directory

## Security Configuration

### SSL/TLS
- Automatic Let's Encrypt certificates via Certbot
- HTTP to HTTPS redirect
- Modern TLS configuration (1.2+)

### Firewall
```bash
# Allow HTTP, HTTPS, and SSH
sudo ufw allow 22
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### Application Security
- JWT authentication for all API endpoints
- Password hashing with bcrypt
- CORS configuration
- Rate limiting on API endpoints
- File type validation

## Monitoring and Maintenance

### Health Checks
```bash
# Check service status
docker-compose ps

# Check application health
curl https://your-domain.com/health

# View logs
docker-compose logs -f backend
```

### Backups
Automated backup script included:
```bash
# Manual backup
./backup.sh

# View backup schedule
crontab -l
```

### Updates
```bash
# Update application
./update.sh

# Or manual update:
git pull
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Troubleshooting

### Common Issues

#### 1. ML Model Loading Issues
```bash
# Check backend logs for model loading errors
docker-compose logs backend | grep -i "model\|error"

# Restart backend if models fail to load
docker-compose restart backend
```

#### 2. Database Connection Issues
```bash
# Check MongoDB status
docker-compose exec mongodb mongo --eval "db.adminCommand('ismaster')"

# Restart services
docker-compose restart mongodb backend
```

#### 3. SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew

# Check Nginx configuration
sudo nginx -t
```

#### 4. High Memory Usage
```bash
# Check system resources
free -h
df -h

# Monitor Docker containers
docker stats

# Restart if needed
docker-compose restart
```

### Performance Optimization

#### 1. Database Optimization
```bash
# Create MongoDB indexes
docker-compose exec mongodb mongo beat_analyzer_prod --eval "
db.tracks.createIndex({user_id: 1});
db.tracks.createIndex({bpm: 1});
db.tracks.createIndex({key: 1});
db.users.createIndex({username: 1}, {unique: true});
"
```

#### 2. Nginx Optimization
- Enable gzip compression (already configured)
- Adjust worker processes based on CPU cores
- Tune client upload sizes

#### 3. Docker Optimization
- Limit container memory usage
- Use Docker health checks
- Optimize image sizes

## Scaling Considerations

### Horizontal Scaling
- Use Docker Swarm or Kubernetes for multiple backend instances
- Load balance with Nginx upstream
- Shared MongoDB cluster

### Vertical Scaling
- Increase server RAM for better ML performance
- Use SSD for faster I/O
- Consider GPU acceleration for ML models

## API Endpoints

### Public Endpoints
- `POST /api/register` - User registration
- `POST /api/login` - User login

### Protected Endpoints (Require JWT)
- `GET /api/me` - Get user info
- `POST /api/analyze` - Analyze audio file
- `POST /api/analyze-batch` - Batch analysis
- `GET /api/tracks` - Get user tracks
- `DELETE /api/track/{id}` - Delete track
- `POST /api/search` - Search tracks
- `GET /api/stats` - Get statistics

## Support and Maintenance

### Regular Tasks
1. **Weekly**: Check system resources and logs
2. **Monthly**: Update Docker images and dependencies
3. **Quarterly**: Review security configurations
4. **Annually**: Plan capacity upgrades

### Emergency Contacts
- Domain: DNS issues
- Hosting: Server/network problems
- SSL: Certificate renewal issues

### Documentation
- Keep this guide updated with any changes
- Document any custom configurations
- Maintain change logs for deployments
