import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Bell, 
  AlertTriangle, 
  Clock, 
  X, 
  Check, 
  ChevronDown, 
  ChevronUp,
  Inbox,
  ShieldAlert,
  ExternalLink,
  Printer,
  RotateCcw
} from 'lucide-react';
import { Asset } from '../types';
import { 
  parseISO, 
  differenceInDays, 
  isBefore, 
  startOfDay,
  format
} from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { generateAssetLabel } from '../utils/labelGenerator';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

interface NotificationCenterProps {
  assets: Asset[];
  setActiveTab: (tab: string) => void;
}

export default function NotificationCenter({ assets, setActiveTab }: NotificationCenterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setNotificationTab] = useState<'all' | 'overdue' | 'upcoming' | 'dismissed'>('all');
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  
  const containerRef = useRef<HTMLDivElement>(null);

  // Load dismissed alert IDs from localStorage
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem('dismissed_maintenance_alerts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Sync dismissed IDs to localStorage
  const saveDismissed = (ids: string[]) => {
    setDismissedIds(ids);
    try {
      localStorage.setItem('dismissed_maintenance_alerts', JSON.stringify(ids));
    } catch (err) {
      console.error('Failed to save dismissed alerts:', err);
    }
  };

  const handleDismiss = (assetId: string) => {
    if (!dismissedIds.includes(assetId)) {
      saveDismissed([...dismissedIds, assetId]);
      toast.success('Alert dismissed');
    }
  };

  const handleRestore = (assetId: string) => {
    saveDismissed(dismissedIds.filter(id => id !== assetId));
    toast.success('Alert restored to inbox');
  };

  const handleClearAll = () => {
    const activeAlerts = rawAlerts.filter(a => !dismissedIds.includes(a.asset.id || ''));
    const idsToDismiss = activeAlerts.map(a => a.asset.id || '').filter(Boolean);
    if (idsToDismiss.length === 0) return;
    saveDismissed([...dismissedIds, ...idsToDismiss]);
    toast.success('All active alerts dismissed');
  };

  const handleRestoreAll = () => {
    saveDismissed([]);
    toast.success('All dismissed alerts restored');
  };

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Compute raw list of urgent alerts
  const rawAlerts = useMemo(() => {
    if (!assets || !Array.isArray(assets)) return [];
    const today = startOfDay(new Date());

    return assets
      .filter(asset => {
        // Exclude retired or disposal assets as they don't require scheduling
        if (asset.status === 'Retired' || asset.status === 'Disposal') {
          return false;
        }
        return !!asset.nextMaintenanceDate;
      })
      .map(asset => {
        let maintDate;
        try {
          maintDate = parseISO(asset.nextMaintenanceDate!);
        } catch (e) {
          return null;
        }

        const diffDays = differenceInDays(maintDate, today);
        const isOverdue = diffDays < 0;
        const isApproaching = diffDays >= 0 && diffDays <= 7;

        let relativeText = '';
        if (isOverdue) {
          relativeText = `Overdue by ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'day' : 'days'}`;
        } else if (isApproaching) {
          relativeText = diffDays === 0 ? 'Scheduled for today' : `Scheduled in ${diffDays} ${diffDays === 1 ? 'day' : 'days'}`;
        }

        return {
          asset,
          isOverdue,
          isApproaching,
          diffDays,
          relativeText,
          maintDate
        };
      })
      .filter((item): item is NonNullable<typeof item> => {
        return item !== null && (item.isOverdue || item.isApproaching);
      })
      .sort((a, b) => {
        // Overdue first, then by earliest date
        if (a.isOverdue && !b.isOverdue) return -1;
        if (!a.isOverdue && b.isOverdue) return 1;
        return a.diffDays - b.diffDays;
      });
  }, [assets]);

  // Split alerts based on user viewing preferences & tabs
  const filteredAlerts = useMemo(() => {
    return rawAlerts.filter(alert => {
      const assetId = alert.asset.id || '';
      const isDismissed = dismissedIds.includes(assetId);

      if (activeTab === 'dismissed') {
        return isDismissed;
      }

      // If viewing active/overdue/upcoming, hide dismissed ones
      if (isDismissed) return false;

      if (activeTab === 'overdue') return alert.isOverdue;
      if (activeTab === 'upcoming') return alert.isApproaching;
      
      return true; // 'all' tab
    });
  }, [rawAlerts, activeTab, dismissedIds]);

  // Compute active unread count (for Badge)
  const unreadCount = useMemo(() => {
    return rawAlerts.filter(a => !dismissedIds.includes(a.asset.id || '')).length;
  }, [rawAlerts, dismissedIds]);

  const toggleExpand = (id: string) => {
    setExpandedAssetId(expandedAssetId === id ? null : id);
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

  return (
    <div className="relative" ref={containerRef}>
      {/* Notification Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2.5 rounded-xl border border-border bg-card hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-all cursor-pointer",
          isOpen && "bg-muted text-foreground ring-2 ring-primary/15"
        )}
        aria-label="Alerts Center"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center border-2 border-card animate-in zoom-in duration-200">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown Card */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-3 w-[420px] max-w-[calc(100vw-2rem)] border border-border bg-card rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-sm text-foreground flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  Urgent Alerts
                </h3>
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                  Maintenance Schedule Monitoring
                </p>
              </div>
              
              {activeTab === 'dismissed' ? (
                dismissedIds.length > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleRestoreAll}
                    className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3 mr-1" /> Restore All
                  </Button>
                )
              ) : (
                unreadCount > 0 && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleClearAll}
                    className="h-8 px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Dismiss All
                  </Button>
                )
              )}
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border bg-muted/10 px-3 py-1.5 gap-1">
              {(['all', 'overdue', 'upcoming', 'dismissed'] as const).map(tab => {
                let label = '';
                let count = 0;
                
                if (tab === 'all') {
                  label = 'All Inbox';
                  count = rawAlerts.filter(a => !dismissedIds.includes(a.asset.id || '')).length;
                } else if (tab === 'overdue') {
                  label = 'Overdue';
                  count = rawAlerts.filter(a => a.isOverdue && !dismissedIds.includes(a.asset.id || '')).length;
                } else if (tab === 'upcoming') {
                  label = '7-Day Warning';
                  count = rawAlerts.filter(a => a.isApproaching && !dismissedIds.includes(a.asset.id || '')).length;
                } else if (tab === 'dismissed') {
                  label = 'Archive';
                  count = dismissedIds.length;
                }

                const isActive = activeTab === tab;

                return (
                  <button
                    key={tab}
                    onClick={() => {
                      setNotificationTab(tab);
                      setExpandedAssetId(null);
                    }}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-center transition-all cursor-pointer relative",
                      isActive 
                        ? "bg-primary text-primary-foreground shadow-sm" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <span>{label}</span>
                    {count > 0 && (
                      <span className={cn(
                        "ml-1 px-1 rounded-md text-[9px] font-extrabold",
                        isActive 
                          ? "bg-primary-foreground text-primary" 
                          : "bg-muted text-muted-foreground"
                      )}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* List Body */}
            <ScrollArea className="max-h-[380px] overflow-y-auto">
              <div className="divide-y divide-border/60">
                {filteredAlerts.length > 0 ? (
                  filteredAlerts.map(alert => {
                    const id = alert.asset.id || '';
                    const isExpanded = expandedAssetId === id;
                    const isOverdue = alert.isOverdue;

                    return (
                      <div 
                        key={id} 
                        className={cn(
                          "p-4 transition-all hover:bg-muted/15 cursor-pointer flex flex-col gap-2",
                          isOverdue && "bg-rose-500/[0.01]",
                          isExpanded && "bg-muted/10"
                        )}
                        onClick={() => toggleExpand(id)}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Alert Icon & Message */}
                          <div className="flex items-start gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5",
                              isOverdue ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                            )}>
                              {isOverdue ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-xs font-bold text-foreground">
                                {alert.asset.name}
                              </p>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-muted-foreground tracking-wider uppercase">
                                  {alert.asset.assetTag}
                                </span>
                                <span className="text-muted-foreground/30 text-[10px]">•</span>
                                <span className={cn(
                                  "text-[10px] font-bold",
                                  isOverdue ? "text-rose-500" : "text-amber-500"
                                )}>
                                  {alert.relativeText}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Controls */}
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            {activeTab === 'dismissed' ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 rounded-md hover:bg-emerald-500/10 hover:text-emerald-500 text-muted-foreground cursor-pointer"
                                onClick={() => handleRestore(id)}
                                title="Restore alert"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="w-7 h-7 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                                onClick={() => handleDismiss(id)}
                                title="Dismiss alert"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <button className="text-muted-foreground p-1 hover:text-foreground">
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Expanded Details */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden pl-11 pr-2 space-y-3"
                              onClick={e => e.stopPropagation()}
                            >
                              <Separator className="bg-border/60" />
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-muted-foreground font-medium">
                                <div>
                                  <span className="block text-[8px] uppercase font-bold text-muted-foreground/60 tracking-wider">Category</span>
                                  <span className="text-foreground font-semibold">{alert.asset.category}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase font-bold text-muted-foreground/60 tracking-wider">Status</span>
                                  <span className="text-foreground font-semibold">{alert.asset.status}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase font-bold text-muted-foreground/60 tracking-wider">Location</span>
                                  <span className="text-foreground font-semibold">{alert.asset.location || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="block text-[8px] uppercase font-bold text-muted-foreground/60 tracking-wider">Assigned To</span>
                                  <span className="text-foreground font-semibold">{alert.asset.assignedTo || 'Unassigned'}</span>
                                </div>
                                {alert.asset.nextMaintenanceDate && (
                                  <div className="col-span-2">
                                    <span className="block text-[8px] uppercase font-bold text-muted-foreground/60 tracking-wider">Maintenance Schedule Date</span>
                                    <span className="text-foreground font-bold">{format(parseISO(alert.asset.nextMaintenanceDate), 'PPPP')}</span>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2 pt-1.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border-border cursor-pointer gap-1"
                                  onClick={() => {
                                    setActiveTab('assets');
                                    setIsOpen(false);
                                  }}
                                >
                                  <ExternalLink className="w-2.5 h-2.5" />
                                  Manage Asset
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 px-2.5 text-[9px] font-bold uppercase tracking-wider rounded-lg border-border cursor-pointer gap-1"
                                  onClick={(e) => handlePrintLabel(alert.asset, e)}
                                >
                                  <Printer className="w-2.5 h-2.5" />
                                  Label Tag
                                </Button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })
                ) : (
                  /* Empty State */
                  <div className="py-12 px-5 text-center flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40">
                      <Inbox className="w-5 h-5" />
                    </div>
                    <div className="space-y-1 max-w-[240px]">
                      <p className="text-xs font-bold text-foreground">No alerts matching filter</p>
                      <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                        All technological items are compliant with their designated scheduled frequencies.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
