import React from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line
} from 'recharts';
import { 
  Package, 
  CheckCircle2, 
  AlertTriangle, 
  Wrench, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
  Activity,
  Bell,
  Clock,
  ExternalLink,
  ShieldCheck,
  Coins
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Asset } from '@/src/types';
import { cn } from '@/lib/utils';
import { format, addDays, isBefore, isAfter, parseISO } from 'date-fns';

interface DashboardProps {
  assets: Asset[];
}

export default function Dashboard({ assets }: DashboardProps) {
  const totalAssets = assets.length;
  const activeAssets = assets.filter(a => a.status === 'Active').length;
  const maintenanceAssets = assets.filter(a => a.status === 'Maintenance').length;
  
  // Expiring warranties (within 30 days)
  const today = new Date();
  const thirtyDaysFromNow = addDays(today, 30);
  
  const expiringWarrantiesList = assets.filter(a => {
    if (!a.warrantyExpiry) return false;
    const expiry = parseISO(a.warrantyExpiry);
    return isAfter(expiry, today) && isBefore(expiry, thirtyDaysFromNow);
  });

  const overdueMaintenanceList = assets.filter(a => {
    if (!a.nextMaintenanceDate) return false;
    const maintenance = parseISO(a.nextMaintenanceDate);
    return isBefore(maintenance, today);
  });

  const expiringWarranties = expiringWarrantiesList.length;
  const overdueMaintenance = overdueMaintenanceList.length;

  const nonCompliantAssets = assets.filter(a => a.compliance?.isCompliant === false).length;
  const complianceRate = totalAssets > 0 ? Math.round(((totalAssets - nonCompliantAssets) / totalAssets) * 100) : 100;

  const [viewType, setViewType] = React.useState<'daily' | 'cumulative'>('daily');
  const [displayMode, setDisplayMode] = React.useState<'total' | 'breakdown'>('total');
  const [selectedStatusTab, setSelectedStatusTab] = React.useState<string>('Active');

  // Helper to parse dates securely from statusHistory and createdAt
  const parseToDate = (dateVal: any): Date | null => {
    if (!dateVal) return null;
    try {
      if (typeof dateVal.toDate === 'function') {
        return dateVal.toDate();
      }
      if (dateVal instanceof Date) {
        return dateVal;
      }
      if (typeof dateVal.seconds === 'number') {
        return new Date(dateVal.seconds * 1000);
      }
      if (typeof dateVal === 'string') {
        const d = new Date(dateVal);
        return isNaN(d.getTime()) ? null : d;
      }
    } catch (e) {
      console.error('Date parsing error', e);
    }
    return null;
  };

  const timelineData = React.useMemo(() => {
    const statusChanges: { date: Date; dateStr: string; status: string }[] = [];
    
    assets.forEach((a) => {
      if (a.statusHistory && Array.isArray(a.statusHistory) && a.statusHistory.length > 0) {
        a.statusHistory.forEach((h) => {
          const parsedDate = parseToDate(h.changedAt || a.createdAt);
          if (parsedDate) {
            const dateStr = format(parsedDate, 'yyyy-MM-dd');
            statusChanges.push({
              date: parsedDate,
              dateStr,
              status: h.status,
            });
          }
        });
      } else {
        const parsedDate = parseToDate(a.createdAt);
        if (parsedDate) {
          const dateStr = format(parsedDate, 'yyyy-MM-dd');
          statusChanges.push({
            date: parsedDate,
            dateStr,
            status: a.status,
          });
        }
      }
    });

    // Sort chronologically
    statusChanges.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Daily aggregations
    const dailyGroups: Record<string, {
      dateObj: Date;
      Procurement: number;
      Active: number;
      Maintenance: number;
      Retired: number;
      Disposal: number;
      Total: number;
    }> = {};

    statusChanges.forEach((change) => {
      const key = change.dateStr;
      if (!dailyGroups[key]) {
        dailyGroups[key] = {
          dateObj: change.date,
          Procurement: 0,
          Active: 0,
          Maintenance: 0,
          Retired: 0,
          Disposal: 0,
          Total: 0,
        };
      }
      const grp = dailyGroups[key];
      if (change.status === 'Procurement') grp.Procurement += 1;
      else if (change.status === 'Active') grp.Active += 1;
      else if (change.status === 'Maintenance') grp.Maintenance += 1;
      else if (change.status === 'Retired') grp.Retired += 1;
      else if (change.status === 'Disposal') grp.Disposal += 1;
      
      grp.Total += 1;
    });

    const sortedKeys = Object.keys(dailyGroups).sort((a, b) => a.localeCompare(b));

    let cumProcurement = 0;
    let cumActive = 0;
    let cumMaintenance = 0;
    let cumRetired = 0;
    let cumDisposal = 0;
    let cumTotal = 0;

    return sortedKeys.map((key) => {
      const dayData = dailyGroups[key];
      cumProcurement += dayData.Procurement;
      cumActive += dayData.Active;
      cumMaintenance += dayData.Maintenance;
      cumRetired += dayData.Retired;
      cumDisposal += dayData.Disposal;
      cumTotal += dayData.Total;

      return {
        dateStr: key,
        displayDate: format(dayData.dateObj, 'MMM d, yyyy'),
        daily: {
          Procurement: dayData.Procurement,
          Active: dayData.Active,
          Maintenance: dayData.Maintenance,
          Retired: dayData.Retired,
          Disposal: dayData.Disposal,
          Total: dayData.Total,
        },
        cumulative: {
          Procurement: cumProcurement,
          Active: cumActive,
          Maintenance: cumMaintenance,
          Retired: cumRetired,
          Disposal: cumDisposal,
          Total: cumTotal,
        }
      };
    });
  }, [assets]);

  const chartData = React.useMemo(() => {
    return timelineData.map(item => {
      const source = viewType === 'daily' ? item.daily : item.cumulative;
      return {
        displayDate: item.displayDate,
        Procurement: source.Procurement,
        Active: source.Active,
        Maintenance: source.Maintenance,
        Retired: source.Retired,
        Disposal: source.Disposal,
        Total: source.Total,
      };
    });
  }, [timelineData, viewType]);

  const monthlyTrendData = React.useMemo(() => {
    const months: { monthKey: string; label: string; added: number; retired: number }[] = [];
    const now = new Date();
    
    // Generate the last 6 months chronologically (ending with current month)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = format(d, 'yyyy-MM');
      const label = format(d, 'MMM yyyy');
      months.push({ monthKey, label, added: 0, retired: 0 });
    }

    assets.forEach(asset => {
      // 1. Determine Added Date (usually a.createdAt)
      const addedDate = parseToDate(asset.createdAt);
      if (addedDate) {
        const addedKey = format(addedDate, 'yyyy-MM');
        const found = months.find(m => m.monthKey === addedKey);
        if (found) {
          found.added += 1;
        }
      }

      // 2. Determine Retired Date
      let retiredDate: Date | null = null;
      if (asset.statusHistory && Array.isArray(asset.statusHistory)) {
        const retiredEntry = asset.statusHistory.find(h => h.status === 'Retired');
        if (retiredEntry) {
          retiredDate = parseToDate(retiredEntry.changedAt);
        }
      }
      
      if (!retiredDate && asset.status === 'Retired') {
        retiredDate = parseToDate(asset.updatedAt || asset.createdAt);
      }

      if (retiredDate) {
        const retiredKey = format(retiredDate, 'yyyy-MM');
        const found = months.find(m => m.monthKey === retiredKey);
        if (found) {
          found.retired += 1;
        }
      }
    });

    return months;
  }, [assets]);

  // 1. Helper to get asset purchase cost with smart fallbacks
  const getAssetCost = React.useCallback((asset: Asset): number => {
    if (asset.specs) {
      for (const [key, val] of Object.entries(asset.specs)) {
        const lowerKey = key.toLowerCase();
        if (lowerKey.includes('cost') || lowerKey.includes('price') || lowerKey.includes('value') || lowerKey.includes('purchase')) {
          const parsed = parseFloat(val.replace(/[^0-9.]/g, ''));
          if (!isNaN(parsed)) return parsed;
        }
      }
    }
    // Category-specific high-fidelity standard fallback costs
    switch (asset.category) {
      case 'Server': return 6500;
      case 'Network': return 2800;
      case 'Storage': return 9000;
      case 'Endpoint': return 1300;
      case 'Software': return 450;
      default: return 1200;
    }
  }, []);

  // 2. Compute 6-Month Depreciation Trend Data
  const valuationTrendData = React.useMemo(() => {
    const months: { monthKey: string; label: string; date: Date; value: number; originalValue: number }[] = [];
    const now = new Date();
    
    // Last 6 months chronological
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      // Let's set the target evaluation date to the end of that month so we capture the assets at that full month's status
      const evalDate = new Date(d.getFullYear(), d.getMonth() + 1, 0); 
      const monthKey = format(d, 'yyyy-MM');
      const label = format(d, 'MMM yyyy');
      months.push({ monthKey, label, date: evalDate, value: 0, originalValue: 0 });
    }

    months.forEach((m) => {
      let totalDepreciated = 0;
      let totalOriginal = 0;

      assets.forEach((asset) => {
        // Find acquisition date
        const purchaseDate = parseToDate(asset.purchaseDate) || parseToDate(asset.createdAt);
        if (!purchaseDate) return;

        // If purchased after this evaluation date, it doesn't exist yet on the books
        if (isAfter(purchaseDate, m.date)) return;

        // Check if retired or disposed before this evaluation date
        let retiredDate: Date | null = null;
        if (asset.statusHistory && Array.isArray(asset.statusHistory)) {
          const retiredEntry = asset.statusHistory.find(h => h.status === 'Retired' || h.status === 'Disposal');
          if (retiredEntry) {
            retiredDate = parseToDate(retiredEntry.changedAt);
          }
        }
        if (!retiredDate && (asset.status === 'Retired' || asset.status === 'Disposal')) {
          retiredDate = parseToDate(asset.updatedAt || asset.createdAt);
        }
        
        if (retiredDate && isBefore(retiredDate, m.date)) {
          // Asset is already off-books/retired by this month
          return;
        }

        const cost = getAssetCost(asset);
        totalOriginal += cost;

        // Lifespan & Depreciation parameters
        const lifespanYears = asset.category === 'Endpoint' || asset.category === 'Software' ? 3 : 5;
        const lifespanMonths = lifespanYears * 12;
        const salvageValue = cost * 0.10; // 10% salvage value
        const monthlyDepreciation = (cost - salvageValue) / lifespanMonths;

        // Months elapsed
        const elapsedMonths = Math.max(
          0,
          (m.date.getFullYear() - purchaseDate.getFullYear()) * 12 + (m.date.getMonth() - purchaseDate.getMonth())
        );

        const currentVal = Math.max(salvageValue, cost - (elapsedMonths * monthlyDepreciation));
        totalDepreciated += currentVal;
      });

      m.value = Math.round(totalDepreciated);
      m.originalValue = Math.round(totalOriginal);
    });

    return months;
  }, [assets, getAssetCost]);

  // Category distribution
  const categoryData = Object.entries(
    assets.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Status distribution
  const statusDistribution = assets.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const STATUS_COLOR_MAP: Record<string, string> = {
    'Procurement': '#0ea5e9', // Sky Accent
    'Active': '#10b981',      // Emerald Accent
    'Maintenance': '#f59e0b', // Amber Accent
    'Retired': '#64748b',     // Slate Accent
    'Disposal': '#ef4444'     // Rose Accent
  };

  const statusData = Object.entries(statusDistribution).map(([name, value]) => ({
    name,
    value,
    color: STATUS_COLOR_MAP[name] || '#8b5cf6' // Purple fallback
  }));

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#64748b'];

  const stats = [
    { 
      label: 'Total Assets', 
      value: totalAssets.toLocaleString(), 
      icon: Package,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-500/10',
      description: 'Total managed infrastructure'
    },
    { 
      label: 'Active Assets', 
      value: activeAssets.toLocaleString(), 
      icon: CheckCircle2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-500/10',
      description: 'Items currently in production'
    },
    { 
      label: 'Expiring Warranties', 
      value: expiringWarranties.toLocaleString(), 
      icon: ShieldAlert,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-500/10',
      description: 'Expiring within 30 days'
    },
    { 
      label: 'Overdue Maintenance', 
      value: overdueMaintenance.toLocaleString(), 
      icon: Clock,
      color: 'text-rose-600 dark:text-rose-400',
      bg: 'bg-rose-50 dark:bg-rose-500/10',
      description: 'Maintenance schedule breach'
    },
    { 
      label: 'Compliance Health', 
      value: `${complianceRate}%`, 
      icon: ShieldCheck,
      color: 'text-indigo-600 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-500/10',
      description: `${nonCompliantAssets} assets with violations`
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Alerts Section */}
      {(expiringWarranties > 0 || overdueMaintenance > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {overdueMaintenance > 0 && (
            <Card className="bg-rose-50 dark:bg-rose-500/10 border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">Maintenance Overdue</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {overdueMaintenanceList.slice(0, 3).map((asset, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-rose-100 dark:border-rose-500/20">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{asset.name}</span>
                        <span className="text-[10px] font-medium text-rose-500 uppercase">Due: {asset.nextMaintenanceDate}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold border-rose-200 dark:border-rose-500/40 text-rose-600 dark:text-rose-400 bg-white dark:bg-black/20">CRITICAL</Badge>
                    </div>
                  ))}
                  {overdueMaintenance > 3 && (
                    <p className="text-[10px] font-bold text-rose-400 text-center uppercase tracking-widest pt-1">
                      + {overdueMaintenance - 3} more critical alerts
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {expiringWarranties > 0 && (
            <Card className="bg-amber-50 dark:bg-amber-500/10 border-none shadow-sm rounded-2xl overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                  <CardTitle className="text-sm font-bold uppercase tracking-wider">Warranty Expiry</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {expiringWarrantiesList.slice(0, 3).map((asset, i) => (
                    <div key={i} className="flex items-center justify-between bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-amber-100 dark:border-amber-500/20">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-foreground">{asset.name}</span>
                        <span className="text-[10px] font-medium text-amber-600 uppercase">Expires: {asset.warrantyExpiry}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold border-amber-200 dark:border-amber-500/40 text-amber-600 dark:text-amber-400 bg-white dark:bg-black/20">WARNING</Badge>
                    </div>
                  ))}
                  {expiringWarranties > 3 && (
                    <p className="text-[10px] font-bold text-amber-400 text-center uppercase tracking-widest pt-1">
                      + {expiringWarranties - 3} more warranty alerts
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <Card key={i} className="bg-card border-none shadow-sm rounded-2xl overflow-hidden group hover:shadow-md transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">{stat.label}</p>
                  <h3 className="text-3xl font-bold text-foreground tracking-tight">{stat.value}</h3>
                </div>
                <div className={cn("p-2.5 rounded-xl transition-transform group-hover:scale-110 duration-300", stat.bg, stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <p className="text-[11px] font-medium text-muted-foreground mt-4 flex items-center gap-1.5">
                <Activity className="w-3 h-3 opacity-50" />
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 bg-card border-none shadow-sm rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <CardHeader className="px-8 pt-8 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold tracking-tight text-foreground">Asset Distribution</CardTitle>
                <CardDescription className="text-xs font-medium text-muted-foreground">By infrastructure category</CardDescription>
              </div>
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Live Data</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 px-4 pb-8">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity={0.8} />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                  dy={15}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                />
                <Tooltip 
                  cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    backgroundColor: 'var(--popover)',
                    color: 'var(--popover-foreground)',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '12px'
                  }}
                />
                <Bar dataKey="value" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-card border-none shadow-sm rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <CardHeader className="px-8 pt-8 pb-4">
            <CardTitle className="text-lg font-bold tracking-tight text-foreground">Lifecycle Overview</CardTitle>
            <CardDescription className="text-xs font-medium text-muted-foreground">Asset status breakdown</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 px-8 pb-8 flex flex-col justify-between">
            <div className="relative flex-1 min-h-[225px]">
              {totalAssets === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <Package className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">No asset state data matches</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                      >
                        {statusData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const percentage = totalAssets > 0 ? Math.round((data.value / totalAssets) * 100) : 0;
                            return (
                              <div className="bg-popover text-popover-foreground px-3 py-2.5 rounded-xl shadow-lg border border-border text-xs font-bold space-y-1">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{data.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: data.color }} />
                                  <span>{data.value} {data.value === 1 ? 'Asset' : 'Assets'}</span>
                                  <span className="text-muted-foreground">({percentage}%)</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest leading-none">Total</span>
                    <span className="text-2xl font-black text-foreground tracking-tight mt-0.5">{totalAssets}</span>
                  </div>
                </>
              )}
            </div>
            <div className="space-y-3 mt-4">
              {statusData.map((entry, index) => (
                <div key={index} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: entry.color }} />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-foreground">{entry.value}</span>
                    <span className="text-[9px] font-bold text-muted-foreground/50">
                      ({totalAssets > 0 ? Math.round((entry.value / totalAssets) * 100) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Lifecycle Timeline Card */}
        <Card className="col-span-1 lg:col-span-3 bg-card border-none shadow-sm rounded-2xl overflow-hidden flex flex-col h-[500px]">
          <CardHeader className="px-8 pt-8 pb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground">Lifecycle Timeline</CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground font-sans">
                Tracking the count of status changes over time based on asset records
              </CardDescription>
            </div>
            
            {/* Elegant Selection Controls */}
            <div className="flex flex-wrap gap-2 items-center">
              <div className="flex rounded-lg bg-muted p-1 text-muted-foreground">
                <button 
                  onClick={() => setViewType('daily')}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider",
                    viewType === 'daily' 
                      ? "bg-card text-foreground shadow-sm font-black" 
                      : "hover:text-foreground"
                  )}
                >
                  Daily
                </button>
                <button 
                  onClick={() => setViewType('cumulative')}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider",
                    viewType === 'cumulative' 
                      ? "bg-card text-foreground shadow-sm font-black" 
                      : "hover:text-foreground"
                  )}
                >
                  Cumulative
                </button>
              </div>

              <div className="flex rounded-lg bg-muted p-1 text-muted-foreground">
                <button 
                  onClick={() => setDisplayMode('total')}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider",
                    displayMode === 'total' 
                      ? "bg-card text-foreground shadow-sm font-black" 
                      : "hover:text-foreground"
                  )}
                >
                  Total
                </button>
                <button 
                  onClick={() => setDisplayMode('breakdown')}
                  className={cn(
                    "px-3 py-1 text-[10px] font-bold rounded-md transition-all uppercase tracking-wider",
                    displayMode === 'breakdown' 
                      ? "bg-card text-foreground shadow-sm font-black" 
                      : "hover:text-foreground"
                  )}
                >
                  Breakdown
                </button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 px-4 pb-8 relative min-h-[350px]">
            {timelineData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <Clock className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No lifecycle history records found</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Lifecycle changes will be tracked here over time</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorProcurement" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorMaintenance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorRetired" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748b" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#64748b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorDisposal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  
                  <XAxis 
                    dataKey="displayDate" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                    dy={15}
                  />
                  
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                  />
                  
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover text-popover-foreground px-4 py-3 rounded-2xl shadow-lg border border-border text-xs font-bold space-y-2 min-w-[180px]">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                            <div className="space-y-1.5 pt-1">
                              {payload.map((p, index) => (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.stroke || p.color }} />
                                    <span className="text-muted-foreground font-semibold">{p.name || p.dataKey}</span>
                                  </div>
                                  <span className="font-black text-foreground">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fill: 'var(--muted-foreground)'
                    }}
                  />

                  {displayMode === 'total' ? (
                    <Area
                      type="monotone"
                      name="Total Changes"
                      dataKey="Total"
                      stroke="#6366f1"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorTotal)"
                    />
                  ) : (
                    <>
                      <Area
                        type="monotone"
                        name="Procurement"
                        dataKey="Procurement"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        stackId="1"
                        fillOpacity={1}
                        fill="url(#colorProcurement)"
                      />
                      <Area
                        type="monotone"
                        name="Active"
                        dataKey="Active"
                        stroke="#10b981"
                        strokeWidth={2}
                        stackId="1"
                        fillOpacity={1}
                        fill="url(#colorActive)"
                      />
                      <Area
                        type="monotone"
                        name="Maintenance"
                        dataKey="Maintenance"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        stackId="1"
                        fillOpacity={1}
                        fill="url(#colorMaintenance)"
                      />
                      <Area
                        type="monotone"
                        name="Retired"
                        dataKey="Retired"
                        stroke="#64748b"
                        strokeWidth={2}
                        stackId="1"
                        fillOpacity={1}
                        fill="url(#colorRetired)"
                      />
                      <Area
                        type="monotone"
                        name="Disposal"
                        dataKey="Disposal"
                        stroke="#ef4444"
                        strokeWidth={2}
                        stackId="1"
                        fillOpacity={1}
                        fill="url(#colorDisposal)"
                      />
                    </>
                  )}
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Monthly Trend Card: New vs Retired Assets (Last 6 Months) */}
        <Card className="col-span-1 lg:col-span-3 bg-card border-none shadow-sm rounded-2xl overflow-hidden flex flex-col h-[420px]">
          <CardHeader className="px-8 pt-8 pb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Asset Velocity Trend
              </CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground">
                6-month volume analysis of newly acquired infrastructure vs decommissioned & retired assets
              </CardDescription>
            </div>
            <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted/60 px-3.5 py-1.5 rounded-xl border border-border/40">
              <span>6-Month Slide</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 px-4 pb-8 relative min-h-[280px]">
            {monthlyTrendData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <Clock className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No trend history records found</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyTrendData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover text-popover-foreground px-4 py-3 rounded-2xl shadow-lg border border-border text-xs font-bold space-y-2 min-w-[180px]">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                            <div className="space-y-1.5 pt-1">
                              {payload.map((p, index) => (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.stroke || p.color }} />
                                    <span className="text-muted-foreground font-semibold">
                                      {p.name === 'added' ? 'New Assets Added' : 'Retired Assets'}
                                    </span>
                                  </div>
                                  <span className="font-black text-foreground">{p.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fill: 'var(--muted-foreground)'
                    }}
                  />
                  <Line
                    type="monotone"
                    name="Added"
                    dataKey="added"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                  <Line
                    type="monotone"
                    name="Retired"
                    dataKey="retired"
                    stroke="#64748b"
                    strokeWidth={3}
                    dot={{ r: 4, strokeWidth: 2 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Estimated Asset Value & Depreciation Trend Card */}
        <Card className="col-span-1 lg:col-span-3 bg-card border-none shadow-sm rounded-2xl overflow-hidden flex flex-col h-[420px]">
          <CardHeader className="px-8 pt-8 pb-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <Coins className="w-5 h-5 text-primary" />
                Asset Valuation & Depreciation Trend
              </CardTitle>
              <CardDescription className="text-xs font-medium text-muted-foreground">
                6-month book value calculation showing capital cost versus straight-line depreciated value (10% salvage limit)
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-muted/60 px-3.5 py-1.5 rounded-xl border border-border/40 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <span className="text-foreground">Current Valuation:</span>
              <span className="text-emerald-500 font-black">
                ${(valuationTrendData[valuationTrendData.length - 1]?.value || 0).toLocaleString()}
              </span>
            </div>
          </CardHeader>
          <CardContent className="flex-1 px-4 pb-8 relative min-h-[280px]">
            {valuationTrendData.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                <Clock className="w-10 h-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">No asset cost records found</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={valuationTrendData} margin={{ top: 20, right: 30, left: 15, bottom: 20 }}>
                  <defs>
                    <linearGradient id="colorValuation" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorOriginal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis 
                    dataKey="label" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                    dy={15}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
                    tickFormatter={(val) => `$${val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val}`}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-popover text-popover-foreground px-4 py-3 rounded-2xl shadow-lg border border-border text-xs font-bold space-y-2 min-w-[200px]">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
                            <div className="space-y-1.5 pt-1">
                              {payload.map((p, index) => (
                                <div key={index} className="flex items-center justify-between gap-4">
                                  <div className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.stroke || p.color }} />
                                    <span className="text-muted-foreground font-semibold">
                                      {p.name === 'Book Value' ? 'Book Value' : 'Acquisition Cost'}
                                    </span>
                                  </div>
                                  <span className="font-black text-foreground">
                                    ${Number(p.value).toLocaleString()}
                                  </span>
                                </div>
                              ))}
                              {payload.length === 2 && (
                                <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-muted-foreground font-semibold">
                                  <span>Total Depreciated:</span>
                                  <span className="text-rose-500 font-bold">
                                    -${(Number(payload[1].value) - Number(payload[0].value)).toLocaleString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36} 
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{
                      fontSize: '10px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      fill: 'var(--muted-foreground)'
                    }}
                  />
                  <Area
                    type="monotone"
                    name="Book Value"
                    dataKey="value"
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorValuation)"
                  />
                  <Area
                    type="monotone"
                    name="Acquisition Cost"
                    dataKey="originalValue"
                    stroke="#2563eb"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    fillOpacity={1}
                    fill="url(#colorOriginal)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Asset Status Distribution Section */}
      <div className="space-y-6 pt-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">Asset Status Distribution</h2>
          <p className="text-xs font-medium text-muted-foreground mt-1">Detailed structural distribution and state telemetry of managed IT assets</p>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 bg-card border-none shadow-sm rounded-2xl overflow-hidden flex flex-col justify-between p-6">
            <div className="pb-4">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Interactive Donut Analysis</CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-0.5">Hover or select slices to examine status allocations</CardDescription>
            </div>
            
            <div className="relative h-[240px] flex items-center justify-center">
              {totalAssets === 0 ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-4">
                  <Package className="w-8 h-8 text-muted-foreground/30 mb-2" />
                  <p className="text-xs font-semibold text-muted-foreground">No assets recorded</p>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={90}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                        cursor="pointer"
                        onMouseEnter={(_, index) => {
                          if (statusData[index]) {
                            setSelectedStatusTab(statusData[index].name);
                          }
                        }}
                      >
                        {statusData.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={entry.color} 
                            style={{
                              filter: selectedStatusTab === entry.name ? 'drop-shadow(0 0 6px rgba(0,0,0,0.15))' : 'none',
                              opacity: selectedStatusTab === entry.name ? 1 : 0.85,
                              transition: 'all 0.2s ease-in-out'
                            }}
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            const pct = totalAssets > 0 ? Math.round((data.value / totalAssets) * 100) : 0;
                            return (
                              <div className="bg-popover text-popover-foreground px-3 py-2 rounded-xl shadow-lg border border-border text-xs font-bold space-y-1">
                                <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{data.name}</p>
                                <div className="flex items-center gap-2">
                                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
                                  <span>{data.value} {data.value === 1 ? 'Asset' : 'Assets'}</span>
                                  <span className="text-muted-foreground font-normal">({pct}%)</span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  
                  {/* Absolute Centered Count */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none">
                      {selectedStatusTab}
                    </span>
                    <span className="text-3xl font-black text-foreground tracking-tight mt-1 leading-none">
                      {statusDistribution[selectedStatusTab] || 0}
                    </span>
                    <span className="text-[9px] font-bold text-muted-foreground/60 mt-0.5">
                      {totalAssets > 0 ? Math.round(((statusDistribution[selectedStatusTab] || 0) / totalAssets) * 100) : 0}% of total
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {/* Quick selection tags */}
            <div className="flex flex-wrap gap-1.5 justify-center mt-2 pt-2 border-t border-border/40">
              {statusData.map((entry, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedStatusTab(entry.name)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border cursor-pointer",
                    selectedStatusTab === entry.name
                      ? "bg-foreground text-background border-foreground font-extrabold"
                      : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                  )}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </Card>
          
          {/* Detailed metrics breakdown for status */}
          <Card className="lg:col-span-2 bg-card border-none shadow-sm rounded-2xl overflow-hidden p-6 flex flex-col justify-between">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/40">
              <div>
                <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <div 
                    className="w-3 h-3 rounded-full animate-pulse transition-all duration-300"
                    style={{ backgroundColor: STATUS_COLOR_MAP[selectedStatusTab] || '#2563eb' }}
                  />
                  <span>Status Inspection: <span className="text-foreground">{selectedStatusTab}</span></span>
                </CardTitle>
                <CardDescription className="text-xs text-muted-foreground mt-0.5">
                  Currently showing telemetry and item registry under {selectedStatusTab} state
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 bg-muted/60 px-3 py-1.5 rounded-xl border border-border/40 w-fit">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Allocation:</span>
                <span className="text-xs font-black text-foreground">
                  {totalAssets > 0 ? Math.round(((statusDistribution[selectedStatusTab] || 0) / totalAssets) * 100) : 0}%
                </span>
              </div>
            </div>
            
            <div className="flex-1 py-4">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-3">Asset Registry Sample ({statusDistribution[selectedStatusTab] || 0} Total)</span>
              
              {(() => {
                const filteredList = assets.filter(a => a.status === selectedStatusTab);
                if (filteredList.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center text-center py-10 text-muted-foreground bg-muted/20 rounded-xl border border-dashed border-border">
                      <Package className="w-8 h-8 text-muted-foreground/30 mb-2" />
                      <p className="text-xs font-semibold">No assets in {selectedStatusTab} status</p>
                    </div>
                  );
                }
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[220px] overflow-y-auto pr-1">
                    {filteredList.slice(0, 6).map((asset, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors"
                      >
                        <div 
                          className="w-1.5 h-10 rounded-full flex-shrink-0"
                          style={{ backgroundColor: STATUS_COLOR_MAP[selectedStatusTab] || '#2563eb' }}
                        />
                        <div className="space-y-0.5 overflow-hidden">
                          <p className="text-xs font-bold text-foreground truncate">{asset.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">TAG: {asset.assetTag} | CAT: {asset.category}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{asset.location || 'No location set'}</p>
                        </div>
                      </div>
                    ))}
                    {filteredList.length > 6 && (
                      <div className="col-span-1 sm:col-span-2 flex justify-center pt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 px-3 py-1 rounded-full border border-border/40">
                          + {filteredList.length - 6} more assets in this status
                        </span>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
            
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-border/40 text-center">
              <div className="space-y-0.5 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Procurement</span>
                <span className="text-sm font-black text-foreground">{statusDistribution['Procurement'] || 0}</span>
              </div>
              <div className="space-y-0.5 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Active</span>
                <span className="text-sm font-black text-foreground">{statusDistribution['Active'] || 0}</span>
              </div>
              <div className="space-y-0.5 bg-muted/20 p-2.5 rounded-xl border border-border/40">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground block">Maintenance</span>
                <span className="text-sm font-black text-foreground">{statusDistribution['Maintenance'] || 0}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
