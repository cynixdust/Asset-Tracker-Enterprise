import React from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { auth } from '../firebase';
import { firestoreService } from '../lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ShieldCheck, LogIn, Mail, Lock, Chrome, User } from 'lucide-react';
import { toast } from 'sonner';

export default function Auth() {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [username, setUsername] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [isLogin, setIsLogin] = React.useState(true);

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      toast.success('Successfully logged in!');
    } catch (error) {
      console.error(error);
      toast.error('Failed to login with Google');
    }
  };

  const handleQuickAdmin = async () => {
    setEmail('admin');
    setPassword('admin');
    setIsLogin(true);
    toast.info('Admin credentials filled. Click Sign In or Create Account.');
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('handleEmailAuth started', { email, isLogin });
    setLoading(true);

    let loginEmail = email.trim();
    let loginPassword = password;

    if (!loginEmail) {
      console.error('Email is empty');
      toast.error('Please enter a username or email');
      setLoading(false);
      return;
    }

    // Handle "admin" username mapping
    const isAdminAccount = loginEmail.toLowerCase() === 'admin';
    if (isAdminAccount) {
      loginEmail = 'admin.assetlink@internal.local';
      if (password === 'admin') {
        loginPassword = 'adminadmin'; // Firebase requires 6+ chars
      }
    } else if (!loginEmail.includes('@')) {
      loginEmail = `${loginEmail}@internal.local`;
    }

    console.log('Auth attempt details:', { isLogin, loginEmail, isAdminAccount });

    const createProfile = async (user: any) => {
      console.log('Creating profile for UID:', user.uid);
      try {
        await firestoreService.set('users', user.uid, {
          uid: user.uid,
          email: user.email!,
          username: isAdminAccount ? 'admin' : (username || email),
          displayName: isAdminAccount ? 'Administrator' : (username || email),
          role: (user.email === 'gcbannermanhyde@gmail.com' || user.email === 'admin.assetlink@internal.local') ? 'admin' : 'user',
          lastLogin: new Date()
        });
        console.log('Profile created successfully in Firestore');
      } catch (profileErr) {
        console.error('Failed to create Firestore profile:', profileErr);
        throw profileErr;
      }
    };

    try {
      if (isLogin) {
        toast.loading('Attempting sign in...', { id: 'auth-toast' });
        try {
          console.log('Calling signInWithEmailAndPassword...');
          await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
          console.log('signInWithEmailAndPassword success');
          toast.success('Welcome back!', { id: 'auth-toast' });
        } catch (loginErr: any) {
          console.log('Login failed with code:', loginErr.code);
          // Handle both 'user-not-found' and 'invalid-credential'
          const isNotFound = loginErr.code === 'auth/user-not-found' || 
                            loginErr.code === 'auth/invalid-credential' ||
                            loginErr.message.includes('invalid-credential');
          
          if (isAdminAccount && isNotFound) {
            console.log('Admin account not found, attempting to bootstrap...');
            toast.loading('Bootstrapping admin account...', { id: 'auth-toast' });
            const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
            console.log('createUserWithEmailAndPassword success');
            await updateProfile(userCredential.user, { displayName: 'Administrator' });
            await createProfile(userCredential.user);
            toast.success('Admin account bootstrapped successfully!', { id: 'auth-toast' });
          } else {
            throw loginErr;
          }
        }
      } else {
        toast.loading('Creating your account...', { id: 'auth-toast' });
        console.log('Calling createUserWithEmailAndPassword...');
        const userCredential = await createUserWithEmailAndPassword(auth, loginEmail, loginPassword);
        const firebaseUser = userCredential.user;
        console.log('createUserWithEmailAndPassword success');
        
        await updateProfile(firebaseUser, { displayName: username || email });
        await createProfile(firebaseUser);
        
        toast.success('Account created successfully!', { id: 'auth-toast' });
      }
    } catch (error: any) {
      console.error('Final Auth Error Catch:', error);
      let message = error.message;
      if (error.code === 'auth/invalid-email') message = 'Please enter a valid email or username';
      if (error.code === 'auth/weak-password') message = 'Password must be at least 6 characters';
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        message = 'Incorrect username or password';
      }
      if (error.code === 'auth/wrong-password') message = 'Incorrect password';
      if (error.code === 'auth/email-already-in-use') message = 'This username or email is already registered. Please sign in instead.';
      
      toast.error(message || 'Authentication failed. Check console for details.', { id: 'auth-toast' });
      // Fallback alert for environments where toasts might be failing
      if (!message) window.alert('Auth Error: ' + error.message);
    } finally {
      console.log('handleEmailAuth finished');
      setLoading(false);
    }
  };

  const handleSystemReset = async () => {
    try {
      console.log('System reset initiated');
      await auth.signOut();
      localStorage.clear();
      sessionStorage.clear();
      
      // Attempt to clear indexedDB which can store stale Firebase state
      try {
        const dbs = await window.indexedDB.databases();
        dbs.forEach(db => {
          if (db.name) window.indexedDB.deleteDatabase(db.name);
        });
      } catch (e) {
        console.warn('Could not clear indexedDB:', e);
      }

      toast.success('System state fully reset. Reloading...');
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Reset failed:', error);
      toast.error('Failed to reset system');
      setTimeout(() => window.location.reload(), 500);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-border shadow-none rounded-xl overflow-hidden relative z-10 bg-card text-card-foreground">
        <CardHeader className="pt-12 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 bg-primary rounded flex items-center justify-center">
              <ShieldCheck className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground">AssetLink Pro</CardTitle>
          <CardDescription className="text-sm mt-1 text-muted-foreground font-medium uppercase tracking-wider">
            Infrastructure Asset Management
          </CardDescription>
        </CardHeader>
        <CardContent className="px-10">
          <div className="mb-6 flex flex-col items-center gap-2">
            <Button 
              type="button"
              variant="outline" 
              size="sm" 
              className="w-full text-[10px] uppercase font-bold tracking-widest border-border text-muted-foreground hover:text-primary hover:border-primary/30"
              onClick={handleQuickAdmin}
            >
              Quick Admin Access
            </Button>
            <button 
              type="button"
              onClick={handleSystemReset}
              className="text-[9px] uppercase font-bold tracking-widest text-muted-foreground/50 hover:text-destructive transition-colors"
            >
              Troubleshoot: Reset System
            </button>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {!isLogin && (
              <div className="space-y-2">
                <Input 
                  type="text" 
                  placeholder="Username" 
                  className="h-10 bg-muted/50 border-border focus-visible:ring-primary/20 shadow-none text-sm"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required={!isLogin}
                />
              </div>
            )}
            <div className="space-y-2">
              <Input 
                type="text" 
                placeholder="Username or Email" 
                className="h-10 bg-muted/50 border-border focus-visible:ring-primary/20 shadow-none text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Input 
                type="password" 
                placeholder="Password" 
                className="h-10 bg-muted/50 border-border focus-visible:ring-primary/20 shadow-none text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button 
              type="submit"
              className="w-full h-10 text-sm font-bold uppercase tracking-wider bg-primary text-primary-foreground shadow-none" 
              disabled={loading}
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
              <span className="bg-card px-4">Or continue with</span>
            </div>
          </div>

          <Button 
            type="button"
            variant="outline" 
            className="w-full h-10 gap-3 text-sm font-semibold border-border hover:bg-muted/50 shadow-none"
            onClick={handleGoogleLogin}
          >
            <Chrome className="w-4 h-4 text-primary" />
            Google Workspace
          </Button>
        </CardContent>
        <CardFooter className="pb-12 pt-8 flex flex-col gap-6">
          <p className="text-xs text-center text-muted-foreground font-medium">
            {isLogin ? "Don't have an account?" : "Already have an account?"}{' '}
            <button 
              type="button"
              className="text-primary font-bold hover:underline underline-offset-4"
              onClick={() => setIsLogin(!isLogin)}
            >
              {isLogin ? 'Register now' : 'Sign in'}
            </button>
          </p>
          <div className="flex justify-center gap-6 text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/40">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
