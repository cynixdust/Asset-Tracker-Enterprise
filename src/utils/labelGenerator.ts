import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { Asset } from '../types';
import { format } from 'date-fns';

/**
 * Generates a printable PDF label for an asset.
 * The label is optimized for thermal barcode/label printers (size: 60mm x 30mm).
 * Contains the Asset Name, Asset Tag, Category, Model, Serial Number, and a high-contrast QR code.
 */
export async function generateAssetLabel(asset: Asset): Promise<void> {
  try {
    // 1. Generate the QR Code Data URL locally
    const qrDataUrl = await QRCode.toDataURL(asset.assetTag, {
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // 2. Create jsPDF instance with custom label size (60mm width x 30mm height)
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [60, 30]
    });

    // Set font to standard sans-serif
    doc.setFont('Helvetica', 'normal');

    // 3. Draw Outer Border Frame for clean layout boundary (margin of 1.5mm)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.3);
    doc.rect(1.5, 1.5, 57, 27);

    // 4. Draw Header / Branding
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(5);
    doc.setTextColor(100, 100, 100);
    doc.text('ASSETLINK PRO • HARDWARE TAG', 4, 4.5);

    // Divider line under brand
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.1);
    doc.line(4, 5.5, 34, 5.5);

    // 5. Asset Name (Bold, font size 8)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 0, 0);
    const displayName = asset.name.length > 25 ? asset.name.substring(0, 22) + '...' : asset.name;
    doc.text(displayName, 4, 9);

    // 6. Asset Tag (Larger, monospace-like or bold sans, font size 10)
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(0, 0, 0);
    doc.text(asset.assetTag, 4, 14);

    // 7. Details: Category & Vendor/Model
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(60, 60, 60);
    
    // Model detail line
    const modelStr = [asset.vendor, asset.model].filter(Boolean).join(' ');
    const displayModel = modelStr 
      ? (modelStr.length > 30 ? modelStr.substring(0, 27) + '...' : modelStr)
      : 'No Model Specified';
    doc.text(`Model: ${displayModel}`, 4, 18);

    // Serial detail line
    const serialStr = asset.serialNumber 
      ? (asset.serialNumber.length > 20 ? asset.serialNumber.substring(0, 17) + '...' : asset.serialNumber)
      : 'N/A';
    doc.text(`S/N: ${serialStr}`, 4, 21.5);

    // Location / Assignment
    const locStr = asset.location 
      ? (asset.location.length > 22 ? asset.location.substring(0, 19) + '...' : asset.location)
      : 'Unassigned Location';
    doc.text(`Loc: ${locStr}`, 4, 25);

    // Category Badge style info
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(5);
    doc.text(`CAT: ${asset.category.toUpperCase()}`, 4, 27.5);

    // 8. Place high-contrast QR Code on the right
    // Size: 22mm x 22mm, centered vertically (30mm height - 22mm size = 8mm remaining, so 4mm top/bottom margin)
    doc.addImage(qrDataUrl, 'PNG', 35, 4, 22, 22);

    // 9. Save / Download the PDF
    const filename = `label_${asset.assetTag.toLowerCase().replace(/[^a-z0-9]/g, '_')}.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error('Error generating asset label PDF:', error);
    throw error;
  }
}

/**
 * Generates a single-page sheets PDF containing labels for multiple assets.
 * Useful for bulk label printing.
 */
export async function generateBulkAssetLabels(assets: Asset[]): Promise<void> {
  if (assets.length === 0) return;
  
  try {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: [60, 30]
    });

    for (let i = 0; i < assets.length; i++) {
      const asset = assets[i];
      if (i > 0) {
        doc.addPage([60, 30], 'landscape');
      }

      // Generate QR Code data url
      const qrDataUrl = await QRCode.toDataURL(asset.assetTag, {
        margin: 1,
        width: 200,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Outer border frame
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.rect(1.5, 1.5, 57, 27);

      // Header / Branding
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5);
      doc.setTextColor(100, 100, 100);
      doc.text('ASSETLINK PRO • HARDWARE TAG', 4, 4.5);

      // Divider line
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.1);
      doc.line(4, 5.5, 34, 5.5);

      // Asset Name
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(0, 0, 0);
      const displayName = asset.name.length > 25 ? asset.name.substring(0, 22) + '...' : asset.name;
      doc.text(displayName, 4, 9);

      // Asset Tag
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(0, 0, 0);
      doc.text(asset.assetTag, 4, 14);

      // Details
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(5.5);
      doc.setTextColor(60, 60, 60);
      
      const modelStr = [asset.vendor, asset.model].filter(Boolean).join(' ');
      const displayModel = modelStr 
        ? (modelStr.length > 30 ? modelStr.substring(0, 27) + '...' : modelStr)
        : 'No Model Specified';
      doc.text(`Model: ${displayModel}`, 4, 18);

      const serialStr = asset.serialNumber 
        ? (asset.serialNumber.length > 20 ? asset.serialNumber.substring(0, 17) + '...' : asset.serialNumber)
        : 'N/A';
      doc.text(`S/N: ${serialStr}`, 4, 21.5);

      const locStr = asset.location 
        ? (asset.location.length > 22 ? asset.location.substring(0, 19) + '...' : asset.location)
        : 'Unassigned Location';
      doc.text(`Loc: ${locStr}`, 4, 25);

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(5);
      doc.text(`CAT: ${asset.category.toUpperCase()}`, 4, 27.5);

      // Add QR Code
      doc.addImage(qrDataUrl, 'PNG', 35, 4, 22, 22);
    }

    doc.save(`bulk_labels_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`);
  } catch (error) {
    console.error('Error generating bulk asset labels:', error);
    throw error;
  }
}
