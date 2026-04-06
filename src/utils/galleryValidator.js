/**
 * galleryValidator.js  ─  v2.0 ENHANCED
 *
 * Changes from FIXED VERSION:
 *
 *  A. detectObstructions(cv, src, corners)
 *     • Accepts a `corners` array (4 points from validateStructure).
 *     • The full morphological pipeline (line + text erasure) still runs on the
 *       complete image to prevent polygon-edge artefacts.
 *     • Contour analysis (Stage 3 & Stage 4) is then restricted to INSIDE the
 *       table polygon — any object outside the table boundary (hand holding the
 *       phone, camera shadow on a desk, etc.) can NEVER trigger a rejection.
 *
 *  B. detectShadow(cv, src, corners)  ← NEW
 *     • Operates exclusively within the table ROI defined by corners.
 *     • Uses a large Gaussian blur to suppress text & grid lines, exposing the
 *       underlying brightness map where shadows live.
 *     • Patch grid analysis measures brightness non-uniformity so uniformly
 *       grey/coloured paper is NEVER mistaken for a shadow.
 *     • CLAHE recovery test: applies aggressive CLAHE and measures how much of
 *       the dark area disappears.
 *         – dark fraction < 15 %                      → no shadow → accept
 *         – brightness range < 40                     → uniform paper → accept
 *         – dark > 15 %, range > 40, recovery ≥ 50 % → light shadow → accept
 *         – dark > 22 %, range > 50, recovery <  50 % → heavy shadow → REJECT
 *
 *  C. validateGalleryImage() pipeline reordered:
 *       1. Blur check           (no corners needed — fast early exit)
 *       2. Structure detection  → acquires table corners
 *       3. Obstruction check    → uses corners (only inside table boundary)
 *       4. Shadow check         → uses corners (only inside table boundary)
 *       5. Auto crop
 *
 *  All previously fixed false-positive guards (screenshot threshold, obstruction
 *  thresholds, blur guard, grid-integrity lower bound, leniency pass) are
 *  preserved unchanged.
 */
import { enhanceImage } from './imageEnhancer';
const cvReady = () => !!(window.cv && window.cv.Mat);

