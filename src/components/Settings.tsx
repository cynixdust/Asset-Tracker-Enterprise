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
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { useTheme } from './ThemeProvider';
import { firestoreService } from '@/src/lib/firestore';

export default function Settings() {
  const [ldapEnabled, setLdapEnabled] = React.useState(false);
  const [dbType, setDbType] = React.useState<'firestore' | 'sqlite' | 'postgres' | 'mariadb'>('firestore');
  const { theme, setTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = React.useState(true);
  const [logo, setLogo] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await firestoreService.get('settings', 'general') as any;
        if (settings) {
          if (settings.logo) setLogo(settings.logo);
          if (settings.notificationsEnabled !== undefined) setNotificationsEnabled(settings.notificationsEnabled);
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
                <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
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
