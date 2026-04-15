import React from 'react';
import { 
  Search, 
  Filter, 
  Plus, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  ExternalLink,
  Download,
  FileSpreadsheet,
  Calendar as CalendarIcon,
  Package,
  ChevronLeft,
  ChevronRight,
  Zap,
  AlertOctagon,
  ArrowRight,
  Activity,
  CheckCircle2,
  ShieldCheck,
  XCircle,
  FileText,
  ShieldAlert,
  History,
  Clock
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Asset, AssetCategory, AssetStatus, StatusHistoryEntry, Baseline } from '@/src/types';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AssetListProps {
  assets: Asset[];
  baselines: Baseline[];
  onAdd: () => void;
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  userRole: string;
}

export default function AssetList({ assets, baselines, onAdd, onEdit, onDelete, userRole }: AssetListProps) {
  const [search, setSearch] = React.useState('');
  const [categoryFilter, setCategoryFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [locationFilter, setLocationFilter] = React.useState<string>('all');
  const [complianceFilter, setComplianceFilter] = React.useState<string>('all');
  const [historyAsset, setHistoryAsset] = React.useState<Asset | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  // Extract unique locations for filter
  const uniqueLocations = React.useMemo(() => {
    const locations = new Set<string>();
    assets.forEach(a => {
      if (a.location) locations.add(a.location);
    });
    return Array.from(locations).sort();
  }, [assets]);

  const filteredAssets = assets.filter(asset => {
    const matchesSearch = 
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.assetTag.toLowerCase().includes(search.toLowerCase()) ||
      asset.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
      asset.vendor?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesLocation = locationFilter === 'all' || asset.location === locationFilter;
    const matchesCompliance = complianceFilter === 'all' || 
      (complianceFilter === 'compliant' && asset.compliance?.isCompliant !== false) ||
      (complianceFilter === 'non-compliant' && asset.compliance?.isCompliant === false);

    return matchesSearch && matchesCategory && matchesStatus && matchesLocation && matchesCompliance;
  });

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, locationFilter, complianceFilter]);

  const totalPages = Math.ceil(filteredAssets.length / itemsPerPage);
  const paginatedAssets = filteredAssets.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadge = (status: AssetStatus) => {
    const variants: Record<AssetStatus, string> = {
      Active: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none',
      Maintenance: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-none',
      Retired: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-none',
      Disposal: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-none',
      Procurement: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-none',
    };
    return <Badge className={cn("rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-none", variants[status])}>{status}</Badge>;
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Tag', 'Category', 'Vendor', 'Model', 'Serial Number', 'Status', 'Location', 'Assigned To', 'Purchase Date', 'Warranty Expiry'];
    const rows = filteredAssets.map(a => [
      a.name, 
      a.assetTag, 
      a.category, 
      a.vendor || '', 
      a.model || '', 
      a.serialNumber || '',
      a.status, 
      a.location || '',
      a.assignedTo || '',
      a.purchaseDate || '',
      a.warrantyExpiry || ''
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `assets_export_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-1 items-center gap-3 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search assets, serials, or vendors..." 
              className="pl-11 h-10 bg-muted border-border rounded-full text-sm focus-visible:ring-primary/20 shadow-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button variant="outline" className="h-10 gap-2 border-border text-xs font-bold uppercase tracking-wider" onClick={exportToCSV}>
            <FileSpreadsheet className="w-4 h-4" />
            Export
          </Button>
          {userRole === 'admin' && (
            <Button className="h-10 gap-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-none" onClick={onAdd}>
              <Plus className="w-4 h-4" />
              Add Asset
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-card border-border text-[11px] font-semibold uppercase tracking-tight shadow-none">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="Server">Server</SelectItem>
            <SelectItem value="Network">Network</SelectItem>
            <SelectItem value="Storage">Storage</SelectItem>
            <SelectItem value="Endpoint">Endpoint</SelectItem>
            <SelectItem value="Software">Software</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-card border-border text-[11px] font-semibold uppercase tracking-tight shadow-none">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Maintenance">Maintenance</SelectItem>
            <SelectItem value="Retired">Retired</SelectItem>
            <SelectItem value="Procurement">Procurement</SelectItem>
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-card border-border text-[11px] font-semibold uppercase tracking-tight shadow-none">
            <SelectValue placeholder="Location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {uniqueLocations.map(loc => (
              <SelectItem key={loc} value={loc}>{loc}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={complianceFilter} onValueChange={setComplianceFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-card border-border text-[11px] font-semibold uppercase tracking-tight shadow-none">
            <SelectValue placeholder="Compliance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Compliance</SelectItem>
            <SelectItem value="compliant">Compliant</SelectItem>
            <SelectItem value="non-compliant">Non-Compliant</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden shadow-none">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="hover:bg-transparent border-border">
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-3 px-6">Asset Tag</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Name / Model</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Location / Assigned</TableHead>
              <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedAssets.length > 0 ? (
              paginatedAssets.map((asset) => (
                <TableRow key={asset.id} className="group hover:bg-muted/50 transition-colors border-border">
                  <TableCell className="py-4 px-6">
                    <code className="text-[11px] text-primary font-bold font-mono">{asset.assetTag}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">{asset.name}</span>
                        {asset.compliance?.isCompliant === false && (
                          <ShieldAlert className="w-3 h-3 text-rose-500" />
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{asset.vendor} {asset.model}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[12px] font-medium text-muted-foreground">{asset.category}</span>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(asset.status)}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-[12px] text-foreground font-medium">{asset.location || 'N/A'}</span>
                      <span className="text-[11px] text-muted-foreground">{asset.assignedTo || 'Unassigned'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-muted-foreground hover:text-foreground")}>
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-lg shadow-xl border-border bg-popover text-popover-foreground">
                        <DropdownMenuItem className="gap-2 cursor-pointer text-xs font-medium" onClick={() => onEdit(asset)}>
                          <Edit2 className="w-3.5 h-3.5" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer text-xs font-medium" onClick={() => setHistoryAsset(asset)}>
                          <ExternalLink className="w-3.5 h-3.5" /> View History
                        </DropdownMenuItem>
                        {userRole === 'admin' && (
                          <>
                            <DropdownMenuSeparator className="bg-border" />
                            <DropdownMenuItem 
                              className="gap-2 text-destructive focus:text-destructive cursor-pointer text-xs font-medium"
                              onClick={() => asset.id && onDelete(asset.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete Asset
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-64 text-center">
                  <div className="flex flex-col items-center justify-center text-muted-foreground">
                    <Package className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm font-bold uppercase tracking-wider">No assets found</p>
                    <p className="text-xs">Try adjusting your search or filters</p>
                  </div>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">
          Showing {Math.min(filteredAssets.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredAssets.length, currentPage * itemsPerPage)} of {filteredAssets.length} assets
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0 border-border" 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="text-[11px] font-bold text-foreground px-2">
            Page {currentPage} of {totalPages || 1}
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-8 w-8 p-0 border-border" 
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages || totalPages === 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <Dialog open={!!historyAsset} onOpenChange={(open) => !open && setHistoryAsset(null)}>
        <DialogContent className="max-w-2xl rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-card text-card-foreground">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-xl font-bold tracking-tight">Asset Details & Relationships</DialogTitle>
              <DialogDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {historyAsset?.name} ({historyAsset?.assetTag})
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="history" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-8 bg-muted p-1 rounded-xl">
                <TabsTrigger value="history" className="rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Status</TabsTrigger>
                <TabsTrigger value="versions" className="rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Versions</TabsTrigger>
                <TabsTrigger value="relationships" className="rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Links</TabsTrigger>
                <TabsTrigger value="impact" className="rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Impact</TabsTrigger>
                <TabsTrigger value="compliance" className="rounded-lg text-xs font-bold uppercase tracking-wider data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Compliance</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-0">
                <div className="space-y-6 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border max-h-[400px] overflow-y-auto pr-2">
                  {historyAsset?.statusHistory?.slice().reverse().map((entry, i) => (
                    <div key={i} className="relative pl-8">
                      <div className={cn(
                        "absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-card flex items-center justify-center shadow-sm",
                        entry.status === 'Active' ? "bg-emerald-500" : 
                        entry.status === 'Maintenance' ? "bg-amber-500" : 
                        entry.status === 'Retired' ? "bg-slate-400" : 
                        entry.status === 'Disposal' ? "bg-rose-500" : "bg-blue-500"
                      )}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-foreground">{entry.status}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">
                            {entry.changedAt?.toDate ? format(entry.changedAt.toDate(), 'MMM d, yyyy') : 'N/A'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{entry.notes || 'No notes provided'}</p>
                        <span className="text-[10px] font-semibold text-muted-foreground mt-1 uppercase tracking-tight">
                          Changed by: {entry.changedBy}
                        </span>
                      </div>
                    </div>
                  ))}
                  {(!historyAsset?.statusHistory || historyAsset.statusHistory.length === 0) && (
                    <p className="text-center text-xs text-muted-foreground py-8">No history entries found.</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="versions" className="mt-0">
                <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Record Version History</h4>
                    <Badge variant="outline" className="text-[10px] font-bold bg-muted">Current v{historyAsset?.version || 1}</Badge>
                  </div>

                  <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-border before:via-border before:to-transparent">
                    {/* Current Version */}
                    <div className="relative flex items-start gap-4 group">
                      <div className="mt-1.5 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 z-10">
                        <History className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 p-4 rounded-2xl bg-muted/50 border border-border">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-foreground">Current Version (v{historyAsset?.version || 1})</span>
                          <span className="text-[10px] font-medium text-muted-foreground">Active</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Last updated: {historyAsset?.updatedAt?.toDate ? format(historyAsset.updatedAt.toDate(), 'MMM d, yyyy HH:mm') : 'N/A'}</p>
                      </div>
                    </div>

                    {/* Previous Versions */}
                    {historyAsset?.versionHistory?.slice().reverse().map((v, idx) => (
                      <div key={idx} className="relative flex items-start gap-4 group">
                        <div className="mt-1.5 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0 z-10">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-foreground">Version {v.version}</span>
                            <span className="text-[10px] font-medium text-muted-foreground">{v.changedAt?.toDate ? format(v.changedAt.toDate(), 'MMM d, yyyy') : 'N/A'}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-2">{v.changeReason || 'No reason provided'}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[9px] font-bold bg-muted text-muted-foreground uppercase tracking-tighter">BY: {v.changedBy.slice(0, 8)}</Badge>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!historyAsset?.versionHistory || historyAsset.versionHistory.length === 0) && (
                      <div className="text-center py-8">
                        <p className="text-xs text-slate-400 italic">No previous versions recorded.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="relationships" className="mt-0">
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-3">Relationship</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Asset</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {historyAsset?.relatedAssets && historyAsset.relatedAssets.length > 0 ? (
                        historyAsset.relatedAssets.map((rel, i) => {
                          const targetAsset = assets.find(a => a.id === rel.targetAssetId);
                          return (
                            <TableRow key={i} className="hover:bg-muted/30 border-border">
                              <TableCell className="py-3">
                                <Badge variant="outline" className="text-[9px] font-bold uppercase border-border text-primary bg-card">
                                  {rel.type}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs font-semibold text-foreground">
                                {rel.targetAssetName}
                              </TableCell>
                              <TableCell className="text-[11px] text-muted-foreground">
                                {targetAsset?.category || 'N/A'}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="h-32 text-center text-xs text-muted-foreground italic">
                            No CI relationships defined for this asset.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                
                {/* Inverse Relationships (Assets that point to this one) */}
                {assets.some(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id)) && (
                  <div className="mt-6">
                    <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Referenced By</h5>
                    <div className="rounded-xl border border-border overflow-hidden">
                      <Table>
                        <TableBody>
                          {assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id)).map((a, i) => {
                            const rel = a.relatedAssets?.find(r => r.targetAssetId === historyAsset?.id);
                            return (
                              <TableRow key={i} className="hover:bg-muted/30 border-border">
                                <TableCell className="py-3 text-xs font-semibold text-foreground">
                                  {a.name}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase border-border text-muted-foreground bg-card">
                                    {rel?.type === 'Parent' ? 'Child' : 
                                     rel?.type === 'Child' ? 'Parent' : 
                                     rel?.type === 'Depends On' ? 'Required By' : 
                                     rel?.type === 'Required By' ? 'Depends On' : 'Linked'}
                                  </Badge>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="impact" className="mt-0">
                <div className="space-y-6">
                  <div className={cn(
                    "p-4 rounded-2xl border flex items-center gap-4",
                    historyAsset?.status === 'Active' ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                  )}>
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                      historyAsset?.status === 'Active' ? "bg-emerald-500" : "bg-rose-500"
                    )}>
                      <Activity className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">Current Operational Status: {historyAsset?.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {historyAsset?.status === 'Active' 
                          ? "This asset is currently healthy and providing services." 
                          : "This asset is offline. Downstream services may be degraded."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-foreground">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">Downstream Impact Path</h4>
                    </div>

                    <div className="space-y-3">
                      {/* Direct Dependencies */}
                      {assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id && (r.type === 'Depends On' || r.type === 'Child'))).length > 0 ? (
                        assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id && (r.type === 'Depends On' || r.type === 'Child'))).map((affected, i) => (
                          <div key={i} className="flex items-start gap-4 group">
                            <div className="flex flex-col items-center">
                              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center border border-border">
                                <Package className="w-4 h-4 text-muted-foreground" />
                              </div>
                              <div className="w-0.5 h-8 bg-border group-last:hidden" />
                            </div>
                            <div className="flex-1 pt-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-foreground">{affected.name}</span>
                                <Badge variant="outline" className="text-[9px] font-bold border-rose-500/20 text-rose-600 dark:text-rose-400 bg-rose-500/10">CRITICAL IMPACT</Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {affected.category} • {affected.relatedAssets?.find(r => r.targetAssetId === historyAsset?.id)?.type === 'Depends On' ? 'Direct Dependency' : 'Component of Parent'}
                              </p>
                              
                              {/* Second Level Impact (Simple recursion simulation) */}
                              {assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === affected.id && r.type === 'Depends On')).map((cascading, j) => (
                                <div key={j} className="mt-3 ml-4 flex items-center gap-3 p-2 rounded-lg bg-muted/50 border border-border">
                                  <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                                  <div className="flex flex-col">
                                    <span className="text-[11px] font-semibold text-muted-foreground">{cascading.name}</span>
                                    <span className="text-[9px] text-muted-foreground/50 uppercase font-bold">Cascading Failure Risk</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-50" />
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No Downstream Dependencies</p>
                          <p className="text-[10px] text-muted-foreground">Failure of this asset has no direct impact on other tracked CIs.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-slate-900 dark:bg-black text-white space-y-2">
                    <div className="flex items-center gap-2">
                      <AlertOctagon className="w-4 h-4 text-rose-500" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Incident Response Recommendation</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {historyAsset?.status === 'Active' 
                        ? "In the event of failure, notify owners of the downstream assets listed above. Prepare failover procedures for critical dependencies." 
                        : "Asset is currently OFFLINE. Verify status of downstream dependencies and initiate disaster recovery protocols if required."}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="compliance" className="mt-0">
                <div className="space-y-6">
                  {historyAsset?.baselineId ? (
                    (() => {
                      const baseline = baselines.find(b => b.id === historyAsset.baselineId);
                      if (!baseline) return <p className="text-center text-xs text-muted-foreground py-8">Assigned baseline not found.</p>;

                      const deviations: string[] = [];
                      if (baseline.expectedVendor && historyAsset.vendor !== baseline.expectedVendor) {
                        deviations.push(`Vendor mismatch: Expected ${baseline.expectedVendor}, found ${historyAsset.vendor}`);
                      }
                      if (baseline.expectedModel && historyAsset.model !== baseline.expectedModel) {
                        deviations.push(`Model mismatch: Expected ${baseline.expectedModel}, found ${historyAsset.model}`);
                      }
                      
                      Object.entries(baseline.requiredSpecs || {}).forEach(([k, v]) => {
                        if (historyAsset.specs?.[k] !== v) {
                          deviations.push(`Spec deviation [${k}]: Expected ${v}, found ${historyAsset.specs?.[k] || 'N/A'}`);
                        }
                      });

                      const isCompliant = deviations.length === 0 && 
                                          historyAsset.compliance?.licenseStatus !== 'Expired' && 
                                          historyAsset.compliance?.warrantyStatus !== 'Expired';

                      return (
                        <div className="space-y-6 max-h-[450px] overflow-y-auto pr-2">
                          <div className={cn(
                            "p-6 rounded-2xl border flex items-center gap-4",
                            isCompliant ? "bg-emerald-500/10 border-emerald-500/20" : "bg-rose-500/10 border-rose-500/20"
                          )}>
                            <div className={cn(
                              "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm",
                              isCompliant ? "bg-emerald-500" : "bg-rose-500"
                            )}>
                              {isCompliant ? <ShieldCheck className="w-6 h-6 text-white" /> : <ShieldAlert className="w-6 h-6 text-white" />}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground">
                                {isCompliant ? "Asset Fully Compliant" : "Compliance Issues Detected"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Last Audit: <span className="font-bold text-foreground">{historyAsset.compliance?.lastAuditDate ? format(historyAsset.compliance.lastAuditDate.toDate(), 'MMM d, yyyy') : 'Never'}</span>
                              </p>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Governance & Licensing</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase text-muted-foreground">License Status</span>
                                  {historyAsset.compliance?.licenseStatus === 'Valid' ? 
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : 
                                    <AlertOctagon className="w-3 h-3 text-rose-500" />
                                  }
                                </div>
                                <p className="text-xs font-bold text-foreground">{historyAsset.compliance?.licenseStatus || 'N/A'}</p>
                                <p className="text-[10px] text-muted-foreground font-mono truncate">{historyAsset.compliance?.licenseKey || 'No key stored'}</p>
                              </div>
                              <div className="p-3 rounded-xl bg-muted/30 border border-border space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold uppercase text-muted-foreground">Warranty Status</span>
                                  {historyAsset.compliance?.warrantyStatus === 'Active' ? 
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : 
                                    <AlertOctagon className="w-3 h-3 text-rose-500" />
                                  }
                                </div>
                                <p className="text-xs font-bold text-foreground">{historyAsset.compliance?.warrantyStatus || 'N/A'}</p>
                                <p className="text-[10px] text-muted-foreground">Expires: {historyAsset.warrantyExpiry || 'N/A'}</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Baseline Compliance Audit</h4>
                            <div className="space-y-2">
                              {/* Vendor Check */}
                              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                                <span className="text-xs font-semibold text-muted-foreground">Vendor Standard</span>
                                {baseline.expectedVendor ? (
                                  historyAsset.vendor === baseline.expectedVendor ? 
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                                    <Badge variant="destructive" className="text-[9px] font-bold">NON-COMPLIANT</Badge>
                                ) : <span className="text-[10px] text-muted-foreground italic">Not defined</span>}
                              </div>

                              {/* Model Check */}
                              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                                <span className="text-xs font-semibold text-muted-foreground">Model Standard</span>
                                {baseline.expectedModel ? (
                                  historyAsset.model === baseline.expectedModel ? 
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                                    <Badge variant="destructive" className="text-[9px] font-bold">NON-COMPLIANT</Badge>
                                ) : <span className="text-[10px] text-muted-foreground italic">Not defined</span>}
                              </div>

                              {/* Specs Check */}
                              {Object.entries(baseline.requiredSpecs || {}).map(([k, v]) => (
                                <div key={k} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border">
                                  <span className="text-xs font-semibold text-muted-foreground">Spec: {k} ({v})</span>
                                  {historyAsset.specs?.[k] === v ? 
                                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : 
                                    <Badge variant="destructive" className="text-[9px] font-bold">NON-COMPLIANT</Badge>
                                  }
                                </div>
                              ))}
                            </div>
                          </div>

                          {!isCompliant && (
                            <div className="p-4 rounded-xl bg-rose-900 text-white space-y-2">
                              <div className="flex items-center gap-2">
                                <AlertOctagon className="w-4 h-4 text-rose-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest">Remediation Required</span>
                              </div>
                              <ul className="text-[11px] text-rose-100 list-disc list-inside space-y-1">
                                {deviations.map((d, i) => <li key={i}>{d}</li>)}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 bg-muted/30 rounded-2xl border border-dashed border-border">
                      <ShieldCheck className="w-8 h-8 text-muted-foreground mb-2 opacity-50" />
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No Baseline Assigned</p>
                      <p className="text-[10px] text-muted-foreground">Assign a configuration baseline to enable compliance tracking.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
              <Button variant="outline" onClick={() => setHistoryAsset(null)} className="text-xs font-bold uppercase tracking-wider">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
