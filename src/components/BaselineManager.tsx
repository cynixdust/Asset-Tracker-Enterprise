import React from 'react';
import { 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Settings2,
  Save,
  ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Baseline, AssetCategory } from '@/src/types';
import { firestoreService } from '@/src/lib/firestore';
import { toast } from 'sonner';

interface BaselineManagerProps {
  baselines: Baseline[];
}

export default function BaselineManager({ baselines }: BaselineManagerProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  
  const [newBaseline, setNewBaseline] = React.useState<Partial<Baseline>>({
    name: '',
    category: 'Server',
    expectedVendor: '',
    expectedModel: '',
    requiredSpecs: {},
    description: ''
  });

  const [specKey, setSpecKey] = React.useState('');
  const [specValue, setSpecValue] = React.useState('');

  const handleSave = async () => {
    if (!newBaseline.name || !newBaseline.category) {
      toast.error('Name and Category are required');
      return;
    }

    try {
      await firestoreService.add('baselines', newBaseline);
      toast.success('Baseline template created');
      setIsAdding(false);
      setNewBaseline({
        name: '',
        category: 'Server',
        expectedVendor: '',
        expectedModel: '',
        requiredSpecs: {},
        description: ''
      });
    } catch (error) {
      toast.error('Failed to save baseline');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this baseline template?')) return;
    try {
      await firestoreService.delete('baselines', id);
      toast.success('Baseline deleted');
    } catch (error) {
      toast.error('Failed to delete baseline');
    }
  };

  const addSpec = () => {
    if (!specKey || !specValue) return;
    setNewBaseline(prev => ({
      ...prev,
      requiredSpecs: {
        ...prev.requiredSpecs,
        [specKey]: specValue
      }
    }));
    setSpecKey('');
    setSpecValue('');
  };

  const removeSpec = (key: string) => {
    setNewBaseline(prev => {
      const next = { ...prev.requiredSpecs };
      delete next[key];
      return { ...prev, requiredSpecs: next };
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Configuration Baselines</h2>
          <p className="text-sm text-muted-foreground">Define approved standard configurations for your infrastructure.</p>
        </div>
        <Button onClick={() => setIsAdding(!isAdding)} className="gap-2 shadow-lg shadow-primary/20">
          {isAdding ? 'Cancel' : <><Plus className="w-4 h-4" /> Create Template</>}
        </Button>
      </div>

      {isAdding && (
        <Card className="border-none shadow-xl bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">New Baseline Template</CardTitle>
            <CardDescription>Specify the standard attributes for this asset class.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Template Name</label>
                <Input 
                  placeholder="e.g. Standard Production Web Server" 
                  value={newBaseline.name}
                  onChange={e => setNewBaseline({...newBaseline, name: e.target.value})}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Asset Category</label>
                <Select 
                  value={newBaseline.category} 
                  onValueChange={(v: AssetCategory) => setNewBaseline({...newBaseline, category: v})}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Server">Server</SelectItem>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Storage">Storage</SelectItem>
                    <SelectItem value="Endpoint">Endpoint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approved Vendor</label>
                <Input 
                  placeholder="e.g. Dell" 
                  value={newBaseline.expectedVendor}
                  onChange={e => setNewBaseline({...newBaseline, expectedVendor: e.target.value})}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approved Model</label>
                <Input 
                  placeholder="e.g. PowerEdge R740" 
                  value={newBaseline.expectedModel}
                  onChange={e => setNewBaseline({...newBaseline, expectedModel: e.target.value})}
                  className="bg-card"
                />
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <div className="flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary" />
                <h4 className="text-xs font-bold uppercase tracking-wider">Required Technical Specs</h4>
              </div>
              
              <div className="flex gap-3">
                <Input 
                  placeholder="Spec Name (e.g. RAM)" 
                  value={specKey}
                  onChange={e => setSpecKey(e.target.value)}
                  className="bg-card"
                />
                <Input 
                  placeholder="Expected Value (e.g. 64GB)" 
                  value={specValue}
                  onChange={e => setSpecValue(e.target.value)}
                  className="bg-card"
                />
                <Button variant="outline" onClick={addSpec} className="bg-card">Add</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {Object.entries(newBaseline.requiredSpecs || {}).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="pl-3 pr-1 py-1 gap-2 bg-card border-border text-foreground">
                    <span className="font-bold">{k}:</span> {v}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-4 w-4 hover:text-rose-500"
                      onClick={() => removeSpec(k)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" /> Save Template
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {baselines.map((baseline) => (
          <Card key={baseline.id} className="group hover:shadow-lg transition-all duration-300 border-border overflow-hidden bg-card text-card-foreground">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex items-center justify-between mb-2">
                <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest border-primary/20 text-primary bg-card">
                  {baseline.category}
                </Badge>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-500"
                  onClick={() => baseline.id && handleDelete(baseline.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <CardTitle className="text-lg">{baseline.name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-[11px]">
                <div>
                  <p className="text-muted-foreground uppercase font-bold tracking-tight mb-1">Vendor</p>
                  <p className="font-semibold text-foreground">{baseline.expectedVendor || 'Any'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground uppercase font-bold tracking-tight mb-1">Model</p>
                  <p className="font-semibold text-foreground">{baseline.expectedModel || 'Any'}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Required Specs</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(baseline.requiredSpecs || {}).map(([k, v]) => (
                    <div key={k} className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                      {k}: {v}
                    </div>
                  ))}
                  {Object.keys(baseline.requiredSpecs || {}).length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">No specific specs required</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {baselines.length === 0 && !isAdding && (
          <div className="col-span-full py-20 text-center bg-muted/30 rounded-3xl border-2 border-dashed border-border">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No Baselines Defined</p>
            <p className="text-xs text-muted-foreground mt-1">Create configuration templates to ensure infrastructure compliance.</p>
          </div>
        )}
      </div>
    </div>
  );
}
