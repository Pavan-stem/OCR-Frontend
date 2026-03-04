/**
 * Gallery Validator — extracted from project_submission pipeline.
 * Self-contained validation for gallery-uploaded images.
 * Uses FileReader (not createObjectURL) for safe mobile loading.
 */

const cvReady = () => !!(window.cv && window.cv.Mat);

/* ═══════════════ Mat Utilities ═══════════════ */
function releaseMats(...mats) {
    for (const mat of mats) {
        try { if (mat && !mat.isDeleted()) mat.delete(); } catch { /* already freed */ }
    }
}

function downscaleMat(cv, mat, maxDim) {
    const { rows, cols } = mat;
    if (rows <= maxDim && cols <= maxDim) return mat.clone();
    const scale = maxDim / Math.max(rows, cols);
    const dst = new cv.Mat();
    cv.resize(mat, dst, new cv.Size(Math.round(cols * scale), Math.round(rows * scale)), 0, 0, cv.INTER_AREA);
    return dst;
}

function matToCanvas(cv, mat) {
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, mat);
    return canvas;
}

/* ═══════════════ Config ═══════════════ */
const CONFIG = {
    BLUR_THRESHOLD: 50,
    MIN_BRIGHTNESS: 35,
    HOUGH_RHO: 1,
    HOUGH_THETA: Math.PI / 180,
    HOUGH_THRESHOLD: 50,
    HOUGH_MIN_LINE_LENGTH: 50,
    HOUGH_MAX_LINE_GAP: 15,
    MIN_HORIZONTAL_LINES: 3,
    MIN_VERTICAL_LINES: 3,
    PARALLEL_ANGLE_TOLERANCE: 8,
    MIN_GRID_COVERAGE: 0.5,
    LINE_CLUSTER_GAP: 15,
    MAX_SKEW_DEGREES: 15,
    MIN_TABLE_AREA_RATIO: 0.10,
    MAX_TABLE_AREA_RATIO: 0.98,
    APPROX_POLY_EPSILON_RATIO: 0.02,
    OUTPUT_MAX_DIM: 1024,
};

/* ═══════════════ Blur Detection ═══════════════ */
function detectBlur(cv, src) {
    let gray, laplacian, mean, stddev;
    try {
        gray = new cv.Mat();
        cv.cvtColor(src, gray, src.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_BGR2GRAY);
        laplacian = new cv.Mat();
        cv.Laplacian(gray, laplacian, cv.CV_64F);
        mean = new cv.Mat(); stddev = new cv.Mat();
        cv.meanStdDev(laplacian, mean, stddev);
        const variance = stddev.doubleAt(0, 0) ** 2;
        const isBlurry = variance < CONFIG.BLUR_THRESHOLD;
        return { isBlurry, variance: Math.round(variance), reason: isBlurry ? `Image too blurry (sharpness: ${Math.round(variance)})` : null };
    } finally {
        releaseMats(gray, laplacian, mean, stddev);
    }
}

