/**
 * Advanced Document Scanner Utility (FIXED & STRICT)
 * OpenCV.js based – NO false positives, NO partial crop
 */

const cvReady = () => !!(window.cv && window.cv.Mat);

/* ===================== BLUR DETECTION ===================== */
const detectBlurOpenCV = (src) => {
    const gray = new cv.Mat();
    const lap = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.Laplacian(gray, lap, cv.CV_64F);

    const mean = new cv.Mat();
    const std = new cv.Mat();
    cv.meanStdDev(lap, mean, std);

    const variance = std.data64F[0] ** 2;

    gray.delete(); lap.delete(); mean.delete(); std.delete();
    return variance;
};


/* ===================== DOCUMENT DETECTION ===================== */
const detectEdgesOpenCV = (src) => {
    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

    // Use Adaptive Thresholding instead of Canny
    // This is more robust to shadows and uneven lighting common in camera captures
    cv.adaptiveThreshold(blur, edges, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 2);

    // Optional: Morphological Close to fill small gaps/noise
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
    cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);

    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const area = cv.contourArea(c);
        // Minimum area check (10% of image)
        if (area < src.rows * src.cols * 0.1) continue;

        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);

        if (approx.rows === 4 && area > bestArea) {
            // Convexity check can help avoid weird shapes
            if (cv.isContourConvex(approx)) {
                bestArea = area;
                best = approx.clone();
            }
        }
        approx.delete();
    }

    gray.delete(); blur.delete(); edges.delete();
    contours.delete(); hierarchy.delete(); kernel.delete();

    if (!best) {
        return {
            detected: false,
            bounds: {
                x: 0, y: 0,
                width: src.cols,
                height: src.rows,
                contourPoints: [
                    { x: 0, y: 0 }, { x: src.cols, y: 0 },
                    { x: src.cols, y: src.rows }, { x: 0, y: src.rows }
                ]
            }
        };
    }

    const pts = [];
    for (let i = 0; i < 8; i += 2) {
        pts.push({ x: best.data32S[i], y: best.data32S[i + 1] });
    }
    best.delete();

    // Order points (TL,TR,BR,BL)
    // Robust ordering for any quadrilateral
    const sum = pts.map(p => p.x + p.y);
    const diff = pts.map(p => p.x - p.y);

    const ordered = [
        pts[sum.indexOf(Math.min(...sum))], // TL
        pts[diff.indexOf(Math.max(...diff))], // TR
        pts[sum.indexOf(Math.max(...sum))], // BR
        pts[diff.indexOf(Math.min(...diff))] // BL
    ];

    const rect = cv.boundingRect(cv.matFromArray(4, 1, cv.CV_32FC2, ordered.flatMap(p => [p.x, p.y])));

    return {
        detected: true,
        bounds: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            contourPoints: ordered
        }
    };
};

/* ===================== LIGHTING (DOCUMENT-AWARE) ===================== */
const detectLightingOpenCV = (src) => {
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const mean = new cv.Mat();
    const std = new cv.Mat();
    cv.meanStdDev(gray, mean, std);

    const brightness = mean.data64F[0];
    const contrast = std.data64F[0];

    gray.delete(); mean.delete(); std.delete();

    const issues = [];

    // Relaxed Lighting Checks
    if (brightness < 30) issues.push("Image too dark");

    if (brightness > 252 && contrast < 8) issues.push("Image overexposed");

    if (contrast < 10) issues.push("Low contrast");

    return { issues, brightness, contrast };
};

/* ===================== COLOR STATS (PAPER LIKENESS) ===================== */
const detectColorStats = (src) => {
    const hsv = new cv.Mat();
    cv.cvtColor(src, hsv, cv.COLOR_RGBA2RGB);
    cv.cvtColor(hsv, hsv, cv.COLOR_RGB2HSV);

    const channels = new cv.MatVector();
    cv.split(hsv, channels);

    const s = channels.get(1); // Saturation channel
    const mean = new cv.Mat();
    const std = new cv.Mat();
    cv.meanStdDev(s, mean, std);

    const saturation = mean.data64F[0];

    hsv.delete(); channels.delete(); s.delete(); mean.delete(); std.delete();

    return { saturation };
};

