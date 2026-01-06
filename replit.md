# Wasteland Companion

A web-based dashboard for monitoring home lab servers, featuring a cyberpunk-inspired dark theme with green accents.

## Overview

Wasteland Companion is a secure monitoring dashboard designed for Ubuntu Server 24.04 LTS deployments. It provides real-time system metrics, service status monitoring, and a sleek, terminal-inspired user interface.

## Default Credentials

**IMPORTANT**: Change these in production!

- **Username**: admin
- **Password**: admin123

The default admin user has the "admin" role, which grants access to user management features.

## Features

- **Secure Authentication**: Session-based auth with bcrypt password hashing
- **Role-Based Access**: Admin users can manage other users and devices; regular users can only view
- **System Metrics**: CPU, Memory, Disk, and Temperature monitoring (reads from /proc on Linux)
- **Service Status**: Monitor PostgreSQL, Docker, SSH, and Firewall via systemctl
- **Network Devices**: Map your home lab devices with IP, MAC, OS, and function descriptions
- **Online/Offline Monitoring**: Automatic ping monitoring (every 60 seconds) to track device availability
- **Dark Theme**: Cyberpunk-inspired UI with green accent colors
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Express-session with bcrypt password hashing
- **Routing**: Wouter (frontend), Express (backend)

## Project Structure

```
client/
  src/
    pages/
      login.tsx        - Login page with cyberpunk theme
      dashboard.tsx    - Main dashboard with metrics
      settings.tsx     - User management (admin only)
      devices.tsx      - Network device mapping (admin can add/edit/delete)
    App.tsx            - Main app with routing
    index.css          - Dark theme CSS variables

server/
  routes.ts            - API endpoints for auth, system status, and devices
  storage.ts           - PostgreSQL database storage
  db.ts                - Database connection
  systemMetrics.ts     - Real system metrics collection
  deviceMonitor.ts     - Ping-based online/offline monitoring

shared/
  schema.ts            - User and Device schemas with Zod validation
```

## Deployment on Ubuntu Server 24.04

1. Install Node.js 20.x
2. Clone the repository
3. Run `npm install`
4. Set environment variable `SESSION_SECRET` to a strong random string
5. Set `DATABASE_URL` for PostgreSQL connection
6. Run `npm run db:push` to create database tables
7. Run `npm run build` for production build
8. Run `npm start` to start the server
9. Access at http://your-server-ip:5000

## API Endpoints

- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/status` - Check auth status (includes role)
- `GET /api/system/status` - Get system metrics (requires auth)
- `GET /api/users` - List all users (admin only)
- `POST /api/users` - Create new user (admin only)
- `PATCH /api/users/:id/password` - Change user password (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)
- `GET /api/devices` - List all devices (requires auth)
- `GET /api/devices/:id` - Get single device (requires auth)
- `POST /api/devices` - Create new device (admin only)
- `PATCH /api/devices/:id` - Update device (admin only)
- `DELETE /api/devices/:id` - Delete device (admin only)

## Security Notes

- Session cookies use `sameSite: lax` for navigation compatibility
- Passwords are hashed with bcrypt (10 rounds)
- Change default admin credentials immediately after deployment
- Set `SESSION_SECRET` environment variable in production
- For HTTPS deployments, set `SECURE_COOKIES=true` environment variable
- Only admin users can access user management and device management features
