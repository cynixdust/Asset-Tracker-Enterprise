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
  Upload,
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
  FileText,
  ShieldAlert,
  History,
  Clock,
  Printer
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
import QRScanner from './QRScanner';
import BulkImportModal from './BulkImportModal';
import { generateAssetLabel, generateBulkAssetLabels } from '../utils/labelGenerator';
import { generateSummaryReport } from '../utils/reportGenerator';
import { toast } from 'sonner';
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
  const [warrantyFilter, setWarrantyFilter] = React.useState<string>('all');
  const [selectedAssetId, setSelectedAssetId] = React.useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const historyAsset = React.useMemo(() => 
    assets.find(a => a.id === selectedAssetId) || null, 
    [assets, selectedAssetId]
  );

  const getWarrantyRemainingDays = (expiryStr?: string): number | null => {
    if (!expiryStr) return null;
    try {
      const expiryDate = new Date(expiryStr);
      if (isNaN(expiryDate.getTime())) return null;
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expiryDate.setHours(0, 0, 0, 0);
      
      const diffTime = expiryDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (e) {
      return null;
    }
  };

  const isWarrantyExpiringSoon = (expiryStr?: string): boolean => {
    const days = getWarrantyRemainingDays(expiryStr);
    return days !== null && days >= 0 && days <= 30;
  };

  const expiringWarrantiesCount = React.useMemo(() => {
    return assets.filter(a => isWarrantyExpiringSoon(a.warrantyExpiry)).length;
  }, [assets]);

  React.useEffect(() => {
    const handleViewAssetEvent = (e: any) => {
      if (e.detail?.assetId) {
        setSelectedAssetId(e.detail.assetId);
        setSearch('');
        setCategoryFilter('all');
        setStatusFilter('all');
        setLocationFilter('all');
        setComplianceFilter('all');
        setWarrantyFilter('all');
      }
    };
    window.addEventListener('view-asset' as any, handleViewAssetEvent);
    return () => window.removeEventListener('view-asset' as any, handleViewAssetEvent);
  }, []);

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    try {
      if (typeof date.toDate === 'function') {
        return format(date.toDate(), 'MMM d, yyyy');
      }
      if (date instanceof Date) {
        return format(date, 'MMM d, yyyy');
      }
      if (typeof date === 'string') {
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM d, yyyy');
      }
    } catch (e) {
      console.error('Date formatting error:', e);
    }
    return 'N/A';
  };

  const formatDateTime = (date: any) => {
    if (!date) return 'N/A';
    try {
      if (typeof date.toDate === 'function') {
        return format(date.toDate(), 'MMM d, yyyy HH:mm');
      }
      if (date instanceof Date) {
        return format(date, 'MMM d, yyyy HH:mm');
      }
      if (typeof date === 'string') {
        const d = new Date(date);
        return isNaN(d.getTime()) ? 'N/A' : format(d, 'MMM d, yyyy HH:mm');
      }
    } catch (e) {
      console.error('Date formatting error:', e);
    }
    return 'N/A';
  };
  
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

    let matchesWarranty = true;
    if (warrantyFilter === 'expiring') {
      matchesWarranty = isWarrantyExpiringSoon(asset.warrantyExpiry);
    } else if (warrantyFilter === 'expired') {
      const days = getWarrantyRemainingDays(asset.warrantyExpiry);
      matchesWarranty = days !== null && days < 0;
    } else if (warrantyFilter === 'active') {
      const days = getWarrantyRemainingDays(asset.warrantyExpiry);
      matchesWarranty = days !== null && days > 30;
    }

    return matchesSearch && matchesCategory && matchesStatus && matchesLocation && matchesCompliance && matchesWarranty;
  });

  // Reset to page 1 when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, categoryFilter, statusFilter, locationFilter, complianceFilter, warrantyFilter]);

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
          <QRScanner iconOnly triggerClassName="h-10 w-10 flex-shrink-0 border-border bg-muted/60 text-muted-foreground hover:text-foreground hover:bg-muted" />
        </div>
        
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button variant="outline" className="h-10 gap-2 border-border text-xs font-bold uppercase tracking-wider" onClick={exportToCSV}>
            <FileSpreadsheet className="w-4 h-4" />
            Export
          </Button>
          <Button 
            variant="outline" 
            className="h-10 gap-2 border-border text-xs font-bold uppercase tracking-wider bg-muted/20 hover:bg-muted/40"
            onClick={async () => {
              if (filteredAssets.length === 0) {
                toast.error('No assets in the current filter to generate a report');
                return;
              }
              const filtersPayload = {
                search,
                category: categoryFilter,
                status: statusFilter,
                location: locationFilter,
                compliance: complianceFilter,
                warranty: warrantyFilter
              };
              const promise = generateSummaryReport(filteredAssets, filtersPayload);
              toast.promise(promise, {
                loading: 'Compiling inventory summary report...',
                success: 'Summary PDF report generated successfully!',
                error: 'Failed to generate summary PDF report'
              });
            }}
          >
            <FileText className="w-4 h-4" />
            Summary Report
          </Button>
          {userRole === 'admin' && (
            <>
              <Button 
                variant="outline" 
                className="h-10 gap-2 border-border text-xs font-bold uppercase tracking-wider bg-muted/20" 
                onClick={async () => {
                  if (filteredAssets.length === 0) {
                    toast.error('No assets in the current filter to print');
                    return;
                  }
                  const promise = generateBulkAssetLabels(filteredAssets);
                  toast.promise(promise, {
                    loading: `Generating ${filteredAssets.length} bulk labels...`,
                    success: 'Bulk labels PDF generated successfully!',
                    error: 'Failed to generate bulk labels'
                  });
                }}
              >
                <Printer className="w-4 h-4" />
                Print Labels ({filteredAssets.length})
              </Button>
              <Button variant="outline" className="h-10 gap-2 border-border text-xs font-bold uppercase tracking-wider bg-muted/20" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="w-4 h-4" />
                Bulk Import
              </Button>
              <Button className="h-10 gap-2 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-none" onClick={onAdd}>
                <Plus className="w-4 h-4" />
                Add Asset
              </Button>
            </>
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

        <Select value={warrantyFilter} onValueChange={setWarrantyFilter}>
          <SelectTrigger className="w-[160px] h-9 bg-card border-border text-[11px] font-semibold uppercase tracking-tight shadow-none">
            <SelectValue placeholder="Warranty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Warranties</SelectItem>
            <SelectItem value="expiring">Expiring (30 Days)</SelectItem>
            <SelectItem value="expired">Expired</SelectItem>
            <SelectItem value="active">Active (&gt;30 Days)</SelectItem>
          </SelectContent>
        </Select>

        {expiringWarrantiesCount > 0 && (
          <button
            onClick={() => setWarrantyFilter(warrantyFilter === 'expiring' ? 'all' : 'expiring')}
            className={cn(
              "flex items-center gap-1.5 px-3 h-9 text-[10px] font-bold uppercase tracking-wider rounded-lg border transition-all shadow-none cursor-pointer",
              warrantyFilter === 'expiring'
                ? "bg-amber-500 text-white border-amber-500 hover:bg-amber-600"
                : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
            )}
          >
            <AlertOctagon className="w-3.5 h-3.5 text-amber-500" />
            {expiringWarrantiesCount} Expiring Soon
          </button>
        )}
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
                      {isWarrantyExpiringSoon(asset.warrantyExpiry) && (
                        <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full w-fit">
                          <AlertOctagon className="w-3 h-3 text-amber-500" />
                          <span>Warranty expires in {getWarrantyRemainingDays(asset.warrantyExpiry)} days</span>
                        </div>
                      )}
                      {(() => {
                        const days = getWarrantyRemainingDays(asset.warrantyExpiry);
                        if (days !== null && days < 0) {
                          return (
                            <div className="flex items-center gap-1 mt-1 text-[10px] font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full w-fit">
                              <AlertOctagon className="w-3 h-3 text-rose-500" />
                              <span>Warranty expired {Math.abs(days)} days ago</span>
                            </div>
                          );
                        }
                        return null;
                      })()}
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
                        <DropdownMenuItem className="gap-2 cursor-pointer text-xs font-medium" onClick={() => setSelectedAssetId(asset.id || null)}>
                          <ExternalLink className="w-3.5 h-3.5" /> View History
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="gap-2 cursor-pointer text-xs font-medium" 
                          onClick={async () => {
                            const promise = generateAssetLabel(asset);
                            toast.promise(promise, {
                              loading: `Generating label PDF for ${asset.assetTag}...`,
                              success: 'Label PDF generated successfully!',
                              error: 'Failed to generate label PDF'
                            });
                          }}
                        >
                          <Printer className="w-3.5 h-3.5" /> Print Label
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

      <Dialog open={!!selectedAssetId} onOpenChange={(open) => !open && setSelectedAssetId(null)}>
        <DialogContent className="max-w-2xl rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-card text-card-foreground">
          <div className="p-8">
            <DialogHeader className="mb-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <DialogTitle className="text-xl font-bold tracking-tight">Asset Details & Relationships</DialogTitle>
                  <DialogDescription className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    {historyAsset?.name} ({historyAsset?.assetTag})
                  </DialogDescription>
                </div>
                {historyAsset && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 border-border text-xs font-bold uppercase tracking-wider bg-muted/20 hover:bg-muted/40 cursor-pointer"
                    onClick={async () => {
                      const promise = generateAssetLabel(historyAsset);
                      toast.promise(promise, {
                        loading: `Generating label PDF for ${historyAsset.assetTag}...`,
                        success: 'Label PDF generated successfully!',
                        error: 'Failed to generate label PDF'
                      });
                    }}
                  >
                    <Printer className="w-3.5 h-3.5" />
                    Print Label
                  </Button>
                )}
              </div>
            </DialogHeader>

            <Tabs defaultValue="history" className="w-full">
              <TabsList className="flex w-full mb-8 bg-muted p-1 rounded-xl overflow-x-auto no-scrollbar">
                <TabsTrigger value="history" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-wider data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm px-2">Status</TabsTrigger>
                <TabsTrigger value="versions" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-wider data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm px-2">Versions</TabsTrigger>
                <TabsTrigger value="relationships" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-wider data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm px-2">Links</TabsTrigger>
                <TabsTrigger value="impact" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-wider data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm px-2">Impact</TabsTrigger>
                <TabsTrigger value="compliance" className="flex-1 rounded-lg text-[10px] font-bold uppercase tracking-wider data-[active]:bg-card data-[active]:text-foreground data-[active]:shadow-sm px-2">Compliance</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-0 outline-none">
                <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/50 max-h-[450px] overflow-y-auto pr-4 -mr-4 custom-scrollbar">
                  {historyAsset?.statusHistory?.slice().reverse().map((entry, i) => (
                    <div key={i} className="relative pl-10 group">
                      <div className={cn(
                        "absolute left-0 top-1.5 w-6 h-6 rounded-full border-4 border-card flex items-center justify-center shadow-sm z-10 transition-transform group-hover:scale-110",
                        entry.status === 'Active' ? "bg-emerald-500" : 
                        entry.status === 'Maintenance' ? "bg-amber-500" : 
                        entry.status === 'Retired' ? "bg-slate-400" : 
                        entry.status === 'Disposal' ? "bg-rose-500" : "bg-blue-500"
                      )}>
                        <div className="w-1.5 h-1.5 rounded-full bg-white dark:bg-slate-900" />
                      </div>
                      
                      <div className="flex flex-col gap-3 p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-border hover:bg-muted/50 transition-all">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Status</span>
                            <span className="text-sm font-bold text-foreground">{entry.status}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Date</span>
                            <span className="text-[11px] font-semibold text-foreground">
                              {formatDate(entry.changedAt)}
                            </span>
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Notes</span>
                          <p className="text-xs text-foreground leading-relaxed">{entry.notes || 'Initial record creation'}</p>
                        </div>
                        
                        <div className="pt-2 border-t border-border/50 flex items-center justify-between">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Changed By</span>
                            <span className="text-[10px] font-mono text-muted-foreground break-all max-w-[300px]">
                              {entry.changedBy}
                            </span>
                          </div>
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/30" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {(!historyAsset?.statusHistory || historyAsset.statusHistory.length === 0) && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <History className="w-12 h-12 text-muted-foreground/20 mb-4" />
                      <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">No history entries found</p>
                      <p className="text-xs text-muted-foreground/60">This asset has no recorded status changes.</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="versions" className="mt-0 outline-none">
                <div className="space-y-6 max-h-[450px] overflow-y-auto pr-4 -mr-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex flex-col gap-0.5">
                      <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Record Version History</h4>
                      <p className="text-[11px] text-muted-foreground">Audit trail of all schema changes</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold bg-primary/5 text-primary border-primary/20 px-3 py-1">Current v{historyAsset?.version || 1}</Badge>
                  </div>

                  <div className="relative space-y-6 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/50 before:via-border before:to-transparent">
                    {/* Current Version */}
                    <div className="relative flex items-start gap-4 group">
                      <div className="mt-1.5 w-10 h-10 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 z-10 ring-4 ring-card">
                        <History className="w-5 h-5 text-primary-foreground" />
                      </div>
                      <div className="flex-1 p-5 rounded-2xl bg-primary/5 border border-primary/20 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-foreground">Current Version (v{historyAsset?.version || 1})</span>
                          <Badge className="text-[9px] font-bold bg-emerald-500 text-white border-none">ACTIVE</Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                          Last updated: {formatDateTime(historyAsset?.updatedAt)}
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center">
                            <Clock className="w-2.5 h-2.5 text-muted-foreground" />
                          </div>
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-tight">System Managed</span>
                        </div>
                      </div>
                    </div>

                    {/* Previous Versions */}
                    {historyAsset?.versionHistory?.slice().reverse().map((v, idx) => (
                      <div key={idx} className="relative flex items-start gap-4 group">
                        <div className="mt-1.5 w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center shrink-0 z-10 group-hover:border-primary/50 transition-colors">
                          <Clock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <div className="flex-1 p-5 rounded-2xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-foreground">Version {v.version}</span>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{formatDate(v.changedAt)}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mb-4 leading-relaxed">{v.changeReason || 'No change reason documented'}</p>
                          <div className="flex items-center justify-between pt-3 border-t border-border/50">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Author:</span>
                              <Badge variant="secondary" className="text-[9px] font-bold bg-muted text-muted-foreground uppercase tracking-tighter px-2">
                                {v.changedBy.slice(0, 12)}...
                              </Badge>
                            </div>
                            <Button variant="ghost" size="sm" className="h-6 text-[9px] font-bold uppercase tracking-widest text-primary hover:bg-primary/5">Details</Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {(!historyAsset?.versionHistory || historyAsset.versionHistory.length === 0) && (
                      <div className="flex flex-col items-center justify-center py-12 text-center bg-muted/20 rounded-2xl border border-dashed border-border">
                        <History className="w-10 h-10 text-muted-foreground/20 mb-3" />
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">No version history</p>
                        <p className="text-[10px] text-muted-foreground/60">This is the initial version of the record.</p>
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="relationships" className="mt-0 outline-none">
                <div className="space-y-6 max-h-[450px] overflow-y-auto pr-4 -mr-4">
                  <div className="flex flex-col gap-1 mb-2">
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Configuration Item Links</h4>
                    <p className="text-[11px] text-muted-foreground">Direct dependencies and parent/child relationships</p>
                  </div>

                  <div className="rounded-2xl border border-border overflow-hidden bg-muted/20">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow className="hover:bg-transparent border-border">
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-3 px-4">Relationship</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Target Asset</TableHead>
                          <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                          <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-4">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {historyAsset?.relatedAssets && historyAsset.relatedAssets.length > 0 ? (
                          historyAsset.relatedAssets.map((rel, i) => {
                            const targetAsset = assets.find(a => a.id === rel.targetAssetId);
                            return (
                              <TableRow key={i} className="hover:bg-muted/30 border-border group">
                                <TableCell className="py-3 px-4">
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase border-primary/20 text-primary bg-primary/5">
                                    {rel.type}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-semibold text-foreground">
                                  {rel.targetAssetName}
                                </TableCell>
                                <TableCell className="text-[11px] text-muted-foreground">
                                  {targetAsset?.category || 'N/A'}
                                </TableCell>
                                <TableCell className="text-right pr-4">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4} className="h-32 text-center">
                              <div className="flex flex-col items-center justify-center gap-2">
                                <Zap className="w-8 h-8 text-muted-foreground/20" />
                                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">No CI relationships defined</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  
                  {/* Inverse Relationships */}
                  {assets.some(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id)) && (
                    <div className="mt-8">
                      <div className="flex flex-col gap-1 mb-4">
                        <h5 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Referenced By</h5>
                        <p className="text-[11px] text-muted-foreground">Assets that depend on this configuration item</p>
                      </div>
                      <div className="rounded-2xl border border-border overflow-hidden bg-muted/20">
                        <Table>
                          <TableBody>
                            {assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id)).map((a, i) => {
                              const rel = a.relatedAssets?.find(r => r.targetAssetId === historyAsset?.id);
                              return (
                                <TableRow key={i} className="hover:bg-muted/30 border-border">
                                  <TableCell className="py-3 px-4 text-xs font-semibold text-foreground">
                                    {a.name}
                                  </TableCell>
                                  <TableCell className="text-[11px] text-muted-foreground">
                                    {a.category}
                                  </TableCell>
                                  <TableCell className="text-right pr-4">
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
                </div>
              </TabsContent>

              <TabsContent value="impact" className="mt-0 outline-none">
                <div className="space-y-6 max-h-[450px] overflow-y-auto pr-4 -mr-4">
                  <div className={cn(
                    "p-5 rounded-2xl border flex items-center gap-5 transition-all",
                    historyAsset?.status === 'Active' ? "bg-emerald-500/5 border-emerald-500/20 shadow-sm shadow-emerald-500/5" : "bg-rose-500/5 border-rose-500/20 shadow-sm shadow-rose-500/5"
                  )}>
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                      historyAsset?.status === 'Active' ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20"
                    )}>
                      <Activity className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Current Operational Status</p>
                      <p className="text-base font-bold text-foreground">{historyAsset?.status}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {historyAsset?.status === 'Active' 
                          ? "This asset is currently healthy and providing services to downstream dependencies." 
                          : "This asset is offline. All downstream services and dependent CIs are at risk."}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-foreground">
                        <Zap className="w-4 h-4 text-amber-500" />
                        <h4 className="text-[10px] font-bold uppercase tracking-widest">Downstream Impact Path</h4>
                      </div>
                      <Badge variant="outline" className="text-[9px] font-bold bg-muted border-border">REAL-TIME ANALYSIS</Badge>
                    </div>

                    <div className="space-y-4 relative before:absolute before:left-4 before:top-8 before:bottom-0 before:w-0.5 before:bg-border/50">
                      {/* Direct Dependencies */}
                      {assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id && (r.type === 'Depends On' || r.type === 'Child'))).length > 0 ? (
                        assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === historyAsset?.id && (r.type === 'Depends On' || r.type === 'Child'))).map((affected, i) => (
                          <div key={i} className="relative flex items-start gap-6 group">
                            <div className="mt-1 w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm z-10 group-hover:border-rose-500/30 transition-colors">
                              <Package className="w-4 h-4 text-muted-foreground group-hover:text-rose-500 transition-colors" />
                            </div>
                            <div className="flex-1 p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-border hover:bg-muted/50 transition-all">
                              <div className="flex items-center justify-between gap-4 mb-1">
                                <span className="text-xs font-bold text-foreground">{affected.name}</span>
                                <Badge variant="outline" className="text-[9px] font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2">CRITICAL IMPACT</Badge>
                              </div>
                              <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-medium">
                                {affected.category} • {affected.relatedAssets?.find(r => r.targetAssetId === historyAsset?.id)?.type === 'Depends On' ? 'Direct Dependency' : 'Component of Parent'}
                              </p>
                              
                              {/* Second Level Impact */}
                              {assets.filter(a => a.relatedAssets?.some(r => r.targetAssetId === affected.id && r.type === 'Depends On')).map((cascading, j) => (
                                <div key={j} className="mt-4 ml-2 flex items-center gap-3 p-3 rounded-xl bg-card/50 border border-border/50">
                                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-[11px] font-bold text-muted-foreground">{cascading.name}</span>
                                    <span className="text-[9px] text-muted-foreground/60 uppercase font-bold tracking-tighter">Cascading Failure Risk</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-3xl border border-dashed border-border/60">
                          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-6 h-6 text-emerald-500 opacity-60" />
                          </div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Isolated CI</p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1">Failure of this asset has no direct downstream impact.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-950 text-white space-y-3 shadow-xl shadow-slate-950/20">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                      <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Incident Response Protocol</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {historyAsset?.status === 'Active' 
                        ? "In the event of failure, notify owners of the downstream assets listed above. Prepare failover procedures for critical dependencies." 
                        : "Asset is currently OFFLINE. Verify status of downstream dependencies and initiate disaster recovery protocols if required."}
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="compliance" className="mt-0 outline-none">
                <div className="space-y-6 max-h-[450px] overflow-y-auto pr-4 -mr-4">
                  {historyAsset?.baselineId ? (
                    (() => {
                      const baseline = baselines.find(b => b.id === historyAsset.baselineId);
                      if (!baseline) return (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <ShieldAlert className="w-12 h-12 text-muted-foreground/20 mb-4" />
                          <p className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Baseline Not Found</p>
                          <p className="text-xs text-muted-foreground/60">The assigned baseline record has been deleted.</p>
                        </div>
                      );

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
                        <div className="space-y-6">
                          <div className={cn(
                            "p-6 rounded-2xl border flex items-center gap-5 transition-all",
                            isCompliant ? "bg-emerald-500/5 border-emerald-500/20 shadow-sm shadow-emerald-500/5" : "bg-rose-500/5 border-rose-500/20 shadow-sm shadow-rose-500/5"
                          )}>
                            <div className={cn(
                              "w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shrink-0",
                              isCompliant ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20"
                            )}>
                              {isCompliant ? <ShieldCheck className="w-7 h-7 text-white" /> : <ShieldAlert className="w-7 h-7 text-white" />}
                            </div>
                            <div className="flex flex-col gap-1">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Compliance Posture</p>
                              <p className="text-base font-bold text-foreground">
                                {isCompliant ? "Asset Fully Compliant" : "Compliance Issues Detected"}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                Last Audit: <span className="font-bold text-foreground">{formatDate(historyAsset.compliance?.lastAuditDate)}</span>
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Licensing</span>
                                {historyAsset.compliance?.licenseStatus === 'Valid' ? 
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : 
                                  <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                                }
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-foreground">{historyAsset.compliance?.licenseStatus || 'N/A'}</p>
                                <p className="text-[10px] font-mono text-muted-foreground truncate bg-card/50 p-1 rounded border border-border/50">{historyAsset.compliance?.licenseKey || 'No key stored'}</p>
                              </div>
                            </div>
                            <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Warranty</span>
                                {historyAsset.compliance?.warrantyStatus === 'Active' ? 
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : 
                                  <AlertOctagon className="w-3.5 h-3.5 text-rose-500" />
                                }
                              </div>
                              <div className="space-y-1">
                                <p className="text-xs font-bold text-foreground">{historyAsset.compliance?.warrantyStatus || 'N/A'}</p>
                                <p className="text-[10px] text-muted-foreground">Expires: <span className="font-semibold text-foreground">{historyAsset.warrantyExpiry || 'N/A'}</span></p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Baseline Audit Results</h4>
                              <Badge variant="secondary" className="text-[9px] font-bold uppercase tracking-tighter">{baseline.name}</Badge>
                            </div>
                            <div className="space-y-2">
                              {/* Vendor Check */}
                              <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:bg-muted/30 transition-colors group">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Vendor Standard</span>
                                  <span className="text-xs font-semibold text-foreground">{baseline.expectedVendor || 'Not defined'}</span>
                                </div>
                                {baseline.expectedVendor ? (
                                  historyAsset.vendor === baseline.expectedVendor ? 
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : 
                                    <Badge variant="destructive" className="text-[9px] font-bold px-2">DEVIATION</Badge>
                                ) : null}
                              </div>

                              {/* Model Check */}
                              <div className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:bg-muted/30 transition-colors group">
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Model Standard</span>
                                  <span className="text-xs font-semibold text-foreground">{baseline.expectedModel || 'Not defined'}</span>
                                </div>
                                {baseline.expectedModel ? (
                                  historyAsset.model === baseline.expectedModel ? 
                                    <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : 
                                    <Badge variant="destructive" className="text-[9px] font-bold px-2">DEVIATION</Badge>
                                ) : null}
                              </div>

                              {/* Specs Check */}
                              {Object.entries(baseline.requiredSpecs || {}).map(([k, v]) => {
                                const actualValue = historyAsset.specs?.[k] || 'N/A';
                                const isMatch = actualValue === v;
                                return (
                                  <div key={k} className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:bg-muted/30 transition-colors group">
                                    <div className="flex flex-col gap-0.5">
                                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Spec: {k}</span>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-semibold text-foreground">Expected: {v}</span>
                                        <span className={cn("text-[11px] font-medium", isMatch ? "text-emerald-500" : "text-rose-500")}>
                                          Found: {actualValue}
                                        </span>
                                      </div>
                                    </div>
                                    {isMatch ? 
                                      <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : 
                                      <Badge variant="destructive" className="text-[9px] font-bold px-2">DEVIATION</Badge>
                                    }
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          {!isCompliant && (
                            <div className="p-5 rounded-2xl bg-rose-950 text-white space-y-3 shadow-xl shadow-rose-950/20">
                              <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-rose-400" />
                                <span className="text-[10px] font-bold uppercase tracking-widest text-rose-300">Remediation Required</span>
                              </div>
                              <ul className="space-y-2">
                                {deviations.map((d, i) => (
                                  <li key={i} className="flex items-start gap-2 text-[11px] text-rose-100/80">
                                    <div className="w-1 h-1 rounded-full bg-rose-400 mt-1.5 shrink-0" />
                                    {d}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 bg-muted/20 rounded-3xl border border-dashed border-border/60">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                        <ShieldCheck className="w-6 h-6 text-muted-foreground opacity-40" />
                      </div>
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No Baseline Assigned</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">Assign a configuration baseline to enable compliance tracking.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end">
              <Button variant="outline" onClick={() => setSelectedAssetId(null)} className="text-xs font-bold uppercase tracking-wider">
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <BulkImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        existingAssets={assets}
        baselines={baselines}
        userRole={userRole}
      />
    </div>
  );
}
