import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, Eye, EyeOff, Copy, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  getSecrets, 
  createSecret, 
  deleteSecret, 
  revealSecret,
  type SecretResponse 
} from "@/lib/api-client";

export default function SecretsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [secrets, setSecrets] = useState<SecretResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSecretName, setNewSecretName] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");
  const [visibleSecrets, setVisibleSecrets] = useState<Set<number>>(new Set());
  const [revealedValues, setRevealedValues] = useState<Map<number, string>>(new Map());
  const [copiedSecret, setCopiedSecret] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loadingReveal, setLoadingReveal] = useState<Set<number>>(new Set());
  const isFetchingSecretsRef = useRef(false);

  useEffect(() => {
    if (user) {
      fetchSecrets();
    }
  }, [user]);

  const fetchSecrets = async () => {
    // Prevent duplicate calls
    if (isFetchingSecretsRef.current) {
      return;
    }

    try {
      isFetchingSecretsRef.current = true;
      const data = await getSecrets();
      setSecrets(data || []);
    } catch (error: any) {
      toast({
        title: "Error fetching secrets",
        description: error.message || "Failed to fetch secrets",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      isFetchingSecretsRef.current = false;
    }
  };

  const handleAddSecret = async () => {
    if (!newSecretName.trim() || !newSecretValue.trim()) {
      toast({
        title: "Error",
        description: "Please provide both name and value for the secret.",
        variant: "destructive",
      });
      return;
    }

    // Check if secret name already exists
    if (secrets.some(s => s.name === newSecretName.trim())) {
      toast({
        title: "Error",
        description: "A secret with this name already exists.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await createSecret({
        name: newSecretName.trim(),
        value: newSecretValue.trim(),
      });

      await fetchSecrets();
      setNewSecretName("");
      setNewSecretValue("");
      setIsAddDialogOpen(false);

      toast({
        title: "Secret added",
        description: `Use \${${newSecretName.trim()}} in your test scenarios to reference this secret.`,
      });
    } catch (error: any) {
      toast({
        title: "Error adding secret",
        description: error.message || "Failed to add secret",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSecret = async (id: number, name: string) => {
    try {
      await deleteSecret(id);

      await fetchSecrets();
      // Clean up revealed values
      const newRevealed = new Map(revealedValues);
      newRevealed.delete(id);
      setRevealedValues(newRevealed);
      
      toast({
        title: "Secret deleted",
        description: `${name} has been removed.`,
      });
    } catch (error: any) {
      toast({
        title: "Error deleting secret",
        description: error.message || "Failed to delete secret",
        variant: "destructive",
      });
    }
  };

  const toggleSecretVisibility = async (id: number) => {
    const isVisible = visibleSecrets.has(id);
    
    if (isVisible) {
      // Hide the secret
      const newVisible = new Set(visibleSecrets);
      newVisible.delete(id);
      setVisibleSecrets(newVisible);
    } else {
      // Show the secret - need to reveal it if not already revealed
      if (!revealedValues.has(id)) {
        setLoadingReveal(prev => new Set(prev).add(id));
        try {
          const response = await revealSecret(id);
          setRevealedValues(prev => new Map(prev).set(id, response.value));
          const newVisible = new Set(visibleSecrets);
          newVisible.add(id);
          setVisibleSecrets(newVisible);
        } catch (error: any) {
          toast({
            title: "Error revealing secret",
            description: error.message || "Failed to reveal secret",
            variant: "destructive",
          });
        } finally {
          setLoadingReveal(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
          });
        }
      } else {
        const newVisible = new Set(visibleSecrets);
        newVisible.add(id);
        setVisibleSecrets(newVisible);
      }
    }
  };

  const copySecretSyntax = (name: string, id: number) => {
    navigator.clipboard.writeText(`\${${name}}`);
    setCopiedSecret(id);
    setTimeout(() => setCopiedSecret(null), 2000);
    toast({
      title: "Copied!",
      description: `\${${name}} copied to clipboard.`,
    });
  };

  const getDisplayValue = (secret: SecretResponse): string => {
    if (visibleSecrets.has(secret.id)) {
      return revealedValues.get(secret.id) || secret.value_masked;
    }
    return secret.value_masked;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Secrets & Variables</h2>
          <p className="text-muted-foreground mt-1">
            Manage credentials and variables for your test scenarios
          </p>
        </div>
        <Button onClick={() => setIsAddDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Add Secret
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base">How to use secrets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Reference secrets in your test scenarios using the syntax: <code className="bg-muted px-2 py-0.5 rounded text-primary font-mono">${`{secret_name}`}</code>
          </p>
          <p className="text-sm text-muted-foreground">
            Example: "Login with username <code className="bg-muted px-2 py-0.5 rounded text-primary font-mono">${`{username}`}</code> and password <code className="bg-muted px-2 py-0.5 rounded text-primary font-mono">${`{password}`}</code>"
          </p>
        </CardContent>
      </Card>

      {/* Secrets Table */}
      <Card>
        <CardHeader>
          <CardTitle>Your Secrets</CardTitle>
          <CardDescription>
            {secrets.length} secret{secrets.length !== 1 ? "s" : ""} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {secrets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No secrets configured yet</p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Secret
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-muted-foreground">
                    <th className="text-left py-3 px-2 font-medium">Name</th>
                    <th className="text-left py-3 px-2 font-medium">Value</th>
                    <th className="text-left py-3 px-2 font-medium">Usage Syntax</th>
                    <th className="text-left py-3 px-2 font-medium">Created</th>
                    <th className="text-right py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {secrets.map((secret) => (
                    <tr 
                      key={secret.id}
                      className="border-b last:border-0 hover:bg-accent/50 transition-colors"
                    >
                      <td className="py-4 px-2 font-medium font-mono">
                        {secret.name}
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <code className="text-sm">
                            {getDisplayValue(secret)}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => toggleSecretVisibility(secret.id)}
                            disabled={loadingReveal.has(secret.id)}
                          >
                            {loadingReveal.has(secret.id) ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : visibleSecrets.has(secret.id) ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="py-4 px-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono">
                            ${`{${secret.name}}`}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => copySecretSyntax(secret.name, secret.id)}
                          >
                            {copiedSecret === secret.id ? (
                              <Check className="h-3 w-3 text-green-500" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-muted-foreground text-sm">
                        {new Date(secret.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-4 px-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteSecret(secret.id, secret.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Secret Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Secret</DialogTitle>
            <DialogDescription>
              Create a new secret or variable that can be referenced in your test scenarios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="secret-name">Name</Label>
              <Input
                id="secret-name"
                placeholder="e.g., username, api_key, password"
                value={newSecretName}
                onChange={(e) => setNewSecretName(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Use lowercase letters, numbers, and underscores only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="secret-value">Value</Label>
              <Input
                id="secret-value"
                type="password"
                placeholder="Enter the secret value"
                value={newSecretValue}
                onChange={(e) => setNewSecretValue(e.target.value)}
              />
            </div>
            {newSecretName && (
              <div className="rounded-lg bg-muted p-3">
                <p className="text-sm text-muted-foreground">
                  Usage in test scenarios:
                </p>
                <code className="text-sm font-mono text-primary">
                  ${`{${newSecretName}}`}
                </code>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddSecret} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Secret
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

