// src/utils/documentProcessor.js

import { classifyDocumentByLines } from './documentClassifier';

function safeDelete(obj) {
  try {
    if (obj && typeof obj.delete === 'function') obj.delete();
  } catch (_) {}
}

function imageToCanvas(imageSource) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;

      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      resolve(canvas);
    };

    img.onerror = reject;

    if (typeof imageSource === 'string') {
      img.src = imageSource;
    } else if (imageSource instanceof File || imageSource instanceof Blob) {
      img.src = URL.createObjectURL(imageSource);
    } else if (imageSource instanceof HTMLCanvasElement) {
      resolve(imageSource);
    } else {
      reject(new Error('Unsupported image source'));
    }
  });
}

function canvasToMat(canvas) {
  return cv.imread(canvas);
}

export async function classifyAndValidate(imageSource, expectedPage) {
  let mat = null;

  try {
    const canvas = await imageToCanvas(imageSource);
    mat = canvasToMat(canvas);

    const result = classifyDocumentByLines(mat);

    if (!result.ok) {
      if (result.type === 'PORTRAIT') {
        return {
          ok: false,
          classification: 'PORTRAIT',
          message: 'Portrait images are not allowed. Please rotate or capture in landscape mode.',
          details: result.details || null
        };
      }

      return {
        ok: false,
        classification: 'UNKNOWN',
        message: result.message || 'Unable to classify the document.',
        details: result.details || null
      };
    }

    const detectedType = result.type;
    const expected = String(expectedPage || '').toLowerCase();

    if (expected === 'page1' || expected === '1') {
      if (detectedType !== 'PAGE1') {
        return {
          ok: false,
          classification: detectedType,
          message: 'Wrong document type. Please upload only Page 1 in the Page 1 slot.',
          details: result.details || null
        };
      }

      return {
        ok: true,
        classification: 'PAGE1',
        message: 'Valid Page 1 document.',
        details: result.details || null
      };
    }

    if (expected === 'page2' || expected === '2') {
      if (detectedType !== 'PAGE2') {
        return {
          ok: false,
          classification: detectedType,
          message: 'Wrong document type. Please upload only Page 2 in the Page 2 slot.',
          details: result.details || null
        };
      }

      return {
        ok: true,
        classification: 'PAGE2',
        message: 'Valid Page 2 document.',
        details: result.details || null
      };
    }

    return {
      ok: false,
      classification: detectedType,
      message: 'Invalid expected page. Use page1 or page2.',
      details: result.details || null
    };
  } catch (err) {
    console.error('classifyAndValidate error:', err);

    return {
      ok: false,
      classification: 'UNKNOWN',
      message: 'Document validation failed.'
    };
  } finally {
    safeDelete(mat);
  }
}

/**
 * processDocumentAndValidate(canvasOrFile, expectedPage)
 * Wrapper for classifyAndValidate to maintain compatibility with SHGUploadSection.jsx
 */
export async function processDocumentAndValidate(canvasOrFile, expectedPage) {
    return await classifyAndValidate(canvasOrFile, expectedPage);
}

/**
 * stitchImages(file1, file2)
 *
 * Combines Page 1 and Page 2 images vertically into a single JPEG File.
 * The narrower image is scaled up to match the wider one's width.
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