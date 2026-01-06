import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Shield,
  Users,
  Plus,
  Trash2,
  Key,
  ArrowLeft,
  Loader2,
  User,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface UserData {
  id: string;
  username: string;
}

const createUserSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

const changePasswordSchema = z.object({
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type CreateUserFormData = z.infer<typeof createUserSchema>;
type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

function CreateUserDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateUserFormData) => {
      const response = await apiRequest("POST", "/api/users", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Created",
        description: "New user account has been created successfully.",
      });
      form.reset();
      setOpen(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateUserFormData) => {
    createMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" data-testid="button-add-user">
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-card-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Create New User
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        placeholder="Enter username"
                        className="pl-10 bg-background"
                        data-testid="input-new-username"
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
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter password"
                        className="pl-10 bg-background"
                        data-testid="input-new-password"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-create-user">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordDialog({ user, onSuccess }: { user: UserData; onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const form = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const response = await apiRequest("PATCH", `/api/users/${user.id}/password`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Password Updated",
        description: `Password for ${user.username} has been changed.`,
      });
      form.reset();
      setOpen(false);
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update password",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordFormData) => {
    updateMutation.mutate({ password: data.password });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" data-testid={`button-change-password-${user.id}`}>
          <Key className="w-4 h-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-card-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary" />
            Change Password for {user.username}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type="password"
                        placeholder="Enter new password"
                        className="pl-10 bg-background"
                        data-testid="input-change-password"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        {...field}
                        type="password"
                        placeholder="Confirm new password"
                        className="pl-10 bg-background"
                        data-testid="input-confirm-password"
                      />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={updateMutation.isPending} data-testid="button-save-password">
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Password"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteUserDialog({ user, onSuccess }: { user: UserData; onSuccess: () => void }) {
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("DELETE", `/api/users/${user.id}`);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "User Deleted",
        description: `User ${user.username} has been removed.`,
      });
      onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete user",
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive" data-testid={`button-delete-user-${user.id}`}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-card border-card-border">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete User
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete <strong>{user.username}</strong>? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => deleteMutation.mutate()}
            className="bg-destructive text-destructive-foreground"
            data-testid="button-confirm-delete"
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete User"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UserRow({ user, currentUserId, onRefresh }: { user: UserData; currentUserId: string; onRefresh: () => void }) {
  const isCurrentUser = user.id === currentUserId;

  return (
    <div className="flex items-center justify-between py-3 px-4 rounded-md bg-background/50 hover-elevate">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-md bg-muted">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <div className="font-medium text-sm flex items-center gap-2">
            {user.username}
            {isCurrentUser && (
              <span className="text-xs text-primary font-mono">(you)</span>
            )}
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            ID: {user.id.slice(0, 8)}...
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <ChangePasswordDialog user={user} onSuccess={onRefresh} />
        {!isCurrentUser && (
          <DeleteUserDialog user={user} onSuccess={onRefresh} />
        )}
      </div>
    </div>
  );
}

export default function Settings() {
  const [, setLocation] = useLocation();

  const { data: authStatus, isLoading: authLoading } = useQuery<{ authenticated: boolean; user?: { id: string; username: string } }>({
    queryKey: ["/api/auth/status"],
  });

  const { data: users, isLoading, error, refetch } = useQuery<UserData[]>({
    queryKey: ["/api/users"],
    enabled: authStatus?.authenticated === true,
    retry: false,
  });

  // Redirect to login if not authenticated
  if (!authLoading && authStatus?.authenticated === false) {
    setLocation("/");
    return null;
  }

  // Handle API errors (401)
  if (error) {
    const errorMessage = (error as Error).message;
    if (errorMessage.includes("401") || errorMessage.includes("Authentication")) {
      setLocation("/");
      return null;
    }
  }

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-card/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
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
              <h1 className="text-lg font-bold tracking-wide">Settings</h1>
              <p className="text-xs text-muted-foreground font-mono">
                User Management
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        <Card className="border-card-border">
          <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              User Accounts
            </CardTitle>
            <CreateUserDialog onSuccess={handleRefresh} />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertTriangle className="w-8 h-8 text-destructive mx-auto mb-4" />
                <p className="text-muted-foreground">Failed to load users</p>
                <Button variant="outline" className="mt-4" onClick={() => refetch()}>
                  Try Again
                </Button>
              </div>
            ) : users && users.length > 0 ? (
              <div className="space-y-2">
                {users.map((user) => (
                  <UserRow
                    key={user.id}
                    user={user}
                    currentUserId={authStatus?.user?.id || ""}
                    onRefresh={handleRefresh}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No users found
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