/* ═══ Mat utilities ════════════════════════════════════════ */
function releaseMats(...mats) {
    for (const m of mats) {
        try { if (m && !m.isDeleted()) m.delete(); } catch { /* already freed */ }
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

/* ═══ Config ════════════════════════════════════════════════ */
const CONFIG = {
    BLUR_THRESHOLD: 45,
    MIN_BRIGHTNESS: 35,
    HOUGH_RHO: 1,
    HOUGH_THETA: Math.PI / 180,
    HOUGH_THRESHOLD: 30,
    HOUGH_MIN_LINE_LENGTH: 30,
    HOUGH_MAX_LINE_GAP: 15,
    MIN_HORIZONTAL_LINES: 2,
    MIN_VERTICAL_LINES: 2,
    PARALLEL_ANGLE_TOLERANCE: 8,
    MIN_GRID_COVERAGE: 0.45,
    LINE_CLUSTER_GAP: 15,
    MAX_SKEW_DEGREES: 18,
    MIN_TABLE_AREA_RATIO: 0.04,
    MAX_TABLE_AREA_RATIO: 0.99,
    APPROX_POLY_EPSILON_RATIO: 0.02,
    OUTPUT_MAX_DIM: 2048,

    // Obstruction
    OBSTRUCTION_AREA_THRESHOLD: 0.040,
    OBSTRUCTION_SOLIDITY: 0.70,

    // Boundary strip (objects ON table edge/corners)
    // Width of the strip (pixels) measured INWARD from the detected table polygon
    BOUNDARY_STRIP_WIDTH: 55,
    // Minimum fraction of a contour's bounding box that must overlap the strip
    // Raised to 0.45 so that text header rows near the top/bottom of the table
    // (which have their bounding box partially inside the strip) are NOT mistaken
    // for physical objects resting on the edge.
    BOUNDARY_OVERLAP_FRACTION: 0.45,

    // Screenshot
    SCREENSHOT_PEAK_STRONG: 0.65,
    SCREENSHOT_PEAK_WEAK: 0.45,

    // Grid integrity
    GRID_INTEGRITY_MIN: 0.60,

    // ── Shadow detection (NEW) ────────────────────────────────────────────────
    // Pixel brightness (0-255) below which a blurred pixel is "dark"
    SHADOW_DARK_THRESHOLD: 115,
    // Minimum dark-pixel fraction to begin shadow investigation
    SHADOW_DARK_FRACTION_CONSIDER: 0.15,
    // Dark fraction above which shadow is "heavy" (combined with other checks)
    SHADOW_DARK_FRACTION_HEAVY: 0.22,
    // Minimum patch-brightness range to distinguish shadow from uniformly grey paper
    SHADOW_BRIGHTNESS_RANGE_CONSIDER: 40,
    SHADOW_BRIGHTNESS_RANGE_HEAVY: 50,
    // CLAHE recovery below this → CLAHE cannot fix the darkness → heavy shadow
    SHADOW_CLAHE_RECOVERY_HEAVY: 0.50,
};

/* ═══ Blur detection ════════════════════════════════════════ */
function detectBlur(cv, src) {
    let gray, laplacian, mean, stddev;
    try {
        gray = new cv.Mat();
        cv.cvtColor(src, gray, src.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_BGR2GRAY);

        const brightMean = new cv.Mat(), brightStd = new cv.Mat();
        cv.meanStdDev(gray, brightMean, brightStd);
        const avgBrightness = brightMean.doubleAt(0, 0);
        releaseMats(brightMean, brightStd);

        if (avgBrightness < CONFIG.MIN_BRIGHTNESS) {
            return { isBlurry: false, variance: 9999, reason: null };
        }

        laplacian = new cv.Mat();
        cv.Laplacian(gray, laplacian, cv.CV_64F);
        mean = new cv.Mat(); stddev = new cv.Mat();
        cv.meanStdDev(laplacian, mean, stddev);
        const variance = stddev.doubleAt(0, 0) ** 2;
        const isBlurry = variance < CONFIG.BLUR_THRESHOLD;
        return {
            isBlurry,
            variance: Math.round(variance),
            reason: isBlurry ? `Image too blurry (sharpness: ${Math.round(variance)})` : null
        };
    } finally {
        releaseMats(gray, laplacian, mean, stddev);
    }
}

/* ═══ Obstruction detection ══════════════════════════════════
 *
 *  CHANGED: accepts optional `corners` (4 ordered points).
 *  When provided, the full morphological pipeline (Stages 1-2) still runs on
 *  the full image — this avoids hard polygon-edge artefacts during erosion /
 *  dilation.  Only the contour-analysis passes (Stages 3-4) are then masked to
 *  the inside of the table polygon, so objects outside the table boundary
 *  (phone edge, hand, desk items) never cause a false rejection.
 */
function detectObstructions(cv, src, corners = null) {
    const release = (...mats) => mats.forEach(m => { if (m) try { m.delete(); } catch (_) { } });
    let gray, equalized, thresh, hLines, vLines, gridMask, afterGrid, afterText,
        contours, hierarchy, darkMask, darkCnt, darkHier,
        tableMask, boundaryStripMask, interiorMask;

    try {
        const H = src.rows, W = src.cols, imgArea = H * W;

        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        equalized = new cv.Mat();
        const clahe = new cv.CLAHE(2.0, new cv.Size(8, 8));
        clahe.apply(gray, equalized);
        clahe.delete();

        thresh = new cv.Mat();
        cv.threshold(equalized, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);

        /* ── Stage 1: Erase ALL grid/table lines ───────────────── */
        const hKSize = Math.max(15, Math.round(W / 10));
        const vKSize = Math.max(15, Math.round(H / 10));
        const hKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(hKSize, 1));
        const vKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, vKSize));

        hLines = new cv.Mat(); vLines = new cv.Mat();
        cv.morphologyEx(thresh, hLines, cv.MORPH_OPEN, hKernel);
        cv.morphologyEx(thresh, vLines, cv.MORPH_OPEN, vKernel);
        hKernel.delete(); vKernel.delete();

        // Erase only THIN lines (<10px) so thick objects (pens) are not erased
        const thickHL = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(1, 10));
        const hThick = new cv.Mat();
        cv.morphologyEx(hLines, hThick, cv.MORPH_OPEN, thickHL);
        cv.subtract(hLines, hThick, hLines);
        thickHL.delete(); hThick.delete();

        const thickVL = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(10, 1));
        const vThick = new cv.Mat();
        cv.morphologyEx(vLines, vThick, cv.MORPH_OPEN, thickVL);
        cv.subtract(vLines, vThick, vLines);
        thickVL.delete(); vThick.delete();

        gridMask = new cv.Mat();
        cv.bitwise_or(hLines, vLines, gridMask);
        const dKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(12, 12));
        cv.dilate(gridMask, gridMask, dKernel); dKernel.delete();

        afterGrid = new cv.Mat();
        cv.subtract(thresh, gridMask, afterGrid);

        /* ── Stage 2: Erase small text / printed characters ─────── */
        const textW = Math.max(5, Math.round(W * 0.025));
        const textH = Math.max(5, Math.round(H * 0.025));
        const textKernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(textW, textH));
        afterText = new cv.Mat();
        cv.morphologyEx(afterGrid, afterText, cv.MORPH_OPEN, textKernel);
        textKernel.delete();

        /* ── Build table polygon masks ──────────────────────────────
         *
         *  TWO masks are created when corners are available:
         *
         *  tableMask        — exact polygon fill.  Used for interior checks so
         *                     objects outside the document never cause rejection.
         *
         *  boundaryStripMask — the region BETWEEN the full polygon and a version
         *                     eroded inward by BOUNDARY_STRIP_WIDTH pixels.
         *                     This is where pens / fingers resting ON the edge
         *                     or corner of the document will appear.
         *
         *  interiorMask      — the eroded (inner) polygon.  Used for the strict
         *                     interior blob / skin checks, where thresholds are
         *                     tight and only unambiguous objects are caught.
         */
        if (corners && corners.length === 4) {
            // -- exact table polygon --
            tableMask = new cv.Mat.zeros(H, W, cv.CV_8UC1);
            const cPts = cv.matFromArray(4, 1, cv.CV_32SC2,
                corners.flatMap(c => [Math.round(c.x), Math.round(c.y)]));
            const cVec = new cv.MatVector();
            cVec.push_back(cPts);
            cv.fillPoly(tableMask, cVec, new cv.Scalar(255));
            cVec.delete(); cPts.delete();

            // -- eroded interior polygon (full table minus a strip at the edges) --
            const sw = CONFIG.BOUNDARY_STRIP_WIDTH;
            const erodeK = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(sw * 2 + 1, sw * 2 + 1));
            interiorMask = new cv.Mat();
            cv.erode(tableMask, interiorMask, erodeK);
            erodeK.delete();

            // -- boundary ring = full polygon XOR eroded interior --
            boundaryStripMask = new cv.Mat();
            cv.subtract(tableMask, interiorMask, boundaryStripMask);

            // Apply the EXACT (un-dilated) polygon to the cleaned binary blob image.
            // This stops objects outside the document from being considered.
            const maskedAfterText = new cv.Mat();
            cv.bitwise_and(afterText, tableMask, maskedAfterText);
            afterText.delete();
            afterText = maskedAfterText;
        }

        /* ── Stage 3: Find remaining blobs ──────────────────────── */
        contours = new cv.MatVector(); hierarchy = new cv.Mat();
        cv.findContours(afterText, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let hasObstruction = false;

        for (let i = 0; i < contours.size(); i++) {
            const cnt = contours.get(i);
            const area = cv.contourArea(cnt);
            if (area < imgArea * 0.003) continue; // skip tiny noise

            const rect = cv.boundingRect(cnt);

            // A contour must be both physically large enough AND span a meaningful
            // fraction of the image to be considered a real physical object.
            const isLong = rect.width > W * 0.15 || rect.height > H * 0.15; // ≥15% span
            const isChunky = rect.width > W * 0.06 && rect.height > H * 0.04; // 6%×4%

            if (!isLong && !isChunky) continue;

            // ── Aspect-ratio guard (NEW) ───────────────────────────────
            //  A heading row of text is wide but very flat (aspect ≥ 4 : 1).
            //  A pen, finger, or hand is never that flat — it has rounded/solid
            //  mass in two dimensions.  Skip very flat blobs that are only
            //  "isLong" in ONE direction, as these are almost certainly
            //  text rows, divider lines, or header bands.
            //  Exception: if the blob is also isChunky (significant in BOTH
            //  dimensions), it might still be a thick object, so we let it through.
            if (isLong && !isChunky) {
                const flatAspect = Math.max(rect.width / Math.max(rect.height, 1),
                    rect.height / Math.max(rect.width, 1));
                if (flatAspect > 4.0) {
                    console.log(`[Obstruction] Stage3 flat/text-line blob skipped ` +
                        `(aspect=${flatAspect.toFixed(1)} w=${rect.width} h=${rect.height})`);
                    continue;
                }
            }

            const hull = new cv.Mat();
            cv.convexHull(cnt, hull);
            const hullArea = cv.contourArea(hull);
            hull.delete();
            const solidity = hullArea > 0 ? area / hullArea : 0;

            // Physical objects (pens, fingers) are solid.
            // Raised floor to 0.65 to filter out soft/feathery shadows.
            if (solidity < 0.65) continue;

            // ── Boundary/corner zone check ─────────────────────────────
            //  Only reject if the contour overlaps the edge strip sufficiently,
            //  OR if it is so large it can only be a physical object (≥6% of image).
            if (boundaryStripMask) {
                const bx = Math.max(0, rect.x);
                const by = Math.max(0, rect.y);
                const bw = Math.min(rect.width, W - bx);
                const bh = Math.min(rect.height, H - by);

                if (bw > 0 && bh > 0) {
                    const bRect = new cv.Rect(bx, by, bw, bh);
                    const stripROI = boundaryStripMask.roi(bRect);
                    const overlapPixels = cv.countNonZero(stripROI);
                    stripROI.delete();

                    const overlapFrac = overlapPixels / (bw * bh);
                    const isHugeInteriorBlob = area > imgArea * 0.06; // raised: 6%

                    if (overlapFrac < CONFIG.BOUNDARY_OVERLAP_FRACTION && !isHugeInteriorBlob) {
                        console.log(`[Obstruction] Stage3 blob inside interior — skipped ` +
                            `(overlap=${(overlapFrac * 100).toFixed(1)}% area=${(area / imgArea * 100).toFixed(1)}%)`);
                        continue;
                    }
                }
            }

            hasObstruction = true;
            console.log(`[Obstruction] OBJECT REJECTED (Stage3): area=${(area / imgArea * 100).toFixed(1)}% ` +
                `w=${rect.width} h=${rect.height} solidity=${solidity.toFixed(2)}`);
            break;
        }

        if (!hasObstruction) {
            /* ── Stage 4: Skin / hand / dark-object detection ──────────
             *  Looks for large mid-dark connected regions (hands, phones, pens)
             *  in the CLAHE-equalised image restricted to the table polygon.
             *
             *  Tightened vs prior version:
             *    • Dark range narrowed to 40-130 (was 25-140) — avoids lightly
             *      shaded paper and very light shadows firing as skin.
             *    • minSkinArea raised to 2.0% (was 0.8%) — finger tips are usually
             *      large enough; this cuts obvious false positives from dark ink areas.
             *    • Solidity floor raised to 0.68 (was 0.60).
             *    • Same boundary-strip logic applied: interior-only blobs need to
             *      be >= 5% of image to be considered a certain obstruction. */
            darkMask = new cv.Mat();
            // Range 55-130: raised floor (was 40) to ignore darker document shadows
            // while still catching skin and dark plastic (pens).
            const low = new cv.Mat(H, W, cv.CV_8UC1, new cv.Scalar(55));
            const high = new cv.Mat(H, W, cv.CV_8UC1, new cv.Scalar(130));
            cv.inRange(equalized, low, high, darkMask);
            low.delete(); high.delete();

            // Gentle opening to reduce speckle without killing thin objects (pens)
            const openK = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(5, 5));
            cv.morphologyEx(darkMask, darkMask, cv.MORPH_OPEN, openK);
            openK.delete();

            // Restrict to table polygon (exact, no dilation)
            if (tableMask) {
                const maskedDark = new cv.Mat();
                cv.bitwise_and(darkMask, tableMask, maskedDark);
                darkMask.delete();
                darkMask = maskedDark;
            }

            darkCnt = new cv.MatVector(); darkHier = new cv.Mat();
            cv.findContours(darkMask, darkCnt, darkHier, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            // 4.5% floor — slightly raised (was 3.5%) to be even more conservative
            // against false positives from large dark-ink regions in the center.
            const minSkinArea = imgArea * 0.045;

            for (let i = 0; i < darkCnt.size(); i++) {
                const c = darkCnt.get(i);
                const area = cv.contourArea(c);
                if (area < minSkinArea) continue;

                const r = cv.boundingRect(c);
                const aspect = Math.max(r.width / r.height, r.height / r.width);

                // Reject very thin shapes (shadow lines) AND very flat shapes
                // (text rows that survived — similar to Stage 3 aspect guard).
                if (aspect > 5.0) continue;

                const hull = new cv.Mat();
                cv.convexHull(c, hull);
                const hullArea = cv.contourArea(hull);
                hull.delete();
                const solidity = hullArea > 0 ? area / hullArea : 0;
                // Raised floor to 0.80 (was 0.68) — real objects are highly solid.
                // Shadows are often feathery/irregular and will fail this.
                if (solidity < 0.80) continue;

                // Apply boundary-strip check for Stage 4 as well
                if (boundaryStripMask) {
                    const bx = Math.max(0, r.x);
                    const by = Math.max(0, r.y);
                    const bw = Math.min(r.width, W - bx);
                    const bh = Math.min(r.height, H - by);

                    if (bw > 0 && bh > 0) {
                        const bRect = new cv.Rect(bx, by, bw, bh);
                        const stripROI = boundaryStripMask.roi(bRect);
                        const overlapPixels = cv.countNonZero(stripROI);
                        stripROI.delete();

                        const overlapFrac = overlapPixels / (bw * bh);
                        // Interior blob must be very large (≥8%) to be rejected
                        // without touching the boundary strip.
                        const isHugeInteriorBlob = area > imgArea * 0.08;

                        if (overlapFrac < CONFIG.BOUNDARY_OVERLAP_FRACTION && !isHugeInteriorBlob) {
                            console.log(`[Obstruction] Stage4 dark blob inside interior — skipped ` +
                                `(overlap=${(overlapFrac * 100).toFixed(1)}% area=${(area / imgArea * 100).toFixed(1)}%)`);
                            continue;
                        }
                    }
                }

                hasObstruction = true;
                console.log(`[Obstruction] HAND/SKIN/OBJECT (Stage4): ${(area / imgArea * 100).toFixed(1)}% ` +
                    `w=${r.width} h=${r.height} solidity=${solidity.toFixed(2)}`);
                break;
            }
        }

        return { hasObstruction };

    } catch (e) {
        console.error('[Obstruction] Pipeline error:', e);
        return { hasObstruction: false };
    } finally {
        release(gray, equalized, thresh, hLines, vLines, gridMask, afterGrid,
            afterText, contours, hierarchy, darkMask, darkCnt, darkHier,
            tableMask, boundaryStripMask, interiorMask);
    }
}