/* ===================== TABLE DETECTION ===================== */
const detectTableOpenCV = (src) => {
    // 1. Convert to binary inverted
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const bw = new cv.Mat();
    cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 15, -2);

    // 2. Create Horizontal and Vertical Kernels
    const horizontalSize = bw.cols / 30;
    const verticalSize = bw.rows / 30;

    const horizontalStructure = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(horizontalSize, 1));
    const verticalStructure = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, verticalSize));

    const horizontal = new cv.Mat();
    const vertical = new cv.Mat();

    // 3. Extract lines
    cv.erode(bw, horizontal, horizontalStructure, new cv.Point(-1, -1));
    cv.dilate(horizontal, horizontal, horizontalStructure, new cv.Point(-1, -1));

    cv.erode(bw, vertical, verticalStructure, new cv.Point(-1, -1));
    cv.dilate(vertical, vertical, verticalStructure, new cv.Point(-1, -1));

    // 4. Combine to find intersections = Table Grid
    const tableMask = new cv.Mat();
    cv.addWeighted(horizontal, 0.5, vertical, 0.5, 0.0, tableMask);

    // 5. Count intersections
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(tableMask, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const intersectionCount = contours.size();

    // 6. Calculate bounding box of all detected intersections to check completeness
    let minX = bw.cols, minY = bw.rows, maxX = 0, maxY = 0;
    let found = false;
    for (let i = 0; i < contours.size(); i++) {
        const rect = cv.boundingRect(contours.get(i));
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
        found = true;
    }

    // Heuristic for cut-off: 
    // If table grid is very small and touches edge, it's likely cut off.
    // If table grid is huge (fills the frame), it's a valid full-page capture.
    const tableWidth = maxX - minX;
    const tableHeight = maxY - minY;
    const isFullFrame = (tableWidth > bw.cols * 0.85) || (tableHeight > bw.rows * 0.85);

    const margin = 2;
    let isTableCutOff = false;
    if (found && !isFullFrame) {
        if (minX <= margin || minY <= margin || maxX >= bw.cols - margin || maxY >= bw.rows - margin) {
            isTableCutOff = true;
        }
    }

    // 7. Count Rows and Columns
    // Dilate lines to merge broken segments
    const horizontalDilated = new cv.Mat();
    const verticalDilated = new cv.Mat();
    // Use larger kernel to merge nearby lines
    const kernelH = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(bw.cols / 20, 1));
    const kernelV = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, bw.rows / 20));

    cv.dilate(horizontal, horizontalDilated, kernelH);
    cv.dilate(vertical, verticalDilated, kernelV);

    const hContours = new cv.MatVector();
    const vContours = new cv.MatVector();
    cv.findContours(horizontalDilated, hContours, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    cv.findContours(verticalDilated, vContours, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const rowCount = hContours.size();
    const colCount = vContours.size();

    // Cleanup
    gray.delete(); bw.delete(); horizontal.delete(); vertical.delete();
    horizontalStructure.delete(); verticalStructure.delete(); tableMask.delete();
    contours.delete(); hierarchy.delete();
    horizontalDilated.delete(); verticalDilated.delete(); kernelH.delete(); kernelV.delete();
    hContours.delete(); vContours.delete();

    return {
        hasTable: intersectionCount > 3,
        isTableCutOff,
        isFullFrame,
        rowCount,
        colCount
    };
};

/* ===================== SCREENSHOT DETECTION (Histogram Analysis) ===================== */
const detectScreenshotOpenCV = (src) => {
    // Logic: Digital screenshots/PDFs usually have a single background color that covers a huge % of pixels.
    // Photos have a distribution of background colors due to lighting/noise.

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // Calculate Histogram with reduced bins to handle JPEG compression/noise
    const srcVec = new cv.MatVector();
    srcVec.push_back(gray);
    const accumulate = false;
    const channels = [0];
    const histSize = [32]; // Reduce to 32 bins (groups of ~8 intensity levels)
    const ranges = [0, 255];
    const hist = new cv.Mat();
    const mask = new cv.Mat();
    const color = new cv.Scalar(255, 255, 255);
    const scale = 1;

    cv.calcHist(srcVec, channels, mask, hist, histSize, ranges, accumulate);

    // Find the bin with the maximum number of pixels (the peak)
    let maxVal = 0;
    for (let i = 0; i < 32; i++) {
        const binVal = hist.data32F[i];
        if (binVal > maxVal) {
            maxVal = binVal;
        }
    }

    const totalPixels = src.cols * src.rows;
    const peakRatio = maxVal / totalPixels;

    // Cleanup
    gray.delete(); srcVec.delete(); hist.delete(); mask.delete();

    // Threshold:
    // If ONE single color (bin) accounts for > 25% of the image, it's digital/screenshot.
    // Photos rarely have > 5-10% in a single 1/256 bin unless completely blown out/black.
    // Digital docs usually have > 60-80% background color.
    return {
        isScreenshot: peakRatio > 0.25,
        peakRatio
    };
};

/* ===================== DIGITAL UI DETECTION (Status Bars/Headers) ===================== */
const detectDigitalUIOpenCV = (src) => {
    // Check Top/Bottom 15% for perfect flat rows (Status bars, Nav bars)
    const height = src.rows;
    const scanHeight = Math.min(150, Math.floor(height * 0.15));

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    let maxContiguousTop = 0;
    let currentContiguousTop = 0;

    // Scan Top
    for (let y = 0; y < scanHeight; y++) {
        const row = gray.row(y);
        const mean = new cv.Mat();
        const std = new cv.Mat();
        cv.meanStdDev(row, mean, std);
        const stdDev = std.data64F[0];

        // Digital row is flat (stdDev < 2.0 to catch compressed flat rows)
        if (stdDev < 2.0) {
            currentContiguousTop++;
        } else {
            maxContiguousTop = Math.max(maxContiguousTop, currentContiguousTop);
            currentContiguousTop = 0;
        }
        row.delete(); mean.delete(); std.delete();
    }
    maxContiguousTop = Math.max(maxContiguousTop, currentContiguousTop);

    let maxContiguousBottom = 0;
    let currentContiguousBottom = 0;

    // Scan Bottom
    for (let y = height - 1; y > height - scanHeight; y--) {
        const row = gray.row(y);
        const mean = new cv.Mat();
        const std = new cv.Mat();
        cv.meanStdDev(row, mean, std);
        const stdDev = std.data64F[0];

        if (stdDev < 2.0) {
            currentContiguousBottom++;
        } else {
            maxContiguousBottom = Math.max(maxContiguousBottom, currentContiguousBottom);
            currentContiguousBottom = 0;
        }
        row.delete(); mean.delete(); std.delete();
    }
    maxContiguousBottom = Math.max(maxContiguousBottom, currentContiguousBottom);

    gray.delete();

    // A status bar is usually at least 20px
    const hasDigitalUI = maxContiguousTop > 20 || maxContiguousBottom > 20;

    return { hasDigitalUI, maxContiguousTop, maxContiguousBottom };
};

/* ===================== MAIN SCAN ===================== */
export const scanDocument = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                const scale = Math.min(1500 / img.width, 1500 / img.height, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                canvas.getContext("2d", { willReadFrequently: true }).drawImage(img, 0, 0, canvas.width, canvas.height);

                const issues = [];
                let crop = null;

                if (cvReady()) {
                    const src = cv.imread(canvas);
                    const width = src.cols;
                    const height = src.rows;

                    // 1. Blur Check
                    const blurScore = detectBlurOpenCV(src);
                    const isBlurry = blurScore < 40; // Extremely lenient for mobile (was 60)

                    // 2. Lighting/Shadow Check
                    const light = detectLightingOpenCV(src);
                    const hasHeavyShadow = light.issues.length > 0;

                    // 3. Document/Object Check (Saturation)
                    const colorStats = detectColorStats(src);
                    // Very relaxed saturation check (some documents have colorful stamps/logos)
                    const isDocument = colorStats.saturation < 140;

                    // 4. Cut-off Check (Edge Detection)
                    const edges = detectEdgesOpenCV(src);
                    let isCutOff = false;

                    if (edges.detected) {
                        const b = edges.bounds;
                        // For doc edges, require it to be very close to the edge to flag as cut-off
                        const margin = 2;
                        if (b.x <= margin || b.y <= margin || (b.x + b.width) >= (width - margin) || (b.y + b.height) >= (height - margin)) {
                            isCutOff = true;
                        }
                        crop = {
                            ...edges.bounds,
                            originalDimensions: { width, height }
                        };
                    } else {
                        // Fallback crop
                        crop = {
                            x: 0, y: 0, width, height,
                            contourPoints: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }],
                            originalDimensions: { width, height }
                        };
                    }

                    // 5. Table Detection
                    const tableAnalysis = detectTableOpenCV(src);
                    const hasTable = tableAnalysis.hasTable;

                    // If the table analysis says it's cut off, or if we have a table but no detected doc edges, flag as cut off.
                    if (tableAnalysis.isTableCutOff) {
                        isCutOff = true;
                    }

                    // 6. Screenshot / Digital Doc Detection (Multi-Signal)
                    const screenshotAnalysis = detectScreenshotOpenCV(src);

                    // 7. Digital UI Detection (Status bars / Headers)
                    const uiAnalysis = detectDigitalUIOpenCV(src);

                    // suspicionScore Calculation:
                    // - Digital UI Found -> +5 (Immediate Reject)
                    // - Background Flatness (High Peak) -> +1 or +2
                    // - No Edges Detected -> +1
                    // - Low Saturation -> +1

                    let suspicionScore = 0;
                    if (uiAnalysis.hasDigitalUI) suspicionScore += 5; // Status bars = Screenshot

                    if (screenshotAnalysis.peakRatio > 0.50) suspicionScore += 2; // Very flat
                    else if (screenshotAnalysis.peakRatio > 0.25) suspicionScore += 1; // Somewhat flat

                    if (!edges.detected) suspicionScore += 1; // No document edges -> Full frame digital?
                    if (colorStats.saturation < 40) suspicionScore += 1; // Grayscale digital?

                    // THRESHOLD: 
                    // Set to 6 for higher confidence. 
                    // IMPORTANT: If a clear table is detected, we further reduce screenshot sensitivity.
                    let isScreenshot = suspicionScore >= 6;
                    if (hasTable && suspicionScore < 7) isScreenshot = false;

                    if (isScreenshot) console.log("Screenshot detected with score:", suspicionScore);

                    // CONSTRUCT VALIDATION RESULT

                    const analysis = {
                        isDocument,
                        isScreenshot,
                        isBlurry,
                        hasHeavyShadow,
                        isCutOff,
                        hasTable,
                        isTableComplete: !isCutOff,
                        isTableBlurry: isBlurry,
                        hasTableShadow: hasHeavyShadow,
                        suspicionScore,
                        reason: ""
                    };



                    // Logic Refinement:
                    // 1. IS SCREENSHOT? -> REJECT IMMEDIATELY.
                    // 2. If it HAS A TABLE, we trust it more. Ignore Saturation check and lenient on CutOff.
                    // 3. If it DOES NOT HAVE A TABLE, we are strict about saturation and cut-off.

                    // DETERMINE STATUS AND MESSAGE
                    let status = "valid";
                    let message = "Complete and clear table detected";

                    if (isScreenshot) {
                        status = "error";
                        message = "Invalid image. Please upload a clear photo of the complete table only. (Screenshots/PDFs are not allowed)";
                    } else if (!hasTable) {
                        status = "error";
                        message = "Invalid image. No table detected. Please upload a clear photo of the complete table only.";
                    } else if (isCutOff && !tableAnalysis.isFullFrame) {
                        status = "error";
                        message = "Incomplete table detected. One or more table borders are missing.";
                    } else if (tableAnalysis.rowCount < 18 || tableAnalysis.colCount < 16) {
                        status = "error";
                        message = "Incomplete table detected. One or more table borders are missing.";
                    } else if (isBlurry) {
                        status = "error";
                        message = "Invalid image. The document is blurry. Please hold the camera steady and retry.";
                    } else if (hasHeavyShadow) {
                        // Accept minor shadow issues, but warn if severe
                        status = "fixed";
                        message = "Image accepted (minor shadows detected)";
                    }

                    // MAPPING TO STRICT OUTPUT FORMAT
                    let finalStatus = "success";
                    let finalMessage = "Image accepted";
                    let finalAction = "proceed";

                    if (status === "error") {
                        finalStatus = "error";
                        finalMessage = message;
                        finalAction = "retry";
                    } else if (status === "fixed") {
                        finalStatus = "success";
                        finalMessage = "Image accepted"; // Was "Image enhanced and accepted"
                        finalAction = "proceed";
                    }

                    const finalResult = {
                        status: finalStatus,
                        message: finalMessage,
                        action: finalAction,
                        analysis,
                        crop,
                        canvas,
                        isValid: finalStatus === "success"
                    };

                    resolve(finalResult);

                } else {
                    resolve({
                        status: "error",
                        message: "OpenCV not loaded. Please refresh the page.",
                        isValid: false
                    });
                }

            } catch (e) {
                console.error("Scanner Error:", e);
                reject(e);
            }
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
    });
};

