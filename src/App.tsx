/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { firestoreService } from './lib/firestore';
import { Asset, UserProfile, AuditLog, StatusHistoryEntry, Baseline, DiscoveryJob, DiscoveryResult, Policy } from './types';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import Layout from '@/src/components/Layout';
import Dashboard from '@/src/components/Dashboard';
import AssetList from '@/src/components/AssetList';
import AssetForm from '@/src/components/AssetForm';
import AuditLogs from '@/src/components/AuditLogs';
import Settings from '@/src/components/Settings';
import BaselineManager from '@/src/components/BaselineManager';
import DiscoveryManager from '@/src/components/DiscoveryManager';
import ComplianceManager from '@/src/components/ComplianceManager';
import UserManagement from '@/src/components/UserManagement';
import Auth from '@/src/components/Auth';
import MapView from '@/src/components/MapView';
import MaintenanceCalendar from '@/src/components/MaintenanceCalendar';
import { orderBy, arrayUnion } from 'firebase/firestore';

export default function App() {
  const [user, setUser] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState('dashboard');
  const [assets, setAssets] = React.useState<Asset[]>([]);
  const [baselines, setBaselines] = React.useState<Baseline[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditLog[]>([]);
  const [discoveryJobs, setDiscoveryJobs] = React.useState<DiscoveryJob[]>([]);
  const [discoveryResults, setDiscoveryResults] = React.useState<DiscoveryResult[]>([]);
  const [policies, setPolicies] = React.useState<Policy[]>([]);
  const [isAssetFormOpen, setIsAssetFormOpen] = React.useState(false);
  const [editingAsset, setEditingAsset] = React.useState<Asset | null>(null);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email);
      if (firebaseUser) {
        try {
          // Fetch or create user profile
          const profile = await firestoreService.get('users', firebaseUser.uid) as any;
          if (profile) {
            console.log('Profile found:', profile.role);
            setUser(profile as UserProfile);
          } else {
            console.log('No profile found, creating one...');
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email!,
              username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'user',
              displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0],
              role: (firebaseUser.email === 'gcbannermanhyde@gmail.com' || firebaseUser.email === 'admin.assetlink@internal.local') ? 'admin' : 'user',
              lastLogin: new Date()
            };
            await firestoreService.set('users', firebaseUser.uid, newProfile);
            setUser(newProfile);
          }
        } catch (error) {
          console.error('Error fetching/creating profile:', error);
          toast.error('System error: Failed to load user profile');
          // Don't set user, which keeps them on Auth screen
        } finally {
          setLoading(false);
        }
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  React.useEffect(() => {
    if (user) {
      const unsubAssets = firestoreService.subscribe('assets', (data) => {
        setAssets(data as Asset[]);
      }, [orderBy('updatedAt', 'desc')]);

      const unsubLogs = firestoreService.subscribe('audit_logs', (data) => {
        setAuditLogs(data as AuditLog[]);
      }, [orderBy('timestamp', 'desc')]);

      const unsubBaselines = firestoreService.subscribe('baselines', (data) => {
        setBaselines(data as Baseline[]);
      });

      const unsubDiscoveryJobs = firestoreService.subscribe('discovery_jobs', (data) => {
        setDiscoveryJobs(data as DiscoveryJob[]);
      });

      const unsubDiscoveryResults = firestoreService.subscribe('discovery_results', (data) => {
        setDiscoveryResults(data as DiscoveryResult[]);
      });

      const unsubPolicies = firestoreService.subscribe('policies', (data) => {
        setPolicies(data as Policy[]);
      });

      return () => {
        unsubAssets();
        unsubLogs();
        unsubBaselines();
        unsubDiscoveryJobs();
        unsubDiscoveryResults();
        unsubPolicies();
      };
    }
  }, [user]);

  React.useEffect(() => {
    const handleRegisterTagEvent = (e: any) => {
      if (e.detail?.tag) {
        setActiveTab('assets');
        setEditingAsset({ assetTag: e.detail.tag } as any);
        setIsAssetFormOpen(true);
      }
    };
    window.addEventListener('register-tag' as any, handleRegisterTagEvent);
    return () => window.removeEventListener('register-tag' as any, handleRegisterTagEvent);
  }, []);

  const handleAddAsset = async (data: any) => {
    console.log('Attempting to add asset:', data);
    try {
      const statusEntry: StatusHistoryEntry = {
        status: data.status,
        changedAt: new Date(),
        changedBy: user?.uid || 'system',
        notes: 'Initial creation'
      };

      const assetData = {
        ...data,
        statusHistory: [statusEntry],
        version: 1,
        versionHistory: []
      };

      const assetId = await firestoreService.add('assets', assetData);
      console.log('Asset added successfully with ID:', assetId);
      
      await firestoreService.add('audit_logs', {
        action: 'CREATE',
        entityType: 'Asset',
        entityId: assetId,
        userId: user?.uid,
        details: `Created asset: ${data.name} (${data.assetTag})`
      });
      setIsAssetFormOpen(false);
      toast.success('Asset created successfully');
    } catch (error: any) {
      console.error('Failed to add asset:', error);
      let message = 'Failed to create asset';
      try {
        const errObj = JSON.parse(error.message);
        message = `Creation failed: ${errObj.error}`;
      } catch (e) {
        message = error.message || message;
      }
      toast.error(message);
    }
  };

  const handleUpdateAsset = async (data: any) => {
    if (!editingAsset?.id) {
      console.error('Update failed: No editingAsset ID found');
      return;
    }
    
    console.log('Attempting to update asset:', editingAsset.id, data);
    
    try {
      // Helper to remove undefined values recursively
      const stripUndefined = (obj: any): any => {
        if (Array.isArray(obj)) {
          return obj.map(stripUndefined);
        } else if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
          return Object.entries(obj).reduce((acc, [key, value]) => {
            if (value !== undefined) {
              acc[key] = stripUndefined(value);
            }
            return acc;
          }, {} as any);
        }
        return obj;
      };

      const updateData: any = stripUndefined({ ...data });
      
      // Ensure we don't accidentally send the ID in the update payload
      delete updateData.id;

      if (data.status !== editingAsset.status) {
        const statusEntry: StatusHistoryEntry = {
          status: data.status,
          changedAt: new Date(),
          changedBy: user?.uid || 'system',
          notes: data.notes || 'Status updated'
        };
        updateData.statusHistory = arrayUnion(stripUndefined(statusEntry));
      }

      // Handle Versioning
      const currentVersion = editingAsset.version || 1;
      const nextVersion = currentVersion + 1;
      
      // Create version record of the PREVIOUS state
      const prevData = { ...editingAsset };
      delete (prevData as any).id;
      delete (prevData as any).versionHistory;
      if (!prevData.statusHistory) prevData.statusHistory = [];

      const versionRecord = {
        version: currentVersion,
        data: stripUndefined(prevData),
        changedAt: new Date(),
        changedBy: user?.uid || 'system',
        changeReason: 'Asset updated'
      };

      updateData.version = nextVersion;
      updateData.versionHistory = arrayUnion(stripUndefined(versionRecord));

      await firestoreService.update('assets', editingAsset.id, updateData);
      console.log('Asset updated successfully');

      await firestoreService.add('audit_logs', {
        action: 'UPDATE',
        entityType: 'Asset',
        entityId: editingAsset.id,
        userId: user?.uid,
        details: `Updated asset: ${data.name} (v${nextVersion})`
      });
      setIsAssetFormOpen(false);
      setEditingAsset(null);
      toast.success('Asset updated successfully');
    } catch (error: any) {
      console.error('Failed to update asset:', error);
      let message = 'Failed to update asset';
      try {
        // Handle Firestore structured errors if they exist
        const errObj = JSON.parse(error.message);
        message = `Update failed: ${errObj.error}`;
      } catch (e) {
        // Handle raw Firestore error messages
        message = error.message || message;
      }
      toast.error(message);
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) return;
    try {
      await firestoreService.delete('assets', id);
      await firestoreService.add('audit_logs', {
        action: 'DELETE',
        entityType: 'Asset',
        entityId: id,
        userId: user?.uid,
        details: `Deleted asset ID: ${id}`
      });
      toast.success('Asset deleted');
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  console.log('App state:', { loading, user: !!user });

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">Initializing System...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth />
        <Toaster position="top-right" />
      </>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard assets={assets} />;
      case 'assets':
        return (
          <AssetList 
            assets={assets} 
            baselines={baselines}
            onAdd={() => {
              setEditingAsset(null);
              setIsAssetFormOpen(true);
            }} 
            onEdit={(asset) => {
              setEditingAsset(asset);
              setIsAssetFormOpen(true);
            }}
            onDelete={handleDeleteAsset}
            userRole={user.role}
          />
        );
      case 'map':
        return (
          <MapView 
            assets={assets} 
            onEdit={(asset) => {
              setEditingAsset(asset);
              setIsAssetFormOpen(true);
            }}
          />
        );
      case 'calendar':
        return (
          <MaintenanceCalendar 
            assets={assets} 
            onEditAsset={(asset) => {
              setEditingAsset(asset);
              setIsAssetFormOpen(true);
            }}
            setActiveTab={setActiveTab}
          />
        );
      case 'audit':
        return <AuditLogs logs={auditLogs} />;
      case 'baselines':
        return <BaselineManager baselines={baselines} />;
      case 'compliance':
        return <ComplianceManager assets={assets} policies={policies} />;
      case 'discovery':
        return <DiscoveryManager jobs={discoveryJobs} results={discoveryResults} />;
      case 'users':
        return <UserManagement />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard assets={assets} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab} user={user} assets={assets}>
      {renderContent()}
      
      <AssetForm 
        open={isAssetFormOpen} 
        onOpenChange={setIsAssetFormOpen} 
        onSubmit={editingAsset && editingAsset.id ? handleUpdateAsset : handleAddAsset}
        initialData={editingAsset}
        allAssets={assets}
        baselines={baselines}
      />
      
      <Toaster position="top-right" richColors closeButton />
    </Layout>
  );
}

