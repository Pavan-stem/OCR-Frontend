/**
 * documentProcessor.js
 *
 * Central pipeline for document validation before upload.
 * Uses classifyAndValidate() as the single source of truth for page correctness.
 *
 * Flow:
 *   canvas + expectedPage
 *       → orientation check                        [portrait → reject immediately]
 *       → (optional) quick table structure check   [OpenCV — non-blocking]
 *       → classifyAndValidate()                    [Claude vision API]
 *       → { ok, message, classification, details }
 */

import { classifyAndValidate } from './documentClassifier';
import { validateSHGTableStructure } from './documentScanner';

// ─────────────────────────────────────────────────────────────────────────────
// CANVAS HELPER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loads a File/Blob/dataURL into an HTMLCanvasElement.
 * Returns null on failure (caller should treat as "can't validate, let AI decide").
 */
async function _fileToCanvas(file) {
    try {
        const url = file instanceof File || file instanceof Blob
            ? URL.createObjectURL(file)
            : file; // assume dataURL string

        return await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                if (file instanceof File || file instanceof Blob) URL.revokeObjectURL(url);
                const c = document.createElement('canvas');
                c.width = img.naturalWidth || img.width;
                c.height = img.naturalHeight || img.height;
                c.getContext('2d').drawImage(img, 0, 0);
                resolve(c);
            };
            img.onerror = () => {
                if (file instanceof File || file instanceof Blob) URL.revokeObjectURL(url);
                reject(new Error('Image load failed'));
            };
            img.src = url;
        });
    } catch (err) {
        console.error('[DocumentProcessor] _fileToCanvas error:', err);
        return null;
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

/**
 * processDocumentAndValidate(canvasOrFile, expectedPage)
 *
 * Validates that the provided image belongs to the expected page slot.
 *
 * @param {HTMLCanvasElement | File | string} canvasOrFile
 *   - HTMLCanvasElement: from SmartCamera or inline capture
 *   - File / Blob:        from gallery picker
 *   - string (dataURL):   from any base64 source
 * @param {1 | 2} expectedPage  - The page slot being filled (1 = Member Register, 2 = Financial Ledger)
 *
 * @returns {Promise<{
 *   ok: boolean,
 *   message: string,
 *   classification: 'PAGE1' | 'PAGE2' | 'REJECTED',
 *   details: object
 * }>}
 */
export const processDocumentAndValidate = async (canvasOrFile, expectedPage) => {
    const tag = `[DocumentProcessor] Page${expectedPage}`;
    const expectedCls = expectedPage === 1 ? 'PAGE1' : 'PAGE2';

    try {
        console.log(`${tag} — Starting classification-first validation...`);

        let canvas;
        if (canvasOrFile instanceof HTMLCanvasElement) {
            canvas = canvasOrFile;
        } else {
            canvas = await _fileToCanvas(canvasOrFile);
            if (!canvas) {
                return {
                    ok: false,
                    errorType: 'file_read_error',
                    message: 'Failed to read the image file. Please try again.',
                    classification: 'REJECTED',
                    details: {}
                };
            }
        }

        if (canvas.height > canvas.width) {
            console.warn(`${tag} — REJECTED: Portrait orientation (${canvas.width}x${canvas.height})`);
            return {
                ok: false,
                errorType: 'orientation',
                message: 'Please rotate your phone to Landscape and try again.',
                classification: 'REJECTED',
                details: {}
            };
        }

        const aiResult = await classifyAndValidate(canvas, expectedPage);
        console.log(`${tag} — Final Prediction: ${aiResult?.classification} (via ${aiResult?.method})`);

        if (!aiResult || !aiResult.classification) {
            return {
                ok: false,
                errorType: 'classification_failed',
                classification: 'REJECTED',
                message: expectedPage === 1
                    ? 'Unable to confirm this as Page 1. Please upload only the Page 1 document.'
                    : 'Unable to confirm this as Page 2. Please upload only the Page 2 document.',
                details: { aiResult, tableDetected: aiResult?.tableDetected }
            };
        }

        if (aiResult.classification !== expectedCls) {
            return {
                ok: false,
                errorType: 'wrong_page',
                classification: aiResult.classification || 'REJECTED',
                message: aiResult.message || (
                    expectedPage === 1
                        ? 'Wrong document uploaded. Please upload the Page 1 document.'
                        : 'Wrong document uploaded. Please upload the Page 2 document.'
                ),
                details: { aiResult, tableDetected: aiResult?.tableDetected }
            };
        }

        return {
            ok: true,
            classification: expectedCls,
            message: 'Document uploaded successfully.',
            details: { aiResult, tableDetected: aiResult?.tableDetected }
        };

    } catch (error) {
        console.error(`${tag} — Pipeline fatal error:`, error);
        return {
            ok: false,
            errorType: 'pipeline_error',
            classification: 'REJECTED',
            message: 'Wrong document type. Please upload the correct page.',
            details: { error: error.message }
        };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE STITCHING
// ─────────────────────────────────────────────────────────────────────────────

/**
 * stitchImages(file1, file2)
 *
 * Combines Page 1 and Page 2 images vertically into a single JPEG File.
 * The narrower image is scaled up to match the wider one's width.
 *
 * @param {File} file1 - Page 1 image
 * @param {File} file2 - Page 2 image
 * @returns {Promise<File>} Combined JPEG file
 */
export const stitchImages = async (file1, file2) => {
    const loadImg = (f) => new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${f.name}`));
        img.src = URL.createObjectURL(f);
    });

    try {
        console.log('[DocumentProcessor] Stitching Page 1 + Page 2...');
        const [img1, img2] = await Promise.all([loadImg(file1), loadImg(file2)]);

        const targetWidth = Math.max(img1.width, img2.width);
        const height1 = Math.round(img1.height * (targetWidth / img1.width));
        const height2 = Math.round(img2.height * (targetWidth / img2.width));
        const targetHeight = height1 + height2;

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetWidth, targetHeight);
        ctx.drawImage(img1, 0, 0, targetWidth, height1);
        ctx.drawImage(img2, 0, height1, targetWidth, height2);

        // Revoke object URLs to free memory
        URL.revokeObjectURL(img1.src);
        URL.revokeObjectURL(img2.src);

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        return new File([blob], `Stitched_${file1.name}`, { type: 'image/jpeg' });

    } catch (err) {
        console.error('[DocumentProcessor] Stitch failed:', err);
        throw err;
    }
};