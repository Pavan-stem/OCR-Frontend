/**
 * Advanced Document Scanner Utility (OpenCV.js Enhanced)
 * Provides robust document detection, perspective correction, and image validation.
 */

// Helper to check if OpenCV is ready
const cvReady = () => {
    return typeof window.cv !== 'undefined' && window.cv.Mat;
};

/**
 * Detect blur using OpenCV Laplacian
 */
const detectBlurOpenCV = (src) => {
    const gray = new window.cv.Mat();
    const laplacian = new window.cv.Mat();

    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
    window.cv.Laplacian(gray, laplacian, window.cv.CV_64F);

    const mean = new window.cv.Mat();
    const stddev = new window.cv.Mat();
    window.cv.meanStdDev(laplacian, mean, stddev);

    const variance = Math.pow(stddev.data64F[0], 2);

    gray.delete();
    laplacian.delete();
    mean.delete();
    stddev.delete();

    return variance;
};

/**
 * Detect Document Edges and Table (Largest Rectangle)
 */
const detectEdgesOpenCV = (src) => {
    const gray = new window.cv.Mat();
    const blurred = new window.cv.Mat();
    const edges = new window.cv.Mat();
    const contours = new window.cv.MatVector();
    const hierarchy = new window.cv.Mat();

    // Preprocessing
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
    window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0);
    window.cv.Canny(blurred, edges, 75, 200);

    // Find Contours
    window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_EXTERNAL, window.cv.CHAIN_APPROX_SIMPLE);

    let maxArea = 0;
    let maxContour = null;
    let documentBounds = null;

    // Find largest quadrilateral
    for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);

        // Filter small contours
        if (area < 5000) continue;

        const peri = window.cv.arcLength(contour, true);
        const approx = new window.cv.Mat();
        window.cv.approxPolyDP(contour, approx, 0.02 * peri, true);

        if (area > maxArea && approx.rows === 4) {
            maxArea = area;
            maxContour = approx; // Keep reference (need to clone if persisting)

            const data = approx.data32S;
            // Sort points according to sum and difference
            // TL: min(sum), BR: max(sum), TR: min(diff), BL: max(diff)
            const pts = [
                { x: data[0], y: data[1] },
                { x: data[2], y: data[3] },
                { x: data[4], y: data[5] },
                { x: data[6], y: data[7] }
            ];

            const sortedPts = new Array(4);
            const sum = pts.map(p => p.x + p.y);
            const diff = pts.map(p => p.x - p.y);

            sortedPts[0] = pts[sum.indexOf(Math.min(...sum))]; // TL
            sortedPts[2] = pts[sum.indexOf(Math.max(...sum))]; // BR
            sortedPts[1] = pts[diff.indexOf(Math.max(...diff))]; // TR (Max diff: High X - Low Y)
            sortedPts[3] = pts[diff.indexOf(Math.min(...diff))]; // BL (Min diff: Low X - High Y)

            const rect = window.cv.boundingRect(approx);
            documentBounds = {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                contourPoints: sortedPts // [TL, TR, BR, BL]
            };
        }
        approx.delete();
    }

    // Cleanup
    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    return {
        detected: !!documentBounds,
        bounds: documentBounds || {
            x: 0,
            y: 0,
            width: src.cols,
            height: src.rows,
            contourPoints: [
                { x: 0, y: 0 },
                { x: src.cols, y: 0 },
                { x: src.cols, y: src.rows },
                { x: 0, y: src.rows }
            ]
        },
        maxArea
    };
};

/**
 * Detect Artificial Borders (Black Padding)
 */
const detectArtificialBorders = (src) => {
    const data = src.data;
    let darkCount = 0;
    const step = 10;
    let sampledTotal = 0;

    for (let i = 0; i < data.length; i += step * 4) {
        sampledTotal++;
        // Use threshold for "near black" to handle compression
        if (data[i] < 20 && data[i + 1] < 20 && data[i + 2] < 20) {
            darkCount++;
        }
    }

    const darkRatio = darkCount / sampledTotal;
    return darkRatio > 0.20; // 20% dark pixels is common in screenshots
};

