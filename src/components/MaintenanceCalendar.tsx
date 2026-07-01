import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  AlertTriangle, 
  Clock, 
  ShieldAlert, 
  Check, 
  Search, 
  Filter, 
  User, 
  MapPin, 
  Tag, 
  CalendarDays,
  Printer,
  Edit,
  ExternalLink,
  RefreshCw,
  Info
} from 'lucide-react';
import { Asset } from '../types';
import { 
  parseISO, 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  isPast, 
  isToday, 
  differenceInDays,
  startOfDay,
  isValid
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { generateAssetLabel } from '../utils/labelGenerator';
import { toast } from 'sonner';
import { firestoreService } from '../lib/firestore';

interface MaintenanceCalendarProps {
  assets: Asset[];
  onEditAsset?: (asset: Asset) => void;
  setActiveTab?: (tab: string) => void;
}

export default function MaintenanceCalendar({ assets, onEditAsset, setActiveTab }: MaintenanceCalendarProps) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'overdue' | 'due-today' | 'upcoming-7' | 'future'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const today = startOfDay(new Date());

  // 1. Parse and compile all maintenance schedules
  const maintenanceEvents = useMemo(() => {
    if (!assets || !Array.isArray(assets)) return [];

    return assets
      .filter(asset => {
        // Exclude retired and disposal assets
        if (asset.status === 'Retired' || asset.status === 'Disposal') {
          return false;
        }
        return !!asset.nextMaintenanceDate;
      })
      .map(asset => {
        let date: Date;
        try {
          date = parseISO(asset.nextMaintenanceDate!);
        } catch {
          return null;
        }

        if (!isValid(date)) return null;

        const diffDays = differenceInDays(startOfDay(date), today);
        const isOverdue = diffDays < 0;
        const isDueToday = diffDays === 0;
        const isUpcoming7 = diffDays > 0 && diffDays <= 7;
        const isFuture = diffDays > 7;

        let urgency: 'overdue' | 'due-today' | 'upcoming-7' | 'future' = 'future';
        if (isOverdue) urgency = 'overdue';
        else if (isDueToday) urgency = 'due-today';
        else if (isUpcoming7) urgency = 'upcoming-7';

        return {
          asset,
          date,
          diffDays,
          urgency,
          isOverdue,
          isDueToday,
          isUpcoming7,
          isFuture
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  }, [assets, today]);

  // Unique categories for filtering
  const categories = useMemo(() => {
    const list = new Set<string>();
    assets.forEach(a => {
      if (a.category) list.add(a.category);
    });
    return ['all', ...Array.from(list)];
  }, [assets]);

  // 2. Filtered events for sidebar list display
  const filteredEvents = useMemo(() => {
    return maintenanceEvents.filter(event => {
      // Filter by search query (asset name, tag, location)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          event.asset.name.toLowerCase().includes(query) ||
          event.asset.assetTag.toLowerCase().includes(query) ||
          (event.asset.location && event.asset.location.toLowerCase().includes(query));
        if (!matchesSearch) return false;
      }

      // Filter by category
      if (categoryFilter !== 'all' && event.asset.category !== categoryFilter) {
        return false;
      }

      // Filter by urgency selection
      if (urgencyFilter !== 'all') {
        if (urgencyFilter === 'overdue' && !event.isOverdue) return false;
        if (urgencyFilter === 'due-today' && !event.isDueToday) return false;
        if (urgencyFilter === 'upcoming-7' && !event.isUpcoming7) return false;
        if (urgencyFilter === 'future' && !event.isFuture) return false;
      }

      // Filter by selected calendar date if click selected
      if (selectedDate) {
        if (!isSameDay(event.date, selectedDate)) return false;
      }

      return true;
    });
  }, [maintenanceEvents, searchQuery, categoryFilter, urgencyFilter, selectedDate]);

  // 3. Compute Calendar Grid Days
  const calendarGrid = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    
    // Day of the week of monthStart (0-6)
    const startDayOfWeek = monthStart.getDay();
    
    // Days in current month
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Prepend padding days from previous month
    const prevMonthDays: Date[] = [];
    if (startDayOfWeek > 0) {
      const prevMonthEnd = endOfMonth(subMonths(currentDate, 1));
      const startOfPadding = prevMonthEnd.getDate() - startDayOfWeek + 1;
      for (let i = startOfPadding; i <= prevMonthEnd.getDate(); i++) {
        prevMonthDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, i));
      }
    }

    // Append padding days from next month to make grid perfect 42 days (6 rows of 7 days)
    const totalGridSize = 42;
    const remainingDays = totalGridSize - (prevMonthDays.length + daysInMonth.length);
    const nextMonthDays: Date[] = [];
    for (let i = 1; i <= remainingDays; i++) {
      nextMonthDays.push(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, i));
    }

    return [...prevMonthDays, ...daysInMonth, ...nextMonthDays];
  }, [currentDate]);

  // Find events for a specific day to render dots
  const getEventsForDay = (date: Date) => {
    return maintenanceEvents.filter(e => isSameDay(e.date, date));
  };

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const handleToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const handlePrintLabel = async (asset: Asset, e: React.MouseEvent) => {
    e.stopPropagation();
    const promise = generateAssetLabel(asset);
    toast.promise(promise, {
      loading: `Generating label PDF for ${asset.assetTag}...`,
      success: 'Label PDF generated successfully!',
      error: 'Failed to generate label PDF'
    });
  };

  // Reschedule date instantly from calendar dashboard (Super convenient workflow)
  const handleReschedule = async (asset: Asset, daysOffset: number) => {
    try {
      const currentSchedule = asset.nextMaintenanceDate ? parseISO(asset.nextMaintenanceDate) : new Date();
      const newSchedule = new Date(currentSchedule.setDate(currentSchedule.getDate() + daysOffset));
      const formattedDate = format(newSchedule, 'yyyy-MM-dd');

      await firestoreService.update('assets', asset.id!, {
        nextMaintenanceDate: formattedDate
      });

      await firestoreService.add('audit_logs', {
        action: 'UPDATE',
        entityType: 'Asset',
        entityId: asset.id!,
        details: `Rescheduled maintenance task for ${asset.assetTag} by ${daysOffset} days. New date: ${formattedDate}`
      });

      toast.success(`Maintenance date rescheduled to ${formattedDate}`);
    } catch (error) {
      console.error('Failed to reschedule:', error);
      toast.error('Failed to reschedule maintenance task');
    }
  };

  // Summary indicators
  const stats = useMemo(() => {
    const overdueCount = maintenanceEvents.filter(e => e.isOverdue).length;
    const dueTodayCount = maintenanceEvents.filter(e => e.isDueToday).length;
    const upcomingCount = maintenanceEvents.filter(e => e.isUpcoming7).length;
    return { overdueCount, dueTodayCount, upcomingCount };
  }, [maintenanceEvents]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-background overflow-hidden">
      {/* Upper Panel: Filters, Title & Stats Summary */}
      <div className="bg-card border-b border-border p-6 flex-shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-xl font-black uppercase tracking-wider text-foreground flex items-center gap-2">
              <CalendarIcon className="w-5.5 h-5.5 text-primary" />
              Maintenance Schedule
            </h2>
            <p className="text-xs text-muted-foreground font-semibold uppercase tracking-widest">
              Review and update equipment maintenance frequencies & compliance
            </p>
          </div>

          {/* Quick Metrics Cards */}
          <div className="flex items-center gap-3">
            <div className="bg-rose-500/10 border border-rose-500/20 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-rose-500/80 tracking-widest block leading-none">Overdue</span>
                <span className="text-sm font-extrabold text-rose-500 leading-none">{stats.overdueCount} Assets</span>
              </div>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-amber-500/80 tracking-widest block leading-none">Today</span>
                <span className="text-sm font-extrabold text-amber-500 leading-none">{stats.dueTodayCount} Assets</span>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 px-3.5 py-1.5 rounded-xl flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-primary" />
              <div className="text-left">
                <span className="text-[9px] font-black uppercase text-primary/80 tracking-widest block leading-none">Next 7 Days</span>
                <span className="text-sm font-extrabold text-primary leading-none">{stats.upcomingCount} Assets</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search assets or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9.5 h-10 text-xs bg-muted/35"
            />
          </div>

          <div>
            <select
              value={urgencyFilter}
              onChange={(e) => setUrgencyFilter(e.target.value as any)}
              className="w-full h-10 text-xs rounded-xl border border-input bg-muted/35 px-3 py-2 text-foreground font-semibold shadow-sm focus:border-primary cursor-pointer"
            >
              <option value="all">All Task Urgencies</option>
              <option value="overdue">Overdue Alerts</option>
              <option value="due-today">Due Today</option>
              <option value="upcoming-7">Warning (7-Day Limit)</option>
              <option value="future">Routine / Future Tasks</option>
            </select>
          </div>

          <div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full h-10 text-xs rounded-xl border border-input bg-muted/35 px-3 py-2 text-foreground font-semibold shadow-sm focus:border-primary cursor-pointer"
            >
              <option value="all">All Asset Categories</option>
              {categories.filter(c => c !== 'all').map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-10 text-xs font-bold uppercase tracking-wider rounded-xl border-border"
              onClick={() => {
                setSearchQuery('');
                setUrgencyFilter('all');
                setCategoryFilter('all');
                setSelectedDate(null);
              }}
            >
              Clear Filters
            </Button>
            {selectedDate && (
              <Button
                variant="outline"
                className="px-3 h-10 text-xs text-primary font-bold uppercase tracking-wider rounded-xl border-border"
                onClick={() => setSelectedDate(null)}
                title="Show all scheduled items"
              >
                Clear Date Filter
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid: Left side Calendar, Right side Tasks List */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        
        {/* Left Hand: Interactive Monthly Calendar Grid */}
        <div className="flex-1 p-6 bg-muted/15 flex flex-col overflow-y-auto">
          <div className="max-w-4xl w-full mx-auto flex flex-col gap-4">
            
            {/* Monthly Navigation Header */}
            <div className="flex items-center justify-between bg-card p-3 rounded-2xl border border-border shadow-sm">
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black tracking-wider uppercase text-foreground">
                  {format(currentDate, 'MMMM yyyy')}
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="icon" onClick={handlePrevMonth} className="h-8.5 w-8.5 rounded-lg border-border">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleToday} className="h-8.5 px-3 text-xs font-bold uppercase tracking-wider rounded-lg border-border">
                  Today
                </Button>
                <Button variant="outline" size="icon" onClick={handleNextMonth} className="h-8.5 w-8.5 rounded-lg border-border">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-[10px] font-black uppercase text-muted-foreground/60 tracking-widest py-1">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Monthly Calendar Day Cells */}
            <div className="grid grid-cols-7 gap-1.5">
              {calendarGrid.map((dayDate, index) => {
                const dayEvents = getEventsForDay(dayDate);
                const isCurrentMonth = dayDate.getMonth() === currentDate.getMonth();
                const isSelected = selectedDate && isSameDay(dayDate, selectedDate);
                const isDayToday = isToday(dayDate);

                // Determine if there are overdue/upcoming tasks
                const hasOverdue = dayEvents.some(e => e.isOverdue);
                const hasUpcoming = dayEvents.some(e => e.isUpcoming7 || e.isDueToday);

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDate(dayDate)}
                    className={`min-h-[76px] lg:min-h-[86px] p-2 border rounded-xl flex flex-col justify-between transition-all cursor-pointer select-none ${
                      !isCurrentMonth ? 'opacity-35 bg-muted/10 border-border/30' : 'bg-card'
                    } ${
                      isSelected 
                        ? 'border-primary ring-2 ring-primary/10 shadow-sm' 
                        : 'border-border/60 hover:border-primary/45'
                    }`}
                  >
                    {/* Date Number Label */}
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-bold font-mono ${
                        isDayToday 
                          ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md text-[10px]' 
                          : 'text-muted-foreground'
                      }`}>
                        {dayDate.getDate()}
                      </span>

                      {dayEvents.length > 0 && (
                        <span className={`text-[9px] font-extrabold px-1 rounded-md ${
                          hasOverdue 
                            ? 'bg-rose-500/10 text-rose-500' 
                            : hasUpcoming 
                              ? 'bg-amber-500/10 text-amber-500' 
                              : 'bg-primary/10 text-primary'
                        }`}>
                          {dayEvents.length}
                        </span>
                      )}
                    </div>

                    {/* Small Dot list or indicator bar */}
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((event) => (
                        <div 
                          key={event.asset.id} 
                          className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider truncate border ${
                            event.isOverdue 
                              ? 'bg-rose-500/15 text-rose-500 border-rose-500/20' 
                              : event.isDueToday || event.isUpcoming7
                                ? 'bg-amber-500/15 text-amber-500 border-amber-500/20' 
                                : 'bg-primary/15 text-primary border-primary/20'
                          }`}
                          title={event.asset.name}
                        >
                          {event.asset.assetTag}
                        </div>
                      ))}
                      {dayEvents.length > 2 && (
                        <div className="text-[7px] text-muted-foreground font-semibold uppercase tracking-wider text-center">
                          +{dayEvents.length - 2} more tasks
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Map Color Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-[10px] font-semibold text-muted-foreground bg-card py-3 px-5 border border-border/60 rounded-xl">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 block" /> Overdue Tasks
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 block" /> Due Today / Coming Up
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary block" /> Routine Schedule (Future)
              </span>
              <span className="text-muted-foreground/30">|</span>
              <span className="text-[9px] text-muted-foreground italic uppercase">
                Click cells to filter list to specific scheduled days
              </span>
            </div>

          </div>
        </div>

        {/* Right Hand: Screen listing scheduled items */}
        <div className="w-full xl:w-[480px] bg-card border-t xl:border-t-0 xl:border-l border-border flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-border bg-muted/10 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm font-bold text-foreground">
                {selectedDate 
                  ? `Tasks on ${format(selectedDate, 'PPPP')}` 
                  : 'All Matching Scheduled Tasks'
                }
              </h3>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">
                Showing {filteredEvents.length} matching events
              </p>
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((event) => {
                  const asset = event.asset;

                  return (
                    <div
                      key={asset.id}
                      className={`p-4 rounded-2xl border transition-all duration-200 bg-card hover:shadow-sm ${
                        event.isOverdue 
                          ? 'border-rose-500/30 hover:border-rose-500/50 bg-rose-500/[0.01]' 
                          : event.isDueToday || event.isUpcoming7
                            ? 'border-amber-500/30 hover:border-amber-500/50 bg-amber-500/[0.01]' 
                            : 'border-border/60 hover:border-border'
                      }`}
                    >
                      {/* Asset header info */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <h4 className="text-xs font-black text-foreground hover:underline cursor-pointer flex items-center gap-1">
                            {asset.name}
                          </h4>
                          <span className="font-mono text-[9px] text-muted-foreground tracking-widest uppercase block">
                            {asset.assetTag}
                          </span>
                        </div>

                        <Badge 
                          variant="outline" 
                          className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-lg"
                          style={{
                            backgroundColor: event.isOverdue ? '#f43f5e15' : event.isDueToday || event.isUpcoming7 ? '#f59e0b15' : '#3b82f615',
                            color: event.isOverdue ? '#f43f5e' : event.isDueToday || event.isUpcoming7 ? '#d97706' : '#2563eb',
                            borderColor: event.isOverdue ? '#f43f5e30' : event.isDueToday || event.isUpcoming7 ? '#d9770630' : '#2563eb30'
                          }}
                        >
                          {event.isOverdue 
                            ? `${Math.abs(event.diffDays)}d Overdue` 
                            : event.isDueToday 
                              ? 'Scheduled Today' 
                              : `In ${event.diffDays} Days`
                          }
                        </Badge>
                      </div>

                      {/* Schedule date indicators */}
                      <div className="grid grid-cols-2 gap-y-1.5 text-[10px] font-medium text-muted-foreground mt-3 bg-muted/30 p-2.5 rounded-xl border border-border/40">
                        <div>
                          <span className="text-[8px] font-bold uppercase text-muted-foreground/60 block tracking-widest">Category</span>
                          <span className="text-foreground font-semibold">{asset.category}</span>
                        </div>
                        <div>
                          <span className="text-[8px] font-bold uppercase text-muted-foreground/60 block tracking-widest">Status</span>
                          <span className="text-foreground font-semibold">{asset.status}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[8px] font-bold uppercase text-muted-foreground/60 block tracking-widest">Location</span>
                          <span className="text-foreground font-semibold block truncate">
                            {asset.location || 'N/A'}
                          </span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-[8px] font-bold uppercase text-muted-foreground/60 block tracking-widest">Assigned Specialist</span>
                          <span className="text-foreground font-semibold block truncate flex items-center gap-1">
                            <User className="w-3 h-3 text-muted-foreground" />
                            {asset.assignedTo || 'Unassigned'}
                          </span>
                        </div>
                      </div>

                      {/* Reschedule Fast Buttons */}
                      <div className="mt-3.5 space-y-2">
                        <span className="text-[8px] font-black uppercase text-muted-foreground/60 tracking-widest block">Reschedule Action</span>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[9px] font-bold uppercase tracking-wider rounded-lg flex-1 border-border/60"
                            onClick={() => handleReschedule(asset, 7)}
                          >
                            +1 Week
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[9px] font-bold uppercase tracking-wider rounded-lg flex-1 border-border/60"
                            onClick={() => handleReschedule(asset, 30)}
                          >
                            +1 Month
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-[9px] font-bold uppercase tracking-wider rounded-lg flex-1 border-border/60"
                            onClick={() => handleReschedule(asset, 90)}
                          >
                            +3 Months
                          </Button>
                        </div>
                      </div>

                      {/* CTAs */}
                      <div className="flex items-center gap-1.5 mt-3.5 pt-3.5 border-t border-border/40">
                        {onEditAsset && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] font-bold uppercase tracking-wider rounded-lg flex-1 border-border/60 gap-1 cursor-pointer"
                            onClick={() => onEditAsset(asset)}
                          >
                            <Edit className="w-3 h-3" />
                            Edit Details
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-[9px] font-bold uppercase tracking-wider rounded-lg border-border/60 flex-shrink-0 cursor-pointer"
                          onClick={(e) => handlePrintLabel(asset, e)}
                          title="Generate Barcode Label"
                        >
                          <Printer className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                        </Button>
                        {setActiveTab && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-[9px] font-bold uppercase tracking-wider rounded-lg border-border/60 flex-shrink-0 cursor-pointer"
                            onClick={() => {
                              setActiveTab('assets');
                              // Search for this asset tag
                              const searchInput = document.querySelector('input[placeholder="Search assets..."]') as HTMLInputElement;
                              if (searchInput) {
                                searchInput.value = asset.assetTag;
                                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                              }
                            }}
                            title="Locate Asset in Registry"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                        )}
                      </div>

                    </div>
                  );
                })
              ) : (
                <div className="py-16 text-center space-y-3.5 px-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground/30 mx-auto">
                    <Check className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div className="space-y-1 max-w-[280px] mx-auto">
                    <p className="text-xs font-bold text-foreground">No maintenance tasks scheduled</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Either no assets are scheduled for this filter/date, or all systems are fully checked and current.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

      </div>
    </div>
  );
}
