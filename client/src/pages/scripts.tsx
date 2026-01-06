import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Shield,
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Copy,
  Check,
  FileCode,
  Terminal,
  Lock,
  Server,
  Search,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import type { Script } from "@shared/schema";

const scriptFormSchema = z.object({
  name: z.string().min(1, "Script name is required"),
  content: z.string().min(1, "Script content is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().optional(),
});

type ScriptFormData = z.infer<typeof scriptFormSchema>;

const categories = [
  { value: "security", label: "Security", icon: Lock },
  { value: "networking", label: "Networking", icon: Server },
  { value: "automation", label: "Automation", icon: Terminal },
  { value: "backup", label: "Backup", icon: FolderOpen },
  { value: "monitoring", label: "Monitoring", icon: Search },
  { value: "general", label: "General", icon: FileCode },
];

function getCategoryIcon(category: string) {
  const cat = categories.find(c => c.value === category);
  return cat?.icon || FileCode;
}

function getCategoryLabel(category: string) {
  const cat = categories.find(c => c.value === category);
  return cat?.label || category;
}

function ScriptCard({
  script,
  isAdmin,
  onEdit,
  onDelete,
}: {
  script: Script;
  isAdmin: boolean;
  onEdit: (script: Script) => void;
  onDelete: (script: Script) => void;
}) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const Icon = getCategoryIcon(script.category);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(script.content);
      setCopied(true);
      toast({
        title: "Copied",
        description: "Script copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Error",
        description: "Failed to copy script",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="border-card-border" data-testid={`card-script-${script.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Icon className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base" data-testid={`text-script-name-${script.id}`}>
                {script.name}
              </CardTitle>
              <Badge variant="outline" className="mt-1 text-xs">
                {getCategoryLabel(script.category)}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              data-testid={`button-copy-script-${script.id}`}
            >
              {copied ? (
                <Check className="w-4 h-4 text-primary" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(script)}
                  data-testid={`button-edit-script-${script.id}`}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(script)}
                  data-testid={`button-delete-script-${script.id}`}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {script.description && (
          <p className="text-sm text-muted-foreground mb-3">{script.description}</p>
        )}
        <div className="bg-background/50 rounded-md p-3 border border-border font-mono text-xs overflow-x-auto max-h-48 overflow-y-auto">
          <pre className="whitespace-pre-wrap break-all">{script.content}</pre>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
          <span>
            Updated: {script.updatedAt ? new Date(script.updatedAt).toLocaleDateString() : "N/A"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Scripts() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [deletingScript, setDeletingScript] = useState<Script | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const { data: authStatus } = useQuery<{ authenticated: boolean; user?: { role: string } }>({
    queryKey: ["/api/auth/status"],
  });

  const isAdmin = authStatus?.user?.role === "admin";

  const { data: scripts, isLoading } = useQuery<Script[]>({
    queryKey: ["/api/scripts"],
  });

  const form = useForm<ScriptFormData>({
    resolver: zodResolver(scriptFormSchema),
    defaultValues: {
      name: "",
      content: "",
      category: "general",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ScriptFormData) => {
      return await apiRequest("POST", "/api/scripts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      setIsFormOpen(false);
      form.reset();
      toast({
        title: "Script Added",
        description: "Your script has been saved.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save script. Please try again.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ScriptFormData }) => {
      return await apiRequest("PATCH", `/api/scripts/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      setIsFormOpen(false);
      setEditingScript(null);
      form.reset();
      toast({
        title: "Script Updated",
        description: "Your script has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update script. Please try again.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/scripts/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/scripts"] });
      setDeletingScript(null);
      toast({
        title: "Script Deleted",
        description: "The script has been removed.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete script. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleAddScript = () => {
    setEditingScript(null);
    form.reset({
      name: "",
      content: "",
      category: "general",
      description: "",
    });
    setIsFormOpen(true);
  };

  const handleEditScript = (script: Script) => {
    setEditingScript(script);
    form.reset({
      name: script.name,
      content: script.content,
      category: script.category,
      description: script.description || "",
    });
    setIsFormOpen(true);
  };

  const handleDeleteScript = (script: Script) => {
    setDeletingScript(script);
  };

  const onSubmit = (data: ScriptFormData) => {
    if (editingScript) {
      updateMutation.mutate({ id: editingScript.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredScripts = scripts?.filter((script) => {
    const matchesSearch =
      script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      script.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      script.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === "all" || script.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

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
              <h1 className="text-lg font-bold tracking-wide">SCRIPTS</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {scripts?.length || 0} scripts stored
              </p>
            </div>
          </div>

          {isAdmin && (
            <Button onClick={handleAddScript} className="gap-2" data-testid="button-add-script">
              <Plus className="w-4 h-4" />
              Add Script
            </Button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search scripts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-scripts"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-48" data-testid="select-filter-category">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center min-h-[300px]">
            <p className="text-muted-foreground">Loading scripts...</p>
          </div>
        ) : filteredScripts?.length === 0 ? (
          <Card className="border-card-border">
            <CardContent className="p-8 text-center">
              <FileCode className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">
                {scripts?.length === 0 ? "No Scripts Yet" : "No Matching Scripts"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {scripts?.length === 0
                  ? "Start building your script library by adding your first script."
                  : "Try adjusting your search or filter."}
              </p>
              {isAdmin && scripts?.length === 0 && (
                <Button onClick={handleAddScript} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add Your First Script
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {filteredScripts?.map((script) => (
              <ScriptCard
                key={script.id}
                script={script}
                isAdmin={isAdmin}
                onEdit={handleEditScript}
                onDelete={handleDeleteScript}
              />
            ))}
          </div>
        )}
      </main>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingScript ? "Edit Script" : "Add New Script"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Script Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Backup MySQL" {...field} data-testid="input-script-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-script-category">
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Brief description of what this script does"
                        {...field}
                        data-testid="input-script-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Script Content</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="#!/bin/bash&#10;# Your script here..."
                        className="font-mono text-sm min-h-[200px] resize-y"
                        {...field}
                        data-testid="input-script-content"
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
                  data-testid="button-save-script"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : "Save Script"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingScript} onOpenChange={() => setDeletingScript(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Script</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingScript?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingScript && deleteMutation.mutate(deletingScript.id)}
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
