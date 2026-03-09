const cvReady = () => !!(window.cv && window.cv.Mat);

/** 
 * Automatically downscale canvas if it exceeds memory-safe dimensions for low-end devices.
 * 1024px is a sweet spot for feature detection while staying < 5MB RAM.
 */
const _getOptimalCanvas = (srcCanvas, maxDim = 1024) => {
    const { width, height } = srcCanvas;
    if (width <= maxDim && height <= maxDim) return srcCanvas;

    const scale = maxDim / Math.max(width, height);
    const dst = document.createElement("canvas");
    dst.width = Math.round(width * scale);
    dst.height = Math.round(height * scale);
    const ctx = dst.getContext("2d");
    ctx.drawImage(srcCanvas, 0, 0, dst.width, dst.height);
    return dst;
};

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
    // ── 1. Binarise ──────────────────────────────────────────────────────────
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const bw = new cv.Mat();
    cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 15, -2);
    gray.delete();

    // ── 2. Extract pure H / V line masks ─────────────────────────────────────
    const hSize = Math.max(25, Math.round(bw.cols / 40));
    const vSize = Math.max(25, Math.round(bw.rows / 40));
    const hStruct = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(hSize, 1));
    const vStruct = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, vSize));

    const horizontal = new cv.Mat();
    const vertical = new cv.Mat();
    const anchor = new cv.Point(-1, -1);

    cv.erode(bw, horizontal, hStruct, anchor); cv.dilate(horizontal, horizontal, hStruct, anchor);
    cv.erode(bw, vertical, vStruct, anchor); cv.dilate(vertical, vertical, vStruct, anchor);

    // Immediate memory release
    bw.delete(); hStruct.delete(); vStruct.delete();

    // ── 3. TRUE junctions = pixels where BOTH H and V lines exist ────────────
    const junctionMask = new cv.Mat();
    cv.bitwise_and(horizontal, vertical, junctionMask);

    const jKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
    cv.dilate(junctionMask, junctionMask, jKernel, anchor);
    jKernel.delete();

    const jContours = new cv.MatVector();
    const jHier = new cv.Mat();
    cv.findContours(junctionMask, jContours, jHier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const junctionCount = jContours.size();

    // Release early
    jContours.delete(); jHier.delete(); junctionMask.delete();

    // ── 4. Bounding box of table (for cut-off detection) ─────────────────────
    const combined = new cv.Mat();
    cv.bitwise_or(horizontal, vertical, combined);
    const bbContours = new cv.MatVector();
    const bbHier = new cv.Mat();
    cv.findContours(combined, bbContours, bbHier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let minX = src.cols, minY = src.rows, maxX = 0, maxY = 0, found = false;
    for (let i = 0; i < bbContours.size(); i++) {
        const c = bbContours.get(i);
        const r = cv.boundingRect(c);
        minX = Math.min(minX, r.x);
        minY = Math.min(minY, r.y);
        maxX = Math.max(maxX, r.x + r.width);
        maxY = Math.max(maxY, r.y + r.height);
        found = true;
    }
    combined.delete(); bbContours.delete(); bbHier.delete();

    const tableWidth = maxX - minX;
    const tableHeight = maxY - minY;
    const isFullFrame = tableWidth > src.cols * 0.85 || tableHeight > src.rows * 0.85;
    const margin = 2;
    let isTableCutOff = false;
    if (found && !isFullFrame) {
        if (minX <= margin || minY <= margin || maxX >= src.cols - margin || maxY >= src.rows - margin)
            isTableCutOff = true;
    }

    // ── 5. Row / col band count ──────────────────────────────────────────────
    const kH = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(Math.round(src.cols / 20), 1));
    const kV = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, Math.round(src.rows / 20)));
    const hDil = new cv.Mat(), vDil = new cv.Mat();
    cv.dilate(horizontal, hDil, kH, anchor);
    cv.dilate(vertical, vDil, kV, anchor);
    kH.delete(); kV.delete(); horizontal.delete(); vertical.delete();

    const hC = new cv.MatVector(); const hCHier = new cv.Mat();
    const vC = new cv.MatVector(); const vCHier = new cv.Mat();
    cv.findContours(hDil, hC, hCHier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    cv.findContours(vDil, vC, vCHier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const rowCount = hC.size();
    const colCount = vC.size();

    // Final release
    hDil.delete(); vDil.delete(); hC.delete(); hCHier.delete(); vC.delete(); vCHier.delete();

    console.log(`[TableDetect] junctions=${junctionCount} rows=${rowCount} cols=${colCount} (${src.cols}×${src.rows})`);

    // ── 6. Decision ──────────────────────────────────────────────────────────
    return {
        hasTable: junctionCount >= 15,
        isTableCutOff,
        isFullFrame,
        rowCount,
        colCount,
        junctionCount
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

    // Threshold lowered: 0.18 → captures phone home screens with dominant background color
    // (phone wallpapers often have one dominant color band)
    return {
        isScreenshot: peakRatio > 0.18,
        peakRatio
    };
};

/* ===================== DIGITAL UI DETECTION (Status Bars/Headers) ===================== */
const detectDigitalUIOpenCV = (src) => {
    const height = src.rows;
    const scanHeight = Math.min(80, Math.floor(height * 0.05));
    if (scanHeight < 2) return { hasDigitalUI: false, zoneMean: 255 };

    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    const data = gray.data;
    const cols = gray.cols;
    const stride = 4;
    let sum = 0, sumSq = 0, cnt = 0;
    for (let y = 0; y < scanHeight; y++) {
        const rowOff = y * cols;
        for (let x = 0; x < cols; x += stride) {
            const v = data[rowOff + x];
            sum += v;
            sumSq += v * v;
            cnt++;
        }
    }
    gray.delete();

    const zoneMean = cnt > 0 ? sum / cnt : 255;
    const zoneVar = cnt > 0 ? (sumSq / cnt) - (zoneMean * zoneMean) : 0;
    const zoneStd = Math.sqrt(Math.max(0, zoneVar));

    const isDarkStatusBar = zoneMean < 80;
    const isFlatNarrow = zoneStd < 8 && scanHeight <= Math.floor(height * 0.03);
    const hasDigitalUI = isDarkStatusBar || isFlatNarrow;

    return { hasDigitalUI, zoneMean, zoneStd };
};

/**
 * Improved Detect significant obstructions (fingers, earbuds, pens) on the document.
 * Using Area, Aspect Ratio, and Solidity filters for high accuracy and low false positives.
 */
const detectObstructions = (cv, src) => {
    // Utility to release matrices
    const release = (...mats) => mats.forEach(m => { if (m) try { m.delete(); } catch (e) { } });

    let gray, thresh, deskewed, laplacian, shadowMask, hLines, vLines, gridThick, masked, contours, hierarchy;

    try {
        const height = src.rows;
        const width = src.cols;
        const imgArea = height * width;

        // --- 1. RESOLUTION ADAPTATION ---
        // Scale kernel sizes based on image dimensions
        const kLarge = Math.max(3, Math.round(Math.min(width, height) / 40));
        const kMedium = Math.max(3, Math.round(Math.min(width, height) / 100));
        const kSmall = 3;

        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // --- 2. SCREENSHOT DETECTION ---
        // Screenshots often have perfect aspect ratios (e.g., 9:16 or 3:4) and specific histograms
        const aspect = width / height;
        const isCommonAspect = [0.5625, 0.46, 0.75, 1.33, 1.77, 2.16].some(a => Math.abs(aspect - a) < 0.001);
        // Note: This is an indicator, not a definitive reject alone.

        // --- 3. BLUR DETECTION (Laplacian Variance) ---
        laplacian = new cv.Mat();
        cv.Laplacian(gray, laplacian, cv.CV_64F);
        let mean = new cv.Mat(1, 4, cv.CV_64F);
        let stddev = new cv.Mat(1, 4, cv.CV_64F);
        cv.meanStdDev(laplacian, mean, stddev);
        const variance = stddev.data64F[0] * stddev.data64F[0];
        if (variance < 20) { // Threshold for "Extremely Blurry"
            // return { hasObstruction: true, reason: "Image is too blurry." };
        }
        release(mean, stddev);

        // --- 4. SHADOW DETECTION ---
        shadowMask = new cv.Mat();
        cv.threshold(gray, shadowMask, 60, 255, cv.THRESH_BINARY_INV);
        const shadowArea = cv.countNonZero(shadowMask) / imgArea;
        // Large dark regions (> 40%) indicator of heavy shadows

        // --- 5. DESKEWING (Dominant Angle Detection) ---
        thresh = new cv.Mat();
        cv.adaptiveThreshold(gray, thresh, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 11, 2);

        let lines = new cv.Mat();
        cv.HoughLinesP(thresh, lines, 1, Math.PI / 180, 100, width / 4, 10);
        let angles = [];
        for (let i = 0; i < lines.rows; ++i) {
            let x1 = lines.data32S[i * 4], y1 = lines.data32S[i * 4 + 1];
            let x2 = lines.data32S[i * 4 + 2], y2 = lines.data32S[i * 4 + 3];
            let angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            // Normalize to [-45, 45]
            if (angle > 45) angle -= 90;
            if (angle < -45) angle += 90;
            if (Math.abs(angle) < 15) angles.push(angle);
        }
        release(lines);

        let medianAngle = 0;
        if (angles.length > 0) {
            angles.sort((a, b) => a - b);
            medianAngle = angles[Math.floor(angles.length / 2)];
        }

        deskewed = new cv.Mat();
        if (Math.abs(medianAngle) > 1.5) {
            let center = new cv.Point(width / 2, height / 2);
            let M = cv.getRotationMatrix2D(center, medianAngle, 1);
            cv.warpAffine(thresh, deskewed, M, new cv.Size(width, height), cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
            M.delete();
        } else {
            thresh.copyTo(deskewed);
        }

        // --- 6. GRID ERASURE (THICK SUBTRACTION) ---
        const hKernelSize = Math.max(kLarge, Math.round(width / 30));
        const vKernelSize = Math.max(kLarge, Math.round(height / 30));
        let hKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(hKernelSize, 1));
        let vKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, vKernelSize));

        hLines = new cv.Mat();
        vLines = new cv.Mat();
        cv.morphologyEx(deskewed, hLines, cv.MORPH_OPEN, hKernel);
        cv.morphologyEx(deskewed, vLines, cv.MORPH_OPEN, vKernel);

        gridThick = new cv.Mat();
        cv.bitwise_or(hLines, vLines, gridThick);

        // "Thickening" the grid lines to ensure 100% erasure
        let kDialateGrid = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5));
        cv.dilate(gridThick, gridThick, kDialateGrid);

        masked = new cv.Mat();
        cv.subtract(deskewed, gridThick, masked);

        hKernel.delete(); vKernel.delete(); kDialateGrid.delete();

        // --- 7. OBJECT RECONNECTION ---
        let kReconnect = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kMedium, kMedium));
        cv.dilate(masked, masked, kReconnect);
        kReconnect.delete();

        let kCleanup = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(kMedium, kMedium));
        cv.morphologyEx(masked, masked, cv.MORPH_OPEN, kCleanup);
        kCleanup.delete();

        // --- 8. CENTER-WEIGHTED DETECTION ---
        contours = new cv.MatVector();
        hierarchy = new cv.Mat();
        cv.findContours(masked, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let hasObstruction = false;
        const areaThreshold = 0.007;     // 0.7% of image area
        const solidityThreshold = 0.72;  // High solidity check

        // ROI: Central 80% to ignore edge noise/fingers-at-edge
        const roiLeft = width * 0.1, roiRight = width * 0.9;
        const roiTop = height * 0.1, roiBottom = height * 0.9;

        for (let i = 0; i < contours.size(); ++i) {
            const cnt = contours.get(i);
            const area = cv.contourArea(cnt);

            if (area > imgArea * areaThreshold) {
                const rect = cv.boundingRect(cnt);
                const centerX = rect.x + rect.width / 2;
                const centerY = rect.y + rect.height / 2;

                // Only check if object is in the "middle"
                if (centerX > roiLeft && centerX < roiRight && centerY > roiTop && centerY < roiBottom) {
                    const hull = new cv.Mat();
                    cv.convexHull(cnt, hull);
                    const hullArea = cv.contourArea(hull);
                    const solidity = hullArea > 0 ? area / hullArea : 0;
                    hull.delete();

                    const aspectRatio = rect.width / rect.height;

                    if (aspectRatio > 0.25 && aspectRatio < 4.0 && solidity > solidityThreshold) {
                        hasObstruction = true;
                        console.log(`[Obstruction] Detected object in middle: area=${(area / imgArea).toFixed(4)}, solidity=${solidity.toFixed(2)}`);
                        break;
                    }
                }
            }
        }

        return { hasObstruction };

    } catch (e) {
        console.error("Obstruction Pipeline Failed:", e);
        return { hasObstruction: false };
    } finally {
        release(gray, thresh, deskewed, laplacian, shadowMask, hLines, vLines, gridThick, masked, contours, hierarchy);
    }
};