/* ═══ Shadow detection (NEW) ════════════════════════════════
 *
 *  Detects whether the table area in the photo is affected by a shadow cast
 *  by a hand, arm, uneven ceiling light, etc.
 *
 *  Strategy:
 *   1. Build a polygon ROI mask from the table corners.
 *   2. Convert to greyscale and apply a LARGE Gaussian blur.
 *      • The blur kernel (~8 % of image dimension, min 31 px) averages out
 *        individual text characters and grid lines (which are ≤ 3 % of width)
 *        while preserving the smooth brightness gradient of a real shadow.
 *   3. 5×5 patch grid analysis on the blurred image:
 *        • Measures minBrightness, maxBrightness, and range across the ROI.
 *        • Uniformly grey or coloured paper has a small range (< 40) and is
 *          NEVER flagged as a shadow regardless of absolute brightness.
 *   4. Count dark-pixel fraction within the ROI
 *      (pixels below SHADOW_DARK_THRESHOLD = 115).
 *   5. CLAHE recovery test: apply CLAHE (clip 4.0, 8×8 grid) and re-measure.
 *        • Light / correctable shadow:  CLAHE recovers ≥ 50 % of dark pixels
 *          → image is accepted (shadow is fixable in post-processing).
 *        • Heavy / irrecoverable shadow: CLAHE recovers < 50 %  AND
 *          dark fraction > 22 %  AND  brightness range > 50
 *          → image is rejected.
 *
 *  Clean, well-lit documents almost always have:
 *    darkFraction < 0.15  OR  brightnessRange < 40
 *  and therefore exit the function immediately as hasShadow: false.
 */
