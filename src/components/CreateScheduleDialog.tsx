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
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getTestSuites, createSchedule, type TestSuiteResponse, type ScheduleCreate } from "@/lib/api-client";


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
  const [testSuites, setTestSuites] = useState<TestSuiteResponse[]>([]);
  
  const [formData, setFormData] = useState({
    name: "",
    test_suite_id: "",
    schedule_type: "daily",
    time_of_day: "09:00",
    days_of_week: [] as number[],
    day_of_month: 1,
  });

  useEffect(() => {
    if (open && user) {
      fetchTestSuites();
    }
  }, [open, user]);

  const fetchTestSuites = async () => {
    try {
      const suites = await getTestSuites();
      setTestSuites(suites);
    } catch (error) {
      console.error('Error fetching test suites:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load test suites",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.test_suite_id) {
      toast({
        title: "Error",
        description: "Please select a test suite",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Find the selected test suite to get project_id
      const selectedSuite = testSuites.find(s => s.id === parseInt(formData.test_suite_id, 10));
      if (!selectedSuite) {
        throw new Error("Selected test suite not found");
      }

      // Map form data to API format
      const scheduleData: ScheduleCreate = {
        name: formData.name,
        project_id: selectedSuite.project_id,
        test_suite_id: parseInt(formData.test_suite_id, 10),
        frequency: formData.schedule_type as 'daily' | 'weekly' | 'monthly',
        time_of_day: formData.time_of_day,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        days_of_week: formData.schedule_type === 'weekly' ? formData.days_of_week : null,
        day_of_month: formData.schedule_type === 'monthly' ? formData.day_of_month : null,
        is_active: true,
      };

      await createSchedule(scheduleData);

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
      });
    } catch (error) {
      console.error('Error creating schedule:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create schedule",
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
                  <SelectItem key={suite.id} value={suite.id.toString()}>
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

