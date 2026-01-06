import { execSync } from "child_process";
import { storage } from "./storage";

const MONITOR_INTERVAL = 60000; // Check every 60 seconds
let monitorInterval: NodeJS.Timeout | null = null;

function pingDevice(ipAddress: string): boolean {
  try {
    execSync(`ping -c 1 -W 2 ${ipAddress}`, { 
      encoding: "utf-8", 
      timeout: 5000,
      stdio: "pipe"
    });
    return true;
  } catch {
    return false;
  }
}

async function checkAllDevices(): Promise<void> {
  try {
    const devices = await storage.getAllDevices();
    
    for (const device of devices) {
      const isOnline = pingDevice(device.ipAddress);
      const status = isOnline ? "online" : "offline";
      const lastSeenAt = isOnline ? new Date() : undefined;
      
      await storage.updateDeviceStatus(device.id, status, lastSeenAt);
    }
  } catch (error) {
    console.error("Device monitor error:", error);
  }
}

export function startDeviceMonitor(): void {
  if (monitorInterval) {
    return;
  }
  
  console.log("Starting device monitor (checking every 60 seconds)...");
  
  checkAllDevices();
  
  monitorInterval = setInterval(checkAllDevices, MONITOR_INTERVAL);
}

export function stopDeviceMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
    console.log("Device monitor stopped");
  }
}
