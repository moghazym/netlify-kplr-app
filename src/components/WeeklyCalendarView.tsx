import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";

interface WeeklyCalendarViewProps {
  schedules: any[];
}

export function WeeklyCalendarView({ schedules }: WeeklyCalendarViewProps) {
  const { weekDays, timeSlots } = useMemo(() => {
    const now = new Date();
    const currentDay = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - currentDay);
    weekStart.setHours(0, 0, 0, 0);

    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });

    const timeSlots = Array.from({ length: 24 }, (_, i) => {
      const hour = i.toString().padStart(2, '0');
      return `${hour}:00`;
    });

    return { weekDays, timeSlots };
  }, []);

  const getScheduleForSlot = (dayIndex: number, timeSlot: string) => {
    const dayDate = weekDays[dayIndex];
    const dayOfWeek = dayDate.getDay();
    const [hour, minute] = timeSlot.split(':').map(Number);
    
    return schedules.filter((schedule) => {
      if (!schedule.is_active) return false;
      
      const scheduleTime = schedule.time_of_day?.slice(0, 5) || '';
      const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number);
      
      if (scheduleHour !== hour || scheduleMinute !== minute) return false;

      switch (schedule.schedule_type) {
        case 'daily':
          return true;
        case 'weekly':
          return schedule.days_of_week?.includes(dayOfWeek) || false;
        case 'monthly':
          return schedule.day_of_month === dayDate.getDate();
        default:
          return false;
      }
    });
  };

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Weekly Schedule</h3>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Header */}
              <div className="grid grid-cols-[80px_repeat(7,1fr)] border-b sticky top-0 bg-background z-10">
                <div className="p-3 font-medium text-sm border-r">Time</div>
                {weekDays.map((date, index) => (
                  <div
                    key={index}
                    className={`p-3 text-center border-r last:border-r-0 ${
                      date.toDateString() === new Date().toDateString()
                        ? 'bg-orange-50'
                        : ''
                    }`}
                  >
                    <div className="font-medium text-sm">
                      {dayNames[date.getDay()]} {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time slots */}
              <div className="max-h-[600px] overflow-y-auto">
                {timeSlots.map((timeSlot) => (
                  <div
                    key={timeSlot}
                    className="grid grid-cols-[80px_repeat(7,1fr)] border-b last:border-b-0"
                  >
                    <div className="p-2 text-xs text-muted-foreground border-r bg-muted/30">
                      {timeSlot}
                    </div>
                    {weekDays.map((date, dayIndex) => {
                      const slotSchedules = getScheduleForSlot(dayIndex, timeSlot);
                      const isToday = date.toDateString() === new Date().toDateString();
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`p-1 border-r last:border-r-0 min-h-[60px] ${
                            isToday ? 'bg-orange-50/50' : ''
                          }`}
                        >
                          {slotSchedules.map((schedule) => (
                            <div
                              key={schedule.id}
                              className="bg-orange-500 text-white text-xs p-2 rounded mb-1 flex items-center justify-between"
                            >
                              <span className="truncate flex-1">
                                {schedule.test_suites?.name || schedule.name}
                              </span>
                              {schedule.repeat_type === 'always' && (
                                <span className="ml-1 flex-shrink-0">∞</span>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

