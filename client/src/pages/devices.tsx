import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Server,
  Monitor,
  Laptop,
  Router,
  Smartphone,
  HardDrive,
  Wifi,
  WifiOff,
  Clock,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Device } from "@shared/schema";

const deviceFormSchema = z.object({
  name: z.string().min(1, "Device name is required"),
  ipAddress: z.string().regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Invalid IP address format"),
  macAddress: z.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/, "Invalid MAC address format").optional().or(z.literal("")),
  deviceType: z.string().min(1, "Device type is required"),
  os: z.string().optional(),
  description: z.string().optional(),
});

type DeviceFormData = z.infer<typeof deviceFormSchema>;

const deviceTypes = [
  { value: "server", label: "Server", icon: Server },
  { value: "workstation", label: "Workstation", icon: Monitor },
  { value: "laptop", label: "Laptop", icon: Laptop },
  { value: "router", label: "Router/Switch", icon: Router },
  { value: "mobile", label: "Mobile Device", icon: Smartphone },
  { value: "storage", label: "Storage/NAS", icon: HardDrive },
  { value: "other", label: "Other", icon: Server },
];

function getDeviceIcon(type: string) {
  const deviceType = deviceTypes.find(d => d.value === type);
  return deviceType?.icon || Server;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "online") {
    return (
      <Badge variant="outline" className="bg-primary/20 text-primary border-primary/30 gap-1">
        <Wifi className="w-3 h-3" />
        Online
      </Badge>
    );
  }
  if (status === "offline") {
    return (
      <Badge variant="outline" className="bg-destructive/20 text-destructive border-destructive/30 gap-1">
        <WifiOff className="w-3 h-3" />
        Offline
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-muted text-muted-foreground gap-1">
      <Clock className="w-3 h-3" />
      Unknown
    </Badge>
  );
}

function DeviceCard({ 
  device, 
  isAdmin, 
  onEdit, 
  onDelete 
}: { 
  device: Device; 
  isAdmin: boolean; 
  onEdit: (device: Device) => void; 
  onDelete: (device: Device) => void;
}) {
  const Icon = getDeviceIcon(device.deviceType);
  
  return (
    <Card className="border-card-border hover-elevate" data-testid={`card-device-${device.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-md ${device.status === "online" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold" data-testid={`text-device-name-${device.id}`}>{device.name}</h3>
              <p className="text-xs text-muted-foreground font-mono" data-testid={`text-device-ip-${device.id}`}>{device.ipAddress}</p>
            </div>
          </div>
          <StatusBadge status={device.status} />
        </div>
        
        <div className="space-y-2 text-sm mb-4">
          {device.macAddress && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">MAC:</span>
              <span className="font-mono text-xs">{device.macAddress}</span>
            </div>
          )}
          {device.os && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">OS:</span>
              <span>{device.os}</span>
            </div>
          )}
          {device.description && (
            <p className="text-muted-foreground text-xs mt-2">{device.description}</p>
          )}
        </div>
        
        <div className="flex items-center justify-between gap-2 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {device.lastSeenAt ? (
              <span>Last seen: {new Date(device.lastSeenAt).toLocaleString()}</span>
            ) : (
              <span>Never checked</span>
            )}
          </div>
          
          {isAdmin && (
            <div className="flex items-center gap-1">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onEdit(device)}
                data-testid={`button-edit-device-${device.id}`}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => onDelete(device)}
                data-testid={`button-delete-device-${device.id}`}
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Devices() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<Device | null>(null);

  const { data: authStatus } = useQuery<{ authenticated: boolean; user?: { role: string } }>({
    queryKey: ["/api/auth/status"],
  });

  const isAdmin = authStatus?.user?.role === "admin";

  const { data: devices, isLoading } = useQuery<Device[]>({
    queryKey: ["/api/devices"],
    refetchInterval: 30000,
  });

  const form = useForm<DeviceFormData>({
    resolver: zodResolver(deviceFormSchema),
    defaultValues: {
      name: "",
      ipAddress: "",
      macAddress: "",
      deviceType: "server",
      os: "",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: DeviceFormData) => {
      return await apiRequest("POST", "/api/devices", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setIsFormOpen(false);
      form.reset();
      toast({
        title: "Device Added",
        description: "The device has been added to your network map.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to add device. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: DeviceFormData }) => {
      return await apiRequest("PATCH", `/api/devices/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setIsFormOpen(false);
      setEditingDevice(null);
      form.reset();
      toast({
        title: "Device Updated",
        description: "The device has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update device. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/devices/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/devices"] });
      setDeletingDevice(null);
      toast({
        title: "Device Deleted",
        description: "The device has been removed from your network map.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete device. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddDevice = () => {
    setEditingDevice(null);
    form.reset({
      name: "",
      ipAddress: "",
      macAddress: "",
      deviceType: "server",
      os: "",
      description: "",
    });
    setIsFormOpen(true);
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    form.reset({
      name: device.name,
      ipAddress: device.ipAddress,
      macAddress: device.macAddress || "",
      deviceType: device.deviceType,
      os: device.os || "",
      description: device.description || "",
    });
    setIsFormOpen(true);
  };

  const handleDeleteDevice = (device: Device) => {
    setDeletingDevice(device);
  };

  const onSubmit = (data: DeviceFormData) => {
    if (editingDevice) {
      updateMutation.mutate({ id: editingDevice.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const onlineCount = devices?.filter(d => d.status === "online").length || 0;
  const offlineCount = devices?.filter(d => d.status === "offline").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setLocation("/dashboard")}
              data-testid="button-back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="p-2 rounded-md bg-primary/10 glow-primary-sm">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wide">NETWORK DEVICES</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {devices?.length || 0} devices mapped
              </p>
            </div>
          </div>

          {isAdmin && (
            <Button onClick={handleAddDevice} className="gap-2" data-testid="button-add-device">
              <Plus className="w-4 h-4" />
              Add Device
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center gap-4 mb-6">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
            {onlineCount} Online
          </Badge>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
            {offlineCount} Offline
          </Badge>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground">Loading devices...</p>
          </div>
        ) : devices?.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-8 text-center">
              <Server className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No Devices Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start mapping your home lab by adding your first device.
              </p>
              {isAdmin && (
                <Button onClick={handleAddDevice} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Device
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {devices?.map((device) => (
              <DeviceCard
                key={device.id}
                device={device}
                isAdmin={isAdmin}
                onEdit={handleEditDevice}
                onDelete={handleDeleteDevice}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingDevice ? "Edit Device" : "Add New Device"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Media Server" {...field} data-testid="input-device-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="ipAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Address</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 192.168.8.10" {...field} data-testid="input-device-ip" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="macAddress"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>MAC Address (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., AA:BB:CC:DD:EE:FF" {...field} data-testid="input-device-mac" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="deviceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-device-type">
                          <SelectValue placeholder="Select device type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {deviceTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="os"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Operating System (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Ubuntu 24.04 LTS" {...field} data-testid="input-device-os" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description / Function (optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="e.g., Runs Plex, Jellyfin, and Sonarr for media management" 
                        className="resize-none"
                        {...field} 
                        data-testid="input-device-description" 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsFormOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={createMutation.isPending || updateMutation.isPending}
                  data-testid="button-save-device"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Device"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingDevice} onOpenChange={() => setDeletingDevice(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Device</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDevice?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingDevice && deleteMutation.mutate(deletingDevice.id)}
              className="bg-destructive text-destructive-foreground"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