/**
 * Detect Mobile UI Patterns
 */
const detectUIPatterns = (src) => {
    const rows = src.rows;
    const cols = src.cols;

    // Mobile screenshots often have very specific aspect ratios (e.g., 9:19.5, 9:20)
    const aspectRatio = rows / cols;
    if (aspectRatio > 2.0 || aspectRatio < 0.5) {
        // Very tall or very wide images are often screenshots
        return true;
    }

    const regions = [
        src.roi(new window.cv.Rect(0, 0, cols, Math.floor(rows * 0.1))),
        src.roi(new window.cv.Rect(0, rows - Math.floor(rows * 0.1), cols, Math.floor(rows * 0.1)))
    ];

    let isUI = false;
    regions.forEach(region => {
        const gray = new window.cv.Mat();
        window.cv.cvtColor(region, gray, window.cv.COLOR_RGBA2GRAY);
        const edges = new window.cv.Mat();
        window.cv.Sobel(gray, edges, window.cv.CV_8U, 0, 1, 3);
        const mean = window.cv.mean(edges)[0];
        gray.delete();
        edges.delete();
        if (mean > 30) isUI = true;
    });

    regions[0].delete();
    regions[1].delete();
    return isUI;
};

/**
 * Detect Recursive Nesting
 */
const detectRecursiveNesting = (src) => {
    const gray = new window.cv.Mat();
    const blurred = new window.cv.Mat();
    const edges = new window.cv.Mat();
    const contours = new window.cv.MatVector();
    const hierarchy = new window.cv.Mat();

    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);
    window.cv.GaussianBlur(gray, blurred, new window.cv.Size(5, 5), 0);
    window.cv.Canny(blurred, edges, 50, 150);
    window.cv.findContours(edges, contours, hierarchy, window.cv.RETR_TREE, window.cv.CHAIN_APPROX_SIMPLE);

    let rectAreas = [];
    const imgArea = src.rows * src.cols;

    for (let i = 0; i < contours.size(); ++i) {
        const contour = contours.get(i);
        const area = window.cv.contourArea(contour);
        if (area > imgArea * 0.02) { // Even smaller nested rects
            const peri = window.cv.arcLength(contour, true);
            const approx = new window.cv.Mat();
            window.cv.approxPolyDP(contour, approx, 0.02 * peri, true);
            if (approx.rows === 4) {
                rectAreas.push(area);
            }
            approx.delete();
        }
    }

    gray.delete();
    blurred.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    // If we have several large-ish rectangles, it's likely a UI frame
    return rectAreas.length >= 4;
};

/**
 * Detect Lighting Conditions (Brightness & Contrast)
 */
const detectLightingOpenCV = (src) => {
    const gray = new window.cv.Mat();
    window.cv.cvtColor(src, gray, window.cv.COLOR_RGBA2GRAY, 0);

    const meanStdDev = new window.cv.Mat();
    const stdDev = new window.cv.Mat();
    window.cv.meanStdDev(gray, meanStdDev, stdDev);

    const brightness = meanStdDev.data64F[0];
    const contrast = stdDev.data64F[0];

    gray.delete();
    meanStdDev.delete();
    stdDev.delete();

    let status = 'good';
    const issues = [];

    if (brightness < 60) {
        status = 'poor';
        issues.push("Lighting is too dark. Please add more light.");
    } else if (brightness > 200) {
        status = 'poor';
        issues.push("Lighting is too bright/glaring.");
    }

    if (contrast < 30) {
        status = 'poor';
        issues.push("Low contrast. Ensure document stands out from background.");
    }

    return { status, brightness, contrast, issues };
};

/**
 * Check for Partial Capture (Edges touching boundaries)
 */
const detectPartialScan = (contourPoints, width, height) => {
    const margin = 5; // Pixels
    const touching = contourPoints.some(p =>
        p.x < margin || p.x > width - margin ||
        p.y < margin || p.y > height - margin
    );
    return touching;
};