function detectShadow(cv, src, corners) {
    if (!corners || corners.length !== 4) {
        return { hasShadow: false, isHeavy: false };
    }

    const release = (...mats) => mats.forEach(m => { if (m) try { m.delete(); } catch (_) { } });
    let roiMask, gray, blurred, grayClhe, blurredClahe;

    try {
        const H = src.rows, W = src.cols;

        /* ── Step 1: Build polygon mask ─────────────────────────── */
        roiMask = new cv.Mat.zeros(H, W, cv.CV_8UC1);
        const cPts = cv.matFromArray(4, 1, cv.CV_32SC2,
            corners.flatMap(c => [Math.round(c.x), Math.round(c.y)]));
        const cVec = new cv.MatVector();
        cVec.push_back(cPts);
        cv.fillPoly(roiMask, cVec, new cv.Scalar(255));
        cVec.delete(); cPts.delete();

        const roiPixelCount = cv.countNonZero(roiMask);
        if (roiPixelCount < 5000) {
            // ROI too small to be meaningful — skip
            return { hasShadow: false, isHeavy: false };
        }

        /* ── Step 2: Greyscale + large Gaussian blur ─────────────── */
        gray = new cv.Mat();
        cv.cvtColor(src, gray, src.channels() === 4 ? cv.COLOR_RGBA2GRAY : cv.COLOR_BGR2GRAY);

        // Kernel size: ~8 % of shorter dimension, forced odd, minimum 31 px
        let kSize = Math.max(31, Math.round(Math.min(W, H) * 0.08));
        if (kSize % 2 === 0) kSize++;

        blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(kSize, kSize), 0);

        /* ── Step 3: 5×5 patch brightness analysis ──────────────── */
        const PATCH_ROWS = 5, PATCH_COLS = 5;
        const pH = Math.floor(H / PATCH_ROWS);
        const pW = Math.floor(W / PATCH_COLS);
        const patchMeans = [];

        for (let r = 0; r < PATCH_ROWS; r++) {
            for (let c = 0; c < PATCH_COLS; c++) {
                const px = c * pW, py = r * pH;
                const pww = Math.min(pW, W - px);
                const phh = Math.min(pH, H - py);
                if (pww < 10 || phh < 10) continue;

                const pRect = new cv.Rect(px, py, pww, phh);
                const patch = blurred.roi(pRect);
                const maskPatch = roiMask.roi(pRect);
                const cnt = cv.countNonZero(maskPatch);

                if (cnt > 50) {
                    const mean = new cv.Mat(), std = new cv.Mat();
                    cv.meanStdDev(patch, mean, std, maskPatch);
                    patchMeans.push(mean.doubleAt(0, 0));
                    mean.delete(); std.delete();
                }
                patch.delete(); maskPatch.delete();
            }
        }

        // Need enough valid patches for a reliable estimate
        if (patchMeans.length < 5) {
            return { hasShadow: false, isHeavy: false };
        }

        const minBrightness = Math.min(...patchMeans);
        const maxBrightness = Math.max(...patchMeans);
        const brightnessRange = maxBrightness - minBrightness;

        console.log(`[ShadowDetect] patch brightness — min:${minBrightness.toFixed(0)} ` +
            `max:${maxBrightness.toFixed(0)} range:${brightnessRange.toFixed(0)}`);

        /* ── Step 4: Dark-pixel fraction within ROI ─────────────── */
        const darkMaskPre = new cv.Mat();
        cv.threshold(blurred, darkMaskPre, CONFIG.SHADOW_DARK_THRESHOLD, 255, cv.THRESH_BINARY_INV);

        const darkInROI = new cv.Mat();
        cv.bitwise_and(darkMaskPre, roiMask, darkInROI);
        const darkCount = cv.countNonZero(darkInROI);
        const darkFraction = darkCount / roiPixelCount;
        darkMaskPre.delete(); darkInROI.delete();

        console.log(`[ShadowDetect] dark fraction (pre-CLAHE): ${(darkFraction * 100).toFixed(1)}%`);

        // ── Early-exit guards: clean and uniform-paper images leave here ──
        // Guard A: not enough dark area to be a shadow
        if (darkFraction < CONFIG.SHADOW_DARK_FRACTION_CONSIDER) {
            return { hasShadow: false, isHeavy: false };
        }
        // Guard B: brightness variation is too small → uniformly grey/coloured paper,
        //          NOT a localised shadow (e.g. cream-coloured form on warm light)
        if (brightnessRange < CONFIG.SHADOW_BRIGHTNESS_RANGE_CONSIDER) {
            return { hasShadow: false, isHeavy: false };
        }

        /* ── Step 5: CLAHE recovery test ─────────────────────────── */
        grayClhe = new cv.Mat();
        const clahe = new cv.CLAHE(4.0, new cv.Size(8, 8));
        clahe.apply(gray, grayClhe);
        clahe.delete();

        blurredClahe = new cv.Mat();
        cv.GaussianBlur(grayClhe, blurredClahe, new cv.Size(kSize, kSize), 0);

        const darkMaskPost = new cv.Mat();
        cv.threshold(blurredClahe, darkMaskPost, CONFIG.SHADOW_DARK_THRESHOLD, 255, cv.THRESH_BINARY_INV);
        const darkInROIPost = new cv.Mat();
        cv.bitwise_and(darkMaskPost, roiMask, darkInROIPost);
        const darkFractionPost = cv.countNonZero(darkInROIPost) / roiPixelCount;
        darkMaskPost.delete(); darkInROIPost.delete();

        const recovery = darkFraction > 0
            ? (darkFraction - darkFractionPost) / darkFraction
            : 1.0;

        console.log(`[ShadowDetect] dark fraction (post-CLAHE): ${(darkFractionPost * 100).toFixed(1)}% ` +
            `| recovery: ${(recovery * 100).toFixed(1)}%`);

        /* ── Step 6: Classify ────────────────────────────────────── */
        //  Heavy shadow: large dark area  +  significant spatial contrast
        //                +  CLAHE cannot recover it
        const isHeavy = darkFraction > CONFIG.SHADOW_DARK_FRACTION_HEAVY &&
            brightnessRange > CONFIG.SHADOW_BRIGHTNESS_RANGE_HEAVY &&
            recovery < CONFIG.SHADOW_CLAHE_RECOVERY_HEAVY;

        // Notable but not blocking shadow (will show as a warning, not an error)
        const hasShadow = darkFraction > CONFIG.SHADOW_DARK_FRACTION_CONSIDER &&
            brightnessRange > CONFIG.SHADOW_BRIGHTNESS_RANGE_CONSIDER;

        if (isHeavy) {
            console.log(`[ShadowDetect] HEAVY SHADOW — dark:${(darkFraction * 100).toFixed(0)}% ` +
                `range:${brightnessRange.toFixed(0)} recovery:${(recovery * 100).toFixed(0)}%`);
        } else if (hasShadow) {
            console.log(`[ShadowDetect] Light / correctable shadow — accepted.`);
        }

        return {
            hasShadow,
            isHeavy,
            darkFraction: Math.round(darkFraction * 100),
            recovery: Math.round(recovery * 100),
            brightnessRange: Math.round(brightnessRange),
        };

    } catch (e) {
        console.error('[ShadowDetect] Pipeline error:', e);
        return { hasShadow: false, isHeavy: false }; // safe: never block on error
    } finally {
        release(roiMask, gray, blurred, grayClhe, blurredClahe);
    }
}

