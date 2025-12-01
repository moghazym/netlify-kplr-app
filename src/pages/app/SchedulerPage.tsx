import { useState, useEffect } from "react";
import { Plus, Calendar, Clock, Play, Pause, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { CreateScheduleDialog } from "@/components/CreateScheduleDialog";
import { WeeklyCalendarView } from "@/components/WeeklyCalendarView";
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
import { 
  getSchedules, 
  updateSchedule, 
  deleteSchedule,
  ScheduleResponse 
} from "@/lib/api-client";

export default function SchedulerPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduleResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  useEffect(() => {
    if (user) {
      fetchSchedules();
    }
  }, [user]);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await getSchedules();
      // Sort by created_at descending
      const sorted = data.sort((a, b) => {
        const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bDate - aDate;
      });
      setSchedules(sorted);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      toast({
        title: "Error",
        description: "Failed to load schedules",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleScheduleStatus = async (id: number, currentStatus: boolean) => {
    try {
      await updateSchedule(id, { is_active: !currentStatus });

      toast({
        title: "Success",
        description: `Schedule ${!currentStatus ? 'activated' : 'paused'}`
      });

      fetchSchedules();
    } catch (error) {
      console.error('Error updating schedule:', error);
      toast({
        title: "Error",
        description: "Failed to update schedule",
        variant: "destructive"
      });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id);

      toast({
        title: "Success",
        description: "Schedule deleted successfully"
      });

      fetchSchedules();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast({
        title: "Error",
        description: "Failed to delete schedule",
        variant: "destructive"
      });
    } finally {
      setDeleteId(null);
    }
  };

  const getScheduleDescription = (schedule: ScheduleResponse) => {
    const time = schedule.time_of_day.slice(0, 5);
    
    switch (schedule.frequency) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dayNames = schedule.days_of_week 
          ? schedule.days_of_week.map((d: number) => days[d]).join(', ')
          : 'Not set';
        return `Weekly on ${dayNames} at ${time}`;
      case 'monthly':
        return `Monthly on day ${schedule.day_of_month || 'Not set'} at ${time}`;
      default:
        return 'Not configured';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">Scheduler</h2>
          <p className="text-muted-foreground mt-1">
            Automate your test suite executions with scheduled runs
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Schedule
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : schedules.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">No schedules yet</p>
              <Button onClick={() => setShowCreateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Schedule Cards */}
          <div>
            <h3 className="text-lg font-semibold mb-4">All Schedules</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {schedules.map((schedule) => (
                <Card key={schedule.id} className="relative group">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{schedule.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-1">
                          {schedule.test_suite?.name}
                        </p>
                      </div>
                      <Badge variant={schedule.is_active ? "default" : "secondary"}>
                        {schedule.is_active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span>{getScheduleDescription(schedule)}</span>
                      </div>

                      {schedule.timezone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          <span>Timezone: {schedule.timezone}</span>
                        </div>
                      )}

                      {schedule.next_run_at && schedule.is_active && (
                        <div className="text-sm text-muted-foreground">
                          Next run: {new Date(schedule.next_run_at).toLocaleString()}
                        </div>
                      )}

                      {schedule.last_run_at && (
                        <div className="text-sm text-muted-foreground">
                          Last run: {new Date(schedule.last_run_at).toLocaleString()}
                        </div>
                      )}

                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleScheduleStatus(schedule.id, schedule.is_active)}
                          className="flex-1"
                        >
                          {schedule.is_active ? (
                            <><Pause className="h-4 w-4 mr-1" /> Pause</>
                          ) : (
                            <><Play className="h-4 w-4 mr-1" /> Activate</>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(schedule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Weekly Calendar View */}
          <WeeklyCalendarView schedules={schedules} />
        </div>
      )}

      <CreateScheduleDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSuccess={fetchSchedules}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId !== null && handleDelete(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