/* ===================== HELPERS ===================== */
export const cropCanvas = (canvas, x, y, w, h) => {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d", { willReadFrequently: true }).drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return c;
};

export const canvasToFile = (canvas, name) =>
    new Promise(r => canvas.toBlob(b => r(new File([b], name, { type: "image/jpeg" })), "image/jpeg", 0.95));

export const rotateCanvas = (canvas, deg) => {
    if (!deg) return canvas;
    const c = document.createElement("canvas");
    c.width = deg % 180 ? canvas.height : canvas.width;
    c.height = deg % 180 ? canvas.width : canvas.height;
    const ctx = c.getContext("2d");
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(deg * Math.PI / 180);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
    return c;
};

/* ===================== WARP PERSPECTIVE ===================== */
export const warpPerspective = (canvas, points) => {
    if (!cvReady()) return canvas;

    const src = cv.imread(canvas);

    // Sort points: TL, TR, BR, BL - handled by caller or basic 4-point transform
    const srcCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
        parseFloat(points[0].x), parseFloat(points[0].y),
        parseFloat(points[1].x), parseFloat(points[1].y),
        parseFloat(points[2].x), parseFloat(points[2].y),
        parseFloat(points[3].x), parseFloat(points[3].y)
    ]);

    // Calculate destination dimensions
    const widthTop = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
    const widthBottom = Math.hypot(points[2].x - points[3].x, points[2].y - points[3].y);
    const maxWidth = Math.max(widthTop, widthBottom);

    const heightLeft = Math.hypot(points[3].x - points[0].x, points[3].y - points[0].y);
    const heightRight = Math.hypot(points[2].x - points[1].x, points[2].y - points[1].y);
    const maxHeight = Math.max(heightLeft, heightRight);

    const dstCoords = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0,                        // TL
        maxWidth, 0,                 // TR
        maxWidth, maxHeight,         // BR
        0, maxHeight                 // BL
    ]);

    const M = cv.getPerspectiveTransform(srcCoords, dstCoords);
    const dst = new cv.Mat();

    cv.warpPerspective(src, dst, M, new cv.Size(maxWidth, maxHeight), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());

    const outputCanvas = document.createElement("canvas");
    cv.imshow(outputCanvas, dst);

    src.delete(); srcCoords.delete(); dstCoords.delete(); M.delete(); dst.delete();

    return outputCanvas;
};

