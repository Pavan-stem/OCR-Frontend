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
            sortedPts[1] = pts[diff.indexOf(Math.min(...diff))]; // TR
            sortedPts[3] = pts[diff.indexOf(Math.max(...diff))]; // BL

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

                // --- OpenCV Processing ---
                if (cvReady()) {
                    console.log("🧠 OpenCV is ready. Starting analysis...");
                    const src = window.cv.imread(canvas);

                    // 1. Blur Detection
                    const blurVar = detectBlurOpenCV(src);
                    console.log("Blur Variance:", blurVar);
                    if (blurVar < 100) { // Threshold
                        issues.push("Image is blurry (Score: " + Math.round(blurVar) + "). Please hold steady.");
                        isBlurry = true;
                    }

                    // 2. Edge/Table Detection
                    const edgeRes = detectEdgesOpenCV(src);

                    if (edgeRes.detected) {
                        cropResult = {
                            bounds: edgeRes.bounds,
                            originalDimensions: { width, height }
                        };
                        tableDetected = true; // Assuming the largest rect is the table/document
                    } else {
                        issues.push("No document/table detected. Please capture the full page.");
                    }

                    // table/document detection logic
                    if (edgeRes.maxArea < (width * height * 0.2)) {
                        issues.push("Object too small. Please move closer.");
                        tableDetected = false;
                    }

                    src.delete();
                } else {
                    console.warn("⚠️ OpenCV not loaded. Falling back to basic JS checks.");
                    // Fallback to basic checks (simplified for brevity as we prioritize OpenCV)
                    if (width < 500 || height < 500) issues.push("Image resolution too low.");
                }

                // Return Result
                resolve({
                    isValid: issues.length === 0, // strict validation: 0 issues allowed
                    issues: issues,
                    validations: {
                        blur: { isBlurry },
                        lighting: { quality: 'good' }, // Placeholder
                        edges: { detected: !!cropResult },
                        table: { detected: tableDetected },
                        text: { textPresent: true }
                    },
                    crop: cropResult,
                    originalCanvas: canvas,
                    summary: {
                        totalIssues: issues.length,
                        documentDetected: !!cropResult,
                        tableDetected: tableDetected
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
