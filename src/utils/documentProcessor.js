/**
 * documentProcessor.js
 *
 * Central pipeline for document validation before upload.
 * Uses classifyAndValidate() as the single source of truth for page correctness.
 *
 * Flow:
 *   canvas + expectedPage
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
    const unexpectedCls = expectedPage === 1 ? 'PAGE2' : 'PAGE1';

    try {
        console.log(`${tag} — Starting classification-first validation...`);

        // ── 1. Normalise input to canvas ──────────────────────────────────────
        let canvas;
        if (canvasOrFile instanceof HTMLCanvasElement) {
            canvas = canvasOrFile;
        } else {
            canvas = await _fileToCanvas(canvasOrFile);
            if (!canvas) {
                return {
                    ok: false,
                    message: 'Failed to read the image file. Please try a different image.',
                    classification: 'REJECTED',
                    details: {}
                };
            }
        }

        // ── 2. AI Classification (PRIMARY — mandatory attempt) ────────────────
        // Now handles ML + OCR Fallback internally in documentClassifier.js
        const aiResult = await classifyAndValidate(canvas, expectedPage);
        console.log(`${tag} — Final Prediction: ${aiResult.classification} (via ${aiResult.method})`);

        // ── 3. FINAL DECISION (Strict Policy) ─────────────────────────────────
        //
        //  The system ONLY accepts if the detected page matches the expected slot.
        //  If both ML and OCR fail to identify the document, we REJECT with a helpful message.

        const failureResponse = {
            ok: false,
            errorType: aiResult?.errorType,
            classification: aiResult?.classification || 'REJECTED',
            message: aiResult?.reason
                ? `Wrong document type. Expected ${expectedCls}, but detected ${aiResult?.classification}. Details: ${aiResult?.reason}`
                : 'Wrong document type. Please upload the correct page.',
            details: { aiResult, tableDetected: aiResult?.tableDetected }
        };

        if (!aiResult || !aiResult.classification) {
            console.warn(`${tag} — Classification FAILED or NO RESULT.`);
            return failureResponse;
        }

        if (aiResult.classification !== expectedCls) {
            console.warn(`${tag} — WRONG PAGE: expected ${expectedCls} but got ${aiResult.classification}`);
            return failureResponse;
        }

        // ONLY here → ACCEPT
        console.log(`${tag} — AI ACCEPTED (${aiResult.classification})`);
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