# Beat Analyzer - Deployment Checklist

## Pre-Deployment Checklist

### ✅ Server Preparation
- [ ] Debian 13 VPS ready with SSH access
- [ ] Domain name pointing to server IP
- [ ] Minimum 4GB RAM, 50GB SSD storage
- [ ] Docker and Docker Compose installed
- [ ] Nginx and Certbot installed
- [ ] Firewall configured (ports 22, 80, 443)

### ✅ Application Files
- [ ] All source code uploaded to `/opt/beat-analyzer/`
- [ ] Environment variables configured in `.env`
- [ ] Nginx configuration updated with correct domain
- [ ] SSL certificates ready (or use Let's Encrypt)
- [ ] Deployment scripts executable (`chmod +x *.sh`)

### ✅ Security Configuration
- [ ] Strong passwords generated for MongoDB
- [ ] JWT secret key configured
- [ ] CORS origins set to correct domain
- [ ] SSL/TLS configured
- [ ] Rate limiting configured in Nginx

## Deployment Steps

### 1. Initial Setup
```bash
# SSH into your VPS
ssh user@your-vps-ip

# Create app directory
sudo mkdir -p /opt/beat-analyzer
sudo chown $USER:$USER /opt/beat-analyzer
cd /opt/beat-analyzer

# Upload application files (using scp, git clone, or sftp)
# Example: scp -r ./beat-analyzer/* user@your-vps-ip:/opt/beat-analyzer/
```

### 2. Environment Configuration
```bash
# Copy and edit environment file
cp .env.production .env
nano .env  # Update all required values

# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 64)
MONGO_PASSWORD=$(openssl rand -base64 32)
```

### 3. Nginx Configuration
```bash
# Update domain in nginx.conf
sed -i 's/your-domain.com/your-actual-domain.com/g' nginx.conf

# Test Nginx configuration
sudo nginx -t
```

### 4. Docker Deployment
```bash
# Build and start services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps
```

### 5. SSL Setup
```bash
# Get SSL certificate
sudo certbot --nginx -d your-domain.com --email admin@your-domain.com --agree-tos --non-interactive

# Setup auto-renewal
(crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
```

### 6. Database Initialization
```bash
# Check MongoDB is running
docker exec beat-analyzer-mongo mongo --eval "db.adminCommand('ismaster')"

# Create indexes (handled by mongo-init.js)
docker exec beat-analyzer-mongo mongo beat_analyzer_prod --eval "db.getCollectionNames()"
```

## Post-Deployment Verification

### ✅ Service Health Checks
```bash
# Check all containers are running
docker-compose ps

# Check application health
curl -f https://your-domain.com/health

# Check backend API
curl -f https://your-domain.com/api/tracks

# Check Nginx status
sudo systemctl status nginx
```

### ✅ Functionality Tests
- [ ] User registration works
- [ ] User login works and returns JWT token
- [ ] Audio file upload works
- [ ] Audio analysis completes successfully
- [ ] Track listing displays user's tracks
- [ ] Search functionality works
- [ ] File deletion works

### ✅ Performance Checks
- [ ] Page load times under 3 seconds
- [ ] Audio analysis completes in reasonable time
- [ ] Memory usage is stable
- [ ] Disk space usage is acceptable

## Monitoring Setup

### ✅ Automated Monitoring
```bash
# Setup monitoring script (included in deploy.sh)
./monitor.sh

# Check monitoring is in crontab
crontab -l | grep monitor
```

### ✅ Backup System
```bash
# Test backup script
./backup.sh

# Check backup schedule
crontab -l | grep backup

# Verify backup files
ls -la /opt/backups/
```

### ✅ Log Management
```bash
# Check application logs
docker-compose logs -f backend

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Setup log rotation if needed
```

## Security Verification

### ✅ SSL Certificate
```bash
# Check SSL certificate
sudo certbot certificates

# Test SSL configuration
curl -I https://your-domain.com

# Check certificate expiry
openssl s_client -connect your-domain.com:443 -servername your-domain.com 2>/dev/null | openssl x509 -noout -dates
```

### ✅ Firewall Status
```bash
# Check UFW status
sudo ufw status

# Verify open ports
sudo netstat -tlnp | grep -E ':(22|80|443)\s'
```

### ✅ Application Security
- [ ] JWT tokens are properly validated
- [ ] Password hashing is working
- [ ] CORS is properly configured
- [ ] File upload restrictions are enforced
- [ ] Rate limiting is active

## Performance Optimization

### ✅ Database Optimization
```bash
# Check MongoDB indexes
docker exec beat-analyzer-mongo mongo beat_analyzer_prod --eval "db.tracks.getIndexes()"

# Monitor database performance
docker exec beat-analyzer-mongo mongo --eval "db.stats()"
```

### ✅ Caching Configuration
- [ ] Static file caching enabled in Nginx
- [ ] Browser caching headers set
- [ ] Gzip compression enabled

### ✅ Resource Limits
- [ ] Docker memory limits configured
- [ ] Nginx client upload size set
- [ ] Database connection limits appropriate

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Check resource usage
docker stats

# Restart service
docker-compose restart backend
```

#### 2. Database Connection Issues
```bash
# Check MongoDB status
docker exec beat-analyzer-mongo mongo --eval "db.adminCommand('ping')"

# Check network connectivity
docker network ls
docker network inspect beat-analyzer_beat-analyzer-network
```

#### 3. SSL Certificate Issues
```bash
# Check certificate status
sudo certbot certificates

# Renew certificate manually
sudo certbot renew --dry-run

# Check Nginx SSL configuration
sudo nginx -t
```

#### 4. High Memory Usage
```bash
# Check system resources
free -h
df -h

# Monitor containers
docker stats

# Restart if needed
docker-compose restart
```

## Maintenance Schedule

### Daily
- [ ] Check system resource usage
- [ ] Review error logs
- [ ] Verify backup completion

### Weekly
- [ ] Check SSL certificate expiry
- [ ] Review user activity
- [ ] Monitor disk space usage

### Monthly
- [ ] Update Docker images
- [ ] Apply security patches
- [ ] Review performance metrics

### Quarterly
- [ ] Capacity planning review
- [ ] Security audit
- [ ] Backup restoration test

## Emergency Procedures

### Service Outage
1. Check all container status
2. Review recent logs for errors
3. Restart affected services
4. Notify users if extended downtime

### Security Incident
1. Check authentication logs
2. Review recent user activity
3. Change all secrets/passwords
4. Update firewall rules

### Data Recovery
1. Stop all services
2. Restore from latest backup
3. Verify data integrity
4. Restart services

## Contact Information

### Emergency Contacts
- **Domain Provider**: For DNS issues
- **VPS Provider**: For hardware/network problems
- **SSL Provider**: For certificate issues

### Documentation Links
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](./API.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

---

## Final Deployment Verification

Before going live, ensure all items in this checklist are completed:

- [ ] All services running and healthy
- [ ] SSL certificate properly installed
- [ ] User registration/login working
- [ ] Audio analysis functionality working
- [ ] Monitoring and backup systems active
- [ ] Security measures in place
- [ ] Performance within acceptable limits
- [ ] Documentation complete and accessible

Once all items are verified, the application is ready for production use!
