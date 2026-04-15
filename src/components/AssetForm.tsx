import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  Plus, 
  Trash2, 
  Link as LinkIcon, 
  Settings2, 
  Loader2,
  Package,
  Calendar as CalendarIcon
} from 'lucide-react';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Asset, RelationshipType, Baseline } from '@/src/types';
import { firestoreService } from '@/src/lib/firestore';
import { toast } from 'sonner';

const assetSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  assetTag: z.string().min(2, 'Asset Tag is required'),
  category: z.enum(['Server', 'Network', 'Storage', 'Endpoint', 'Software', 'Other']),
  vendor: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().optional(),
  warrantyExpiry: z.string().optional(),
  nextMaintenanceDate: z.string().optional(),
  status: z.enum(['Procurement', 'Active', 'Maintenance', 'Retired', 'Disposal']),
  location: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  baselineId: z.string().optional(),
  specs: z.record(z.string(), z.string()).optional(),
  relatedAssets: z.array(z.object({
    targetAssetId: z.string(),
    targetAssetName: z.string(),
    type: z.enum(['Parent', 'Child', 'Depends On', 'Required By', 'Connected To'])
  })).optional(),
  compliance: z.object({
    licenseStatus: z.enum(['Valid', 'Expired', 'Missing', 'N/A']),
    licenseKey: z.string().optional(),
    warrantyStatus: z.enum(['Active', 'Expired', 'N/A']),
    securityStandards: z.array(z.string()).optional(),
  }).optional(),
});

interface AssetFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: any) => void;
  initialData?: Asset | null;
  allAssets?: Asset[];
  baselines?: Baseline[];
}

