import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { 
  Camera, 
  QrCode, 
  X, 
  Search, 
  Package, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight, 
  History,
  FileText,
  User,
  MapPin,
  Tag,
  Hammer
} from 'lucide-react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
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
import { firestoreService } from '@/src/lib/firestore';
import { auth, db } from '@/src/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Asset, AssetStatus, StatusHistoryEntry } from '@/src/types';

interface QRScannerProps {
  onViewAsset?: (assetId: string) => void;
  triggerClassName?: string;
  buttonText?: string;
  iconOnly?: boolean;
}

export default function QRScanner({ 
  onViewAsset, 
  triggerClassName, 
  buttonText = "Scan Tag", 
  iconOnly = false 
}: QRScannerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [error, setError] = useState<string | null>(null);
  
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  
  const [scannedCode, setScannedCode] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Status edit local states
  const [newStatus, setNewStatus] = useState<AssetStatus | ''>('');
  const [statusNotes, setStatusNotes] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Play synthetic feedback beep using Web Audio API
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // 880Hz pitch (A5)
      
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (err) {
      console.error('Audio beep feedback failed:', err);
    }
  };

  // Enumerate video devices
  useEffect(() => {
    if (!isOpen) return;
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => {
        const videoDevs = devices.filter(d => d.kind === 'videoinput');
        setVideoDevices(videoDevs);
        if (videoDevs.length > 0) {
          // Default to environment/back camera if found, else first available
          const backCam = videoDevs.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('environment') || 
            d.label.toLowerCase().includes('rear')
          );
          setSelectedDeviceId(backCam ? backCam.deviceId : videoDevs[0].deviceId);
        }
      })
      .catch((err) => {
        console.error('Failed to list video devices:', err);
      });
  }, [isOpen]);

  // Start / Stop camera stream depending on dialog state
  useEffect(() => {
    if (isOpen) {
      startCamera(selectedDeviceId);
    } else {
      stopCamera();
      // Clean up states
      setScannedAsset(null);
      setScannedCode('');
      setSearchQuery('');
      setNewStatus('');
      setStatusNotes('');
      setError(null);
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, selectedDeviceId]);

  const startCamera = async (deviceId?: string) => {
    stopCamera();
    setError(null);
    setCameraPermission('prompt');

    try {
      const constraints: MediaStreamConstraints = {
        video: deviceId 
          ? { deviceId: { exact: deviceId } } 
          : { facingMode: 'environment' }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.play().catch(e => console.error("Video play interrupted", e));
      }
      
      setCameraPermission('granted');
      setIsScanning(true);
    } catch (err: any) {
      console.error('Error starting camera stream:', err);
      setError(err.name === 'NotAllowedError' 
        ? 'Camera permission was denied. Please allow camera access in your settings.' 
        : 'Could not access the device camera. Verify it is not being used by another application.'
      );
      setCameraPermission('denied');
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  };

  // Core frame-processing loop
  const tick = () => {
    if (!isScanning || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data) {
        playBeep();
        stopCamera();
        handleScannedCode(code.data);
        return; // Break the animation loop
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const handleVideoPlaying = () => {
    setIsScanning(true);
    animationFrameRef.current = requestAnimationFrame(tick);
  };

  const handleScannedCode = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    setScannedCode(trimmed);
    setIsSearching(true);
    setScannedAsset(null);

    try {
      const q = query(collection(db, 'assets'), where('assetTag', '==', trimmed));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const docSnap = querySnapshot.docs[0];
        const assetData = { id: docSnap.id, ...docSnap.data() } as Asset;
        setScannedAsset(assetData);
        setNewStatus(assetData.status);
        toast.success(`Asset identified: ${assetData.name}`);
      } else {
        toast.error(`No asset found with tag: "${trimmed}"`);
      }
    } catch (err: any) {
      console.error('Error fetching scanned asset:', err);
      toast.error('Error searching asset tag');
    } finally {
      setIsSearching(false);
    }
  };

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      handleScannedCode(searchQuery.trim());
    }
  };

  const handleUpdateStatus = async () => {
    if (!scannedAsset?.id || !newStatus) return;

    setIsUpdatingStatus(true);
    try {
      const statusEntry: StatusHistoryEntry = {
        status: newStatus as AssetStatus,
        changedAt: new Date(),
        changedBy: auth.currentUser?.uid || 'system',
        notes: statusNotes.trim() || 'Status updated via camera QR tag scan'
      };

      const nextVersion = (scannedAsset.version || 1) + 1;
      const prevData = { ...scannedAsset };
      delete (prevData as any).id;
      delete (prevData as any).versionHistory;
      if (!prevData.statusHistory) prevData.statusHistory = [];

      const versionRecord = {
        version: scannedAsset.version || 1,
        data: prevData,
        changedAt: new Date(),
        changedBy: auth.currentUser?.uid || 'system',
        changeReason: 'Status quick-change via QR scan'
      };

      const updatePayload = {
        status: newStatus,
        statusHistory: [...(scannedAsset.statusHistory || []), statusEntry],
        version: nextVersion,
        versionHistory: [...(scannedAsset.versionHistory || []), versionRecord]
      };

      await firestoreService.update('assets', scannedAsset.id, updatePayload);

      // Log the audit change
      await firestoreService.add('audit_logs', {
        action: 'UPDATE',
        entityType: 'Asset',
        entityId: scannedAsset.id,
        userId: auth.currentUser?.uid || 'system',
        details: `Updated asset status to ${newStatus} via QR tag scan: ${scannedAsset.name}`
      });

      // Update local asset view state
      setScannedAsset(prev => prev ? {
        ...prev,
        ...updatePayload
      } : null);

      setStatusNotes('');
      toast.success('Asset status updated successfully');
    } catch (err) {
      console.error('Failed to update status:', err);
      toast.error('Failed to update asset status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleViewInRegistry = () => {
    if (scannedAsset?.id) {
      setIsOpen(false);
      // Let's switch tabs and select the asset using our custom event system
      window.dispatchEvent(new CustomEvent('view-asset', { 
        detail: { assetId: scannedAsset.id } 
      }));
      if (onViewAsset) {
        onViewAsset(scannedAsset.id);
      }
    }
  };

  const handleResetScanner = () => {
    setScannedAsset(null);
    setScannedCode('');
    setSearchQuery('');
    setNewStatus('');
    setStatusNotes('');
    startCamera(selectedDeviceId);
  };

  // Helper styles for statuses
  const getStatusBadge = (status: AssetStatus) => {
    const maps: Record<AssetStatus, string> = {
      'Procurement': 'bg-sky-500/10 text-sky-500 border-sky-500/20',
      'Active': 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
      'Maintenance': 'bg-amber-500/10 text-amber-500 border-amber-500/20',
      'Retired': 'bg-slate-500/10 text-slate-500 border-slate-500/20',
      'Disposal': 'bg-rose-500/10 text-rose-500 border-rose-500/20',
    };
    return (
      <Badge className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", maps[status] || 'bg-primary/10 text-primary')}>
        {status}
      </Badge>
    );
  };

  return (
    <>
      {iconOnly ? (
        <Button 
          variant="outline" 
          size="icon" 
          onClick={() => setIsOpen(true)}
          className={cn("rounded-full border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground", triggerClassName)}
          title="Scan QR Asset Tag"
        >
          <QrCode className="w-4 h-4" />
        </Button>
      ) : (
        <Button 
          onClick={() => setIsOpen(true)}
          className={cn("gap-2 text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm px-4", triggerClassName)}
        >
          <QrCode className="w-4 h-4" />
          {buttonText}
        </Button>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xl rounded-2xl border-none shadow-2xl p-0 overflow-hidden bg-card text-card-foreground">
          
          {/* Header */}
          <DialogHeader className="px-8 pt-8 pb-4 border-b border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold tracking-tight">QR Code Scanner</DialogTitle>
                  <DialogDescription className="text-xs font-medium text-muted-foreground mt-0.5">
                    Align asset tag QR code inside the viewfinder to identify details
                  </DialogDescription>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Hidden Offscreen Canvas for jsQR Frame Grabbing */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Outer Grid / Content Container */}
          <div className="p-6">
            
            {/* 1. If scanned asset is NOT identified (No asset details to show yet) */}
            {!scannedAsset && !isSearching && (
              <div className="space-y-6">
                
                {/* Viewfinder area */}
                <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black/95 shadow-inner border border-border flex flex-col items-center justify-center">
                  
                  {/* Active Video Stream */}
                  {cameraPermission === 'granted' && (
                    <video 
                      ref={videoRef} 
                      onPlay={handleVideoPlaying}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  )}

                  {/* Visual Overlay - Reticle Target & Glowing Scanning Laser line */}
                  {cameraPermission === 'granted' && isScanning && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
                      {/* Grid overlay */}
                      <div className="w-56 h-56 border-2 border-primary/40 rounded-3xl relative flex items-center justify-center bg-black/20">
                        {/* Brackets in corners */}
                        <span className="absolute top-2 left-2 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                        <span className="absolute top-2 right-2 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                        <span className="absolute bottom-2 left-2 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                        <span className="absolute bottom-2 right-2 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
                        
                        {/* Animated Scanning Laser Line */}
                        <div className="absolute left-4 right-4 h-[2px] bg-primary shadow-[0_0_8px_rgba(var(--primary),1)] animate-[bounce_2s_infinite] opacity-80" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 mt-4 bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm shadow-sm">
                        Scanning Active...
                      </span>
                    </div>
                  )}

                  {/* Loading/Setup Screen */}
                  {cameraPermission === 'prompt' && !error && (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <RefreshCw className="w-8 h-8 animate-spin text-primary/40" />
                      <p className="text-xs font-semibold uppercase tracking-wider">Accessing Camera...</p>
                    </div>
                  )}

                  {/* Permission Denied / Error Screen */}
                  {cameraPermission === 'denied' && (
                    <div className="flex flex-col items-center text-center p-6 space-y-4 max-w-sm">
                      <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">Camera Access Restrained</p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {error || 'Authorize camera feed access in order to identify asset codes instantly.'}
                        </p>
                      </div>
                      <Button onClick={() => startCamera(selectedDeviceId)} className="text-xs font-bold uppercase tracking-wider px-4 py-2">
                        <RefreshCw className="w-3.5 h-3.5 mr-2" />
                        Try Access Again
                      </Button>
                    </div>
                  )}
                </div>

                {/* Device Selector Controls if Multiple Cameras */}
                {videoDevices.length > 1 && cameraPermission === 'granted' && (
                  <div className="flex items-center justify-between gap-3 bg-muted/50 p-3 rounded-xl border border-border/40">
                    <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Select Camera:</span>
                    <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                      <SelectTrigger className="w-48 h-8 text-[11px] font-semibold rounded-md border-border bg-card">
                        <SelectValue placeholder="Switch Camera" />
                      </SelectTrigger>
                      <SelectContent className="bg-popover text-popover-foreground border-border text-[11px]">
                        {videoDevices.map((device, i) => (
                          <SelectItem key={device.deviceId} value={device.deviceId}>
                            {device.label || `Camera ${i + 1}`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Manual Tag Entry (Fallback input) */}
                <form onSubmit={handleManualSearch} className="space-y-2 border-t border-border/40 pt-4">
                  <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground block mb-1">
                    Or Enter Asset Tag Manually
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                      <Input
                        type="text"
                        placeholder="e.g. AST-90812"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-10 rounded-xl text-xs font-semibold bg-muted/30 border-border focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                    <Button type="submit" disabled={!searchQuery.trim()} className="h-10 px-4 rounded-xl text-xs font-bold uppercase tracking-wider">
                      <Search className="w-4 h-4 mr-1.5" />
                      Query
                    </Button>
                  </div>
                </form>
              </div>
            )}

            {/* 2. Loading State during firestore asset lookup */}
            {isSearching && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <div className="text-center space-y-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Identifying Tag</p>
                  <p className="text-xs text-muted-foreground/60">Searching tag: "<span className="font-mono text-foreground">{scannedCode}</span>"</p>
                </div>
              </div>
            )}

            {/* 3. Scanned tag has NOT matched any asset (Empty results) */}
            {scannedCode && !scannedAsset && !isSearching && (
              <div className="flex flex-col items-center text-center py-8 px-4 space-y-5">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <p className="text-sm font-bold text-foreground">Tag Record Unfound</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    No asset matches the tag <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-foreground font-bold">"{scannedCode}"</span>.
                    You can register a new asset with this tag or run another search.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full justify-center pt-2">
                  <Button 
                    variant="outline" 
                    onClick={handleResetScanner} 
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-10"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Scan Another
                  </Button>
                  
                  {/* Let's send a custom event to App to open AssetForm pre-filled */}
                  <Button 
                    onClick={() => {
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent('register-tag', { 
                        detail: { tag: scannedCode } 
                      }));
                    }}
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-10 bg-primary"
                  >
                    <Package className="w-4 h-4 mr-1.5" />
                    Register Tag Asset
                  </Button>
                </div>
              </div>
            )}

            {/* 4. Match Found! Beautiful Asset Card Details with Quick Actions */}
            {scannedAsset && !isSearching && (
              <div className="space-y-6">
                
                {/* Main details banner */}
                <div className="bg-muted/40 rounded-2xl border border-border/40 overflow-hidden">
                  <div className="p-5 border-b border-border/40 flex items-start justify-between">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-primary uppercase bg-primary/5 px-2 py-0.5 rounded border border-primary/15 font-mono">
                          {scannedAsset.assetTag}
                        </span>
                        {getStatusBadge(scannedAsset.status)}
                      </div>
                      <h4 className="text-base font-bold text-foreground tracking-tight">{scannedAsset.name}</h4>
                      <p className="text-xs text-muted-foreground">{scannedAsset.model || 'Generic Model'} • {scannedAsset.vendor || 'Unknown Vendor'}</p>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                  </div>

                  {/* Metadata fields */}
                  <div className="p-5 grid grid-cols-2 gap-4 text-xs font-sans">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" /> Location
                      </span>
                      <p className="font-semibold text-foreground">{scannedAsset.location || 'Not Assigned'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" /> Assigned User
                      </span>
                      <p className="font-semibold text-foreground">{scannedAsset.assignedTo || 'Unassigned'}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" /> Category
                      </span>
                      <p className="font-semibold text-foreground uppercase tracking-wider text-[11px]">{scannedAsset.category}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5" /> Current Version
                      </span>
                      <p className="font-semibold text-foreground">v{scannedAsset.version || 1}</p>
                    </div>
                  </div>
                </div>

                {/* Status Quick Update Section */}
                <div className="bg-card border border-border/50 rounded-2xl p-5 space-y-4 shadow-sm">
                  <h5 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                    <Hammer className="w-4 h-4 text-primary" /> Quick Status Update
                  </h5>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 items-center">
                      <span className="text-xs font-bold text-muted-foreground">Select New State:</span>
                      <Select 
                        value={newStatus} 
                        onValueChange={(val: any) => setNewStatus(val as AssetStatus)}
                      >
                        <SelectTrigger className="h-9 text-xs font-semibold rounded-lg bg-muted/40 border-border">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent className="bg-popover text-popover-foreground border-border text-xs">
                          <SelectItem value="Procurement">Procurement</SelectItem>
                          <SelectItem value="Active">Active</SelectItem>
                          <SelectItem value="Maintenance">Maintenance</SelectItem>
                          <SelectItem value="Retired">Retired</SelectItem>
                          <SelectItem value="Disposal">Disposal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-muted-foreground block">
                        Status Notes
                      </label>
                      <Input
                        type="text"
                        placeholder="e.g. Completed hardware diagnostics"
                        value={statusNotes}
                        onChange={(e) => setStatusNotes(e.target.value)}
                        className="h-9 rounded-lg text-xs font-semibold bg-muted/20 border-border"
                      />
                    </div>

                    <Button 
                      onClick={handleUpdateStatus} 
                      disabled={newStatus === scannedAsset.status || isUpdatingStatus}
                      className="w-full text-xs font-bold uppercase tracking-wider h-9 rounded-lg bg-primary mt-2"
                    >
                      {isUpdatingStatus ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin mr-2" />
                          Saving Changes...
                        </>
                      ) : (
                        'Save Status Change'
                      )}
                    </Button>
                  </div>
                </div>

                {/* Footer action links */}
                <div className="flex gap-3 justify-end pt-2 border-t border-border/40">
                  <Button 
                    variant="outline" 
                    onClick={handleResetScanner}
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-10"
                  >
                    <RefreshCw className="w-4 h-4 mr-1.5" />
                    Scan Another
                  </Button>
                  
                  <Button 
                    onClick={handleViewInRegistry}
                    className="text-xs font-bold uppercase tracking-wider rounded-xl h-10 gap-1.5"
                  >
                    View in Registry
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>

              </div>
            )}

          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}