/* ═══════════════ Structural Validation ═══════════════ */
function validateStructure(cv, src) {
    const reasons = [];
    const metrics = {};
    const mats = [];

    try {
        const gray = new cv.Mat(); mats.push(gray);
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const blurred = new cv.Mat(); mats.push(blurred);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        const edges = new cv.Mat(); mats.push(edges);
        cv.Canny(blurred, edges, 50, 150);

        const dk = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)); mats.push(dk);
        const dilated = new cv.Mat(); mats.push(dilated);
        cv.dilate(edges, dilated, dk);

        // Find boundary
        const contours = new cv.MatVector();
        const hierarchy = new cv.Mat(); mats.push(hierarchy);
        cv.findContours(dilated, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const imgArea = src.rows * src.cols;
        let bestContour = null, bestArea = 0;

        for (let i = 0; i < contours.size(); i++) {
            const c = contours.get(i);
            const area = cv.contourArea(c);
            const ratio = area / imgArea;
            if (ratio < CONFIG.MIN_TABLE_AREA_RATIO || ratio > CONFIG.MAX_TABLE_AREA_RATIO) continue;

            const peri = cv.arcLength(c, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(c, approx, CONFIG.APPROX_POLY_EPSILON_RATIO * peri, true);
            if (approx.rows === 4 && cv.isContourConvex(approx) && area > bestArea) {
                if (bestContour) bestContour.delete();
                bestContour = approx;
                bestArea = area;
            } else {
                approx.delete();
            }
        }
        contours.delete();

        if (!bestContour) {
            reasons.push('No rectangular table boundary detected');
            return { isValid: false, reasons, metrics, corners: null };
        }

        const corners = [];
        for (let i = 0; i < 4; i++) {
            corners.push({ x: bestContour.intAt(i, 0), y: bestContour.intAt(i, 1) });
        }
        bestContour.delete();
        metrics.tableAreaRatio = Math.round((bestArea / imgArea) * 100) / 100;

        const ordered = orderCorners(corners);

        // Grid lines via Hough
        const roiMask = new cv.Mat.zeros(gray.rows, gray.cols, cv.CV_8UC1); mats.push(roiMask);
        const roiPts = cv.matFromArray(4, 1, cv.CV_32SC2, ordered.flatMap(c => [c.x, c.y])); mats.push(roiPts);
        const roiVec = new cv.MatVector();
        roiVec.push_back(roiPts);
        cv.fillPoly(roiMask, roiVec, new cv.Scalar(255));
        roiVec.delete();

        const masked = new cv.Mat(); mats.push(masked);
        cv.bitwise_and(edges, roiMask, masked);

        const lines = new cv.Mat(); mats.push(lines);
        cv.HoughLinesP(masked, lines, CONFIG.HOUGH_RHO, CONFIG.HOUGH_THETA, CONFIG.HOUGH_THRESHOLD, CONFIG.HOUGH_MIN_LINE_LENGTH, CONFIG.HOUGH_MAX_LINE_GAP);

        if (lines.rows === 0) {
            reasons.push('No grid lines detected in document');
            return { isValid: false, reasons, metrics, corners: ordered };
        }

        const hLines = [], vLines = [], dLines = [];
        for (let i = 0; i < lines.rows; i++) {
            const x1 = lines.intAt(i, 0), y1 = lines.intAt(i, 1);
            const x2 = lines.intAt(i, 2), y2 = lines.intAt(i, 3);
            const angle = Math.atan2(Math.abs(y2 - y1), Math.abs(x2 - x1)) * (180 / Math.PI);
            const length = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            if (angle < 30) hLines.push({ x1, y1, x2, y2, angle });
            else if (angle > 60) vLines.push({ x1, y1, x2, y2, angle });
            else dLines.push({ x1, y1, x2, y2, angle, length });
        }

        metrics.horizontalLines = hLines.length;
        metrics.verticalLines = vLines.length;
        metrics.diagonalLines = dLines.length;

        const rowPos = hLines.map(l => (l.y1 + l.y2) / 2);
        const colPos = vLines.map(l => (l.x1 + l.x2) / 2);
        const rowCenters = getClusterCenters(rowPos, CONFIG.LINE_CLUSTER_GAP);
        const colCenters = getClusterCenters(colPos, CONFIG.LINE_CLUSTER_GAP);
        metrics.tableRows = rowCenters.length;
        metrics.tableCols = colCenters.length;

        if (hLines.length < CONFIG.MIN_HORIZONTAL_LINES) {
            reasons.push(`Not enough horizontal lines (${hLines.length})`);
        }
        if (vLines.length < CONFIG.MIN_VERTICAL_LINES) {
            reasons.push(`Not enough vertical lines (${vLines.length})`);
        }

        // Table dimensions
        const tblW = Math.max(dist(ordered[0], ordered[1]), dist(ordered[3], ordered[2]));
        const tblH = Math.max(dist(ordered[0], ordered[3]), dist(ordered[1], ordered[2]));

        // Obstacle Detection (Diagonal lines)
        const tableDiag = Math.sqrt(tblW ** 2 + tblH ** 2);
        const totalDLength = dLines.reduce((s, l) => s + l.length, 0);
        const dRatio = tableDiag > 0 ? totalDLength / tableDiag : 0;
        metrics.diagonalRatio = Math.round(dRatio * 100) / 100;
        if (dRatio > 1.5) reasons.push('Obstacles detected covering the table (remove fingers/objects)');

        // Grid Integrity Detection
        if (rowCenters.length >= 3 && colCenters.length >= 3) {
            let totalI = 0, intactI = 0;
            const radius = 7;
            for (const rY of rowCenters) {
                for (const cX of colCenters) {
                    const ix = Math.round(cX), iy = Math.round(rY);
                    if (ix < radius || ix >= edges.cols - radius || iy < radius || iy >= edges.rows - radius) continue;
                    totalI++;
                    let found = false;
                    for (let dy = -radius; dy <= radius && !found; dy++) {
                        for (let dx = -radius; dx <= radius && !found; dx++) {
                            if (edges.ucharAt(iy + dy, ix + dx) > 0) found = true;
                        }
                    }
                    if (found) intactI++;
                }
            }
            if (totalI > 0) {
                const intactRatio = intactI / totalI;
                metrics.gridIntegrity = Math.round(intactRatio * 100) / 100;
                if (intactRatio < 0.70) reasons.push('Table grid is partially hidden or distorted');
            }
        }

        // Coverage check
        if (hLines.length >= 2) {
            const ys = hLines.map(l => (l.y1 + l.y2) / 2);
            const cov = (Math.max(...ys) - Math.min(...ys)) / tblH;
            metrics.hCoverage = Math.round(cov * 100) / 100;
            if (cov < CONFIG.MIN_GRID_COVERAGE) reasons.push(`Grid doesn't cover full height (${Math.round(cov * 100)}%)`);
        }
        if (vLines.length >= 2) {
            const xs = vLines.map(l => (l.x1 + l.x2) / 2);
            const cov = (Math.max(...xs) - Math.min(...xs)) / tblW;
            metrics.vCoverage = Math.round(cov * 100) / 100;
            if (cov < CONFIG.MIN_GRID_COVERAGE) reasons.push(`Grid doesn't cover full width (${Math.round(cov * 100)}%)`);
        }

        // Skew check
        if (hLines.length > 0) {
            const angles = hLines.map(l => Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * (180 / Math.PI));
            const sorted = [...angles].sort((a, b) => a - b);
            const med = sorted[Math.floor(sorted.length / 2)];
            metrics.skewAngle = Math.round(Math.abs(med) * 100) / 100;
            if (Math.abs(med) > CONFIG.MAX_SKEW_DEGREES) reasons.push(`Excessive skew (${metrics.skewAngle}°)`);
        }

        return { isValid: reasons.length === 0, reasons, metrics, corners: ordered };
    } finally {
        releaseMats(...mats);
    }
}

