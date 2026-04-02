// src/utils/documentClassifier.js

function safeDelete(obj) {
  try {
    if (obj && typeof obj.delete === 'function') obj.delete();
  } catch (_) {}
}

function getContourRects(binaryMat) {
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const rects = [];

  try {
    cv.findContours(
      binaryMat,
      contours,
      hierarchy,
      cv.RETR_EXTERNAL,
      cv.CHAIN_APPROX_SIMPLE
    );

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const rect = cv.boundingRect(cnt);
      rects.push(rect);
      cnt.delete();
    }
  } finally {
    safeDelete(contours);
    safeDelete(hierarchy);
  }

  return rects;
}

function mergeCloseLines(rects, axis, tolerance, minLength) {
  const centers = [];

  for (const r of rects) {
    const length = axis === 'x' ? r.height : r.width;
    if (length < minLength) continue;

    const center = axis === 'x'
      ? r.x + r.width / 2
      : r.y + r.height / 2;

    centers.push(center);
  }

  centers.sort((a, b) => a - b);

  const merged = [];
  for (const c of centers) {
    if (!merged.length || Math.abs(c - merged[merged.length - 1]) > tolerance) {
      merged.push(c);
    }
  }

  return merged.length;
}

function detectLineMasks(srcMat) {
  const gray = new cv.Mat();
  const binary = new cv.Mat();
  const horizontal = new cv.Mat();
  const vertical = new cv.Mat();

  try {
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(3, 3), 0);

    cv.adaptiveThreshold(
      gray,
      binary,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      15,
      4
    );

    binary.copyTo(horizontal);
    binary.copyTo(vertical);

    const horizontalKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(Math.max(25, Math.floor(srcMat.cols / 30)), 1)
    );

    const verticalKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(1, Math.max(25, Math.floor(srcMat.rows / 30)))
    );

    cv.erode(horizontal, horizontal, horizontalKernel);
    cv.dilate(horizontal, horizontal, horizontalKernel);

    cv.erode(vertical, vertical, verticalKernel);
    cv.dilate(vertical, vertical, verticalKernel);

    horizontalKernel.delete();
    verticalKernel.delete();

    return { gray, binary, horizontal, vertical };
  } catch (err) {
    safeDelete(gray);
    safeDelete(binary);
    safeDelete(horizontal);
    safeDelete(vertical);
    throw err;
  }
}

function extractLineFeatures(mat) {
  const { gray, binary, horizontal, vertical } = detectLineMasks(mat);

  try {
    const width = mat.cols;
    const height = mat.rows;

    const vRects = getContourRects(vertical);
    const hRects = getContourRects(horizontal);

    const verticalRects = vRects.filter(
      r => r.height > height * 0.70 && r.width < width * 0.15
    );

    const horizontalRects = hRects.filter(
      r => r.width > width * 0.10 && r.height < height * 0.15
    );

    const verticalCount = mergeCloseLines(
      verticalRects,
      'x',
      Math.max(8, Math.floor(width * 0.01)),
      Math.floor(height * 0.70)
    );

    const horizontalCount = mergeCloseLines(
      horizontalRects,
      'y',
      Math.max(8, Math.floor(height * 0.01)),
      Math.floor(width * 0.10)
    );

    return {
      width,
      height,
      verticalCount,
      horizontalCount
    };
  } finally {
    safeDelete(gray);
    safeDelete(binary);
    safeDelete(horizontal);
    safeDelete(vertical);
  }
}

/**
 * RESTORED FOR COMPATIBILITY with SmartCamera.jsx
 */

let _selectedPage = 1;
export function setSelectedPage(page) {
  _selectedPage = page;
}

function imageToCanvas(imageSource) {
  return new Promise((resolve, reject) => {
    if (imageSource instanceof HTMLCanvasElement) {
      return resolve(imageSource);
    }

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
    } else {
      reject(new Error('Unsupported image source'));
    }
  });
}

export async function classifyImage(imageInput) {
  let mat = null;
  try {
    const canvas = await imageToCanvas(imageInput);
    mat = cv.imread(canvas);

    if (mat.rows > mat.cols) {
      return {
        cls: 'REJECTED',
        confidence: 0,
        reason: 'Portrait orientation detected.',
        features: {},
        degrees: 0,
        tableDetected: false
      };
    }

    const res = classifyDocumentByLines(mat);

    if (!res.ok) {
      return {
        cls: 'REJECTED',
        confidence: 0,
        reason: res.message,
        features: res.details || {},
        degrees: 0,
        tableDetected: false
      };
    }

    return {
      cls: res.type,
      confidence: 0.9,
      reason: res.message,
      features: res.details || {},
      degrees: 0,
      tableDetected: true
    };
  } catch (err) {
    console.error('classifyImage error:', err);
    return {
      cls: 'REJECTED',
      confidence: 0,
      reason: 'Classification failed',
      features: {},
      degrees: 0,
      tableDetected: false
    };
  } finally {
    safeDelete(mat);
  }
}

export function validatePage(classificationStatus, expectedPage) {
  const expectedCls = 'PAGE' + expectedPage;
  return classificationStatus === expectedCls
    ? { ok: true }
    : { ok: false, errorType: 'slot_mismatch', msg: '' };
}

export function classifyDocumentByLines(mat) {
  try {
    if (!mat || mat.empty()) {
      return {
        ok: false,
        type: 'UNKNOWN',
        message: 'Invalid image'
      };
    }

    // Reject portrait
    if (mat.rows > mat.cols) {
      return {
        ok: false,
        type: 'PORTRAIT',
        message: 'Portrait images are not allowed. Please capture in landscape mode.'
      };
    }

    const f = extractLineFeatures(mat);

    const verticalCount = f.verticalCount;
    const horizontalCount = f.horizontalCount;

    console.log('Detected counts:', {
      verticalCount,
      horizontalCount
    });

    // Exact tuned logic from your document structure
    const isPage1 =
      verticalCount >= 14 &&
      verticalCount <= 20 &&
      horizontalCount >= 18 &&
      horizontalCount <= 26;

    const isPage2 =
      verticalCount >= 4 &&
      verticalCount <= 8 &&
      horizontalCount >= 24 &&
      horizontalCount <= 32;

    if (isPage1) {
      return {
        ok: true,
        type: 'PAGE1',
        message: 'Detected Page 1 document',
        details: f
      };
    }

    if (isPage2) {
      return {
        ok: true,
        type: 'PAGE2',
        message: 'Detected Page 2 document',
        details: f
      };
    }

    // Fallback based mainly on vertical line count
    if (verticalCount >= 10) {
      return {
        ok: true,
        type: 'PAGE1',
        message: 'Detected Page 1 document (fallback)',
        details: f
      };
    }

    return {
      ok: true,
      type: 'PAGE2',
      message: 'Detected Page 2 document (fallback)',
      details: f
    };
  } catch (err) {
    console.error('classifyDocumentByLines error:', err);
    return {
      ok: false,
      type: 'UNKNOWN',
      message: 'Unable to classify the document'
    };
  }
}