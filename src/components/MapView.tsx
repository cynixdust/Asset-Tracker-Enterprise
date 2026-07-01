import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  APIProvider, 
  Map, 
  AdvancedMarker, 
  Pin, 
  InfoWindow 
} from '@vis.gl/react-google-maps';
import { 
  MapPin, 
  Search, 
  Globe, 
  Building, 
  Server, 
  Info, 
  Edit, 
  Navigation,
  Check,
  AlertCircle,
  X,
  Plus,
  HelpCircle
} from 'lucide-react';
import { Asset } from '../types';
import { firestoreService } from '../lib/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface MapViewProps {
  assets: Asset[];
  onEdit?: (asset: Asset) => void;
}

interface MapAsset {
  asset: Asset;
  lat: number;
  lng: number;
}

// Preset locations for quick assignment
const PRESETS = [
  { name: 'Silicon Valley HQ', lat: 37.4220, lng: -122.0841, icon: Building },
  { name: 'New York Office', lat: 40.7128, lng: -74.0060, icon: Building },
  { name: 'London Data Center', lat: 51.5074, lng: -0.1278, icon: Server },
  { name: 'Tokyo Hub', lat: 35.6762, lng: 139.6503, icon: Globe },
];

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY';

export default function MapView({ assets, onEdit }: MapViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'mapped' | 'unmapped'>('mapped');
  const [selectedAsset, setSelectedAsset] = useState<MapAsset | null>(null);
  
  // Custom manual coordinate inputs
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [assigningAssetId, setAssigningAssetId] = useState<string | null>(null);

  // Map state
  const [mapCenter, setMapCenter] = useState({ lat: 37.4220, lng: -122.0841 });
  const [mapZoom, setMapZoom] = useState(3);

  // Extract coordinates from an asset (check specs or location field)
  const parseCoordinates = (asset: Asset): { lat: number, lng: number } | null => {
    // 1. Try from specs
    if (asset.specs) {
      const latVal = asset.specs.latitude || asset.specs.lat;
      const lngVal = asset.specs.longitude || asset.specs.lng || asset.specs.lon;
      if (latVal && lngVal) {
        const lat = parseFloat(latVal);
        const lng = parseFloat(lngVal);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }

    // 2. Try parsing from the location text (e.g., "37.4220, -122.0841" or "HQ (37.4220, -122.0841)")
    if (asset.location) {
      const regex = /(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/;
      const match = asset.location.match(regex);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
        }
      }
    }

    return null;
  };

  // Divide assets into mapped and unmapped
  const { mappedAssets, unmappedAssets } = useMemo(() => {
    const mapped: MapAsset[] = [];
    const unmapped: Asset[] = [];

    assets.forEach(asset => {
      // Filter by search query if present
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          asset.name.toLowerCase().includes(query) || 
          asset.assetTag.toLowerCase().includes(query) || 
          (asset.location && asset.location.toLowerCase().includes(query)) ||
          asset.category.toLowerCase().includes(query);
        
        if (!matchesSearch) return;
      }

      const coords = parseCoordinates(asset);
      if (coords) {
        mapped.push({
          asset,
          lat: coords.lat,
          lng: coords.lng
        });
      } else {
        unmapped.push(asset);
      }
    });

    return { mappedAssets: mapped, unmappedAssets: unmapped };
  }, [assets, searchQuery]);

  // Handle marker/item selection
  const handleSelectAsset = (mapAsset: MapAsset) => {
    setSelectedAsset(mapAsset);
    setMapCenter({ lat: mapAsset.lat, lng: mapAsset.lng });
    setMapZoom(14);
  };

  // Assign location coordinates to asset
  const handleAssignCoordinates = async (asset: Asset, lat: number, lng: number, locationName?: string) => {
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error('Invalid coordinates. Latitude must be -90 to 90, Longitude must be -180 to 180.');
      return;
    }

    try {
      const updatedSpecs = {
        ...(asset.specs || {}),
        latitude: lat.toFixed(6),
        longitude: lng.toFixed(6)
      };

      const updatedData: Partial<Asset> = {
        specs: updatedSpecs
      };

      if (locationName) {
        updatedData.location = locationName;
      } else if (!asset.location) {
        updatedData.location = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      }

      await firestoreService.update('assets', asset.id!, updatedData);
      
      // Log audit trail
      await firestoreService.add('audit_logs', {
        action: 'UPDATE',
        entityType: 'Asset',
        entityId: asset.id!,
        details: `Updated physical coordinates: lat ${lat.toFixed(6)}, lng ${lng.toFixed(6)}`
      });

      toast.success(`Coordinates assigned to ${asset.name}`);
      setAssigningAssetId(null);
      setManualLat('');
      setManualLng('');

      // If assigning coordinates, auto-focus on the newly mapped asset on the map
      setTimeout(() => {
        handleSelectAsset({ asset: { ...asset, ...updatedData }, lat, lng });
      }, 500);

    } catch (error) {
      console.error('Failed to update asset coordinates:', error);
      toast.error('Failed to assign coordinates');
    }
  };

  // If no API Key is configured, show splash screen with instructions
  if (!hasValidKey) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[calc(100vh-4rem)] bg-background">
        <Card className="max-w-xl w-full border border-border/60 shadow-lg rounded-2xl overflow-hidden">
          <CardHeader className="bg-muted/30 border-b border-border/40 pb-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
              <MapPin className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl font-black uppercase tracking-wider">Google Maps API Key Required</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              To display assets on the interactive map, you must configure a Google Maps API Key in your workspace Secrets.
            </p>
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-xl border border-border/40 text-xs space-y-3">
                <div className="flex items-start gap-2.5">
                  <span className="font-extrabold text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">1</span>
                  <div>
                    <span className="font-bold">Get a Google Maps API Key:</span>
                    <a 
                      href="https://console.cloud.google.com/google/maps-apis/start?utm_campaign=gmp-code-assist-ais" 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-primary hover:underline ml-1 inline-flex items-center gap-0.5"
                    >
                      Get Started Guide
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="font-extrabold text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0">2</span>
                  <div>
                    <span className="font-bold">Configure Secret:</span> Open <span className="font-bold">Settings</span> (⚙️ gear icon, top-right corner) &rarr; <span className="font-bold">Secrets</span> &rarr; type <code className="bg-muted px-1.5 py-0.5 rounded border text-rose-500 font-mono text-[10px]">GOOGLE_MAPS_PLATFORM_KEY</code> as the name &rarr; paste your API key &rarr; press Enter.
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground font-semibold uppercase text-center tracking-wider">
              The application compiles automatically after configuring the secret
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Pin background color by asset status
  const getPinColor = (status: string) => {
    switch (status) {
      case 'Active': return '#10b981'; // green
      case 'Maintenance': return '#f59e0b'; // amber
      case 'Procurement': return '#3b82f6'; // blue
      case 'Retired': return '#6b7280'; // gray
      case 'Disposal': return '#ef4444'; // red
      default: return '#6366f1'; // indigo
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-background">
      {/* Sidebar Section */}
      <div className="w-[380px] border-r border-border bg-card flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-border space-y-4">
          <div className="space-y-1">
            <h2 className="text-base font-black uppercase tracking-wider text-foreground">Physical Locations</h2>
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Asset GPS & Coordinates Mapping</p>
          </div>

          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search assets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          {/* Mapped vs Unmapped Tab Selectors */}
          <div className="flex bg-muted/60 p-1 rounded-xl gap-1">
            <button
              onClick={() => {
                setActiveTab('mapped');
                setAssigningAssetId(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all ${
                activeTab === 'mapped'
                  ? 'bg-card text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Mapped ({mappedAssets.length})
            </button>
            <button
              onClick={() => {
                setActiveTab('unmapped');
                setSelectedAsset(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-center transition-all ${
                activeTab === 'unmapped'
                  ? 'bg-card text-foreground shadow-sm border border-border/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Unmapped ({unmappedAssets.length})
            </button>
          </div>
        </div>

        {/* List Content */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {activeTab === 'mapped' ? (
              mappedAssets.length > 0 ? (
                mappedAssets.map((mapAsset) => (
                  <div
                    key={mapAsset.asset.id}
                    onClick={() => handleSelectAsset(mapAsset)}
                    className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col gap-2 hover:bg-muted/15 ${
                      selectedAsset?.asset.id === mapAsset.asset.id
                        ? 'border-primary bg-primary/[0.02] shadow-sm'
                        : 'border-border/60 bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-bold text-foreground leading-tight">{mapAsset.asset.name}</h4>
                        <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">{mapAsset.asset.assetTag}</span>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className="text-[9px] font-extrabold uppercase py-0.5 px-2 tracking-wider"
                        style={{
                          backgroundColor: `${getPinColor(mapAsset.asset.status)}15`,
                          color: getPinColor(mapAsset.asset.status),
                          borderColor: `${getPinColor(mapAsset.asset.status)}30`
                        }}
                      >
                        {mapAsset.asset.status}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-primary/70" />
                      <span className="truncate max-w-[200px]">{mapAsset.asset.location || `${mapAsset.lat.toFixed(4)}, ${mapAsset.lng.toFixed(4)}`}</span>
                    </div>

                    <div className="flex items-center justify-between text-[9px] text-muted-foreground/60 font-mono mt-1 border-t border-border/40 pt-1.5">
                      <span>LAT: {mapAsset.lat.toFixed(5)}</span>
                      <span>LNG: {mapAsset.lng.toFixed(5)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40 mx-auto">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">No Mapped Assets Found</p>
                  <p className="text-[10px] text-muted-foreground/80 max-w-[220px] mx-auto leading-relaxed">
                    Check the "Unmapped" tab to quickly assign coordinates to your equipment assets.
                  </p>
                </div>
              )
            ) : (
              unmappedAssets.length > 0 ? (
                unmappedAssets.map((asset) => {
                  const isAssigning = assigningAssetId === asset.id;

                  return (
                    <div
                      key={asset.id}
                      className="p-4 rounded-2xl border border-border/60 bg-card flex flex-col gap-3.5 transition-all hover:border-border"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-xs font-bold text-foreground leading-tight">{asset.name}</h4>
                          <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase">{asset.assetTag}</span>
                        </div>
                        <Badge variant="outline" className="text-[9px] font-extrabold uppercase py-0.5 px-2 tracking-wider">
                          {asset.category}
                        </Badge>
                      </div>

                      {asset.location && (
                        <div className="text-[10px] bg-muted/40 p-2 rounded-lg border border-border/40 text-muted-foreground font-medium">
                          <span className="font-bold text-[8px] uppercase block tracking-wider text-muted-foreground/60">Current Text Location</span>
                          {asset.location}
                        </div>
                      )}

                      {!isAssigning ? (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-[10px] font-bold uppercase tracking-wider h-8 rounded-lg cursor-pointer"
                          onClick={() => setAssigningAssetId(asset.id!)}
                        >
                          <Plus className="w-3.5 h-3.5 mr-1" /> Assign GPS Location
                        </Button>
                      ) : (
                        <div className="space-y-3.5 border-t border-border/40 pt-3.5 animate-in fade-in duration-200">
                          {/* Presets Grid */}
                          <div className="space-y-1.5">
                            <span className="text-[8px] uppercase font-black text-muted-foreground/60 tracking-widest block">Quick Presets</span>
                            <div className="grid grid-cols-2 gap-1.5">
                              {PRESETS.map((preset) => (
                                <button
                                  key={preset.name}
                                  onClick={() => handleAssignCoordinates(asset, preset.lat, preset.lng, preset.name)}
                                  className="py-1 px-2 border border-border/60 hover:border-primary hover:bg-primary/[0.01] rounded-lg text-left text-[9px] font-bold transition-all flex items-center gap-1 truncate"
                                >
                                  <preset.icon className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="truncate">{preset.name}</span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Manual Coordinates Input */}
                          <div className="space-y-2">
                            <span className="text-[8px] uppercase font-black text-muted-foreground/60 tracking-widest block">Custom GPS Coordinates</span>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <label className="text-[8px] uppercase text-muted-foreground font-bold">Latitude</label>
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="e.g. 37.422"
                                  value={manualLat}
                                  onChange={(e) => setManualLat(e.target.value)}
                                  className="h-7 text-[10px] px-2"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-[8px] uppercase text-muted-foreground font-bold">Longitude</label>
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="e.g. -122.08"
                                  value={manualLng}
                                  onChange={(e) => setManualLng(e.target.value)}
                                  className="h-7 text-[10px] px-2"
                                />
                              </div>
                            </div>

                            <div className="flex gap-1.5 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[9px] font-bold uppercase tracking-widest h-7 text-muted-foreground"
                                onClick={() => setAssigningAssetId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 text-[9px] font-bold uppercase tracking-widest h-7"
                                onClick={() => handleAssignCoordinates(asset, parseFloat(manualLat), parseFloat(manualLng))}
                              >
                                Save GPS
                              </Button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground/40 mx-auto">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">All Assets Mapped</p>
                  <p className="text-[10px] text-muted-foreground/80 max-w-[220px] mx-auto leading-relaxed">
                    All currently registered system assets are properly tagged with spatial coordinates metadata.
                  </p>
                </div>
              )
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Main Map View Section */}
      <div className="flex-1 relative h-full">
        <APIProvider apiKey={API_KEY} version="weekly">
          <Map
            center={mapCenter}
            zoom={mapZoom}
            onCenterChanged={(ev) => setMapCenter(ev.detail.center)}
            onZoomChanged={(ev) => setMapZoom(ev.detail.zoom)}
            mapId="DEMO_MAP_ID"
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
            style={{ width: '100%', height: '100%' }}
          >
            {mappedAssets.map((mapAsset) => {
              const markerPosition = { lat: mapAsset.lat, lng: mapAsset.lng };

              return (
                <AdvancedMarker
                  key={mapAsset.asset.id}
                  position={markerPosition}
                  title={mapAsset.asset.name}
                  onClick={() => setSelectedAsset(mapAsset)}
                >
                  <Pin 
                    background={getPinColor(mapAsset.asset.status)} 
                    glyphColor="#ffffff" 
                    borderColor="#ffffff"
                  />
                </AdvancedMarker>
              );
            })}

            {/* Selected Asset Info Window */}
            {selectedAsset && (
              <InfoWindow
                position={{ lat: selectedAsset.lat, lng: selectedAsset.lng }}
                onCloseClick={() => setSelectedAsset(null)}
              >
                <div className="p-1 max-w-[240px] text-foreground space-y-2.5">
                  <div className="space-y-0.5">
                    <h3 className="text-xs font-extrabold leading-tight text-foreground pr-4">
                      {selectedAsset.asset.name}
                    </h3>
                    <span className="font-mono text-[9px] text-muted-foreground tracking-wider uppercase block">
                      {selectedAsset.asset.assetTag}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 text-[9px] border-t border-b border-border/40 py-1.5">
                    <div>
                      <span className="text-[8px] uppercase text-muted-foreground font-black block tracking-wider">Category</span>
                      <span className="font-bold text-foreground">{selectedAsset.asset.category}</span>
                    </div>
                    <div>
                      <span className="text-[8px] uppercase text-muted-foreground font-black block tracking-wider">Status</span>
                      <span className="font-bold text-foreground" style={{ color: getPinColor(selectedAsset.asset.status) }}>
                        {selectedAsset.asset.status}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[8px] uppercase text-muted-foreground font-black block tracking-wider">Physical Location</span>
                      <span className="font-bold text-foreground truncate block">{selectedAsset.asset.location || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex gap-1.5 pt-0.5">
                    {onEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6.5 text-[9px] font-bold uppercase tracking-wider rounded-md cursor-pointer flex-1 gap-1"
                        onClick={() => {
                          onEdit(selectedAsset.asset);
                          setSelectedAsset(null);
                        }}
                      >
                        <Edit className="w-2.5 h-2.5" />
                        Edit Details
                      </Button>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </Map>
        </APIProvider>
      </div>
    </div>
  );
}