/* ═══════════════ Helpers ═══════════════ */
function orderCorners(pts) {
    const sums = pts.map(p => p.x + p.y);
    const diffs = pts.map(p => p.y - p.x);
    return [
        pts[sums.indexOf(Math.min(...sums))],
        pts[diffs.indexOf(Math.min(...diffs))],
        pts[sums.indexOf(Math.max(...sums))],
        pts[diffs.indexOf(Math.max(...diffs))],
    ];
}
function dist(a, b) { return Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2); }

/**
 * Cluster 1D positions into distinct groups and return their centers.
 * Lines within `gap` pixels of each other are merged into one cluster.
 */
function getClusterCenters(positions, gap = 15) {
    if (positions.length === 0) return [];
    const sorted = [...positions].sort((a, b) => a - b);
    const centers = [];
    let clusterSum = sorted[0];
    let clusterCount = 1;

    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > gap) {
            centers.push(clusterSum / clusterCount);
            clusterSum = sorted[i];
            clusterCount = 1;
        } else {
            clusterSum += sorted[i];
            clusterCount++;
        }
    }
    centers.push(clusterSum / clusterCount);
    return centers;
}

/* ═══════════════ Main Export ═══════════════ */

/**
 * Validate a gallery-uploaded File for SHG table content.
 * Uses FileReader (not createObjectURL) to avoid mobile memory crashes.
 * Returns: { isValid, message, canvas?, corners?, metrics? }
 */
export async function validateGalleryImage(file) {
    if (!cvReady()) {
        return { isValid: false, message: 'OpenCV not loaded. Please refresh the page.' };
    }

    // 1. Safe image loading via FileReader (works on ALL mobile browsers)
    let dataURL;
    try {
        dataURL = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('Cannot read file'));
            reader.readAsDataURL(file);
        });
    } catch (e) {
        return { isValid: false, message: 'Cannot read the selected file. Please try another photo.' };
    }

    // 2. Decode image to canvas (with timeout for large images)
    let img, canvas;
    try {
        img = new Image();
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Image decode timeout')), 15000);
            img.onload = () => { clearTimeout(timeout); resolve(); };
            img.onerror = () => { clearTimeout(timeout); reject(new Error('Image decode failed')); };
            img.src = dataURL;
        });

        // Downscale on canvas BEFORE touching OpenCV
        const maxDim = CONFIG.OUTPUT_MAX_DIM;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    } catch (e) {
        return { isValid: false, message: `Image could not be decoded: ${e.message}. Try a smaller photo.` };
    }

    // Free the data URL string from memory
    dataURL = null;

    // 3. Run OpenCV pipeline
    let src;
    try {
        src = cv.imread(canvas);

        // Blur check
        const blur = detectBlur(cv, src);
        if (blur.isBlurry) {
            src.delete();
            return { isValid: false, message: blur.reason, canvas };
        }

        // Structure check
        const struct = validateStructure(cv, src);
        src.delete();
        src = null;

        if (!struct.isValid) {
            const reason = struct.reasons[0] || 'Document structure not recognized.';
            console.log('[GalleryValidator] Rejected:', struct.reasons, struct.metrics);
            return { isValid: false, message: reason, canvas, metrics: struct.metrics };
        }

        console.log('[GalleryValidator] Accepted:', struct.metrics);
        return { isValid: true, message: 'Image accepted', canvas, corners: struct.corners, metrics: struct.metrics };

    } catch (e) {
        if (src) try { src.delete(); } catch { /* noop */ }
        console.error('[GalleryValidator] Pipeline error:', e);
        return { isValid: false, message: `Processing error: ${e.message}. Please try again.` };
    }
}
