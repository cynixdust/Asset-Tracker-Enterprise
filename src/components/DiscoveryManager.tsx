import React from 'react';
import { 
  Plus, 
  Trash2, 
  Search, 
  RefreshCw, 
  CheckCircle2, 
  XCircle,
  Network,
  Cpu,
  Globe,
  Database,
  ArrowRight,
  ShieldCheck,
  Zap,
  AlertCircle
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
import { 
  DiscoveryJob, 
  DiscoveryResult, 
  DiscoveryType, 
  Asset, 
  StatusHistoryEntry 
} from '@/src/types';
import { firestoreService } from '@/src/lib/firestore';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface DiscoveryManagerProps {
  jobs: DiscoveryJob[];
  results: DiscoveryResult[];
}

export default function DiscoveryManager({ jobs, results }: DiscoveryManagerProps) {
  const [isAddingJob, setIsAddingJob] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState<string | null>(null);

  const [newJob, setNewJob] = React.useState<Partial<DiscoveryJob>>({
    name: '',
    type: 'Network Scan',
    target: '',
    status: 'Pending',
    config: {}
  });

  const handleCreateJob = async () => {
    if (!newJob.name || !newJob.target) {
      toast.error('Name and Target are required');
      return;
    }

    try {
      await firestoreService.add('discovery_jobs', newJob);
      toast.success('Discovery job created');
      setIsAddingJob(false);
      setNewJob({ name: '', type: 'Network Scan', target: '', status: 'Pending', config: {} });
    } catch (error) {
      toast.error('Failed to create job');
    }
  };

  const handleDeleteJob = async (id: string) => {
    if (!window.confirm('Delete this discovery job?')) return;
    try {
      await firestoreService.delete('discovery_jobs', id);
      toast.success('Job deleted');
    } catch (error) {
      toast.error('Failed to delete job');
    }
  };

  const simulateScan = async (job: DiscoveryJob) => {
    if (!job.id) return;
    setIsScanning(job.id);
    
    try {
      await firestoreService.update('discovery_jobs', job.id, { status: 'Running' });
      
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock discovered assets based on type
      const mockAssets: Partial<Asset>[] = [];
      if (job.type === 'Network Scan') {
        mockAssets.push({
          name: `Discovered-Switch-${Math.floor(Math.random() * 100)}`,
          assetTag: `DISC-${Math.floor(Math.random() * 10000)}`,
          category: 'Network',
          vendor: 'Cisco',
          model: 'Catalyst 9200',
          location: 'Auto-Detected',
          status: 'Procurement'
        });
      } else if (job.type === 'Agent') {
        mockAssets.push({
          name: `Workstation-${Math.floor(Math.random() * 100)}`,
          assetTag: `AGT-${Math.floor(Math.random() * 10000)}`,
          category: 'Endpoint',
          vendor: 'Dell',
          model: 'OptiPlex 7000',
          status: 'Active'
        });
      }

      for (const assetData of mockAssets) {
        await firestoreService.add('discovery_results', {
          jobId: job.id,
          assetData,
          detectedAt: new Date(),
          status: 'New'
        });
      }

      await firestoreService.update('discovery_jobs', job.id, { 
        status: 'Completed',
        lastRun: new Date()
      });
      
      toast.success(`Scan complete: Found ${mockAssets.length} new assets`);
    } catch (error) {
      toast.error('Scan failed');
      await firestoreService.update('discovery_jobs', job.id, { status: 'Failed' });
    } finally {
      setIsScanning(null);
    }
  };

  const mergeResult = async (result: DiscoveryResult) => {
    if (!result.id) return;
    try {
      const statusEntry: StatusHistoryEntry = {
        status: result.assetData.status || 'Active',
        changedAt: new Date(),
        changedBy: 'Discovery Service',
        notes: 'Imported from automated discovery'
      };

      const assetData = {
        ...result.assetData,
        statusHistory: [statusEntry],
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: 'system'
      };

      await firestoreService.add('assets', assetData);
      await firestoreService.update('discovery_results', result.id, { status: 'Merged' });
      toast.success('Asset merged into registry');
    } catch (error) {
      toast.error('Failed to merge asset');
    }
  };

  const ignoreResult = async (id: string) => {
    try {
      await firestoreService.update('discovery_results', id, { status: 'Ignored' });
      toast.info('Result ignored');
    } catch (error) {
      toast.error('Failed to update result');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Discovery & Data Population</h2>
          <p className="text-sm text-muted-foreground">Automate asset detection via network scans, agents, and APIs.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => {
            const mockApiResult: DiscoveryResult = {
              jobId: 'api-integration',
              assetData: {
                name: 'Cloud-Instance-X',
                category: 'Server',
                vendor: 'AWS',
                model: 't3.medium',
                status: 'Active'
              },
              detectedAt: new Date(),
              status: 'New'
            };
            firestoreService.add('discovery_results', mockApiResult);
            toast.success('Simulated API data received');
          }} className="gap-2">
            <Globe className="w-4 h-4" /> Simulate API Push
          </Button>
          <Button onClick={() => setIsAddingJob(!isAddingJob)} className="gap-2 shadow-lg shadow-primary/20">
            {isAddingJob ? 'Cancel' : <><Plus className="w-4 h-4" /> New Discovery Job</>}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm bg-blue-500/10 dark:bg-blue-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Network className="w-5 h-5 text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">Network Scans</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{jobs.filter(j => j.type === 'Network Scan').length}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-purple-500/10 dark:bg-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Cpu className="w-5 h-5 text-purple-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">Active Agents</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{jobs.filter(j => j.type === 'Agent').length}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-emerald-500/10 dark:bg-emerald-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="w-5 h-5 text-emerald-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">API Integrations</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{jobs.filter(j => j.type === 'API').length}</p>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm bg-amber-500/10 dark:bg-amber-500/20">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <Database className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">SNMP Crawlers</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{jobs.filter(j => j.type === 'SNMP').length}</p>
          </CardContent>
        </Card>
      </div>

      {isAddingJob && (
        <Card className="border-none shadow-xl bg-muted/50">
          <CardHeader>
            <CardTitle className="text-lg">Configure Discovery Job</CardTitle>
            <CardDescription>Set up a new automated scan or agent listener.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Job Name</label>
                <Input 
                  placeholder="e.g. Datacenter Subnet Scan" 
                  value={newJob.name}
                  onChange={e => setNewJob({...newJob, name: e.target.value})}
                  className="bg-card"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Discovery Type</label>
                <Select 
                  value={newJob.type} 
                  onValueChange={(v: DiscoveryType) => setNewJob({...newJob, type: v})}
                >
                  <SelectTrigger className="bg-card">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Network Scan">Network Scan (ICMP/Nmap)</SelectItem>
                    <SelectItem value="SNMP">SNMP Crawler</SelectItem>
                    <SelectItem value="Agent">Agent Listener</SelectItem>
                    <SelectItem value="API">External API / Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target / Scope</label>
                <Input 
                  placeholder="e.g. 192.168.1.0/24 or https://agent.internal.local" 
                  value={newJob.target}
                  onChange={e => setNewJob({...newJob, target: e.target.value})}
                  className="bg-card"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="ghost" onClick={() => setIsAddingJob(false)}>Cancel</Button>
              <Button onClick={handleCreateJob} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Initialize Job
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="flex items-center gap-2 text-foreground">
            <RefreshCw className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold uppercase tracking-wider">Active Jobs</h3>
          </div>
          
          <div className="space-y-4">
            {jobs.map((job) => (
              <Card key={job.id} className="border-none shadow-sm bg-card text-card-foreground overflow-hidden group">
                <div className={cn(
                  "h-1 w-full",
                  job.status === 'Running' ? "bg-blue-500 animate-pulse" : 
                  job.status === 'Completed' ? "bg-emerald-500" : 
                  job.status === 'Failed' ? "bg-rose-500" : "bg-muted"
                )} />
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {job.type === 'Network Scan' && <Network className="w-4 h-4 text-blue-500" />}
                      {job.type === 'Agent' && <Cpu className="w-4 h-4 text-purple-500" />}
                      {job.type === 'API' && <Globe className="w-4 h-4 text-emerald-500" />}
                      {job.type === 'SNMP' && <Database className="w-4 h-4 text-amber-500" />}
                      <span className="text-sm font-bold text-foreground">{job.name}</span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-500"
                      onClick={() => job.id && handleDeleteJob(job.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span>{job.type}</span>
                    <span>{job.status}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{job.target}</p>
                  <div className="pt-2 flex items-center gap-2">
                    <Button 
                      size="sm" 
                      className="h-8 flex-1 text-[10px] font-bold uppercase tracking-wider"
                      onClick={() => simulateScan(job)}
                      disabled={isScanning === job.id}
                    >
                      {isScanning === job.id ? <RefreshCw className="w-3 h-3 animate-spin mr-2" /> : <Zap className="w-3 h-3 mr-2" />}
                      Run Scan
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {jobs.length === 0 && (
              <div className="py-12 text-center bg-muted/30 rounded-2xl border border-dashed border-border">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">No Discovery Jobs</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-foreground">
              <Search className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold uppercase tracking-wider">Discovered Assets Pending Review</h3>
            </div>
            <Badge variant="secondary" className="bg-muted text-muted-foreground border-none">
              {results.filter(r => r.status === 'New').length} New
            </Badge>
          </div>

          <div className="space-y-4">
            {results.filter(r => r.status === 'New').map((result) => (
              <Card key={result.id} className="border-none shadow-sm bg-card text-card-foreground overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col md:flex-row">
                    <div className="p-5 flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center border border-border">
                            <Package className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-foreground">{result.assetData.name}</h4>
                            <p className="text-[11px] text-muted-foreground">Detected {format(result.detectedAt.toDate ? result.detectedAt.toDate() : new Date(), 'MMM d, HH:mm')}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-bold uppercase border-blue-500/20 text-blue-600 dark:text-blue-400 bg-blue-500/10">
                          {result.assetData.category}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2">
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Vendor / Model</p>
                          <p className="text-xs font-semibold text-foreground">{result.assetData.vendor} {result.assetData.model}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Asset Tag</p>
                          <p className="text-xs font-semibold text-foreground">{result.assetData.assetTag}</p>
                        </div>
                        <div>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tight">Source Job</p>
                          <p className="text-xs font-semibold text-foreground truncate">{jobs.find(j => j.id === result.jobId)?.name || 'Unknown'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-muted/30 p-4 flex flex-row md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-border">
                      <Button 
                        size="sm" 
                        className="h-9 px-6 bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold uppercase tracking-wider"
                        onClick={() => mergeResult(result)}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Approve & Merge
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="h-9 px-6 text-muted-foreground hover:text-rose-600 text-[10px] font-bold uppercase tracking-wider"
                        onClick={() => result.id && ignoreResult(result.id)}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-2" /> Ignore
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {results.filter(r => r.status === 'New').length === 0 && (
              <div className="py-24 text-center bg-muted/30 rounded-3xl border-2 border-dashed border-border">
                <CheckCircle2 className="w-12 h-12 text-emerald-500/30 mx-auto mb-4" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Registry Synchronized</p>
                <p className="text-xs text-muted-foreground mt-1">No new assets detected pending review.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="border-none shadow-sm bg-slate-900 text-slate-300 dark:bg-card dark:text-card-foreground dark:border dark:border-border">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-emerald-400" />
            <CardTitle className="text-sm text-white dark:text-foreground uppercase tracking-widest">Developer Documentation: Scripts & APIs</CardTitle>
          </div>
          <CardDescription className="text-slate-400 dark:text-muted-foreground">Integrate your own scanners or agents using the Discovery API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold text-slate-400 dark:text-muted-foreground uppercase">Push Discovery Result (cURL Example)</p>
            <div className="bg-slate-950 p-4 rounded-lg font-mono text-[11px] overflow-x-auto border border-slate-800 dark:border-border">
              <code className="text-emerald-400">
                curl -X POST https://api.assetlink.pro/v1/discovery/push \<br />
                &nbsp;&nbsp;-H "Authorization: Bearer YOUR_API_KEY" \<br />
                &nbsp;&nbsp;-H "Content-Type: application/json" \<br />
                &nbsp;&nbsp;-d '&#123;"name": "Server-01", "category": "Server", "ip": "10.0.0.5"&#125;'
              </code>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white dark:text-foreground uppercase">SNMP Integration</h4>
              <p className="text-[11px] leading-relaxed">
                Configure your SNMP crawlers to target the <code>/api/snmp/ingest</code> endpoint. 
                Supports v2c and v3 with standard MIB-II discovery.
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white dark:text-foreground uppercase">Agent Deployment</h4>
              <p className="text-[11px] leading-relaxed">
                Download the lightweight discovery agent for Windows/Linux. 
                Agents perform local hardware inventory and push updates every 24 hours.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { Package } from 'lucide-react';