/**
 * Image Enhancement (Auto Contrast + Denoise)
 */
export const enhanceImage = (canvas) => {
    if (!cvReady()) return canvas;

    const src = window.cv.imread(canvas);
    const dst = new window.cv.Mat();

    // Convert to gray
    window.cv.cvtColor(src, src, window.cv.COLOR_RGBA2GRAY, 0);

    // Denoise
    window.cv.GaussianBlur(src, src, new window.cv.Size(3, 3), 0);

    // Adaptive Threshold (Scanned Look)
    window.cv.adaptiveThreshold(src, dst, 255, window.cv.ADAPTIVE_THRESH_GAUSSIAN_C, window.cv.THRESH_BINARY, 11, 2);

    // Output
    window.cv.imshow(outputCanvas, dst);

    src.delete();
    dst.delete();
    return canvas;
};


/**
 * Main Scan Function (Hybrid: JS fallback if OpenCV not loaded)
 */
export const scanDocument = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            try {
                // Resize for performance (OpenCV is slow on huge images)
                const maxDim = 1500;
                let width = img.width;
                let height = img.height;
                let scale = 1;

                if (width > maxDim || height > maxDim) {
                    scale = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const issues = [];
                let cropResult = null;
                let isBlurry = false;
                let tableDetected = false;
                let lightingRes = { status: 'unknown' };
                let isPartial = false;
                let invalidObject = false;
                let isScreenshot = false;

                // --- OpenCV Processing ---
                if (cvReady()) {
                    console.log("🧠 OpenCV is ready. Starting analysis...");
                    const src = window.cv.imread(canvas);

                    // 1. Screenshot & UI Detection (High Sensitivity)
                    const uiDetected = detectUIPatterns(src);
                    const nestedDetected = detectRecursiveNesting(src);
                    const artificialBorders = detectArtificialBorders(src);

                    if (uiDetected || nestedDetected || artificialBorders) {
                        isScreenshot = true;
                        issues.push("Capture error: This looks like a screenshot. Please capture a live photo of the paper document.");
                    }

                    // 2. Blur Detection
                    const blurVar = detectBlurOpenCV(src);
                    console.log("Blur Variance:", blurVar);
                    if (blurVar < 70) {
                        issues.push("Image is blurry. Please hold steady.");
                        isBlurry = true;
                    }

                    // 3. Lighting Detection
                    lightingRes = detectLightingOpenCV(src);
                    if (lightingRes.status === 'poor') {
                        issues.push(...lightingRes.issues);
                    }

                    // 4. Edge/Table Detection
                    const edgeRes = detectEdgesOpenCV(src);

                    if (edgeRes.detected) {
                        cropResult = {
                            bounds: edgeRes.bounds,
                            originalDimensions: { width, height }
                        };
                        tableDetected = true; // Assuming the largest rect is the table/document

                        // 5. Partial Capture Detection
                        isPartial = detectPartialScan(edgeRes.bounds.contourPoints, width, height);
                        if (isPartial) {
                            issues.push("Document edges are cut off. Please backup.");
                        }

                        // 6. Wrong Object / Geometry Check
                        // Aspect ratio check (Documents usually 0.5 to 2.0)
                        const ar = edgeRes.bounds.width / edgeRes.bounds.height;
                        if (ar < 0.2 || ar > 5.0) {
                            issues.push("Invalid document shape detected.");
                            invalidObject = true;
                            tableDetected = false;
                        }

                    } else {
                        issues.push("No document detected. Scan a full page.");
                    }

                    // table/document detection logic
                    if (edgeRes.maxArea < (width * height * 0.15)) {
                        issues.push("Document too small. Please move closer.");
                        tableDetected = false;
                    }

                    src.delete();
                } else {
                    console.warn("⚠️ OpenCV not loaded. Falling back to basic JS checks.");
                    // Fallback to basic checks (simplified for brevity as we prioritize OpenCV)
                    if (width < 500 || height < 500) issues.push("Resolution too low.");
                }

                // Return Result
                resolve({
                    isValid: issues.length === 0, // strict validation: 0 issues allowed
                    issues: issues,
                    validations: {
                        blur: { isBlurry, score: 0 }, // Score todo
                        lighting: lightingRes,
                        edges: { detected: !!cropResult, isPartial },
                        table: { detected: tableDetected },
                        object: { valid: !invalidObject, isScreenshot },
                        text: { textPresent: true }
                    },
                    crop: cropResult,
                    originalCanvas: canvas,
                    summary: {
                        totalIssues: issues.length,
                        documentDetected: !!cropResult,
                        tableDetected: tableDetected,
                        isScreenshot
                    }
                });

            } catch (e) {
                console.error("Scan error:", e);
                reject(e);
            }
        };
        img.onerror = reject;
        img.src = objectUrl;
    });
};

