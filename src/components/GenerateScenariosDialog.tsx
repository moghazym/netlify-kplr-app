import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, Check } from "lucide-react";
import { generateScenarios } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";

interface GenerateScenariosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (scenarios: Array<{ id: string; name: string; description: string }>) => void;
  suiteName: string;
  description: string;
  url?: string | null;
  aiInstructions?: string | null;
}

export function GenerateScenariosDialog({
  open,
  onOpenChange,
  onApply,
  suiteName,
  description,
  url,
  aiInstructions,
}: GenerateScenariosDialogProps) {
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);
  const [scenarios, setScenarios] = useState<string[]>([]);
  const [selectedScenarios, setSelectedScenarios] = useState<Set<number>>(new Set());

  const handleGenerate = async () => {
    if (!suiteName.trim() || !description.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a test suite name and description",
        variant: "destructive",
      });
      return;
    }

    setGenerating(true);
    setScenarios([]);
    setSelectedScenarios(new Set());

    try {
      const response = await generateScenarios({
        test_suite_name: suiteName,
        application_url: url || "",
        test_description: description,
        ai_testing_instructions: aiInstructions || undefined,
      });

      setScenarios(response.scenarios);
      // Select all scenarios by default
      setSelectedScenarios(new Set(response.scenarios.map((_, index) => index)));
    } catch (error) {
      console.error("Error generating scenarios:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate scenarios",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const toggleScenario = (index: number) => {
    const newSelected = new Set(selectedScenarios);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedScenarios(newSelected);
  };

  const handleApply = () => {
    const selected = Array.from(selectedScenarios)
      .sort((a, b) => a - b)
      .map((index) => ({
        id: `scenario-${index}`,
        name: scenarios[index],
        description: scenarios[index],
      }));

    onApply(selected);
    onOpenChange(false);
    // Reset state
    setScenarios([]);
    setSelectedScenarios(new Set());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Generate Test Scenarios
          </DialogTitle>
          <DialogDescription>
            AI will generate test scenarios based on your test suite description
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {scenarios.length === 0 && !generating && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                Click the button below to generate test scenarios using AI
              </p>
              <Button onClick={handleGenerate} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Scenarios
              </Button>
            </div>
          )}

          {generating && (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-muted-foreground">Generating scenarios...</p>
            </div>
          )}

          {scenarios.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {selectedScenarios.size} of {scenarios.length} scenarios selected
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedScenarios(new Set(scenarios.map((_, i) => i)));
                    }}
                  >
                    Select All
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedScenarios(new Set());
                    }}
                  >
                    Deselect All
                  </Button>
                </div>
              </div>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {scenarios.map((scenario, index) => (
                  <Card
                    key={index}
                    className={`p-4 cursor-pointer transition-colors ${
                      selectedScenarios.has(index)
                        ? "border-primary bg-primary/5"
                        : "hover:bg-muted/50"
                    }`}
                    onClick={() => toggleScenario(index)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 flex h-5 w-5 items-center justify-center rounded border-2 ${
                          selectedScenarios.has(index)
                            ? "border-primary bg-primary"
                            : "border-muted-foreground/50"
                        }`}
                      >
                        {selectedScenarios.has(index) && (
                          <Check className="h-3 w-3 text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{scenario}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {scenarios.length > 0 && (
            <Button
              onClick={handleApply}
              disabled={selectedScenarios.size === 0}
              className="gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Apply {selectedScenarios.size} Scenario{selectedScenarios.size !== 1 ? "s" : ""}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