/* ===================== MAIN SCAN ===================== */
export const scanDocument = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const originalCanvas = document.createElement("canvas");
            originalCanvas.width = img.width;
            originalCanvas.height = img.height;
            const ctx = originalCanvas.getContext("2d");
            ctx.drawImage(img, 0, 0);

            // Mandatory downscaling for memory safety on old phones
            const canvas = _getOptimalCanvas(originalCanvas, 1024);
            const width = canvas.width;
            const height = canvas.height;

            try {
                if (cvReady()) {
                    let src = cv.imread(canvas);

                    // 1. Blur Check
                    const blurScore = detectBlurOpenCV(src);
                    const isBlurry = blurScore < 40;

                    // 2. Lighting/Shadow Check
                    const light = detectLightingOpenCV(src);
                    const hasHeavyShadow = light.issues.length > 0;

                    // 3. Document/Object Check (Saturation)
                    const colorStats = detectColorStats(src);
                    const isDocument = colorStats.saturation < 140;

                    // 4. Cut-off Check (Edge Detection)
                    const edges = detectEdgesOpenCV(src);
                    let isCutOff = false;
                    let crop = null;

                    if (edges.detected) {
                        const b = edges.bounds;
                        const margin = 2;
                        if (b.x <= margin || b.y <= margin || (b.x + b.width) >= (width - margin) || (b.y + b.height) >= (height - margin)) {
                            isCutOff = true;
                        }
                        crop = {
                            ...edges.bounds,
                            originalDimensions: { width, height }
                        };
                    } else {
                        crop = {
                            x: 0, y: 0, width, height,
                            contourPoints: [{ x: 0, y: 0 }, { x: width, y: 0 }, { x: width, y: height }, { x: 0, y: height }],
                            originalDimensions: { width, height }
                        };
                    }

                    // 5. Table Detection
                    const tableAnalysis = detectTableOpenCV(src);
                    const hasTable = tableAnalysis.hasTable;
                    if (tableAnalysis.isTableCutOff) isCutOff = true;

                    // 6. Screenshot / Digital UI
                    const screenshotAnalysis = detectScreenshotOpenCV(src);
                    const uiAnalysis = detectDigitalUIOpenCV(src);

                    // 7. NEW: Obstruction Detection
                    const obstruction = detectObstructions(cv, src);
                    const hasObstruction = obstruction.hasObstruction;

                    let suspicionScore = 0;
                    if (uiAnalysis.hasDigitalUI) suspicionScore += 5;
                    if (screenshotAnalysis.peakRatio > 0.50) suspicionScore += 2;
                    else if (screenshotAnalysis.peakRatio > 0.18) suspicionScore += 1;
                    if (!edges.detected) suspicionScore += 1;
                    if (colorStats.saturation < 40) suspicionScore += 1;

                    const isScreenshot = hasTable ? suspicionScore >= 9 : suspicionScore >= 6;

                    // Clean up high-res src Mat immediately
                    src.delete();
                    src = null;

                    const analysis = {
                        isDocument, isScreenshot, isBlurry, hasHeavyShadow, isCutOff, hasTable,
                        isTableComplete: !isCutOff, suspicionScore, hasObstruction
                    };

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
                    } else if (isBlurry) {
                        status = "error";
                        message = "Invalid image. The document is blurry. Please hold the camera steady and retry.";
                    } else if (hasObstruction) {
                        status = "error";
                        message = "Object detected on document. Please remove any objects (fingers, pens, etc.) and retry.";
                    } else if (hasHeavyShadow) {
                        status = "fixed";
                        message = "Image accepted (minor shadows detected)";
                    }

                    if (status === "valid" || status === "fixed") {
                        const structure = validateSHGTableStructure(canvas);
                        if (!structure.valid) {
                            status = "error";
                            message = structure.reason;
                        }
                    }

                    resolve({
                        status: status === "error" ? "error" : "success",
                        message: status === "error" ? message : "Image accepted",
                        action: status === "error" ? "retry" : "proceed",
                        analysis,
                        crop,
                        canvas,
                        isValid: status !== "error"
                    });

                } else {
                    resolve({ status: "error", message: "OpenCV not loaded. Please refresh.", isValid: false });
                }
            } catch (e) {
                console.error("[Scanner] Error during scan:", e);
                resolve({ status: "error", message: `Internal processing error: ${e.message}`, isValid: false });
            }
        };
        img.onerror = () => reject(new Error("Image failed to load"));
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