export default function AssetForm({ open, onOpenChange, onSubmit, initialData, allAssets = [], baselines = [] }: AssetFormProps) {
  const [newRelAssetId, setNewRelAssetId] = React.useState('');
  const [newRelType, setNewRelType] = React.useState<RelationshipType>('Connected To');
  const [specKey, setSpecKey] = React.useState('');
  const [specValue, setSpecValue] = React.useState('');
  const [isCheckingUniqueness, setIsCheckingUniqueness] = React.useState(false);

  const form = useForm<z.infer<typeof assetSchema>>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      name: '',
      assetTag: '',
      category: 'Endpoint',
      vendor: '',
      model: '',
      serialNumber: '',
      purchaseDate: '',
      warrantyExpiry: '',
      nextMaintenanceDate: '',
      status: 'Active',
      location: '',
      assignedTo: '',
      notes: '',
      baselineId: '',
      specs: {},
      relatedAssets: [],
      compliance: {
        licenseStatus: 'N/A',
        licenseKey: '',
        warrantyStatus: 'N/A',
        securityStandards: [],
      },
    },
  });

  const specs = form.watch('specs') || {};

  const addSpec = () => {
    if (!specKey || !specValue) return;
    form.setValue('specs', { ...specs, [specKey]: specValue });
    setSpecKey('');
    setSpecValue('');
  };

  const removeSpec = (key: string) => {
    const next = { ...specs };
    delete next[key];
    form.setValue('specs', next);
  };

  const applyBaseline = (baselineId: string) => {
    const baseline = baselines.find(b => b.id === baselineId);
    if (!baseline) return;

    form.setValue('baselineId', baselineId);
    if (baseline.expectedVendor) form.setValue('vendor', baseline.expectedVendor);
    if (baseline.expectedModel) form.setValue('model', baseline.expectedModel);
    if (baseline.requiredSpecs) {
      form.setValue('specs', { ...specs, ...baseline.requiredSpecs });
    }
  };

  const relatedAssets = form.watch('relatedAssets') || [];

  const addRelationship = () => {
    if (!newRelAssetId) return;
    const targetAsset = allAssets.find(a => a.id === newRelAssetId);
    if (!targetAsset) return;

    if (relatedAssets.some(r => r.targetAssetId === newRelAssetId)) return;

    form.setValue('relatedAssets', [
      ...relatedAssets,
      { 
        targetAssetId: targetAsset.id!, 
        targetAssetName: targetAsset.name, 
        type: newRelType 
      }
    ]);
    setNewRelAssetId('');
  };

  const removeRelationship = (id: string) => {
    form.setValue('relatedAssets', relatedAssets.filter(r => r.targetAssetId !== id));
  };

  React.useEffect(() => {
    if (initialData) {
      form.reset({
        name: initialData.name,
        assetTag: initialData.assetTag,
        category: initialData.category,
        vendor: initialData.vendor || '',
        model: initialData.model || '',
        serialNumber: initialData.serialNumber || '',
        purchaseDate: initialData.purchaseDate || '',
        warrantyExpiry: initialData.warrantyExpiry || '',
        nextMaintenanceDate: initialData.nextMaintenanceDate || '',
        status: initialData.status,
        location: initialData.location || '',
        assignedTo: initialData.assignedTo || '',
        notes: initialData.notes || '',
        baselineId: initialData.baselineId || '',
        specs: initialData.specs || {},
        relatedAssets: initialData.relatedAssets || [],
        compliance: initialData.compliance || {
          licenseStatus: 'N/A',
          licenseKey: '',
          warrantyStatus: 'N/A',
          securityStandards: [],
        },
      });
    } else {
      form.reset({
        name: '',
        assetTag: '',
        category: 'Endpoint',
        vendor: '',
        model: '',
        serialNumber: '',
        purchaseDate: '',
        warrantyExpiry: '',
        nextMaintenanceDate: '',
        status: 'Active',
        location: '',
        assignedTo: '',
        notes: '',
        baselineId: '',
        specs: {},
        relatedAssets: [],
        compliance: {
          licenseStatus: 'N/A',
          licenseKey: '',
          warrantyStatus: 'N/A',
          securityStandards: [],
        },
      });
    }
  }, [initialData, form]);

  const handleFormSubmit = async (data: any) => {
    setIsCheckingUniqueness(true);
    try {
      // Check Asset Tag uniqueness
      const isTagUnique = await firestoreService.checkUniqueness('assets', 'assetTag', data.assetTag, initialData?.id);
      if (!isTagUnique) {
        form.setError('assetTag', { message: 'Asset Tag must be unique' });
        setIsCheckingUniqueness(false);
        return;
      }

      // Check Serial Number uniqueness if provided
      if (data.serialNumber) {
        const isSerialUnique = await firestoreService.checkUniqueness('assets', 'serialNumber', data.serialNumber, initialData?.id);
        if (!isSerialUnique) {
          form.setError('serialNumber', { message: 'Serial Number must be unique' });
          setIsCheckingUniqueness(false);
          return;
        }
      }

      await onSubmit(data);
    } catch (error) {
      toast.error('Validation failed');
    } finally {
      setIsCheckingUniqueness(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] sm:max-w-6xl max-h-[95vh] overflow-y-auto rounded-[32px] border-none shadow-2xl p-0 bg-card text-card-foreground">
        <div className="p-0">
          <div className="px-8 md:px-12 pt-10 md:pt-12 pb-6 md:pb-8 border-b border-border bg-muted/30">
            <DialogHeader>
              <DialogTitle className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                {initialData ? 'Edit Asset' : 'Add New Asset'}
              </DialogTitle>
              <DialogDescription className="text-muted-foreground text-base md:text-lg mt-2 font-medium">
                {initialData ? 'Update the details of the existing asset.' : 'Enter the details of the new infrastructure asset.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="p-6 md:p-12 space-y-10 md:space-y-12">
              {/* General Information Section */}
              <div className="space-y-6 md:space-y-8">
                <div className="flex items-center gap-4 text-primary">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                    <Package className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold uppercase tracking-[0.2em]">General Information</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-12 gap-y-6 md:gap-y-8">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Asset Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Core Switch 01" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assetTag"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Asset Tag / ID</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. AST-2024-001" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Category</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5">
                              <SelectValue placeholder="Select category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-2xl border-border shadow-xl">
                            <SelectItem value="Server">Server</SelectItem>
                            <SelectItem value="Network">Network</SelectItem>
                            <SelectItem value="Storage">Storage</SelectItem>
                            <SelectItem value="Endpoint">Endpoint</SelectItem>
                            <SelectItem value="Software">Software</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Vendor</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Cisco, Dell" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Model</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Catalyst 9300" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="serialNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Serial Number</FormLabel>
                        <FormControl>
                          <Input placeholder="S/N" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Lifecycle & Assignment Section */}
              <div className="space-y-6 md:space-y-8">
                <div className="flex items-center gap-4 text-primary">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                    <CalendarIcon className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold uppercase tracking-[0.2em]">Lifecycle & Assignment</h4>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 md:gap-x-12 gap-y-6 md:gap-y-8">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-2xl border-border shadow-xl">
                            <SelectItem value="Procurement">Procurement</SelectItem>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Maintenance">Maintenance</SelectItem>
                            <SelectItem value="Retired">Retired</SelectItem>
                            <SelectItem value="Disposal">Disposal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Location</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. DC-01, Rack 4" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Assigned To</FormLabel>
                        <FormControl>
                          <Input placeholder="User or Department" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchaseDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Purchase Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="warrantyExpiry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Warranty Expiry</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="nextMaintenanceDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Next Maintenance</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} className="h-12 md:h-14 bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base px-5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-black uppercase text-muted-foreground tracking-widest ml-1">Additional Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Enter any additional details, configuration notes, or history..." 
                          {...field} 
                          className="min-h-[120px] bg-muted/50 border-border focus:bg-card focus:ring-2 focus:ring-primary/20 transition-all rounded-2xl text-base p-5 resize-none" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Compliance & Governance Section */}
              <div className="p-6 md:p-10 rounded-[32px] md:rounded-[40px] bg-muted/30 border border-border space-y-8 md:space-y-10 shadow-inner">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 text-primary">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-base font-bold uppercase tracking-[0.2em]">Compliance & Governance</h4>
                  </div>
                  <FormField
                    control={form.control}
                    name="baselineId"
                    render={({ field }) => (
                      <div className="flex items-center gap-4">
                        <span className="hidden sm:inline text-[11px] font-black uppercase text-muted-foreground tracking-widest whitespace-nowrap">Baseline Template:</span>
                        <Select onValueChange={applyBaseline} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11 w-full md:w-[240px] bg-card border-border text-xs font-bold rounded-xl shadow-sm">
                              <SelectValue placeholder="Select baseline" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border-border shadow-xl">
                            <SelectItem value="none">No Baseline</SelectItem>
                            {baselines
                              .filter(b => b.category === form.watch('category'))
                              .map(b => (
                                <SelectItem key={b.id} value={b.id!}>{b.name}</SelectItem>
                              ))
                            }
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
                  <FormField
                    control={form.control}
                    name="compliance.licenseStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">License Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 bg-card border-border rounded-2xl shadow-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border-border shadow-xl">
                            <SelectItem value="Valid">Valid</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            <SelectItem value="Missing">Missing</SelectItem>
                            <SelectItem value="N/A">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="compliance.licenseKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">License Key / ID</FormLabel>
                        <FormControl>
                          <Input {...field} className="h-12 bg-card border-border rounded-2xl shadow-sm px-4" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="compliance.warrantyStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Warranty Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 bg-card border-border rounded-2xl shadow-sm">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="rounded-xl border-border shadow-xl">
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Expired">Expired</SelectItem>
                            <SelectItem value="N/A">N/A</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="compliance.securityStandards"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[10px] font-black uppercase text-muted-foreground tracking-widest ml-1">Security Standards</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="ISO27001, SOC2" 
                            value={field.value?.join(', ') || ''}
                            onChange={e => field.onChange(e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                            className="h-12 bg-card border-border rounded-2xl shadow-sm px-4" 
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* Technical Specifications Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-4 text-primary">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                    <Settings2 className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold uppercase tracking-[0.2em]">Technical Specifications</h4>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  <Input 
                    placeholder="Spec Name (e.g. RAM)" 
                    value={specKey}
                    onChange={e => setSpecKey(e.target.value)}
                    className="h-12 md:h-14 bg-muted/50 border-border rounded-2xl flex-1 px-5 text-base"
                  />
                  <Input 
                    placeholder="Value (e.g. 64GB)" 
                    value={specValue}
                    onChange={e => setSpecValue(e.target.value)}
                    className="h-12 md:h-14 bg-muted/50 border-border rounded-2xl flex-1 px-5 text-base"
                  />
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="h-12 md:h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs shadow-md hover:shadow-lg transition-all"
                    onClick={addSpec}
                  >
                    <Plus className="w-5 h-5 mr-3" /> Add Spec
                  </Button>
                </div>

                <div className="flex flex-wrap gap-4">
                  {Object.entries(specs).map(([k, v]) => (
                    <Badge key={k} variant="secondary" className="pl-6 pr-3 py-3 gap-4 bg-card border border-border text-foreground rounded-2xl shadow-sm hover:border-primary/30 transition-colors">
                      <span className="text-[11px] font-black uppercase text-muted-foreground tracking-widest">{k}:</span> 
                      <span className="font-bold text-sm">{v}</span>
                      <Button 
                        type="button"
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 rounded-full hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                        onClick={() => removeSpec(k)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </Badge>
                  ))}
                  {Object.keys(specs).length === 0 && (
                    <div className="w-full py-10 text-center bg-muted/30 rounded-[32px] border border-dashed border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No technical specifications added yet</p>
                    </div>
                  )}
                </div>
              </div>

              {/* CI Relationships Section */}
              <div className="space-y-8">
                <div className="flex items-center gap-4 text-primary">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-sm">
                    <LinkIcon className="w-5 h-5" />
                  </div>
                  <h4 className="text-base font-bold uppercase tracking-[0.2em]">CI Relationships</h4>
                </div>
                
                <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                  <div className="flex-1">
                    <Select value={newRelAssetId} onValueChange={setNewRelAssetId}>
                      <SelectTrigger className="h-12 md:h-14 bg-muted/50 border-border rounded-2xl px-5 text-base">
                        <SelectValue placeholder="Select asset to link..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border shadow-xl">
                        {allAssets
                          .filter(a => a.id !== initialData?.id)
                          .map(a => (
                            <SelectItem key={a.id} value={a.id!}>{a.name} ({a.assetTag})</SelectItem>
                          ))
                        }
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-full md:w-64">
                    <Select value={newRelType} onValueChange={(v: any) => setNewRelType(v)}>
                      <SelectTrigger className="h-12 md:h-14 bg-muted/50 border-border rounded-2xl px-5 text-base">
                        <SelectValue placeholder="Relationship" />
                      </SelectTrigger>
                      <SelectContent className="rounded-2xl border-border shadow-xl">
                        <SelectItem value="Parent">Parent</SelectItem>
                        <SelectItem value="Child">Child</SelectItem>
                        <SelectItem value="Depends On">Depends On</SelectItem>
                        <SelectItem value="Required By">Required By</SelectItem>
                        <SelectItem value="Connected To">Connected To</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    type="button" 
                    variant="secondary" 
                    className="h-12 md:h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs shadow-md hover:shadow-lg transition-all"
                    onClick={addRelationship}
                  >
                    <Plus className="w-5 h-5 mr-3" /> Link Asset
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                  {relatedAssets.map((rel, i) => (
                    <div key={i} className="flex items-center justify-between p-4 md:p-6 rounded-[24px] md:rounded-[32px] bg-card border border-border shadow-sm hover:border-primary/20 transition-all group">
                      <div className="flex items-center gap-4 md:gap-5">
                        <div className="px-3 py-1.5 rounded-xl bg-muted border border-border text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                          {rel.type}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">{rel.targetAssetName}</span>
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Linked CI</span>
                        </div>
                      </div>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        className="h-10 w-10 rounded-2xl opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                        onClick={() => removeRelationship(rel.targetAssetId)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  {relatedAssets.length === 0 && (
                    <div className="col-span-full py-10 md:py-12 text-center bg-muted/30 rounded-[32px] border border-dashed border-border">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No relationships defined for this CI</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="pt-8 md:pt-12 flex flex-col sm:flex-row items-center justify-end gap-4 md:gap-6 border-t border-border">
                <Button 
                  type="button" 
                  variant="ghost" 
                  onClick={() => onOpenChange(false)} 
                  className="w-full sm:w-auto h-14 md:h-16 px-10 text-muted-foreground font-black uppercase tracking-widest text-xs hover:bg-muted rounded-2xl transition-colors"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="w-full sm:w-auto h-14 md:h-16 px-16 bg-primary text-primary-foreground font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-primary/30 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50" 
                  disabled={isCheckingUniqueness}
                >
                  {isCheckingUniqueness && <Loader2 className="w-5 h-5 mr-3 animate-spin" />}
                  {initialData ? 'Update Asset Record' : 'Create Asset Record'}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