/* ═══ Structural validation ═════════════════════════════════ */
function validateStructure(cv, src) {
    const reasons = [];
    const warnings = [];
    const metrics = {};
    const mats = [];

    try {
        const gray = new cv.Mat(); mats.push(gray);
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const blurred = new cv.Mat(); mats.push(blurred);
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        const edges = new cv.Mat(); mats.push(edges);
        cv.Canny(blurred, edges, 30, 100);

        const dk = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15)); mats.push(dk);
        const dilated = new cv.Mat(); mats.push(dilated);
        cv.dilate(edges, dilated, dk);

        const imgArea = src.rows * src.cols;
        let bestContour = null, bestArea = 0;
        let fallbackLargestC = null, fallbackLargestArea = 0;

        const EPSILONS = [0.02, 0.03, 0.04, 0.05, 0.06];

        const allContours = new cv.MatVector();
        const hierarchyAll = new cv.Mat();
        cv.findContours(dilated, allContours, hierarchyAll, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
        hierarchyAll.delete();

        for (let i = 0; i < allContours.size(); i++) {
            const c = allContours.get(i);
            const area = cv.contourArea(c);
            const ratio = area / imgArea;
            if (ratio < CONFIG.MIN_TABLE_AREA_RATIO || ratio > CONFIG.MAX_TABLE_AREA_RATIO) continue;

            if (area > fallbackLargestArea) {
                fallbackLargestArea = area;
                if (fallbackLargestC) fallbackLargestC.delete();
                fallbackLargestC = c.clone();
            }

            if (bestContour) continue;
            const peri = cv.arcLength(c, true);
            for (const eps of EPSILONS) {
                const approx = new cv.Mat();
                cv.approxPolyDP(c, approx, eps * peri, true);
                if (approx.rows === 4 && cv.isContourConvex(approx) && area > bestArea) {
                    if (bestContour) bestContour.delete();
                    bestContour = approx; bestArea = area;
                    console.log(`[GalleryValidator] 4-corner poly at epsilon=${eps}, ` +
                        `area=${(ratio * 100).toFixed(1)}%`);
                    break;
                }
                approx.delete();
            }
        }
        allContours.delete();

        let corners = null;

        if (bestContour) {
            corners = [];
            for (let i = 0; i < 4; i++) {
                corners.push({ x: bestContour.intAt(i, 0), y: bestContour.intAt(i, 1) });
            }
            bestContour.delete();
            metrics.tableAreaRatio = Math.round((bestArea / imgArea) * 100) / 100;
        } else if (fallbackLargestC) {
            console.log('[GalleryValidator] Using bounding-rect fallback');
            const rect = cv.boundingRect(fallbackLargestC);
            corners = [
                { x: rect.x, y: rect.y },
                { x: rect.x + rect.width, y: rect.y },
                { x: rect.x + rect.width, y: rect.y + rect.height },
                { x: rect.x, y: rect.y + rect.height },
            ];
            metrics.tableAreaRatio = Math.round((fallbackLargestArea / imgArea) * 100) / 100;
            metrics.usedBoundingRectFallback = true;
            warnings.push('Boundary approximated from bounding rectangle (photo slightly skewed)');
        } else {
            if (fallbackLargestC) fallbackLargestC.delete();
            reasons.push("No rectangular table boundary detected");
            return { isValid: false, reasons, metrics, corners: null };
        }

        if (fallbackLargestC) fallbackLargestC.delete();

        // Outward padding
        // Outward padding (Consistent 5% expansion)
        const cx = corners.reduce((s, p) => s + p.x, 0) / corners.length;
        const cy = corners.reduce((s, p) => s + p.y, 0) / corners.length;
        const PAD_RATIO = 0.05; 
        const paddedCorners = corners.map(p => ({
            x: Math.max(0, Math.min(src.cols - 1, p.x + (p.x - cx) * PAD_RATIO)),
            y: Math.max(0, Math.min(src.rows - 1, p.y + (p.y - cy) * PAD_RATIO)),
        }));

        const ordered = orderCorners(paddedCorners);

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
        cv.HoughLinesP(masked, lines,
            CONFIG.HOUGH_RHO, CONFIG.HOUGH_THETA, CONFIG.HOUGH_THRESHOLD,
            CONFIG.HOUGH_MIN_LINE_LENGTH, CONFIG.HOUGH_MAX_LINE_GAP);

        if (lines.rows === 0) {
            reasons.push("No grid lines detected in document");
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

        const rowCenters = getClusterCenters(hLines.map(l => (l.y1 + l.y2) / 2), CONFIG.LINE_CLUSTER_GAP);
        const colCenters = getClusterCenters(vLines.map(l => (l.x1 + l.x2) / 2), CONFIG.LINE_CLUSTER_GAP);
        metrics.tableRows = rowCenters.length;
        metrics.tableCols = colCenters.length;

        if (hLines.length < CONFIG.MIN_HORIZONTAL_LINES || vLines.length < CONFIG.MIN_VERTICAL_LINES) {
            if (hLines.length === 0 && vLines.length === 0) {
                reasons.push('No table grid lines detected in document');
            } else {
                warnings.push(`Faint table detected (h=${hLines.length}, v=${vLines.length}) — accepted`);
            }
        }

        const tblW = Math.max(dist(ordered[0], ordered[1]), dist(ordered[3], ordered[2]));
        const tblH = Math.max(dist(ordered[0], ordered[3]), dist(ordered[1], ordered[2]));

        if (hLines.length >= 2) {
            const ys = hLines.map(l => (l.y1 + l.y2) / 2);
            const cov = (Math.max(...ys) - Math.min(...ys)) / tblH;
            metrics.hCoverage = Math.round(cov * 100) / 100;
            if (cov < CONFIG.MIN_GRID_COVERAGE)
                warnings.push(`Low horizontal coverage (${Math.round(cov * 100)}%) — accepted with caution`);
        }
        if (vLines.length >= 2) {
            const xs = vLines.map(l => (l.x1 + l.x2) / 2);
            const cov = (Math.max(...xs) - Math.min(...xs)) / tblW;
            metrics.vCoverage = Math.round(cov * 100) / 100;
            if (cov < CONFIG.MIN_GRID_COVERAGE)
                warnings.push(`Low vertical coverage (${Math.round(cov * 100)}%) — accepted with caution`);
        }

        if (hLines.length > 0) {
            const angles = hLines.map(l => Math.atan2(l.y2 - l.y1, l.x2 - l.x1) * (180 / Math.PI));
            const med = [...angles].sort((a, b) => a - b)[Math.floor(angles.length / 2)];
            metrics.skewAngle = Math.round(Math.abs(med) * 100) / 100;
            if (Math.abs(med) > CONFIG.MAX_SKEW_DEGREES)
                reasons.push(`Excessive skew (${metrics.skewAngle}°) — please retake the photo more squarely`);
        }

        console.log("[GalleryValidator] Reasons:", reasons, "| Warnings:", warnings, "| Metrics:", metrics);

        return { isValid: reasons.length === 0, reasons, warnings, metrics, corners: ordered };

    } finally {
        releaseMats(...mats);
    }
}

