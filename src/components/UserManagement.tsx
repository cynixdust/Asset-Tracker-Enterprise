import React from 'react';
import { 
  Users, 
  UserPlus, 
  Shield, 
  Mail, 
  Trash2, 
  MoreVertical,
  User as UserIcon,
  ShieldAlert,
  ShieldCheck,
  Lock
} from 'lucide-react';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Button, buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
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
import { UserProfile } from '@/src/types';
import { firestoreService } from '@/src/lib/firestore';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut, updateProfile } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export default function UserManagement() {
  const [users, setUsers] = React.useState<UserProfile[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [isAddUserOpen, setIsAddUserOpen] = React.useState(false);
  const [newUser, setNewUser] = React.useState({
    email: '',
    password: '',
    username: '',
    role: 'user' as 'admin' | 'user'
  });
  const [processing, setProcessing] = React.useState(false);

  React.useEffect(() => {
    const unsubscribe = firestoreService.subscribe('users', (data) => {
      setUsers(data as UserProfile[]);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    
    let secondaryApp;
    try {
      // Create user in Firebase Auth using a secondary app instance
      // to avoid signing out the current admin user
      secondaryApp = initializeApp(firebaseConfig, `Secondary-${Date.now()}`);
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth, 
        newUser.email, 
        newUser.password
      );
      
      const firebaseUser = userCredential.user;
      await updateProfile(firebaseUser, { displayName: newUser.username });
      
      // Create Firestore profile
      await firestoreService.set('users', firebaseUser.uid, {
        uid: firebaseUser.uid,
        email: newUser.email,
        username: newUser.username,
        displayName: newUser.username,
        role: (newUser.email === 'admin.assetlink@internal.local' || newUser.email === 'gcbannermanhyde@gmail.com') ? 'admin' : newUser.role,
        lastLogin: new Date()
      });

      await signOut(secondaryAuth);
      
      toast.success('User account created successfully');
      setIsAddUserOpen(false);
      setNewUser({ email: '', password: '', username: '', role: 'user' });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to create user');
    } finally {
      if (secondaryApp) await deleteApp(secondaryApp);
      setProcessing(false);
    }
  };

  const handleUpdateRole = async (uid: string, newRole: 'admin' | 'user') => {
    try {
      await firestoreService.update('users', uid, { role: newRole });
      toast.success('User role updated');
    } catch (error) {
      toast.error('Failed to update role');
    }
  };

  const handleDeleteUser = async (uid: string) => {
    if (!window.confirm('Are you sure? This will only remove the Firestore profile. The Auth account must be deleted from Firebase Console.')) return;
    try {
      await firestoreService.delete('users', uid);
      toast.success('User profile removed');
    } catch (error) {
      toast.error('Failed to remove profile');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-sm text-muted-foreground">Manage system access and roles</p>
        </div>
      </div>
      <Button onClick={() => setIsAddUserOpen(true)} className="gap-2 bg-primary text-primary-foreground shadow-none font-bold uppercase text-xs tracking-wider">
        <UserPlus className="w-4 h-4" />
        Add User
      </Button>
    </div>

    <div className="rounded-xl border border-border bg-card text-card-foreground overflow-hidden shadow-none">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow className="hover:bg-transparent border-border">
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground py-3 px-6">User</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Username</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</TableHead>
            <TableHead className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Last Login</TableHead>
            <TableHead className="text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground pr-6">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.uid} className="group hover:bg-muted/30 transition-colors border-border">
              <TableCell className="py-4 px-6">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                    {user.displayName?.substring(0, 2).toUpperCase() || 'U'}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[13px] font-semibold text-foreground">{user.displayName || 'Unnamed User'}</span>
                    <span className="text-[11px] text-muted-foreground">{user.email}</span>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <span className="text-[12px] font-medium text-muted-foreground">{user.username}</span>
              </TableCell>
              <TableCell>
                <Badge className={cn(
                  "rounded-full px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-none",
                  user.role === 'admin' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"
                )}>
                  {user.role}
                </Badge>
              </TableCell>
              <TableCell>
                <span className="text-[12px] text-muted-foreground">
                  {user.lastLogin ? format(new Date(user.lastLogin.toDate?.() || user.lastLogin), 'MMM dd, HH:mm') : 'Never'}
                </span>
              </TableCell>
              <TableCell className="text-right pr-6">
                <DropdownMenu>
                  <DropdownMenuTrigger className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 text-muted-foreground hover:text-foreground")}>
                    <MoreVertical className="w-4 h-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 rounded-lg shadow-xl border-border bg-card text-card-foreground">
                    <DropdownMenuItem 
                      className="gap-2 cursor-pointer text-xs font-medium"
                      onClick={() => handleUpdateRole(user.uid, user.role === 'admin' ? 'user' : 'admin')}
                    >
                      <Shield className="w-3.5 h-3.5" /> 
                      Make {user.role === 'admin' ? 'User' : 'Admin'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="gap-2 text-destructive focus:text-destructive cursor-pointer text-xs font-medium"
                      onClick={() => handleDeleteUser(user.uid)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Profile
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
      <DialogContent className="sm:max-w-[425px] rounded-xl bg-card text-card-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Add Local Account</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Create a new user account with email and password.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAddUser} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Username</label>
            <Input 
              placeholder="jdoe" 
              className="h-10 bg-muted/50 border-border shadow-none text-sm focus:bg-card"
              value={newUser.username}
              onChange={(e) => setNewUser({...newUser, username: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email Address</label>
            <Input 
              type="email"
              placeholder="john@example.com" 
              className="h-10 bg-muted/50 border-border shadow-none text-sm focus:bg-card"
              value={newUser.email}
              onChange={(e) => setNewUser({...newUser, email: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Password</label>
            <Input 
              type="password"
              placeholder="••••••••" 
              className="h-10 bg-muted/50 border-border shadow-none text-sm focus:bg-card"
              value={newUser.password}
              onChange={(e) => setNewUser({...newUser, password: e.target.value})}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role</label>
            <Select 
              value={newUser.role} 
              onValueChange={(v: any) => setNewUser({...newUser, role: v})}
            >
              <SelectTrigger className="h-10 bg-muted/50 border-border shadow-none text-sm focus:bg-card">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent className="bg-card text-card-foreground border-border">
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsAddUserOpen(false)}
              className="h-10 border-border text-xs font-bold uppercase tracking-wider"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={processing}
              className="h-10 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-none"
            >
              {processing ? 'Creating...' : 'Create Account'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </div>
  );
}
