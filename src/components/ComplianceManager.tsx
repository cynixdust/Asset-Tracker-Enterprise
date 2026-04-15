import React from 'react';
import { 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  FileText,
  ShieldAlert
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
import { Policy, Asset, AssetCategory } from '@/src/types';
import { firestoreService } from '@/src/lib/firestore';
import { toast } from 'sonner';

interface ComplianceManagerProps {
  assets: Asset[];
  policies: Policy[];
}

export default function ComplianceManager({ assets, policies }: ComplianceManagerProps) {
  const [isAdding, setIsAdding] = React.useState(false);
  
  const [newPolicy, setNewPolicy] = React.useState<Partial<Policy>>({
    name: '',
    description: '',
    category: 'All',
    severity: 'Medium',
    type: 'Security'
  });

  const handleSavePolicy = async () => {
    if (!newPolicy.name || !newPolicy.type) {
      toast.error('Name and Type are required');
      return;
    }

    try {
      await firestoreService.add('policies', newPolicy);
      toast.success('Policy created');
      setIsAdding(false);
      setNewPolicy({
        name: '',
        description: '',
        category: 'All',
        severity: 'Medium',
        type: 'Security'
      });
    } catch (error) {
      toast.error('Failed to save policy');
    }
  };

  const handleDeletePolicy = async (id: string) => {
    try {
      await firestoreService.delete('policies', id);
      toast.success('Policy deleted');
    } catch (error) {
      toast.error('Failed to delete policy');
    }
  };

  const handleAuditAll = async () => {
    toast.loading('Running system-wide compliance audit...', { id: 'audit' });
    try {
      const today = new Date();
      
      for (const asset of assets) {
        if (!asset.id) continue;

        const violations: string[] = [];
        let licenseStatus = asset.compliance?.licenseStatus || 'N/A';
        let warrantyStatus = asset.compliance?.warrantyStatus || 'N/A';

        // Check Warranty
        if (asset.warrantyExpiry) {
          const expiry = new Date(asset.warrantyExpiry);
          if (expiry < today) {
            warrantyStatus = 'Expired';
            violations.push('Warranty has expired');
          } else {
            warrantyStatus = 'Active';
          }
        }

        // Check License (Simple logic)
        if (asset.category === 'Software' && !asset.compliance?.licenseKey) {
          licenseStatus = 'Missing';
          violations.push('Software license key is missing');
        }

        const isCompliant = violations.length === 0;

        await firestoreService.update('assets', asset.id, {
          compliance: {
            ...asset.compliance,
            licenseStatus,
            warrantyStatus,
            isCompliant,
            policyViolations: violations,
            lastAuditDate: new Date()
          }
        });
      }
      toast.success('Audit completed successfully', { id: 'audit' });
    } catch (error) {
      toast.error('Audit failed', { id: 'audit' });
    }
  };

  const getComplianceStats = () => {
    const total = assets.length;
    const compliant = assets.filter(a => a.compliance?.isCompliant !== false).length;
    const nonCompliant = total - compliant;
    const expiredWarranty = assets.filter(a => a.compliance?.warrantyStatus === 'Expired').length;
    const expiredLicense = assets.filter(a => a.compliance?.licenseStatus === 'Expired').length;

    return { total, compliant, nonCompliant, expiredWarranty, expiredLicense };
  };

  const stats = getComplianceStats();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Compliance & Governance</h2>
          <p className="text-sm text-muted-foreground">Monitor infrastructure adherence to corporate policies and standards.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={handleAuditAll} className="gap-2">
            <ShieldCheck className="w-4 h-4" /> Run System Audit
          </Button>
          <Button onClick={() => setIsAdding(!isAdding)} className="gap-2 shadow-lg shadow-primary/20">
            {isAdding ? 'Cancel' : <><Plus className="w-4 h-4" /> Create Policy</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-emerald-500/10 dark:bg-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Compliant Assets</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.compliant} / {stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-rose-500/10 dark:bg-rose-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">Non-Compliant</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.nonCompliant}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-amber-500/10 dark:bg-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">Warranty Issues</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.expiredWarranty}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-blue-500/10 dark:bg-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">License Issues</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.expiredLicense}</p>
          </CardContent>
        </Card>
      </div>

      {isAdding && (
        <Card className="border-none shadow-xl bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">New Compliance Policy</CardTitle>
            <CardDescription>Define a rule to track asset compliance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Policy Name</label>
                <Input 
                  placeholder="e.g. Server Warranty Check" 
                  value={newPolicy.name}
                  onChange={e => setNewPolicy({...newPolicy, name: e.target.value})}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Policy Type</label>
                <Select 
                  value={newPolicy.type} 
                  onValueChange={(v: any) => setNewPolicy({...newPolicy, type: v})}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Warranty">Warranty Compliance</SelectItem>
                    <SelectItem value="License">Software Licensing</SelectItem>
                    <SelectItem value="Security">Security Standards</SelectItem>
                    <SelectItem value="Custom">Custom Rule</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Applicable Category</label>
                <Select 
                  value={newPolicy.category} 
                  onValueChange={(v: any) => setNewPolicy({...newPolicy, category: v})}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Categories</SelectItem>
                    <SelectItem value="Server">Server</SelectItem>
                    <SelectItem value="Network">Network</SelectItem>
                    <SelectItem value="Storage">Storage</SelectItem>
                    <SelectItem value="Endpoint">Endpoint</SelectItem>
                    <SelectItem value="Software">Software</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Severity</label>
                <Select 
                  value={newPolicy.severity} 
                  onValueChange={(v: any) => setNewPolicy({...newPolicy, severity: v})}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Description</label>
              <Input 
                placeholder="Describe the policy requirements..." 
                value={newPolicy.description}
                onChange={e => setNewPolicy({...newPolicy, description: e.target.value})}
                className="bg-card"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setIsAdding(false)}>Cancel</Button>
              <Button onClick={handleSavePolicy} className="shadow-lg shadow-primary/20">Save Policy</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-primary" />
              Active Policies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {policies.map(policy => (
                <div key={policy.id} className="flex items-start justify-between p-4 rounded-xl border border-border bg-muted/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{policy.name}</span>
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                        {policy.type}
                      </Badge>
                      <Badge className={cn(
                        "text-[10px] uppercase font-bold tracking-wider",
                        policy.severity === 'Critical' ? "bg-rose-500" :
                        policy.severity === 'High' ? "bg-amber-500" :
                        "bg-blue-500"
                      )}>
                        {policy.severity}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{policy.description}</p>
                    <div className="text-[10px] text-muted-foreground/60">Applies to: {policy.category}</div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-muted-foreground hover:text-rose-500"
                    onClick={() => handleDeletePolicy(policy.id!)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {policies.length === 0 && (
                <div className="text-center py-8 text-muted-foreground italic text-sm">
                  No active policies defined.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-card text-card-foreground">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Compliance Violations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {assets.filter(a => a.compliance?.isCompliant === false).map(asset => (
                <div key={asset.id} className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{asset.name}</span>
                    <Badge variant="destructive" className="text-[10px] uppercase font-bold tracking-wider">
                      Non-Compliant
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {asset.compliance?.policyViolations.map((v, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-3 h-3" />
                        {v}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {assets.filter(a => a.compliance?.isCompliant === false).length === 0 && (
                <div className="text-center py-8 text-emerald-500 italic text-sm flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8" />
                  All assets are currently compliant.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
