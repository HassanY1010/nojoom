# Multi-Tenant SaaS - Quick Start Guide

## 1. Database Setup

```bash
# Connect to MySQL
mysql -u root -p

# Run migrations in order
mysql -u root -p your_database < migrations/001_multi_tenant_schema.sql
mysql -u root -p your_database < migrations/002_add_tenant_id_to_existing_tables.sql
```

## 2. Environment Configuration

Add to `.env`:
```env
# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-refresh-secret-key-change-this

# Multi-Tenant Configuration
APP_DOMAIN=app.com
ALLOW_CUSTOM_DOMAINS=true
```

## 3. Server Integration

Update `server.js`:
```javascript
const { resolveTenant, enforceTenantIsolation } = require('./middleware/tenantMiddleware');
const multiTenantAdminRoutes = require('./routes/multiTenantAdminRoutes');
const { socketIoTenantSetup } = require('./socket/tenantSocketSetup');

// Apply tenant middleware BEFORE routes
app.use(resolveTenant);
app.use(enforceTenantIsolation);

// Add admin routes
app.use('/api/admin', multiTenantAdminRoutes);

// Setup Socket.io with tenant isolation
const io = socketIoTenantSetup(socketIO);
```

## 4. Update Auth Controller

Modify JWT payload in `authController.js`:
```javascript
const accessToken = jwt.sign(
  { 
    id: user.id, 
    email: user.email, 
    role: user.role,
    tenantId: req.tenantId  // ADD THIS
  },
  jwtConfig.secret,
  { expiresIn: jwtConfig.expiresIn }
);
```

## 5. Frontend Configuration

Create `src/config/tenant.ts`:
```typescript
export const getTenantFromHost = () => {
  const host = window.location.host;
  const parts = host.split('.');
  
  if (parts.length >= 3) {
    return parts[0]; // subdomain
  }
  return 'default';
};

export const API_BASE_URL = `https://${getTenantFromHost()}.app.com/api`;
```

## 6. Create First Tenant

```bash
# Login as Super Admin
POST /api/auth/login
{
  "email": "admin@example.com",
  "password": "admin123"
}

# Create Tenant
POST /api/admin/super/tenants
{
  "name": "Demo Company",
  "subdomain": "demo",
  "subscriptionPlan": "pro",
  "isTrial": true
}
```

## 7. Test Tenant Isolation

1. Visit `http://demo.app.com` (or `http://localhost:5173?tenant=demo`)
2. Register a new user
3. Upload a video
4. Verify storage path: `/uploads/2/videos/...` (tenant_id = 2)
5. Open another browser, visit `http://default.app.com`
6. Verify the video from step 3 is NOT visible

## 8. Production Deployment

### DNS Configuration
```
*.app.com  →  Your Server IP
app.com    →  Your Server IP
```

### Nginx Configuration
```nginx
server {
  server_name *.app.com app.com;
  
  location / {
    proxy_pass http://localhost:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

### SSL (Let's Encrypt)
```bash
certbot --nginx -d app.com -d *.app.com
```

## 9. Monitoring

Track per-tenant metrics:
```sql
SELECT 
  t.name,
  t.storage_used_gb,
  COUNT(DISTINCT u.id) as users,
  COUNT(DISTINCT v.id) as videos
FROM tenants t
LEFT JOIN users u ON t.id = u.tenant_id
LEFT JOIN videos v ON t.id = v.tenant_id
GROUP BY t.id;
```

## 10. Troubleshooting

**Issue**: Tenant not found
- Check subdomain spelling
- Verify `tenants` table has entry
- Check `is_active = 1`

**Issue**: Cross-tenant data leak
- Verify all queries include `WHERE tenant_id = ?`
- Check foreign key constraints
- Review middleware logs

**Issue**: Storage limit not enforced
- Ensure `checkStorageLimit` middleware is applied to upload routes
- Verify `storage_used_gb` is updated after uploads
