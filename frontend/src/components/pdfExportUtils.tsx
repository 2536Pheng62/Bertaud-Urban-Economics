/**
 * PDF Export Utilities for BaanBid
 * 
 * These functions handle the generation and download of PDF reports.
 * Separated from the component file to allow Fast Refresh to work properly.
 */

import { pdf } from '@react-pdf/renderer';
import BaanBidPDFReport, { type PDFReportData } from './BaanBidPDFReport';

// --- PDF Generation Function ---
export const generateBaanBidPDF = async (data: PDFReportData): Promise<Blob> => {
    try {
        const document = <BaanBidPDFReport data={data} />;
        const blob = await pdf(document).toBlob();
        return blob;
    } catch (error) {
        console.error('PDF Generation Error:', error);
        throw error;
    }
};

// --- Download Trigger Function ---
export const downloadBaanBidPDF = async (data: PDFReportData, filename?: string): Promise<void> => {
    try {
        console.log('Starting PDF generation...');
        const blob = await generateBaanBidPDF(data);
        console.log('PDF generated, blob size:', blob.size);

        if (blob.size === 0) {
            throw new Error('PDF generation failed - blob is empty');
        }

        const pdfFilename = filename || `Project_Analysis_Report_${new Date().toISOString().split('T')[0]}.pdf`;

        // Create blob URL
        const blobUrl = URL.createObjectURL(blob);

        // Open PDF in new window for viewing/saving
        const pdfWindow = window.open(blobUrl, '_blank');

        if (pdfWindow) {
            // Set the title of the new window
            pdfWindow.document.title = pdfFilename;
            console.log('PDF opened in new window');
        } else {
            // If popup blocked, try direct download
            console.log('Popup blocked, trying direct download...');
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = pdfFilename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }

        // Cleanup blob URL after delay
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

    } catch (error) {
        console.error('PDF Download Error:', error);
        alert('ไม่สามารถสร้าง PDF ได้: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
};

// Re-export types for convenience
export type { PDFReportData };