/* ===================== IMAGE ENHANCEMENT (Native-Grade UHD Scan v9) ===================== */
export const enhanceImage = async (canvas, onProgress = () => { }) => {
    if (!cvReady()) {
        console.warn("[Enhance] OpenCV not ready, returning original.");
        return canvas;
    }

    // Yield to let React render the message before starting heavy work
    const tick = () => new Promise(r => setTimeout(r, 0));

    console.log("[Enhance] Starting enhancement pipeline...");
    onProgress("Analyzing...");
    await tick();

    let src = null, gray = null, illuminationMap = null, tinyGray = null, tinyBlur = null;
    let kernel = null, normalized = null, balanced = null, whitened = null;
    let blurStructure = null, midResult = null, blurText = null, finalResult = null;

    try {
        src = cv.imread(canvas);
        console.log(`[Enhance] Source Mat: ${src.rows}x${src.cols}, type=${src.type()}, channels=${src.channels()}`);

        // --- Step 0: Intelligent Pre-Scan Detection ---
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Fast pixel sampling — no cv.calcHist needed
        let veryDark = 0, veryBright = 0;
        const data = gray.data;
        for (let i = 0; i < data.length; i += 10) {
            if (data[i] < 30) veryDark++;
            else if (data[i] > 230) veryBright++;
        }
        const sampledTotal = Math.ceil(data.length / 10);
        const extremeRatio = (veryDark + veryBright) / sampledTotal;

        console.log(`[Enhance] extremeRatio=${extremeRatio.toFixed(3)}`);

        if (extremeRatio > 0.90) {
            console.log("[Enhance] Already a clean scan, bypassing.");
            onProgress("Format accepted");
            src.delete(); gray.delete();
            return canvas;
        }

        // --- Step 0b: Blur Assessment ---
        const blurScore = detectBlurOpenCV(src);
        const isSharp = blurScore > 60;
        const isExtremelyBlurry = blurScore < 25;
        console.log(`[Enhance] blurScore=${blurScore.toFixed(1)}, isSharp=${isSharp}`);

        // --- Step 0c: High-Quality/Pre-Processed Detection ---
        // Characterized by high brightness and high contrast (already white background)
        const mean = new cv.Mat();
        const std = new cv.Mat();
        cv.meanStdDev(gray, mean, std);
        const avgBrightness = mean.data64F[0];
        const avgContrast = std.data64F[0];
        mean.delete(); std.delete();

        const isPreProcessed = avgBrightness > 200 && avgContrast > 40;
        console.log(`[Enhance] avgBrightness=${avgBrightness.toFixed(1)}, avgContrast=${avgContrast.toFixed(1)}, isPreProcessed=${isPreProcessed}`);

        if (isPreProcessed && isSharp) {
            console.log("[Enhance] High-quality pre-processed image detected. Using minimal enhancement.");
            onProgress("Optimizing quality...");
            // Minimal sharpening only
            blurText = new cv.Mat();
            cv.GaussianBlur(gray, blurText, new cv.Size(3, 3), 0);
            finalResult = new cv.Mat();
            cv.addWeighted(gray, 1.1, blurText, -0.1, 0, finalResult);

            const outputCanvas = document.createElement("canvas");
            cv.imshow(outputCanvas, finalResult);
            src.delete(); gray.delete(); blurText.delete(); finalResult.delete();
            return outputCanvas;
        }

        // --- Step 1: Shadow Removal ---
        onProgress("Removing shadows...");
        await tick();

        // Skip median blur if already sharp to preserve fine lines
        if (!isSharp) {
            cv.medianBlur(gray, gray, 3);
        }

        illuminationMap = new cv.Mat();
        tinyGray = new cv.Mat();
        tinyBlur = new cv.Mat();

        const iScale = 256 / Math.max(gray.rows, gray.cols);
        cv.resize(gray, tinyGray, new cv.Size(Math.round(gray.cols * iScale), Math.round(gray.rows * iScale)), 0, 0, cv.INTER_AREA);
        kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(7, 7));
        cv.dilate(tinyGray, tinyBlur, kernel);
        cv.GaussianBlur(tinyBlur, tinyBlur, new cv.Size(31, 31), 0);
        cv.resize(tinyBlur, illuminationMap, new cv.Size(gray.cols, gray.rows), 0, 0, cv.INTER_LINEAR);

        normalized = new cv.Mat();
        cv.divide(gray, illuminationMap, normalized, 255);

        // --- Step 2: Contrast ---
        onProgress("Tuning contrast...");
        await tick();

        balanced = new cv.Mat();
        // Lower clip limit for already balanced images
        const clipLimit = isSharp ? 1.2 : 1.8;
        const clahe = new cv.CLAHE(clipLimit, new cv.Size(8, 8));
        clahe.apply(normalized, balanced);
        clahe.delete();

        // --- Step 3: Whitening ---
        onProgress("Whitening...");
        await tick();

        whitened = new cv.Mat();
        // Adaptive whitening based on current brightness
        const whiteScale = isSharp ? (avgBrightness > 180 ? 1.05 : 1.15) : 1.10;
        const whiteOffset = isSharp ? (avgBrightness > 180 ? -5 : -15) : -10;
        balanced.convertTo(whitened, cv.CV_8U, whiteScale, whiteOffset);
        console.log(`[Enhance] Whitening done (scale=${whiteScale}).`);

        // --- Step 4: Sharpening ---
        onProgress("Sharpning...");
        await tick();

        blurStructure = new cv.Mat();
        cv.GaussianBlur(whitened, blurStructure, new cv.Size(15, 15), 0);
        midResult = new cv.Mat();
        const structureWeight = isSharp ? 0.20 : (isExtremelyBlurry ? 0.15 : 0.25);
        cv.addWeighted(whitened, 1 + structureWeight, blurStructure, -structureWeight, 0, midResult);

        blurText = new cv.Mat();
        cv.GaussianBlur(midResult, blurText, new cv.Size(5, 5), 0);
        finalResult = new cv.Mat();
        const textWeight = isSharp ? 0.15 : (isExtremelyBlurry ? 0.10 : 0.18);
        cv.addWeighted(midResult, 1 + textWeight, blurText, -textWeight, 0, finalResult);

        // --- Step 5: Output ---
        onProgress("Finalizing...");
        await tick();

        const outputCanvas = document.createElement("canvas");
        outputCanvas.width = canvas.width;
        outputCanvas.height = canvas.height;
        cv.imshow(outputCanvas, finalResult);
        console.log("[Enhance] Complete!");

        src.delete(); gray.delete(); illuminationMap.delete(); kernel.delete();
        tinyGray.delete(); tinyBlur.delete();
        normalized.delete(); balanced.delete(); whitened.delete();
        blurStructure.delete(); midResult.delete(); blurText.delete(); finalResult.delete();

        return outputCanvas;

    } catch (err) {
        console.error("[Enhance] Pipeline crashed:", err);
        try { if (src) src.delete(); } catch (_) { }
        try { if (gray) gray.delete(); } catch (_) { }
        try { if (illuminationMap) illuminationMap.delete(); } catch (_) { }
        try { if (tinyGray) tinyGray.delete(); } catch (_) { }
        try { if (tinyBlur) tinyBlur.delete(); } catch (_) { }
        try { if (kernel) kernel.delete(); } catch (_) { }
        try { if (normalized) normalized.delete(); } catch (_) { }
        try { if (balanced) balanced.delete(); } catch (_) { }
        try { if (whitened) whitened.delete(); } catch (_) { }
        try { if (blurStructure) blurStructure.delete(); } catch (_) { }
        try { if (midResult) midResult.delete(); } catch (_) { }
        try { if (blurText) blurText.delete(); } catch (_) { }
        try { if (finalResult) finalResult.delete(); } catch (_) { }
        return canvas;
    }
};


