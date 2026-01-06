import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Shield, User, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [systemStatus] = useState<"online" | "offline">("online");
  const [encryptionStatus] = useState<"active" | "inactive">("active");

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Authentication Successful",
        description: "Welcome to Wasteland Companion",
      });
      setLocation("/dashboard");
    },
    onError: (error: Error) => {
      toast({
        title: "Authentication Failed",
        description: error.message || "Invalid credentials",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {/* Subtle grid background pattern */}
      <div 
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(hsl(155 100% 45% / 0.1) 1px, transparent 1px),
            linear-gradient(90deg, hsl(155 100% 45% / 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
        }}
      />
      
      {/* Login Card */}
      <div className="w-full max-w-md relative">
        <div className="bg-card border border-card-border rounded-lg p-8 relative overflow-visible">
          {/* Glow effect behind card */}
          <div className="absolute -inset-1 bg-primary/5 rounded-lg blur-xl -z-10" />
          
          {/* Shield Icon */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-full border-2 border-primary flex items-center justify-center glow-primary-sm">
                <Shield className="w-8 h-8 text-primary" />
              </div>
              {/* Subtle pulse animation */}
              <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" style={{ animationDuration: '3s' }} />
            </div>
          </div>

          {/* Title */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold tracking-wider text-foreground mb-2">
              WASTELAND COMPANION
            </h1>
            <p className="text-xs tracking-widest text-muted-foreground uppercase">
              Secure Login // Authorization Required
            </p>
          </div>

          {/* Login Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="text"
                          placeholder="Username"
                          className="pl-12 h-12 bg-background border-border focus:border-primary focus:ring-1 focus:ring-primary/50 rounded-md font-mono text-sm"
                          data-testid="input-username"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          {...field}
                          type="password"
                          placeholder="Password"
                          className="pl-12 h-12 bg-background border-border focus:border-primary focus:ring-1 focus:ring-primary/50 rounded-md font-mono text-sm"
                          data-testid="input-password"
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full h-12 text-sm font-bold tracking-widest uppercase glow-primary-sm"
                disabled={loginMutation.isPending}
                data-testid="button-authenticate"
              >
                {loginMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  "Authenticate"
                )}
              </Button>
            </form>
          </Form>

          {/* Status Indicators */}
          <div className="mt-8 text-center space-y-1">
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="text-muted-foreground">System Status:</span>
              <span 
                className={`font-mono font-semibold uppercase ${
                  systemStatus === "online" ? "text-primary text-glow" : "text-destructive"
                }`}
                data-testid="status-system"
              >
                {systemStatus}
              </span>
            </div>
            <div className="flex items-center justify-center gap-2 text-xs">
              <span className="text-muted-foreground">Encryption:</span>
              <span 
                className={`font-mono font-semibold uppercase ${
                  encryptionStatus === "active" ? "text-primary text-glow" : "text-destructive"
                }`}
                data-testid="status-encryption"
              >
                {encryptionStatus}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