/* ═══ Helpers ════════════════════════════════════════════════ */
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

function getClusterCenters(positions, gap = 15) {
    if (positions.length === 0) return [];
    const sorted = [...positions].sort((a, b) => a - b);
    const centers = [];
    let clusterSum = sorted[0], clusterCount = 1;
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] - sorted[i - 1] > gap) {
            centers.push(clusterSum / clusterCount);
            clusterSum = sorted[i]; clusterCount = 1;
        } else { clusterSum += sorted[i]; clusterCount++; }
    }
    centers.push(clusterSum / clusterCount);
    return centers;
}

/* ═══════════════════════════════════════════════
   AUTO CROP + PERSPECTIVE CORRECTION (STABLE)
═══════════════════════════════════════════════ */
function autoCropDocument(cv, src, corners) {

    const ordered = orderCorners(corners);

    const widthTop = Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y);
    const widthBottom = Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y);
    const heightLeft = Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y);
    const heightRight = Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y);

    const maxWidth = Math.max(widthTop, widthBottom);
    const maxHeight = Math.max(heightLeft, heightRight);

    const expandTop = maxHeight * 0.02;
    const expandSide = maxWidth * 0.02;
    const expandBottom = maxHeight * 0.02;

    const expanded = [
        { x: ordered[0].x - expandSide, y: ordered[0].y - expandTop },
        { x: ordered[1].x + expandSide, y: ordered[1].y - expandTop },
        { x: ordered[2].x + expandSide, y: ordered[2].y + expandBottom },
        { x: ordered[3].x - expandSide, y: ordered[3].y + expandBottom },
    ];

    expanded.forEach(p => {
        p.x = Math.max(0, Math.min(src.cols - 1, p.x));
        p.y = Math.max(0, Math.min(src.rows - 1, p.y));
    });

    const finalWidth = Math.round(Math.max(
        Math.hypot(expanded[1].x - expanded[0].x, expanded[1].y - expanded[0].y),
        Math.hypot(expanded[2].x - expanded[3].x, expanded[2].y - expanded[3].y)
    ));

    const finalHeight = Math.round(Math.max(
        Math.hypot(expanded[3].x - expanded[0].x, expanded[3].y - expanded[0].y),
        Math.hypot(expanded[2].x - expanded[1].x, expanded[2].y - expanded[1].y)
    ));

    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        expanded[0].x, expanded[0].y,
        expanded[1].x, expanded[1].y,
        expanded[2].x, expanded[2].y,
        expanded[3].x, expanded[3].y,
    ]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0, 0, finalWidth, 0, finalWidth, finalHeight, 0, finalHeight,
    ]);

    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    const warped = new cv.Mat();
    cv.warpPerspective(src, warped, M, new cv.Size(finalWidth, finalHeight),
        cv.INTER_LINEAR, cv.BORDER_REPLICATE);

    srcPts.delete(); dstPts.delete(); M.delete();
    return warped;
}