/* ===================== SHG TABLE STRUCTURE VALIDATOR ===================== */
// Ratios from calibrated_template.json
const SHG_ROW_RATIOS = [
    0.035345, 0.058621, 0.02931, 0.037069, 0.053448, 0.093966,
    0.039655, 0.039655, 0.039655, 0.039655, 0.039655, 0.038793,
    0.039655, 0.041379, 0.040517, 0.038793, 0.040517, 0.040517,
    0.039655, 0.040517, 0.043966, 0.05431, 0.035345
];
const SHG_COL_RATIOS = [
    0.023597, 0.044573, 0.088621, 0.044048, 0.066597, 0.059255,
    0.066597, 0.069219, 0.062402, 0.061353, 0.052963, 0.065024,
    0.055585, 0.065024, 0.036707, 0.046146, 0.06817, 0.024122
];

/** Pearson correlation helper */
const _pearsonCorr = (a, b) => {
    const n = Math.min(a.length, b.length);
    if (n < 2) return 0;
    let ma = 0, mb = 0;
    for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
    ma /= n; mb /= n;
    let num = 0, den1 = 0, den2 = 0;
    for (let i = 0; i < n; i++) {
        let da = a[i] - ma, db = b[i] - mb;
        num += da * db; den1 += da * da; den2 += db * db;
    }
    return Math.sqrt(den1 * den2) === 0 ? 0 : num / Math.sqrt(den1 * den2);
};

