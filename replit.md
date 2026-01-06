# Home Lab Companion

A web-based dashboard for monitoring home lab servers, featuring a cyberpunk-inspired dark theme with green accents.

## Overview

Home Lab Companion is a secure monitoring dashboard designed for Ubuntu Server 24.04 LTS deployments. It provides real-time system metrics, service status monitoring, and a sleek, terminal-inspired user interface.

## Default Credentials

**IMPORTANT**: Change these in production!

- **Username**: admin
- **Password**: admin123

## Features

- **Secure Authentication**: Session-based auth with bcrypt password hashing
- **System Metrics**: CPU, Memory, Disk, and Temperature monitoring
- **Service Status**: Monitor Nginx, PostgreSQL, Redis, Docker, SSH, and Firewall
- **Dark Theme**: Cyberpunk-inspired UI with green accent colors
- **Responsive Design**: Works on desktop and mobile devices

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI
- **Backend**: Express.js, Node.js
- **Authentication**: Express-session with bcrypt password hashing
- **Routing**: Wouter (frontend), Express (backend)

## Project Structure

```
client/
  src/
    pages/
      login.tsx        - Login page with cyberpunk theme
      dashboard.tsx    - Main dashboard with metrics
    App.tsx            - Main app with routing
    index.css          - Dark theme CSS variables

server/
  routes.ts            - API endpoints for auth and system status
  storage.ts           - In-memory user storage

shared/
  schema.ts            - User schema with Zod validation
```

## Deployment on Ubuntu Server 24.04

1. Install Node.js 20.x
2. Clone the repository
3. Run `npm install`
4. Set environment variable `SESSION_SECRET` to a strong random string
5. Run `npm run build` for production build
6. Run `npm start` to start the server
7. Access at http://your-server-ip:5000

## API Endpoints

- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/status` - Check auth status
- `GET /api/system/status` - Get system metrics (requires auth)

## Security Notes

- Session cookies use `sameSite: strict` for CSRF protection
- Passwords are hashed with bcrypt (10 rounds)
- Change default admin credentials immediately after deployment
- Set `SESSION_SECRET` environment variable in production
- Use HTTPS in production (set via reverse proxy like Nginx)