/**
 * Crop canvas helper
 */
export const cropCanvas = (canvas, x, y, width, height) => {
    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = width;
    croppedCanvas.height = height;
    const ctx = croppedCanvas.getContext("2d");
    ctx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
    return croppedCanvas;
};

/**
 * File conversion helper
 */
export const canvasToFile = (canvas, filename) => {
    return new Promise(resolve => {
        canvas.toBlob(blob => {
            resolve(new File([blob], filename, { type: "image/jpeg" }));
        }, "image/jpeg", 0.95);
    });
};

/**
 * Rotation helper
 */
export const rotateCanvas = (canvas, degrees) => {
    if (degrees === 0) return canvas;
    const canvas2 = document.createElement("canvas");
    if (degrees === 90 || degrees === 270 || degrees === -90) {
        canvas2.width = canvas.height;
        canvas2.height = canvas.width;
    } else {
        canvas2.width = canvas.width;
        canvas2.height = canvas.height;
    }
    const ctx = canvas2.getContext("2d");
    ctx.translate(canvas2.width / 2, canvas2.height / 2);
    ctx.rotate(degrees * Math.PI / 180);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return canvas2;
};

/**
 * Perspective Warp using OpenCV
 * @param {HTMLCanvasElement} canvas - Source image canvas
 * @param {Array<{x:number, y:number}>} points - 4 points: [TL, TR, BR, BL]
 */
export const warpPerspective = (canvas, points) => {
    if (!cvReady()) {
        console.error("OpenCV not ready for warp");
        return canvas;
    }

    // 1. Sort points to ensure order: TL, TR, BR, BL
    // (Assuming UI provides them in correct order, but safe to verify if needed.
    // However, existing standard for perspective warp input is usually specific order.
    // Let's assume input is [tl, tr, br, bl] based on UI state).

    const [tl, tr, br, bl] = points;

    // 2. Calculate width/height of new flattened image
    const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
    const maxWidth = Math.max(widthTop, widthBottom);

    const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
    const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
    const maxHeight = Math.max(heightLeft, heightRight);

    // 3. Create OpenCV mats
    const src = window.cv.imread(canvas);
    const dst = new window.cv.Mat();

    // Source points
    const srcTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
        tl.x, tl.y,
        tr.x, tr.y,
        br.x, br.y,
        bl.x, bl.y
    ]);

    // Destination points (Rectangle 0,0 to maxWidth,maxHeight)
    const dstTri = window.cv.matFromArray(4, 1, window.cv.CV_32FC2, [
        0, 0,
        maxWidth, 0,
        maxWidth, maxHeight,
        0, maxHeight
    ]);

    // 4. Warp
    const M = window.cv.getPerspectiveTransform(srcTri, dstTri);
    window.cv.warpPerspective(src, dst, M, new window.cv.Size(maxWidth, maxHeight), window.cv.INTER_LINEAR, window.cv.BORDER_CONSTANT, new window.cv.Scalar());

    // 5. Output
    const outputCanvas = document.createElement('canvas');
    outputCanvas.width = maxWidth;
    outputCanvas.height = maxHeight;
    window.cv.imshow(outputCanvas, dst);

    // Cleanup
    src.delete();
    dst.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();

    return outputCanvas;
};
