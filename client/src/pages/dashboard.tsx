import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  Server,
  Cpu,
  HardDrive,
  Activity,
  Wifi,
  Power,
  Settings,
  LogOut,
  RefreshCw,
  Clock,
  Terminal,
  Database,
  Globe,
  Lock,
  Thermometer,
  MemoryStick,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

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

interface ServiceStatus {
  name: string;
  status: "running" | "stopped" | "warning";
  port?: number;
  uptime?: string;
}

function StatusBadge({ status }: { status: "running" | "stopped" | "warning" | "online" | "offline" }) {
  const variants: Record<string, { className: string; label: string }> = {
    running: { className: "bg-primary/20 text-primary border-primary/30", label: "Running" },
    online: { className: "bg-primary/20 text-primary border-primary/30", label: "Online" },
    stopped: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Stopped" },
    offline: { className: "bg-destructive/20 text-destructive border-destructive/30", label: "Offline" },
    warning: { className: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30", label: "Warning" },
  };

  const variant = variants[status] || variants.stopped;

  return (
    <Badge variant="outline" className={`${variant.className} font-mono text-xs uppercase`}>
      {variant.label}
    </Badge>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value,
  unit,
  percentage,
  status,
}: {
  icon: typeof Cpu;
  title: string;
  value: string | number;
  unit?: string;
  percentage?: number;
  status?: "good" | "warning" | "critical";
}) {
  const getStatusColor = () => {
    switch (status) {
      case "critical": return "text-destructive";
      case "warning": return "text-yellow-500";
      default: return "text-primary";
    }
  };

  const getProgressColor = () => {
    if (!percentage) return "bg-primary";
    if (percentage > 90) return "bg-destructive";
    if (percentage > 70) return "bg-yellow-500";
    return "bg-primary";
  };

  return (
    <Card className="border-card-border">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-md bg-primary/10 ${getStatusColor()}`}>
            <Icon className="w-4 h-4" />
          </div>
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <div className="flex items-baseline gap-1 mb-2">
          <span className={`text-2xl font-mono font-bold ${getStatusColor()}`}>
            {value}
          </span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {percentage !== undefined && (
          <Progress 
            value={percentage} 
            className="h-1.5"
            style={{ 
              "--progress-color": getProgressColor() 
            } as React.CSSProperties}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ServiceRow({ service }: { service: ServiceStatus }) {
  const getIcon = (name: string) => {
    const icons: Record<string, typeof Server> = {
      nginx: Globe,
      postgresql: Database,
      redis: Database,
      docker: Server,
      ssh: Terminal,
      firewall: Lock,
    };
    return icons[name.toLowerCase()] || Server;
  };

  const Icon = getIcon(service.name);

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-md bg-background/50 hover-elevate">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-muted">
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <div className="font-medium text-sm">{service.name}</div>
          {service.port && (
            <div className="text-xs text-muted-foreground font-mono">
              Port: {service.port}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {service.uptime && (
          <span className="text-xs text-muted-foreground font-mono">
            {service.uptime}
          </span>
        )}
        <StatusBadge status={service.status} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: systemStatus, isLoading, refetch, isRefetching } = useQuery<SystemStatus>({
    queryKey: ["/api/system/status"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSuccess: () => {
      queryClient.clear();
      setLocation("/");
    },
  });

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshing",
      description: "Fetching latest system status...",
    });
  };

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Calculate status levels
  const getCpuStatus = (usage: number): "good" | "warning" | "critical" => {
    if (usage > 90) return "critical";
    if (usage > 70) return "warning";
    return "good";
  };

  const getMemoryStatus = (usage: number): "good" | "warning" | "critical" => {
    if (usage > 90) return "critical";
    if (usage > 80) return "warning";
    return "good";
  };

  const getDiskStatus = (usage: number): "good" | "warning" | "critical" => {
    if (usage > 95) return "critical";
    if (usage > 85) return "warning";
    return "good";
  };

  const getTempStatus = (temp: number): "good" | "warning" | "critical" => {
    if (temp > 80) return "critical";
    if (temp > 65) return "warning";
    return "good";
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 glow-primary-sm">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">HOME LAB COMPANION</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {systemStatus?.hostname || "lab-server"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mr-4">
              <Clock className="w-3 h-3" />
              <span className="font-mono">
                {currentTime.toLocaleTimeString()}
              </span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefetching}
              data-testid="button-refresh"
            >
              <RefreshCw className={`w-4 h-4 ${isRefetching ? "animate-spin" : ""}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/settings")}
              data-testid="button-settings"
            >
              <Settings className="w-4 h-4" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading system status...</p>
            </div>
          </div>
        ) : (
          <>
            {/* System Overview */}
            <section className="mb-8">
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold">System Overview</h2>
                <div className="flex items-center gap-2">
                  <StatusBadge status={systemStatus?.networkStatus || "online"} />
                  <span className="text-xs text-muted-foreground font-mono">
                    Uptime: {systemStatus?.uptime || "0d 0h"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard
                  icon={Cpu}
                  title="CPU Usage"
                  value={systemStatus?.cpuUsage || 0}
                  unit="%"
                  percentage={systemStatus?.cpuUsage || 0}
                  status={getCpuStatus(systemStatus?.cpuUsage || 0)}
                />
                <MetricCard
                  icon={MemoryStick}
                  title="Memory"
                  value={systemStatus?.memoryUsage || 0}
                  unit="%"
                  percentage={systemStatus?.memoryUsage || 0}
                  status={getMemoryStatus(systemStatus?.memoryUsage || 0)}
                />
                <MetricCard
                  icon={HardDrive}
                  title="Disk Usage"
                  value={systemStatus?.diskUsage || 0}
                  unit="%"
                  percentage={systemStatus?.diskUsage || 0}
                  status={getDiskStatus(systemStatus?.diskUsage || 0)}
                />
                <MetricCard
                  icon={Thermometer}
                  title="Temperature"
                  value={systemStatus?.temperature || 0}
                  unit="°C"
                  percentage={(systemStatus?.temperature || 0) / 100 * 100}
                  status={getTempStatus(systemStatus?.temperature || 0)}
                />
              </div>
            </section>

            {/* Quick Actions */}
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" className="gap-2" data-testid="button-terminal">
                  <Terminal className="w-4 h-4" />
                  Terminal
                </Button>
                <Button variant="outline" className="gap-2" data-testid="button-network">
                  <Wifi className="w-4 h-4" />
                  Network
                </Button>
                <Button variant="outline" className="gap-2" data-testid="button-power">
                  <Power className="w-4 h-4" />
                  Power Options
                </Button>
                <Button variant="outline" className="gap-2" data-testid="button-activity">
                  <Activity className="w-4 h-4" />
                  Activity Log
                </Button>
              </div>
            </section>

            {/* Services */}
            <section>
              <div className="flex items-center justify-between gap-4 mb-4">
                <h2 className="text-lg font-semibold">Services</h2>
                <span className="text-xs text-muted-foreground">
                  {systemStatus?.services?.filter(s => s.status === "running").length || 0} / {systemStatus?.services?.length || 0} running
                </span>
              </div>

              <Card className="border-card-border">
                <CardContent className="p-2">
                  <div className="space-y-2">
                    {systemStatus?.services?.map((service, index) => (
                      <ServiceRow key={service.name + index} service={service} />
                    )) || (
                      <div className="py-8 text-center text-muted-foreground">
                        No services configured
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </section>

            {/* Footer */}
            <footer className="mt-12 pt-6 border-t border-border">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Lock className="w-3 h-3 text-primary" />
                  <span>Encryption: Active</span>
                </div>
                <div className="font-mono">
                  Last update: {systemStatus?.lastUpdate || new Date().toLocaleTimeString()}
                </div>
              </div>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