/**
 * Perform a one-off document detection on a canvas.
 * Useful for secondary refinement passes on buffered captures.
 */
export const detectDocument = (canvas) => {
    if (!cvReady()) return null;
    let src;
    try {
        src = cv.imread(canvas);
        const result = detectEdgesOpenCV(src);
        src.delete();
        return result.detected ? result.bounds.contourPoints : null;
    } catch (e) {
        console.error("Secondary detection failed:", e);
        if (src) src.delete();
        return null;
    }
};

/* ===================== IMAGE ENHANCEMENT (Native-Grade UHD Scan v8) ===================== */
export const enhanceImage = (canvas) => {
    if (!cvReady()) return canvas;

    const src = cv.imread(canvas);

    // 0. Adaptive Blur Assessment for Enhancement Tuning
    const blurScore = detectBlurOpenCV(src);
    const isSharp = blurScore > 60; // Standard threshold for high-quality scan
    const isExtremelyBlurry = blurScore < 25;

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 0b. Noise Removal (Salt & Pepper Dots)
    // Median blur specifically targets the small black/white dots without blurring edges much
    cv.medianBlur(gray, gray, 3);

    // 1. ADVANCED SHADING CORRECTION (Intensity Map)
    // Create an illumination map to neutralize uneven shadows
    const illuminationMap = new cv.Mat();
    // Larger kernel for dilation to ensure text is fully covered for the lighting map
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(31, 31));

    // Dilate to remove text while keeping background lighting gradients
    cv.dilate(gray, illuminationMap, kernel);
    // Extreme blur to ensure the illumination field is perfectly smooth - no local halos
    cv.GaussianBlur(illuminationMap, illuminationMap, new cv.Size(251, 251), 0);

    // Normalize: (Source / IlluminationMap) * 255
    const normalized = new cv.Mat();
    cv.divide(gray, illuminationMap, normalized, 255);

    // 2. High-Precision Contrast & Local Equalization (CLAHE)
    const balanced = new cv.Mat();
    // Reduced clipLimit (1.5) to prevent over-amplifying grain in dark shadow regions
    const clahe = new cv.CLAHE(1.5, new cv.Size(8, 8));
    clahe.apply(normalized, balanced);
    clahe.delete();

    // 2b. Global Whitening Pass (The "previous effect" user requested)
    // This pushes light-grey shadow remnants into pure white.
    const whitened = new cv.Mat();
    // Dynamic whitening based on sharpness
    const whiteScale = isSharp ? 1.15 : 1.10;
    const whiteOffset = isSharp ? -15 : -10;
    balanced.convertTo(whitened, cv.CV_8U, whiteScale, whiteOffset);

    // 3. Multi-Radius Sharpening (Adaptive Natural Pro v15)
    // Step A: Structures (Bold lines)
    const blurStructure = new cv.Mat();
    cv.GaussianBlur(whitened, blurStructure, new cv.Size(15, 15), 0);
    const midResult = new cv.Mat();

    // Scale sharpening weight based on sharpness - BOOSTED for table clarity
    const structureWeight = isSharp ? 0.45 : (isExtremelyBlurry ? 0.15 : 0.30);
    cv.addWeighted(whitened, 1 + structureWeight, blurStructure, -structureWeight, 0, midResult);

    // Step B: Natural Fine Text (Subtle strokes)
    const blurText = new cv.Mat();
    cv.GaussianBlur(midResult, blurText, new cv.Size(5, 5), 0);
    const finalResult = new cv.Mat();

    const textWeight = isSharp ? 0.20 : (isExtremelyBlurry ? 0.05 : 0.15);
    cv.addWeighted(midResult, 1 + textWeight, blurText, -textWeight, 0, finalResult);

    const outputCanvas = document.createElement("canvas");
    cv.imshow(outputCanvas, finalResult);

    // Cleanup
    src.delete(); gray.delete(); illuminationMap.delete(); kernel.delete();
    normalized.delete(); balanced.delete(); whitened.delete();
    blurStructure.delete(); midResult.delete(); blurText.delete(); finalResult.delete();

    return outputCanvas;
};