/* ═════════════════════════════════════════════════════════
   MAIN VALIDATION ENTRY POINT
   Pipeline order (v2.0):
     1. Blur check           — full image, no corners required
     2. Structure detection  — finds table corners
     3. Obstruction check    — restricted to table polygon (corners)
     4. Shadow check         — restricted to table polygon (corners)
     5. Auto crop
═════════════════════════════════════════════════════════ */
export async function validateGalleryImage(file) {

    const isMobile =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
        window.innerWidth < 1024;

    if (!isMobile) {
        console.log("[GalleryValidator] Desktop detected: skipping validation");
        return { isValid: true, message: "Image accepted (desktop)", canvas: null };
    }

    if (!cvReady()) {
        return { isValid: false, message: "OpenCV not loaded. Refresh page." };
    }

    /* ── Read file ─────────────────────────────────────────── */
    let dataURL;
    try {
        dataURL = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    } catch {
        return { isValid: false, message: "Cannot read file." };
    }

    /* ── Load image ────────────────────────────────────────── */
    const img = new Image();
    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataURL;
    });

    const scale = Math.min(1, CONFIG.OUTPUT_MAX_DIM / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

    let src = cv.imread(canvas);

    /* ────────────────────────────────────────────────────────
     *  STEP 1 — Blur check
     *  Fast full-image check; no corners needed.
     * ────────────────────────────────────────────────────────*/
    const blur = detectBlur(cv, src);
    if (blur.isBlurry) {
        src.delete();
        return { isValid: false, message: blur.reason };
    }

    /* ────────────────────────────────────────────────────────
     *  STEP 2 — Structure detection → acquires table corners
     *  Must run BEFORE obstruction / shadow so we have the
     *  boundary polygon to constrain those checks.
     * ────────────────────────────────────────────────────────*/
    const struct = validateStructure(cv, src);
    if (!struct.isValid) {
        src.delete();
        return {
            isValid: false,
            message: struct.reasons[0] || "Document structure not detected.",
        };
    }

    /* ────────────────────────────────────────────────────────
     *  STEP 3 — Obstruction check (within table boundary)
     *  Passing `struct.corners` restricts blob analysis to
     *  INSIDE the table polygon — objects at the frame edges
     *  (phone bezel shadow, hand gripping the device, desk
     *  items visible around the document) are ignored.
     * ────────────────────────────────────────────────────────*/
    const obstruction = detectObstructions(cv, src, struct.corners);
    if (obstruction.hasObstruction) {
        src.delete();
        return {
            isValid: false,
            message: "Object or Shadow detected on the document. Please try again.",
        };
    }

    /* ────────────────────────────────────────────────────────
     *  STEP 4 — Shadow check (within table boundary)
     *  Light / correctable shadows are accepted automatically.
     *  Only heavy shadows that CLAHE cannot recover are rejected.
     * ────────────────────────────────────────────────────────*/
    const shadow = detectShadow(cv, src, struct.corners);
    if (shadow.isHeavy) {
        src.delete();
        return {
            isValid: false,
            message: "Heavy shadow detected on the document. " +
                "Move to even lighting or reduce glare and try again.",
        };
    }

    src.delete();

    /* ── Build success message ────────────────────────────── */
    let message = "Image accepted";
    if (struct.warnings?.length) {
        message = `Image accepted (${struct.warnings[0]})`;
    } else if (shadow.hasShadow) {
        message = "Image accepted (minor shadow detected — will be corrected automatically)";
    }

    return {
        isValid: true,
        message,
        fullCanvas: canvas,            // scaled but un-cropped original
        canvas: canvas,                // for backward compatibility
        corners: struct.corners,
        metrics: struct.metrics,
        warnings: [
            ...(struct.warnings ?? []),
            ...(shadow.hasShadow && !shadow.isHeavy
                ? [`Shadow detected (${shadow.darkFraction}% dark area, ${shadow.recovery}% CLAHE recovery)`]
                : []),
        ],
    };
}