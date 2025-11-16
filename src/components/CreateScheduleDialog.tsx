import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface TestSuite {
  id: string;
  name: string;
  created_at: string;
  scenario_count?: number;
}

// Mock data - replace with real Supabase queries when available
const mockSuites: TestSuite[] = [
  {
    id: "1",
    name: "Regression Suite",
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    scenario_count: 12,
  },
  {
    id: "2",
    name: "Smoke Tests",
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    scenario_count: 5,
  },
  {
    id: "3",
    name: "Integration Tests",
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    scenario_count: 8,
  },
];

interface CreateScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateScheduleDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateScheduleDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [testSuites, setTestSuites] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    test_suite_id: "",
    schedule_type: "daily",
    time_of_day: "09:00",
    days_of_week: [] as number[],
    day_of_month: 1,
    cron_expression: "",
    repeat_type: "always",
    repeat_count: 1,
  });

  useEffect(() => {
    if (open && user) {
      fetchTestSuites();
    }
  }, [open, user]);

  const fetchTestSuites = async () => {
    try {
      // TODO: Replace with real Supabase query
      // const { data, error } = await supabase
      //   .from('test_suites')
      //   .select('id, name')
      //   .eq('user_id', user?.id)
      //   .order('name', { ascending: true });
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setTestSuites(mockSuites);
    } catch (error) {
      console.error('Error fetching test suites:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('test_schedules')
        .insert({
          user_id: user.id,
          name: formData.name,
          test_suite_id: formData.test_suite_id,
          schedule_type: formData.schedule_type,
          time_of_day: formData.time_of_day,
          days_of_week: formData.days_of_week,
          day_of_month: formData.day_of_month,
          cron_expression: formData.cron_expression || null,
          repeat_type: formData.repeat_type,
          repeat_count: formData.repeat_type === 'limited' ? formData.repeat_count : null,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Success",
        description: "Schedule created successfully",
      });

      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: "",
        test_suite_id: "",
        schedule_type: "daily",
        time_of_day: "09:00",
        days_of_week: [],
        day_of_month: 1,
        cron_expression: "",
        repeat_type: "always",
        repeat_count: 1,
      });
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast({
        title: "Error",
        description: "Failed to create schedule",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Schedule</DialogTitle>
          <DialogDescription>
            Set up a new automated test execution schedule
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Schedule Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Daily Regression Tests"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="test_suite_id">Test Suite</Label>
            <Select
              value={formData.test_suite_id}
              onValueChange={(value) => setFormData({ ...formData, test_suite_id: value })}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a test suite" />
              </SelectTrigger>
              <SelectContent>
                {testSuites.map((suite) => (
                  <SelectItem key={suite.id} value={suite.id}>
                    {suite.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="schedule_type">Schedule Type</Label>
              <Select
                value={formData.schedule_type}
                onValueChange={(value) => setFormData({ ...formData, schedule_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="custom">Custom (Cron)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="time_of_day">Time</Label>
              <Input
                id="time_of_day"
                type="time"
                value={formData.time_of_day}
                onChange={(e) => setFormData({ ...formData, time_of_day: e.target.value })}
                required
              />
            </div>
          </div>

          {formData.schedule_type === 'weekly' && (
            <div className="space-y-2">
              <Label>Days of Week</Label>
              <div className="flex flex-wrap gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                  <Button
                    key={day}
                    type="button"
                    variant={formData.days_of_week.includes(index) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      const newDays = formData.days_of_week.includes(index)
                        ? formData.days_of_week.filter(d => d !== index)
                        : [...formData.days_of_week, index].sort();
                      setFormData({ ...formData, days_of_week: newDays });
                    }}
                  >
                    {day}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {formData.schedule_type === 'monthly' && (
            <div className="space-y-2">
              <Label htmlFor="day_of_month">Day of Month</Label>
              <Input
                id="day_of_month"
                type="number"
                min="1"
                max="31"
                value={formData.day_of_month}
                onChange={(e) => setFormData({ ...formData, day_of_month: parseInt(e.target.value) })}
                required
              />
            </div>
          )}

          {formData.schedule_type === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="cron_expression">Cron Expression</Label>
              <Input
                id="cron_expression"
                value={formData.cron_expression}
                onChange={(e) => setFormData({ ...formData, cron_expression: e.target.value })}
                placeholder="0 9 * * *"
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="repeat_type">Repeat</Label>
              <Select
                value={formData.repeat_type}
                onValueChange={(value) => setFormData({ ...formData, repeat_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Run once</SelectItem>
                  <SelectItem value="limited">Limited times</SelectItem>
                  <SelectItem value="always">Indefinitely</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.repeat_type === 'limited' && (
              <div className="space-y-2">
                <Label htmlFor="repeat_count">Number of Runs</Label>
                <Input
                  id="repeat_count"
                  type="number"
                  min="1"
                  value={formData.repeat_count}
                  onChange={(e) => setFormData({ ...formData, repeat_count: parseInt(e.target.value) })}
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

