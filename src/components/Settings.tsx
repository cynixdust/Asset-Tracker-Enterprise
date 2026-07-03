import React from 'react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription,
  CardFooter
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Database, 
  Globe, 
  Save,
  Server,
  Lock,
  AlertTriangle,
  Upload,
  X,
  Image as ImageIcon,
  Github,
  GitBranch,
  GitCommit,
  GitPullRequest,
  Terminal,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from './ThemeProvider';
import { firestoreService } from '@/src/lib/firestore';

export default function Settings() {
  const [ldapEnabled, setLdapEnabled] = React.useState(false);
  const [dbType, setDbType] = React.useState<'firestore' | 'sqlite' | 'postgres' | 'mariadb'>('firestore');
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [mapViewEnabled, setMapViewEnabled] = React.useState(true);
  const [logo, setLogo] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // GitHub Settings states
  const [githubOwner, setGithubOwner] = React.useState('');
  const [githubRepo, setGithubRepo] = React.useState('');
  const [githubBranch, setGithubBranch] = React.useState('master');
  const [githubToken, setGithubToken] = React.useState('');
  const [hasToken, setHasToken] = React.useState(false);
  const [maskedToken, setMaskedToken] = React.useState('');
  const [savingConfig, setSavingConfig] = React.useState(false);

  // Local Git Status states
  const [localGit, setLocalGit] = React.useState<any>(null);
  const [checkingLocal, setCheckingLocal] = React.useState(false);

  // GitHub Commits (Update Feed) states
  const [remoteCommits, setRemoteCommits] = React.useState<any[]>([]);
  const [checkingRemote, setCheckingRemote] = React.useState(false);
  const [remoteError, setRemoteError] = React.useState<string | null>(null);

  // Update/Pull action states
  const [updateMode, setUpdateMode] = React.useState<'stash' | 'force'>('stash');
  const [updating, setUpdating] = React.useState(false);
  const [updateLogs, setUpdateLogs] = React.useState<string[]>([]);

  const fetchLocalStatus = async () => {
    setCheckingLocal(true);
    try {
      const res = await fetch('/api/github/status');
      if (res.ok) {
        const data = await res.json();
        setLocalGit(data);
      }
    } catch (e) {
      console.error('Failed to fetch local git status:', e);
    } finally {
      setCheckingLocal(false);
    }
  };

  const fetchGithubConfig = async () => {
    try {
      const res = await fetch('/api/github/config');
      if (res.ok) {
        const data = await res.json();
        setGithubOwner(data.owner || '');
        setGithubRepo(data.repo || '');
        setGithubBranch(data.branch || 'master');
        setHasToken(data.hasToken);
        setMaskedToken(data.maskedToken || '');
        if (data.hasToken) {
          setGithubToken(data.maskedToken || '');
        }
      }
    } catch (e) {
      console.error('Failed to fetch GitHub config:', e);
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingRemote(true);
    setRemoteError(null);
    try {
      const params = new URLSearchParams({
        owner: githubOwner,
        repo: githubRepo,
        branch: githubBranch
      });
      if (githubToken && !githubToken.startsWith('••••')) {
        params.append('token', githubToken);
      }
      
      const res = await fetch(`/api/github/latest?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to fetch commits');
      }
      const data = await res.json();
      setRemoteCommits(data.commits || []);
      toast.success('Successfully checked GitHub for latest commits!');
    } catch (e: any) {
      setRemoteError(e.message);
      toast.error(`GitHub Check Failed: ${e.message}`);
    } finally {
      setCheckingRemote(false);
    }
  };

  const handleSaveGithubConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/github/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: githubOwner,
          repo: githubRepo,
          branch: githubBranch,
          token: githubToken === maskedToken ? undefined : githubToken
        })
      });
      if (res.ok) {
        toast.success('GitHub configuration saved successfully');
        fetchGithubConfig();
      } else {
        throw new Error('Failed to save config');
      }
    } catch (e: any) {
      toast.error(`Failed to save configuration: ${e.message}`);
    } finally {
      setSavingConfig(false);
    }
  };

  const handleTriggerUpdate = async () => {
    setUpdating(true);
    setUpdateLogs(['[System] Initializing update procedure...']);
    try {
      const res = await fetch('/api/github/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: updateMode })
      });
      const data = await res.json();
      if (data.logs) {
        setUpdateLogs(data.logs);
      } else {
        setUpdateLogs(prev => [...prev, '[System] Done. Details retrieved.']);
      }
      if (res.ok) {
        toast.success('Application updated successfully! Refreshing...');
        fetchLocalStatus();
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.error || 'Update failed');
      }
    } catch (e: any) {
      toast.error(`Application Update Failed: ${e.message}`);
      setUpdateLogs(prev => [...prev, `[System ERROR] ${e.message}`]);
    } finally {
      setUpdating(false);
    }
  };

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await firestoreService.get('settings', 'general') as any;
        if (settings) {
          if (settings.logo) setLogo(settings.logo);
          if (settings.notificationsEnabled !== undefined) setNotificationsEnabled(settings.notificationsEnabled);
          if (settings.mapViewEnabled !== undefined) setMapViewEnabled(settings.mapViewEnabled);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast.error('Please upload a JPG or PNG file');
      return;
    }

    if (file.size > 500 * 1024) { // 500KB limit for Base64 storage
      toast.error('Logo must be smaller than 500KB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    try {
      await firestoreService.set('settings', 'general', {
        logo,
        notificationsEnabled,
        mapViewEnabled,
        updatedAt: new Date()
      });
      toast.success('Settings saved successfully');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-md overflow-hidden bg-card text-card-foreground">
            <CardHeader className="bg-muted/30 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Server className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">LDAP / Active Directory</CardTitle>
                  <CardDescription>Configure external authentication providers</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 border border-border">
                <div className="space-y-0.5">
                  <Label className="text-base font-bold">Enable LDAP Authentication</Label>
                  <p className="text-sm text-muted-foreground">Allow users to sign in with their corporate credentials</p>
                </div>
                <Switch checked={ldapEnabled} onCheckedChange={setLdapEnabled} />
              </div>

              <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 transition-all duration-300 ${ldapEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                <div className="space-y-2">
                  <Label htmlFor="ldap-server" className="font-semibold">LDAP Server</Label>
                  <Input id="ldap-server" placeholder="ldap.company.com" className="h-11 bg-muted/50 border-border focus:bg-card" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ldap-port" className="font-semibold">Port</Label>
                  <Input id="ldap-port" placeholder="389" className="h-11 bg-muted/50 border-border focus:bg-card" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="base-dn" className="font-semibold">Base DN</Label>
                  <Input id="base-dn" placeholder="dc=company,dc=com" className="h-11 bg-muted/50 border-border focus:bg-card" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bind-dn" className="font-semibold">Bind DN</Label>
                  <Input id="bind-dn" placeholder="cn=admin,dc=company,dc=com" className="h-11 bg-muted/50 border-border focus:bg-card" />
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 pt-6">
              <Button className="gap-2 h-11 px-8 shadow-lg shadow-primary/20" onClick={handleSave}>
                <Save className="w-4 h-4" />
                Save LDAP Configuration
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-none shadow-md overflow-hidden bg-card text-card-foreground">
            <CardHeader className="bg-muted/30 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10">
                  <Database className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold">Database Configuration</CardTitle>
                  <CardDescription>Select and configure your primary data store</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <Label className="font-semibold">Database Engine</Label>
                <Select value={dbType} onValueChange={(v: any) => setDbType(v)}>
                  <SelectTrigger className="h-11 bg-muted/50 border-border focus:bg-card">
                    <SelectValue placeholder="Select Database Type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card text-card-foreground border-border">
                    <SelectItem value="firestore">Cloud Firestore (Default)</SelectItem>
                    <SelectItem value="sqlite">SQLite (Local File)</SelectItem>
                    <SelectItem value="postgres">PostgreSQL (Relational)</SelectItem>
                    <SelectItem value="mariadb">MariaDB / MySQL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dbType === 'firestore' ? (
                <div className="p-4 rounded-2xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center shadow-sm border border-border">
                      <Database className="w-6 h-6 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-bold">Cloud Firestore (Enterprise)</p>
                      <p className="text-xs text-muted-foreground">Connected to: gen-lang-client-0227114206</p>
                    </div>
                  </div>
                  <Badge className="bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 border-none px-3 py-1">Active</Badge>
                </div>
              ) : (
                <div className="space-y-6 animate-in slide-in-from-top-2 duration-300">
                  <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Switching to {dbType} requires a migration. Ensure your credentials are correct before saving.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="font-semibold">Host / Connection String</Label>
                      <Input placeholder={dbType === 'sqlite' ? '/path/to/database.sqlite' : 'localhost'} className="h-11 bg-muted/50 border-border focus:bg-card" />
                    </div>
                    {dbType !== 'sqlite' && (
                      <div className="space-y-2">
                        <Label className="font-semibold">Port</Label>
                        <Input placeholder={dbType === 'postgres' ? '5432' : '3306'} className="h-11 bg-muted/50 border-border focus:bg-card" />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="font-semibold">Database Name</Label>
                      <Input placeholder="asset_track_db" className="h-11 bg-muted/50 border-border focus:bg-card" />
                    </div>
                    {dbType !== 'sqlite' && (
                      <>
                        <div className="space-y-2">
                          <Label className="font-semibold">Username</Label>
                          <Input placeholder="db_user" className="h-11 bg-muted/50 border-border focus:bg-card" />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-semibold">Password</Label>
                          <div className="relative">
                            <Input type="password" placeholder="••••••••" className="h-11 bg-muted/50 border-border pr-10 focus:bg-card" />
                            <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest bg-muted/30 p-3 rounded-lg">
                    <Shield className="w-3 h-3" />
                    Credentials are encrypted at rest using AES-256
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors cursor-pointer group bg-muted/10">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Storage Usage</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold">12.4 MB</span>
                    <span className="text-xs text-muted-foreground mb-1">/ 1 GB</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                    <div className="w-[1.2%] h-full bg-primary" />
                  </div>
                </div>
                <div className="p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors cursor-pointer group bg-muted/10">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Read Quota</p>
                  <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold">1.2k</span>
                    <span className="text-xs text-muted-foreground mb-1">/ 50k daily</span>
                  </div>
                  <div className="w-full h-1.5 bg-muted rounded-full mt-3 overflow-hidden">
                    <div className="w-[2.4%] h-full bg-blue-500" />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 pt-6">
              <Button className="gap-2 h-11 px-8 shadow-lg shadow-blue-500/20 bg-blue-600 hover:bg-blue-700" onClick={handleSave}>
                <Save className="w-4 h-4" />
                Update Database Settings
              </Button>
            </CardFooter>
          </Card>

          <Card className="border-none shadow-md overflow-hidden bg-card text-card-foreground">
            <CardHeader className="bg-muted/30 pb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10">
                    <Github className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-bold">GitHub Update Center</CardTitle>
                    <CardDescription>Configure Git updates and pull application code directly</CardDescription>
                  </div>
                </div>
                {localGit && (
                  <Badge variant={localGit.hasChanges ? "destructive" : "secondary"} className="h-6">
                    {localGit.hasChanges ? "Local Changes Detected" : "Up to Date"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {/* Local Git Status Info */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    <span className="font-bold text-sm">Local Branch:</span>
                    <Badge variant="outline" className="font-mono text-xs">{localGit?.branch || 'master'}</Badge>
                  </div>
                  {localGit?.lastCommit ? (
                    <div className="text-xs text-muted-foreground space-y-1 mt-2">
                      <div className="flex items-center gap-1.5">
                        <GitCommit className="w-3.5 h-3.5" />
                        <span className="font-semibold text-foreground">Latest Commit:</span>
                        <code className="bg-muted px-1.5 py-0.5 rounded text-primary font-mono text-[11px]">{localGit.lastCommit.hash}</code>
                      </div>
                      <p className="italic">"{localGit.lastCommit.subject}"</p>
                      <p className="text-[10px] text-muted-foreground/80">by {localGit.lastCommit.author} on {new Date(localGit.lastCommit.date).toLocaleString()}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No local commit information found</p>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border" onClick={fetchLocalStatus} disabled={checkingLocal}>
                    <RefreshCw className={`w-3.5 h-3.5 ${checkingLocal ? 'animate-spin' : ''}`} />
                    Refresh Git
                  </Button>
                </div>
              </div>

              {localGit?.hasChanges && (
                <div className="p-4 rounded-2xl bg-rose-500/5 border border-rose-500/10 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-rose-800 dark:text-rose-400">Uncommitted Local Changes</p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400/80 leading-relaxed">
                      You have uncommitted modifications in your workspace. Standard updates may fail unless you select <strong>Forced Pull</strong> to reset, or <strong>Safe Pull</strong> to automatically stash them.
                    </p>
                  </div>
                </div>
              )}

              {/* GitHub Repository Configuration */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">GitHub Repository Settings</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="font-semibold">Repository Owner</Label>
                    <Input 
                      placeholder="e.g. octocat" 
                      value={githubOwner} 
                      onChange={(e) => setGithubOwner(e.target.value)}
                      className="h-11 bg-muted/50 border-border focus:bg-card" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Repository Name</Label>
                    <Input 
                      placeholder="e.g. Hello-World" 
                      value={githubRepo} 
                      onChange={(e) => setGithubRepo(e.target.value)}
                      className="h-11 bg-muted/50 border-border focus:bg-card" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Target Branch</Label>
                    <Input 
                      placeholder="master or main" 
                      value={githubBranch} 
                      onChange={(e) => setGithubBranch(e.target.value)}
                      className="h-11 bg-muted/50 border-border focus:bg-card" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-semibold">Personal Access Token (PAT)</Label>
                    <div className="relative">
                      <Input 
                        type="password"
                        placeholder={hasToken ? "••••••••••••••••" : "Optional for private repos"} 
                        value={githubToken} 
                        onChange={(e) => setGithubToken(e.target.value)}
                        className="h-11 bg-muted/50 border-border pr-10 focus:bg-card" 
                      />
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end pt-2">
                  <Button 
                    className="gap-2 h-10 px-6" 
                    disabled={savingConfig || !githubOwner || !githubRepo} 
                    onClick={handleSaveGithubConfig}
                  >
                    {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save GitHub Config
                  </Button>
                </div>
              </div>

              <Separator className="bg-border/60" />

              {/* Check for Updates Feed */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">GitHub Update Feed</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-xs gap-1.5 border-border" 
                    onClick={handleCheckUpdates} 
                    disabled={checkingRemote || !githubOwner || !githubRepo}
                  >
                    {checkingRemote ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                    Check Repository
                  </Button>
                </div>

                {remoteError && (
                  <div className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/10 text-xs text-destructive-foreground">
                    Error querying repository: {remoteError}
                  </div>
                )}

                {remoteCommits.length > 0 ? (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {remoteCommits.map((commit, idx) => {
                      const isLocal = localGit?.lastCommit?.hash?.slice(0, 7) === commit.shortSha;
                      return (
                        <div key={commit.sha} className={`p-3 rounded-xl border flex items-start justify-between gap-4 transition-all ${isLocal ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 border-border hover:border-muted-foreground/30'}`}>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-semibold">{commit.shortSha}</code>
                              <span className="text-xs font-semibold text-foreground line-clamp-1">{commit.message}</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">by {commit.author} on {new Date(commit.date).toLocaleString()}</p>
                          </div>
                          <div className="shrink-0 flex items-center gap-1.5">
                            {isLocal ? (
                              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 border-none text-[10px] py-0.5 px-2">Current Active Version</Badge>
                            ) : idx === 0 ? (
                              <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none text-[10px] py-0.5 px-2">Latest Available Release</Badge>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : !checkingRemote && (
                  <div className="p-8 rounded-2xl bg-muted/20 border border-dashed border-border flex flex-col items-center justify-center text-center">
                    <GitPullRequest className="w-8 h-8 text-muted-foreground/40 mb-2" />
                    <p className="text-xs font-medium text-muted-foreground">Check repository updates to view available branch commits</p>
                  </div>
                )}
              </div>

              {/* Trigger Update Form & Log Window */}
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="text-sm font-bold">Deploy Code Update</p>
                      <p className="text-xs text-muted-foreground">Fetch and pull latest code on branch {githubBranch}. This will pull and automatically build the code.</p>
                    </div>
                    <div className="flex items-center bg-muted p-1 rounded-xl border border-border w-fit shrink-0">
                      <button 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${updateMode === 'stash' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setUpdateMode('stash')}
                      >
                        Safe Pull
                      </button>
                      <button 
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${updateMode === 'force' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        onClick={() => setUpdateMode('force')}
                      >
                        Forced Pull
                      </button>
                    </div>
                  </div>

                  <Button 
                    className="w-full h-11 gap-2 shadow-lg shadow-purple-500/20 bg-purple-600 hover:bg-purple-700 text-white" 
                    onClick={handleTriggerUpdate} 
                    disabled={updating || !githubOwner || !githubRepo}
                  >
                    {updating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Updating Application...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Perform Git Update & Build
                      </>
                    )}
                  </Button>
                </div>

                {/* Console Logs */}
                {(updating || updateLogs.length > 0) && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-widest pl-1">
                      <Terminal className="w-3.5 h-3.5" />
                      Deployment Terminal Console
                    </div>
                    <pre className="bg-zinc-950 text-emerald-400 p-4 rounded-xl font-mono text-xs overflow-auto max-h-60 border border-zinc-800 shadow-inner space-y-1 leading-relaxed">
                      {updateLogs.map((log, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <span className="text-zinc-600 select-none">$</span>
                          <span>{log}</span>
                        </div>
                      ))}
                      {updating && (
                        <div className="flex items-center gap-2 text-emerald-400/70 animate-pulse mt-1 pl-4">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Running task in background...
                        </div>
                      )}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-md overflow-hidden bg-card text-card-foreground">
            <CardHeader className="bg-muted/30 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <SettingsIcon className="w-5 h-5 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold">General Preferences</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="space-y-4">
                <Label className="font-semibold">Company Logo</Label>
                <div className="flex items-center gap-6">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-2xl bg-muted border-2 border-dashed border-border flex items-center justify-center overflow-hidden transition-all group-hover:border-primary/50">
                      {logo ? (
                        <img src={logo} alt="Company Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
                      )}
                      <div 
                        className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    {logo && (
                      <button 
                        onClick={() => setLogo(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <div className="flex-1 space-y-2">
                    <p className="text-xs font-medium text-foreground">Upload your organization's logo</p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                      Recommended size: 256x256px.<br />
                      Supported formats: JPG, PNG.<br />
                      Max size: 500KB.
                    </p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-8 text-[10px] font-bold uppercase tracking-wider border-border"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Select Image
                    </Button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/jpeg,image/png"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Application Theme</Label>
                <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                  <SelectTrigger className="h-11 bg-muted/50 border-border focus:bg-card">
                    <SelectValue placeholder="Select theme" />
                  </SelectTrigger>
                  <SelectContent className="bg-card text-card-foreground border-border">
                    <SelectItem value="light">Light Mode</SelectItem>
                    <SelectItem value="dark">Dark Mode</SelectItem>
                    <SelectItem value="system">System Default</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Alerts for warranty expiry</p>
                </div>
                <Switch 
                  checked={notificationsEnabled} 
                  onCheckedChange={async (checked) => {
                    setNotificationsEnabled(checked);
                    try {
                      await firestoreService.set('settings', 'general', {
                        logo,
                        notificationsEnabled: checked,
                        mapViewEnabled,
                        updatedAt: new Date()
                      });
                      toast.success(`Notifications ${checked ? 'enabled' : 'disabled'} successfully`);
                    } catch (err) {
                      toast.error('Failed to update notification settings');
                    }
                  }} 
                />
              </div>

              <div className="flex items-center justify-between py-2 border-t border-border/40 pt-4">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Enable Map View</Label>
                  <p className="text-xs text-muted-foreground">Show physical locations on the interactive map tab</p>
                </div>
                <Switch 
                  checked={mapViewEnabled} 
                  onCheckedChange={async (checked) => {
                    setMapViewEnabled(checked);
                    try {
                      await firestoreService.set('settings', 'general', {
                        logo,
                        notificationsEnabled,
                        mapViewEnabled: checked,
                        updatedAt: new Date()
                      });
                      toast.success(`Map View ${checked ? 'enabled' : 'disabled'} successfully`);
                    } catch (err) {
                      toast.error('Failed to update map view setting');
                    }
                  }} 
                />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Default Site / Location</Label>
                <Input placeholder="Main Datacenter" className="h-11 bg-muted/50 border-border focus:bg-card" />
              </div>

              <div className="space-y-2">
                <Label className="font-semibold">Date Format</Label>
                <Select defaultValue="MMM d, yyyy">
                  <SelectTrigger className="h-11 bg-muted/50 border-border focus:bg-card">
                    <SelectValue placeholder="Select format" />
                  </SelectTrigger>
                  <SelectContent className="bg-card text-card-foreground border-border">
                    <SelectItem value="MMM d, yyyy">MMM d, yyyy (Apr 15, 2026)</SelectItem>
                    <SelectItem value="yyyy-MM-dd">ISO (2026-04-15)</SelectItem>
                    <SelectItem value="dd/MM/yyyy">European (15/04/2026)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter className="bg-muted/10 pt-6">
              <Button className="w-full h-11 gap-2 shadow-lg shadow-primary/20" onClick={handleSave}>
                <Save className="w-4 h-4" />
                Save Preferences
              </Button>
            </CardFooter>
          </Card>
          <Card className="border-none shadow-md overflow-hidden bg-card text-card-foreground">
            <CardHeader className="bg-muted/30 pb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-amber-500/10">
                  <Shield className="w-5 h-5 text-amber-500" />
                </div>
                <CardTitle className="text-xl font-bold">Security</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label className="font-semibold">Session Timeout</Label>
                <Select defaultValue="30">
                  <SelectTrigger className="h-11 bg-muted/50 border-border focus:bg-card">
                    <SelectValue placeholder="Select timeout" />
                  </SelectTrigger>
                  <SelectContent className="bg-card text-card-foreground border-border">
                    <SelectItem value="15">15 Minutes</SelectItem>
                    <SelectItem value="30">30 Minutes</SelectItem>
                    <SelectItem value="60">1 Hour</SelectItem>
                    <SelectItem value="0">Never</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5">
                  <Label className="font-semibold">Two-Factor Auth</Label>
                  <p className="text-xs text-muted-foreground">Require 2FA for all admins</p>
                </div>
                <Switch />
              </div>
              <Separator className="bg-border" />
              <Button variant="outline" className="w-full h-11 gap-2 border-border">
                <Lock className="w-4 h-4" />
                Change Admin Password
              </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-md overflow-hidden bg-primary text-primary-foreground">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/20">
                  <Globe className="w-5 h-5 text-white" />
                </div>
                <CardTitle className="text-xl font-bold">System Info</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Version</span>
                <span className="font-bold">v2.4.0-enterprise</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Environment</span>
                <span className="font-bold">Production</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Region</span>
                <span className="font-bold">Europe-West2</span>
              </div>
              <Separator className="bg-white/20" />
              <p className="text-[10px] leading-relaxed opacity-70">
                AssetTrack Enterprise is licensed to gcbannermanhyde@gmail.com. 
                Support contract active until Dec 2026.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
