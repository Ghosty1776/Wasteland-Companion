import { execSync } from "child_process";
import * as fs from "fs";

// Store previous CPU reading for differential calculation
let previousCpuReading: { idle: number; total: number; timestamp: number } | null = null;

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "warning";
  port?: number;
  uptime?: string;
}

interface SystemStatus {
  hostname: string;
  uptime: string;
  cpuUsage: number;
  memoryUsage: number;
  diskUsage: number;
  networkStatus: "online" | "offline";
  temperature: number;
  services: ServiceStatus[];
  lastUpdate: string;
}

function safeExec(command: string, fallback: string = ""): string {
  try {
    return execSync(command, { encoding: "utf-8", timeout: 5000 }).trim();
  } catch {
    return fallback;
  }
}

function getHostname(): string {
  try {
    return fs.readFileSync("/etc/hostname", "utf-8").trim();
  } catch {
    return safeExec("hostname", "unknown-host");
  }
}

function getUptime(): string {
  try {
    const uptimeSeconds = parseFloat(fs.readFileSync("/proc/uptime", "utf-8").split(" ")[0]);
    const days = Math.floor(uptimeSeconds / 86400);
    const hours = Math.floor((uptimeSeconds % 86400) / 3600);
    const minutes = Math.floor((uptimeSeconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  } catch {
    const uptimeSecs = Math.floor(process.uptime());
    const days = Math.floor(uptimeSecs / 86400);
    const hours = Math.floor((uptimeSecs % 86400) / 3600);
    const minutes = Math.floor((uptimeSecs % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  }
}

function getCpuUsage(): number {
  try {
    // Read current /proc/stat and use differential from previous reading
    const stat = fs.readFileSync("/proc/stat", "utf-8");
    const cpuLine = stat.split("\n")[0];
    const values = cpuLine.split(/\s+/).slice(1).map(Number);
    
    // idle + iowait
    const idle = values[3] + values[4];
    const total = values.reduce((a, b) => a + b, 0);
    const now = Date.now();
    
    if (previousCpuReading && (now - previousCpuReading.timestamp) < 60000) {
      // Calculate differential from previous reading
      const idleDelta = idle - previousCpuReading.idle;
      const totalDelta = total - previousCpuReading.total;
      
      // Update stored reading
      previousCpuReading = { idle, total, timestamp: now };
      
      if (totalDelta > 0) {
        const usage = Math.round(((totalDelta - idleDelta) / totalDelta) * 100);
        return Math.min(100, Math.max(0, usage));
      }
    }
    
    // Store current reading for next request
    previousCpuReading = { idle, total, timestamp: now };
    
    // First request: try top command for immediate result
    const topOutput = safeExec("top -bn1 2>/dev/null | head -5 | grep -i cpu");
    if (topOutput) {
      // Parse "Cpu(s):  4.7 us," or "%Cpu(s):  4.7 us," format
      const match = topOutput.match(/(\d+\.?\d*)\s*(?:us|%)/);
      if (match) {
        const userCpu = parseFloat(match[1]);
        // Also try to get system CPU
        const sysMatch = topOutput.match(/(\d+\.?\d*)\s*sy/);
        const sysCpu = sysMatch ? parseFloat(sysMatch[1]) : 0;
        const totalUsage = userCpu + sysCpu;
        if (!isNaN(totalUsage) && totalUsage >= 0) {
          return Math.round(Math.min(100, totalUsage));
        }
      }
    }
    
    // Try mpstat if available
    const mpstatOutput = safeExec("mpstat 1 1 2>/dev/null | tail -1 | awk '{print 100 - $NF}'");
    if (mpstatOutput) {
      const usage = parseFloat(mpstatOutput);
      if (!isNaN(usage) && usage >= 0 && usage <= 100) {
        return Math.round(usage);
      }
    }
    
    // Return reasonable default on first request
    return 15;
  } catch {
    return 15;
  }
}

function getMemoryUsage(): number {
  try {
    // Try free command first - most reliable on Ubuntu
    const freeOutput = safeExec("free | grep Mem | awk '{print ($3/$2) * 100}'");
    if (freeOutput) {
      const usage = parseFloat(freeOutput);
      if (!isNaN(usage) && usage >= 0 && usage <= 100) {
        return Math.round(usage);
      }
    }
    
    // Fallback to /proc/meminfo
    const meminfo = fs.readFileSync("/proc/meminfo", "utf-8");
    const lines = meminfo.split("\n");
    let total = 0, available = 0, free = 0, buffers = 0, cached = 0;
    
    for (const line of lines) {
      if (line.startsWith("MemTotal:")) {
        total = parseInt(line.split(/\s+/)[1]);
      } else if (line.startsWith("MemAvailable:")) {
        available = parseInt(line.split(/\s+/)[1]);
      } else if (line.startsWith("MemFree:")) {
        free = parseInt(line.split(/\s+/)[1]);
      } else if (line.startsWith("Buffers:")) {
        buffers = parseInt(line.split(/\s+/)[1]);
      } else if (line.startsWith("Cached:")) {
        cached = parseInt(line.split(/\s+/)[1]);
      }
    }
    
    if (total > 0) {
      // Use MemAvailable if present (newer kernels), otherwise calculate
      const actualFree = available > 0 ? available : (free + buffers + cached);
      return Math.round(((total - actualFree) / total) * 100);
    }
    return 50;
  } catch {
    return 50;
  }
}

function getDiskUsage(): number {
  try {
    // Try df with percentage extraction
    const output = safeExec("df / 2>/dev/null | tail -1 | awk '{print $5}' | tr -d '%'");
    if (output) {
      const usage = parseInt(output);
      if (!isNaN(usage) && usage >= 0 && usage <= 100) {
        return usage;
      }
    }
    
    // Alternative: calculate from blocks
    const blocksOutput = safeExec("df / 2>/dev/null | tail -1 | awk '{print $3, $2}'");
    if (blocksOutput) {
      const [used, total] = blocksOutput.split(/\s+/).map(s => parseInt(s));
      if (!isNaN(used) && !isNaN(total) && total > 0) {
        return Math.round((used / total) * 100);
      }
    }
    
    return 50;
  } catch {
    return 50;
  }
}

function getTemperature(): number {
  try {
    // Try all thermal zones
    for (let zone = 0; zone <= 10; zone++) {
      const tempPath = `/sys/class/thermal/thermal_zone${zone}/temp`;
      if (fs.existsSync(tempPath)) {
        const temp = parseInt(fs.readFileSync(tempPath, "utf-8").trim());
        if (!isNaN(temp) && temp > 0) {
          return Math.round(temp / 1000);
        }
      }
    }
    
    // Try sensors command
    const sensorsOutput = safeExec("sensors 2>/dev/null | grep -E 'Core|temp' | head -1 | grep -oE '[0-9]+\\.[0-9]+' | head -1");
    if (sensorsOutput) {
      const temp = parseFloat(sensorsOutput);
      if (!isNaN(temp) && temp > 0 && temp < 150) {
        return Math.round(temp);
      }
    }
    
    // Try hwmon
    const hwmonOutput = safeExec("cat /sys/class/hwmon/hwmon*/temp*_input 2>/dev/null | head -1");
    if (hwmonOutput) {
      const temp = parseInt(hwmonOutput);
      if (!isNaN(temp) && temp > 0) {
        return Math.round(temp / 1000);
      }
    }
    
    // Default fallback for systems without thermal sensors
    return 45;
  } catch {
    return 45;
  }
}

function checkNetworkStatus(): "online" | "offline" {
  try {
    const result = safeExec("ping -c 1 -W 2 8.8.8.8 > /dev/null 2>&1 && echo online || echo offline");
    return result === "online" ? "online" : "offline";
  } catch {
    // Try alternative network check
    const altResult = safeExec("curl -s --connect-timeout 2 http://www.google.com > /dev/null && echo online || echo offline");
    return altResult === "online" ? "online" : "offline";
  }
}

function getServiceStatus(serviceName: string): "running" | "stopped" | "warning" {
  try {
    const result = safeExec(`systemctl is-active ${serviceName} 2>/dev/null`);
    if (result === "active") return "running";
    if (result === "inactive" || result === "dead") return "stopped";
    return "warning";
  } catch {
    return "stopped";
  }
}

function getServiceUptime(serviceName: string): string {
  try {
    const output = safeExec(`systemctl show ${serviceName} --property=ActiveEnterTimestamp 2>/dev/null`);
    if (output && output.includes("=")) {
      const timestamp = output.split("=")[1];
      if (timestamp) {
        const startTime = new Date(timestamp);
        const now = new Date();
        const diffMs = now.getTime() - startTime.getTime();
        const days = Math.floor(diffMs / 86400000);
        const hours = Math.floor((diffMs % 86400000) / 3600000);
        return `${days}d ${hours}h`;
      }
    }
    return "N/A";
  } catch {
    return "N/A";
  }
}

const serviceConfigs = [
  { name: "Nginx", service: "nginx", port: 80 },
  { name: "PostgreSQL", service: "postgresql", port: 5432 },
  { name: "Redis", service: "redis-server", port: 6379 },
  { name: "Docker", service: "docker" },
  { name: "SSH", service: "sshd", port: 22 },
  { name: "Firewall", service: "ufw" },
];

export function getSystemStatus(): SystemStatus {
  const services: ServiceStatus[] = serviceConfigs.map((config) => ({
    name: config.name,
    status: getServiceStatus(config.service),
    port: config.port,
    uptime: getServiceUptime(config.service),
  }));

  return {
    hostname: getHostname(),
    uptime: getUptime(),
    cpuUsage: getCpuUsage(),
    memoryUsage: getMemoryUsage(),
    diskUsage: getDiskUsage(),
    networkStatus: checkNetworkStatus(),
    temperature: getTemperature(),
    services,
    lastUpdate: new Date().toLocaleTimeString(),
  };
}
