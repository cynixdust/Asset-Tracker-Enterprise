export type AssetCategory = 'Server' | 'Network' | 'Storage' | 'Endpoint' | 'Software' | 'Other';
export type AssetStatus = 'Procurement' | 'Active' | 'Maintenance' | 'Retired' | 'Disposal';
export type RelationshipType = 'Parent' | 'Child' | 'Depends On' | 'Required By' | 'Connected To';

export interface AssetRelationship {
  targetAssetId: string;
  targetAssetName: string;
  type: RelationshipType;
}

export interface Baseline {
  id?: string;
  name: string;
  category: AssetCategory;
  expectedVendor?: string;
  expectedModel?: string;
  requiredSpecs?: Record<string, string>;
  description?: string;
}

export type DiscoveryStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';
export type DiscoveryType = 'SNMP' | 'Network Scan' | 'Agent' | 'API';

export interface DiscoveryJob {
  id?: string;
  name: string;
  type: DiscoveryType;
  target: string; // IP range, URL, or Agent ID
  status: DiscoveryStatus;
  lastRun?: any;
  config?: Record<string, any>;
}

export interface DiscoveryResult {
  id?: string;
  jobId: string;
  assetData: Partial<Asset>;
  detectedAt: any;
  status: 'New' | 'Merged' | 'Ignored';
}

export interface StatusHistoryEntry {
  status: AssetStatus;
  changedAt: any;
  changedBy: string;
  notes?: string;
}

export interface ComplianceInfo {
  licenseStatus: 'Valid' | 'Expired' | 'Missing' | 'N/A';
  licenseKey?: string;
  warrantyStatus: 'Active' | 'Expired' | 'N/A';
  securityStandards: string[];
  lastAuditDate?: any;
  isCompliant: boolean;
  policyViolations: string[];
}

export interface Policy {
  id?: string;
  name: string;
  description: string;
  category: AssetCategory | 'All';
  severity: 'Low' | 'Medium' | 'High' | 'Critical';
  type: 'Warranty' | 'License' | 'Security' | 'Custom';
}

export interface AssetVersion {
  version: number;
  data: Partial<Asset>;
  changedAt: any;
  changedBy: string;
  changeReason?: string;
}

export interface Asset {
  id?: string;
  name: string;
  assetTag: string;
  category: AssetCategory;
  vendor?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string;
  warrantyExpiry?: string;
  nextMaintenanceDate?: string;
  status: AssetStatus;
  statusHistory?: StatusHistoryEntry[];
  location?: string;
  assignedTo?: string;
  notes?: string;
  baselineId?: string;
  specs?: Record<string, string>;
  relatedAssets?: AssetRelationship[];
  compliance?: ComplianceInfo;
  version: number;
  versionHistory?: AssetVersion[];
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  username: string;
  displayName?: string;
  role: 'admin' | 'user';
  lastLogin: any;
}

export interface AuditLog {
  id?: string;
  action: string;
  entityType: string;
  entityId: string;
  userId: string;
  timestamp: any;
  details: string;
}

export interface SystemSettings {
  ldapEnabled: boolean;
  ldapServer: string;
  ldapPort: number;
  ldapBaseDn: string;
}

declare global {
  interface Window {
    electron?: {
      scanNetwork: () => Promise<any[]>;
      getPlatform: () => string;
    };
  }
}