/** Find peaks in a 1D projection */
const _findPeaks = (arr, threshold, minGap) => {
    const peaks = [];
    for (let i = 1; i < arr.length - 1; i++) {
        if (arr[i] > threshold && arr[i] >= arr[i - 1] && arr[i] >= arr[i + 1]) {
            if (peaks.length === 0 || i - peaks[peaks.length - 1] > minGap) {
                peaks.push(i);
            }
        }
    }
    return peaks;
};

export const validateSHGTableStructure = (canvas) => {
    if (!cvReady()) return { valid: true };

    let src, gray, bw, hKernel, vKernel, horizontal, vertical, junctions;
    try {
        src = cv.imread(canvas);
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        bw = new cv.Mat();
        cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_MEAN_C, cv.THRESH_BINARY_INV, 15, -2);

        // Extract junctions (scaled for structure analysis)
        const hSize = Math.max(25, Math.round(bw.cols / 40));
        const vSize = Math.max(25, Math.round(bw.rows / 40));
        hKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(hSize, 1));
        vKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, vSize));

        horizontal = new cv.Mat(); vertical = new cv.Mat();
        const anchor = new cv.Point(-1, -1);
        cv.erode(bw, horizontal, hKernel, anchor); cv.dilate(horizontal, horizontal, hKernel, anchor);
        cv.erode(bw, vertical, vKernel, anchor); cv.dilate(vertical, vertical, vKernel, anchor);
        bw.delete(); bw = null;

        junctions = new cv.Mat();
        cv.bitwise_and(horizontal, vertical, junctions);

        // Manual 1D Projections (Avoids cv.reduce which crashes some mobile browsers)
        const height = junctions.rows;
        const width = junctions.cols;
        const jData = junctions.data8U; // Raw Uint8Array access via data8U for browser compatibility
        const hProj = new Float32Array(height);
        const vProj = new Float32Array(width);

        for (let y = 0; y < height; y++) {
            let rowSum = 0;
            const rowOff = y * width;
            for (let x = 0; x < width; x++) {
                if (jData[rowOff + x] > 0) rowSum++;
            }
            hProj[y] = rowSum;
        }
        for (let x = 0; x < width; x++) {
            let colSum = 0;
            for (let y = 0; y < height; y++) {
                if (jData[y * width + x] > 0) colSum++;
            }
            vProj[x] = colSum;
        }

        // Peak Detection: require at least 15 pixels density for a junction group
        // Loosened thresholds to be more forgiving for older camera resolution/noise
        const hPeaks = _findPeaks(Array.from(hProj), 13, 10);
        const vPeaks = _findPeaks(Array.from(vProj), 10, 10);

        console.log(`[SHG-Struct] Detected Peaks: rows=${hPeaks.length} cols=${vPeaks.length}`);

        if (hPeaks.length < 13 || vPeaks.length < 10) {
            return {
                valid: false,
                reason: "Table structure not clearly detected. Ensure even lighting and steady camera.",
                peaks: { rows: hPeaks.length, cols: vPeaks.length }
            };
        }

        const hGaps = [], vGaps = [];
        const totalH = hPeaks[hPeaks.length - 1] - hPeaks[0] || 1;
        const totalV = vPeaks[vPeaks.length - 1] - vPeaks[0] || 1;

        for (let i = 1; i < hPeaks.length; i++) hGaps.push((hPeaks[i] - hPeaks[i - 1]) / totalH);
        for (let i = 1; i < vPeaks.length; i++) vGaps.push((vPeaks[i] - vPeaks[i - 1]) / totalV);

        const rowCorr = _pearsonCorr(hGaps, SHG_ROW_RATIOS);
        const colCorr = _pearsonCorr(vGaps, SHG_COL_RATIOS);

        console.log(`[SHG-Struct] Correlation: rows=${rowCorr.toFixed(2)} cols=${colCorr.toFixed(2)}`);

        // Threshold 0.5 is very lenient for basic shape matching
        if (rowCorr < 0.5 && colCorr < 0.5) {
            return { valid: false, reason: "Not the correct document format. Only SHG Ledgers are accepted.", rowCorr, colCorr };
        }

        return { valid: true, rowCorr, colCorr };

    } catch (e) {
        console.error("Structure validation error:", e);
        return { valid: true }; // Fail-safe: don't block user if check itself crashes
    } finally {
        if (src) src.delete(); if (gray) gray.delete(); if (bw) bw.delete();
        if (hKernel) hKernel.delete(); if (vKernel) vKernel.delete();
        if (horizontal) horizontal.delete(); if (vertical) vertical.delete();
        if (junctions) junctions.delete();
    }
};
