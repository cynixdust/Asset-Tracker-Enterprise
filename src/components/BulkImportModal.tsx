import React, { useRef, useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  Download, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Info,
  Loader2,
  Trash2
} from 'lucide-react';
import { Asset, AssetCategory, AssetStatus, StatusHistoryEntry, Baseline } from '@/src/types';
import { firestoreService } from '@/src/lib/firestore';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface BulkImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingAssets: Asset[];
  baselines: Baseline[];
  userRole: string;
  userId?: string;
}

interface ParsedAsset {
  raw: Record<string, string>;
  mapped: Partial<Asset> & {
    compliance?: {
      licenseStatus: 'Valid' | 'Expired' | 'Missing' | 'N/A';
      licenseKey?: string;
      warrantyStatus: 'Active' | 'Expired' | 'N/A';
      securityStandards?: string[];
    };
  };
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

export default function BulkImportModal({ 
  open, 
  onOpenChange, 
  existingAssets, 
  baselines,
  userRole,
  userId
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedAsset[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    const headers = [
      'Name',
      'Asset Tag',
      'Category',
      'Vendor',
      'Model',
      'Serial Number',
      'Purchase Date',
      'Warranty Expiry',
      'Next Maintenance Date',
      'Status',
      'Location',
      'Assigned To',
      'Notes',
      'Baseline ID',
      'License Status',
      'License Key',
      'Warranty Status'
    ];
    
    const examples = [
      [
        'MacBook Pro 16',
        'EQ-MAC-042',
        'Endpoint',
        'Apple',
        'M3 Pro',
        'C02G23XYZ',
        '2026-01-15',
        '2029-01-15',
        '2026-07-15',
        'Active',
        'London Office',
        'John Doe',
        'Developer machine',
        '',
        'N/A',
        '',
        'Active'
      ],
      [
        'Core DB Server',
        'SRV-SQL-01',
        'Server',
        'Dell',
        'PowerEdge R760',
        'DELL9982X',
        '2025-10-10',
        '2028-10-10',
        '2026-04-10',
        'Active',
        'Primary Data Center',
        'Infrastructure Team',
        'Main database server',
        '',
        'N/A',
        '',
        'Active'
      ]
    ];

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers, ...examples].map(e => e.map(val => {
        // Wrap in quotes if it contains a comma or quote
        const stringVal = String(val);
        if (stringVal.includes(',') || stringVal.includes('"') || stringVal.includes('\n')) {
          return `"${stringVal.replace(/"/g, '""')}"`;
        }
        return stringVal;
      }).join(',')).join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `asset_bulk_import_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Template CSV downloaded successfully');
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv')) {
        handleFileSelected(droppedFile);
      } else {
        toast.error('Please upload a valid CSV file');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelected(e.target.files[0]);
    }
  };

  // Standard RFC 4180 CSV Parser
  const parseCSV = (text: string): string[][] => {
    const lines: string[][] = [];
    let row: string[] = [];
    let inQuotes = false;
    let currentVal = '';

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (inQuotes) {
        if (char === '"') {
          if (nextChar === '"') {
            currentVal += '"';
            i++; // skip next quote
          } else {
            inQuotes = false;
          }
        } else {
          currentVal += char;
        }
      } else {
        if (char === '"') {
          inQuotes = true;
        } else if (char === ',') {
          row.push(currentVal.trim());
          currentVal = '';
        } else if (char === '\n' || char === '\r') {
          if (char === '\r' && nextChar === '\n') {
            i++;
          }
          row.push(currentVal.trim());
          lines.push(row);
          row = [];
          currentVal = '';
        } else {
          currentVal += char;
        }
      }
    }
    if (currentVal || row.length > 0) {
      row.push(currentVal.trim());
      lines.push(row);
    }
    return lines.filter(r => r.some(cell => cell !== ''));
  };

  const handleFileSelected = (selectedFile: File) => {
    setFile(selectedFile);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;

      try {
        const rows = parseCSV(text);
        if (rows.length < 2) {
          toast.error('The uploaded CSV is empty or has no data rows.');
          return;
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const dataRows = rows.slice(1);

        const HEADER_MAP: Record<string, string> = {
          'name': 'name',
          'asset tag': 'assetTag',
          'tag': 'assetTag',
          'category': 'category',
          'vendor': 'vendor',
          'model': 'model',
          'serial number': 'serialNumber',
          'serial': 'serialNumber',
          'purchase date': 'purchaseDate',
          'warranty expiry': 'warrantyExpiry',
          'next maintenance date': 'nextMaintenanceDate',
          'maintenance date': 'nextMaintenanceDate',
          'status': 'status',
          'location': 'location',
          'assigned to': 'assignedTo',
          'notes': 'notes',
          'baseline id': 'baselineId',
          'baseline': 'baselineId',
          'license status': 'licenseStatus',
          'license key': 'licenseKey',
          'warranty status': 'warrantyStatus',
        };

        const results: ParsedAsset[] = [];
        const processedTags = new Set<string>();

        dataRows.forEach((row, rowIdx) => {
          const rawRecord: Record<string, string> = {};
          headers.forEach((header, colIdx) => {
            rawRecord[header] = row[colIdx] || '';
          });

          // Build mapped asset object
          const mappedRecord: any = {
            specs: {},
            compliance: {
              licenseStatus: 'N/A',
              licenseKey: '',
              warrantyStatus: 'N/A',
              securityStandards: [],
            }
          };

          // Basic string fields
          headers.forEach((header, colIdx) => {
            const mappedField = HEADER_MAP[header];
            if (mappedField) {
              const val = (row[colIdx] || '').trim();
              
              if (mappedField === 'licenseStatus') {
                const cleanVal = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
                if (['Valid', 'Expired', 'Missing', 'N/A'].includes(cleanVal)) {
                  mappedRecord.compliance.licenseStatus = cleanVal;
                } else if (val) {
                  mappedRecord.compliance.licenseStatus = 'N/A';
                }
              } else if (mappedField === 'licenseKey') {
                mappedRecord.compliance.licenseKey = val;
              } else if (mappedField === 'warrantyStatus') {
                const cleanVal = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
                if (['Active', 'Expired', 'N/A'].includes(cleanVal)) {
                  mappedRecord.compliance.warrantyStatus = cleanVal;
                } else if (val) {
                  mappedRecord.compliance.warrantyStatus = 'N/A';
                }
              } else {
                mappedRecord[mappedField] = val;
              }
            }
          });

          const errors: string[] = [];
          const warnings: string[] = [];

          // Validate required Name
          if (!mappedRecord.name) {
            errors.push('Name is required');
          } else if (mappedRecord.name.length < 2) {
            errors.push('Name must be at least 2 characters');
          }

          // Validate required Asset Tag
          if (!mappedRecord.assetTag) {
            errors.push('Asset Tag is required');
          } else if (mappedRecord.assetTag.length < 2) {
            errors.push('Asset Tag must be at least 2 characters');
          } else {
            // Check uniqueness in existing database
            const tagExists = existingAssets.some(a => a.assetTag.toLowerCase() === mappedRecord.assetTag.toLowerCase());
            if (tagExists) {
              errors.push(`Duplicate Asset Tag: '${mappedRecord.assetTag}' already exists in database`);
            }
            
            // Check uniqueness in current file batch
            if (processedTags.has(mappedRecord.assetTag.toLowerCase())) {
              errors.push(`Duplicate Asset Tag in uploaded file: '${mappedRecord.assetTag}'`);
            } else {
              processedTags.add(mappedRecord.assetTag.toLowerCase());
            }
          }

          // Validate Category
          if (!mappedRecord.category) {
            warnings.push("Category missing, defaulting to 'Endpoint'");
            mappedRecord.category = 'Endpoint';
          } else {
            // Match with capitalization
            const categories: AssetCategory[] = ['Server', 'Network', 'Storage', 'Endpoint', 'Software', 'Other'];
            const matchedCat = categories.find(c => c.toLowerCase() === mappedRecord.category.toLowerCase());
            if (matchedCat) {
              mappedRecord.category = matchedCat;
            } else {
              warnings.push(`Invalid Category '${mappedRecord.category}', defaulting to 'Other'`);
              mappedRecord.category = 'Other';
            }
          }

          // Validate Status
          if (!mappedRecord.status) {
            warnings.push("Status missing, defaulting to 'Active'");
            mappedRecord.status = 'Active';
          } else {
            const statuses: AssetStatus[] = ['Procurement', 'Active', 'Maintenance', 'Retired', 'Disposal'];
            const matchedStatus = statuses.find(s => s.toLowerCase() === mappedRecord.status.toLowerCase());
            if (matchedStatus) {
              mappedRecord.status = matchedStatus;
            } else {
              warnings.push(`Invalid Status '${mappedRecord.status}', defaulting to 'Active'`);
              mappedRecord.status = 'Active';
            }
          }

          // Validate dates
          const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
          ['purchaseDate', 'warrantyExpiry', 'nextMaintenanceDate'].forEach(dateField => {
            const val = mappedRecord[dateField];
            if (val && !dateRegex.test(val)) {
              warnings.push(`Invalid ${dateField} format '${val}'. Expected YYYY-MM-DD.`);
              mappedRecord[dateField] = ''; // clear invalid date so it won't crash
            }
          });

          // Check Serial Number uniqueness if provided
          if (mappedRecord.serialNumber) {
            const serialExists = existingAssets.some(a => a.serialNumber && a.serialNumber.toLowerCase() === mappedRecord.serialNumber.toLowerCase());
            if (serialExists) {
              warnings.push(`Serial Number '${mappedRecord.serialNumber}' already exists in DB (not blocking)`);
            }
          }

          // Apply baseline specifications if baselineId matches
          if (mappedRecord.baselineId) {
            const baseline = baselines.find(b => b.id === mappedRecord.baselineId || b.name.toLowerCase() === mappedRecord.baselineId.toLowerCase());
            if (baseline) {
              mappedRecord.baselineId = baseline.id;
              if (!mappedRecord.vendor && baseline.expectedVendor) mappedRecord.vendor = baseline.expectedVendor;
              if (!mappedRecord.model && baseline.expectedModel) mappedRecord.model = baseline.expectedModel;
              if (baseline.requiredSpecs) {
                mappedRecord.specs = { ...baseline.requiredSpecs };
              }
            } else {
              warnings.push(`Baseline ID or Name '${mappedRecord.baselineId}' not found. Leaving blank.`);
              mappedRecord.baselineId = '';
            }
          }

          results.push({
            raw: rawRecord,
            mapped: mappedRecord,
            errors,
            warnings,
            isValid: errors.length === 0
          });
        });

        setParsedData(results);
        toast.info(`Successfully parsed ${results.length} rows`);
      } catch (err) {
        toast.error('Failed to parse CSV file. Please make sure the structure is correct.');
      }
    };
    reader.readAsText(selectedFile);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setParsedData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const executeBulkImport = async () => {
    const validAssets = parsedData.filter(p => p.isValid);
    if (validAssets.length === 0) {
      toast.error('No valid asset records found to import.');
      return;
    }

    setIsImporting(true);
    setImportProgress({ current: 0, total: validAssets.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validAssets.length; i++) {
      const asset = validAssets[i];
      try {
        const statusEntry: StatusHistoryEntry = {
          status: asset.mapped.status || 'Active',
          changedAt: new Date(),
          changedBy: userId || 'system',
          notes: 'Created via Bulk Import template'
        };

        const assetData = {
          ...asset.mapped,
          statusHistory: [statusEntry],
          version: 1,
          versionHistory: []
        };

        const assetId = await firestoreService.add('assets', assetData);
        
        await firestoreService.add('audit_logs', {
          action: 'CREATE',
          entityType: 'Asset',
          entityId: assetId,
          userId: userId,
          details: `Bulk imported asset: ${asset.mapped.name} (${asset.mapped.assetTag})`
        });

        successCount++;
      } catch (err) {
        console.error('Failed to import row: ', asset.mapped.name, err);
        failCount++;
      }

      setImportProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setIsImporting(false);
    toast.success(`Bulk Import Complete: Successfully imported ${successCount} assets. ${failCount > 0 ? `Failed: ${failCount}` : ''}`);
    onOpenChange(false);
    handleRemoveFile();
  };

  const validCount = parsedData.filter(p => p.isValid).length;
  const invalidCount = parsedData.filter(p => !p.isValid).length;

  return (
    <Dialog open={open} onOpenChange={(val) => !isImporting && onOpenChange(val)}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border-border bg-card rounded-2xl p-0 shadow-lg">
        <div className="px-6 md:px-8 py-5 border-b border-border bg-muted/30 flex items-center justify-between">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Bulk Import Assets
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground font-medium">
              Upload a CSV spreadsheet to add multiple infrastructure records at once
            </DialogDescription>
          </DialogHeader>
          <button 
            disabled={isImporting}
            onClick={() => onOpenChange(false)}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted/80 hover:text-foreground transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
          {/* Informative Instructions & Download Link */}
          <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-start gap-3">
            <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs">
              <p className="font-bold text-foreground">Prepare Your Spreadsheet File</p>
              <p className="text-muted-foreground leading-relaxed">
                Ensure all columns match the system schema exactly. Essential fields are <strong className="text-foreground">Name</strong> and <strong className="text-foreground">Asset Tag</strong> (which must be completely unique). Valid values for Category include <em>Server, Network, Storage, Endpoint, Software</em>.
              </p>
              <Button 
                variant="link" 
                size="sm" 
                onClick={downloadTemplate}
                className="h-auto p-0 text-primary font-extrabold flex items-center gap-1.5 hover:text-primary/90 hover:no-underline"
              >
                <Download className="w-3.5 h-3.5" />
                Download CSV Template File
              </Button>
            </div>
          </div>

          {/* Upload Drop Zone */}
          {!file ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-3 text-center cursor-pointer transition-all",
                isDragActive 
                  ? "border-primary bg-primary/5 text-primary" 
                  : "border-border hover:border-border/80 hover:bg-muted/30"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".csv"
                className="hidden" 
              />
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
                <Upload className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">Drag and drop your CSV file here</p>
                <p className="text-xs text-muted-foreground">or click to browse your local directory</p>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest mt-2">Maximum file size: 5MB</span>
            </div>
          ) : (
            /* File loaded summary and statistics */
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/80 bg-muted/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold text-foreground truncate max-w-xs md:max-w-md">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">{(file.size / 1024).toFixed(1)} KB | {parsedData.length} records found</p>
                  </div>
                </div>
                {!isImporting && (
                  <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>

              {/* Parsed results & status breakdown */}
              <div className="flex gap-4">
                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{validCount}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-500 block mt-0.5">Valid & Ready</span>
                </div>
                <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
                  <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{invalidCount}</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-500 block mt-0.5">Errors / Invalid</span>
                </div>
              </div>

              {/* Detailed interactive table of preview rows */}
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="bg-muted/50 px-4 py-2.5 border-b border-border">
                  <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Import File Preview (First 50 Rows)</span>
                </div>
                <div className="max-h-[250px] overflow-y-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border/60 bg-muted/25">
                        <th className="px-4 py-2 font-bold text-muted-foreground text-[10px] uppercase tracking-wider w-16 text-center">Status</th>
                        <th className="px-4 py-2 font-bold text-muted-foreground text-[10px] uppercase tracking-wider">Asset Name</th>
                        <th className="px-4 py-2 font-bold text-muted-foreground text-[10px] uppercase tracking-wider">Asset Tag</th>
                        <th className="px-4 py-2 font-bold text-muted-foreground text-[10px] uppercase tracking-wider">Details & Issues</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {parsedData.slice(0, 50).map((record, index) => (
                        <tr key={index} className={cn("hover:bg-muted/20 transition-colors", !record.isValid && "bg-rose-500/[0.02]")}>
                          <td className="px-4 py-2.5 text-center">
                            {record.isValid ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500 inline-block" />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-rose-500 inline-block" />
                            )}
                          </td>
                          <td className="px-4 py-2.5 font-bold text-foreground">
                            {record.mapped.name || <span className="text-rose-500 font-medium italic">Empty Name</span>}
                          </td>
                          <td className="px-4 py-2.5 font-mono text-muted-foreground text-[11px]">
                            {record.mapped.assetTag || <span className="text-rose-500 font-medium italic">Empty Tag</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="space-y-1 max-w-md">
                              {/* Display validation errors in red */}
                              {record.errors.map((err, i) => (
                                <p key={i} className="text-rose-600 dark:text-rose-400 font-bold text-[10px] flex items-center gap-1">
                                  <span>•</span> {err}
                                </p>
                              ))}
                              {/* Display validation warnings in yellow */}
                              {record.warnings.map((warn, i) => (
                                <p key={i} className="text-amber-600 dark:text-amber-400 font-semibold text-[10px] flex items-center gap-1">
                                  <span>•</span> {warn}
                                </p>
                              ))}
                              {record.isValid && record.warnings.length === 0 && (
                                <span className="text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Ready to import</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer actions with progress bars */}
        <div className="px-6 md:px-8 py-5 border-t border-border bg-muted/30 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="w-full sm:w-auto text-center sm:text-left">
            {isImporting && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 justify-center sm:justify-start">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-xs font-bold text-foreground">Importing assets...</span>
                  <span className="text-[10px] font-bold text-muted-foreground">({importProgress.current} / {importProgress.total})</span>
                </div>
                <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300 rounded-full" 
                    style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isImporting}
              className="h-10 border-border text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer"
            >
              Cancel
            </Button>
            {file && (
              <Button 
                onClick={executeBulkImport}
                disabled={isImporting || validCount === 0}
                className="h-10 bg-primary text-primary-foreground hover:bg-primary/95 text-xs font-bold uppercase tracking-wider rounded-xl shadow-none cursor-pointer gap-2"
              >
                {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                Confirm & Import {validCount} Assets
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
