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
  Legend
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
  ShieldCheck
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

  // Category distribution
  const categoryData = Object.entries(
    assets.reduce((acc, a) => {
      acc[a.category] = (acc[a.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

  // Status distribution
  const statusData = Object.entries(
    assets.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name, value }));

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
          <CardContent className="flex-1 px-8 pb-8 flex flex-col">
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      borderRadius: '12px', 
                      border: 'none', 
                      backgroundColor: 'var(--popover)',
                      color: 'var(--popover-foreground)',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-4 mt-6">
              {statusData.map((entry, index) => (
                <div key={index} className="flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider group-hover:text-foreground transition-colors">{entry.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-black text-foreground">{entry.value}</span>
                    <span className="text-[9px] font-bold text-muted-foreground/50">({Math.round((entry.value / totalAssets) * 100)}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
