import { jsPDF } from 'jspdf';
import { Asset } from '../types';
import { format } from 'date-fns';

interface FilterCriteria {
  search: string;
  category: string;
  status: string;
  location: string;
  compliance: string;
  warranty: string;
}

/**
 * Generates a beautiful summary PDF report of the filtered assets.
 * Includes executive statistics, status distribution analysis, and a clean tabular registry.
 */
export async function generateSummaryReport(assets: Asset[], filters: FilterCriteria): Promise<void> {
  try {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
    const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
    const margin = 15;
    const contentWidth = pageWidth - (margin * 2); // 180mm

    // Color Palette (Slate/Modern aesthetic)
    const colors = {
      primary: { r: 15, g: 23, b: 42 },    // Slate 900 (deep navy-black)
      secondary: { r: 100, g: 116, b: 139 }, // Slate 500 (gray)
      lightBg: { r: 248, g: 250, b: 252 },   // Slate 50 (soft background)
      border: { r: 226, g: 232, b: 240 },    // Slate 200 (light border)
      accent: { r: 37, g: 99, b: 235 },      // Royal Blue accent
      textDark: { r: 15, g: 23, b: 42 },
      textLight: { r: 255, g: 255, b: 255 }
    };

    // Helper: Draw Header on each page
    const drawPageHeader = (pageNumber: number) => {
      // Small upper brand line
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
      doc.text('ASSETLINK PRO • SYSTEM METRICS REPORT', margin, 12);
      
      // Right side run date
      const runDateStr = format(new Date(), 'PPP p');
      doc.setFont('Helvetica', 'normal');
      doc.text(`Generated: ${runDateStr}`, pageWidth - margin, 12, { align: 'right' });

      // Fine header division line
      doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
      doc.setLineWidth(0.3);
      doc.line(margin, 14, pageWidth - margin, 14);
    };

    // Helper: Draw Footer on each page
    const drawPageFooter = (pageNumber: number, totalPagesPlaceholder: string) => {
      doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
      doc.text('Confidential - Internal IT Infrastructure Asset Registry', margin, pageHeight - 9);
      doc.text(`Page ${pageNumber} of ${totalPagesPlaceholder}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
    };

    // Start rendering the cover / main summary section
    drawPageHeader(1);

    // --- REPORT TITLE ---
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(22);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('IT Assets Inventory Summary', margin, 24);

    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
    doc.text('A comprehensive structural snapshot of active and managed technological infrastructure.', margin, 29);

    // --- EXECUTIVE METRICS BLOCK ---
    doc.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
    doc.roundedRect(margin, 34, contentWidth, 24, 2, 2, 'F');
    
    // Total Count Callout
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
    doc.text('TOTAL ASSETS IN SCOPE', margin + 6, 40);
    
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colors.accent.r, colors.accent.g, colors.accent.b);
    doc.text(String(assets.length), margin + 6, 48);

    // Active status counts
    const activeCount = assets.filter(a => a.status === 'Active').length;
    const maintenanceCount = assets.filter(a => a.status === 'Maintenance').length;
    const otherCount = assets.length - activeCount - maintenanceCount;

    // Stat Column 2
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
    doc.text('ACTIVE & OPERATIONAL', margin + 65, 40);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(String(activeCount), margin + 65, 48);

    // Stat Column 3
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
    doc.text('UNDER MAINTENANCE', margin + 120, 40);
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text(String(maintenanceCount), margin + 120, 48);

    // --- APPLIED FILTERS SUBSECTION ---
    let yPos = 65;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('Scope and Filter Criteria Applied:', margin, yPos);
    
    yPos += 5;
    doc.setFont('Helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);

    const filterLabels = [
      `Search: "${filters.search || 'None'}"`,
      `Category: ${filters.category === 'all' ? 'All Categories' : filters.category}`,
      `Status: ${filters.status === 'all' ? 'All Statuses' : filters.status}`,
      `Location: ${filters.location === 'all' ? 'All Locations' : filters.location}`,
    ];
    doc.text(filterLabels.join('   |   '), margin, yPos);

    // Thin separator line
    yPos += 6;
    doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
    doc.line(margin, yPos, pageWidth - margin, yPos);

    // --- TABLE HEADERS ---
    yPos += 10;
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.text('Asset Ledger Register', margin, yPos);

    yPos += 6;
    
    // Column Definitions: widths must sum to contentWidth (180mm)
    const cols = [
      { id: 'tag', label: 'ASSET TAG', width: 28 },
      { id: 'name', label: 'NAME', width: 44 },
      { id: 'category', label: 'CATEGORY', width: 22 },
      { id: 'model', label: 'VENDOR / MODEL', width: 42 },
      { id: 'location', label: 'LOCATION', width: 24 },
      { id: 'status', label: 'STATUS', width: 20 }
    ];

    // Render Table Header Background
    doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
    doc.rect(margin, yPos, contentWidth, 7, 'F');

    // Render Header Text
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(colors.textLight.r, colors.textLight.g, colors.textLight.b);
    let xOffset = margin;
    cols.forEach(col => {
      const align = col.id === 'status' ? 'center' : 'left';
      const textX = align === 'center' ? xOffset + (col.width / 2) : xOffset + 3;
      doc.text(col.label, textX, yPos + 4.8, { align });
      xOffset += col.width;
    });

    yPos += 7; // Move to first row position

    let currentPageNum = 1;
    const rowHeight = 7.5;

    // Iterate Assets and print rows
    assets.forEach((asset, index) => {
      // Check if we need to spill over to next page
      // Leave 20mm margin at bottom for the page footer
      if (yPos + rowHeight > pageHeight - 20) {
        // Draw footer of current page before switching
        drawPageFooter(currentPageNum, '##TOTAL_PAGES##');
        
        doc.addPage();
        currentPageNum++;
        yPos = 20; // reset vertical position for subsequent pages
        
        drawPageHeader(currentPageNum);

        // Re-render Table Header on the new page
        doc.setFillColor(colors.primary.r, colors.primary.g, colors.primary.b);
        doc.rect(margin, yPos, contentWidth, 7, 'F');
        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(colors.textLight.r, colors.textLight.g, colors.textLight.b);
        
        let subXOffset = margin;
        cols.forEach(col => {
          const align = col.id === 'status' ? 'center' : 'left';
          const textX = align === 'center' ? subXOffset + (col.width / 2) : subXOffset + 3;
          doc.text(col.label, textX, yPos + 4.8, { align });
          subXOffset += col.width;
        });
        
        yPos += 7;
      }

      // Zebra striping background
      if (index % 2 === 1) {
        doc.setFillColor(colors.lightBg.r, colors.lightBg.g, colors.lightBg.b);
        doc.rect(margin, yPos, contentWidth, rowHeight, 'F');
      }

      // Draw bottom row divider lines
      doc.setDrawColor(colors.border.r, colors.border.g, colors.border.b);
      doc.setLineWidth(0.15);
      doc.line(margin, yPos + rowHeight, pageWidth - margin, yPos + rowHeight);

      // Render cells text
      doc.setFontSize(7.5);
      
      let colX = margin;
      cols.forEach(col => {
        let text = '';
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(colors.textDark.r, colors.textDark.g, colors.textDark.b);

        if (col.id === 'tag') {
          text = asset.assetTag;
          doc.setFont('Courier', 'bold'); // Monospace tag
        } else if (col.id === 'name') {
          text = asset.name;
          doc.setFont('Helvetica', 'bold');
        } else if (col.id === 'category') {
          text = asset.category;
        } else if (col.id === 'model') {
          text = [asset.vendor, asset.model].filter(Boolean).join(' ') || 'N/A';
        } else if (col.id === 'location') {
          text = asset.location || 'N/A';
        } else if (col.id === 'status') {
          text = asset.status;
          doc.setFont('Helvetica', 'bold');
          // Highlight colors based on status type
          if (asset.status === 'Active') {
            doc.setTextColor(16, 124, 65); // soft green
          } else if (asset.status === 'Maintenance') {
            doc.setTextColor(190, 110, 0); // soft orange
          } else {
            doc.setTextColor(100, 100, 100);
          }
        }

        // Cell clip / truncate helper to avoid column bleed
        const maxChars = col.id === 'name' ? 24 : col.id === 'model' ? 24 : col.id === 'location' ? 14 : 30;
        const displayText = text.length > maxChars ? text.substring(0, maxChars - 2) + '..' : text;

        const align = col.id === 'status' ? 'center' : 'left';
        const cellTextX = align === 'center' ? colX + (col.width / 2) : colX + 3;
        
        doc.text(displayText, cellTextX, yPos + 4.8, { align });
        colX += col.width;
      });

      yPos += rowHeight;
    });

    // Final page footer of last page
    drawPageFooter(currentPageNum, '##TOTAL_PAGES##');

    // Replace the page placeholders dynamically
    const totalPages = currentPageNum;
    for (let j = 1; j <= totalPages; j++) {
      doc.setPage(j);
      // We overwrite or modify the text in jsPDF or just output standard string.
      // A safe way is to call internal page count mapping of jsPDF:
    }

    // Now, run a secondary pass to write "Page X of Y" dynamically
    const totalPagesString = String(totalPages);
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(colors.secondary.r, colors.secondary.g, colors.secondary.b);
      // Draw white rectangle to hide "Page X of ##TOTAL_PAGES##"
      doc.setFillColor(colors.textLight.r, colors.textLight.g, colors.textLight.b);
      // Fill space precisely where page number is located
      doc.rect(pageWidth - margin - 25, pageHeight - 12, 25, 5, 'F');
      doc.text(`Page ${i} of ${totalPagesString}`, pageWidth - margin, pageHeight - 9, { align: 'right' });
    }

    // Save and download report
    const filename = `assets_inventory_report_${format(new Date(), 'yyyyMMdd_HHmmss')}.pdf`;
    doc.save(filename);
    
  } catch (err) {
    console.error('Failed to generate inventory summary report PDF:', err);
    throw err;
  }
}
