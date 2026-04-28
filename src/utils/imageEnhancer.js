/**
 * imageEnhancer.js — DOCUMENT ENHANCEMENT v13 (modified)
 *
 * PROBLEM FIXED:
 *   Original v13 burned a flat BURN_STRENGTH value (60) onto every detected
 *   ink pixel. This erased real pixel variation — faint digits and thin
 *   strokes that were slightly lighter than their neighbours got stamped
 *   with the same flat grey as bold text, losing their actual tone.
 *   Even worse, ink pixels NOT detected by adaptiveThreshold were left
 *   as pure white on the canvas → complete erasure of those marks.
 *
 * SOLUTION — soft blend instead of hard burn:
 *   Instead of: result[i] = BURN_STRENGTH  (if mask says ink)
 *   We now do:  result[i] = divided[i] × BLEND_ALPHA + result[i] × (1 − BLEND_ALPHA)
 *
 *   This means:
 *   • Every pixel from the divided (whitened) image is kept at its real tone.
 *   • The white canvas is blended with the divided image at BLEND_ALPHA strength.
 *   • Ink pixels naturally appear darker because the divided image has them darker.
 *   • No pixel is ever forced to a flat value → zero erasure.
 *
 *   The mask now controls WHERE the blend is applied (ink regions get full
 *   BLEND_ALPHA strength; paper regions stay white canvas) rather than
 *   WHAT VALUE gets written.
 *
 * Full pipeline — all steps identical to v13 except Step 9 and new Step 10:
 * Step 1  — Grayscale
 * Step 2  — Background model (downscale → dilate → upscale)
 * Step 3  — Divide: flatten illumination gradient  ← kept as reference for blend
 * Step 4  — Normalize + clamp: clean white canvas  ← base layer
 * Step 5  — Gaussian blur on original gray
 * Step 6  — Adaptive threshold → raw ink mask
 * Step 7  — Morphological opening (OPEN_KSIZE=1, no-op)
 * Step 8  — Connected component filtering (MIN_BLOB_AREA=4)
 * Step 9  — SOFT BLEND: mix divided tones into white canvas using mask ← CHANGED
 * Step 10 — UNSHARP MASK: sharpen edges to restore crispness lost by blur/blend ← NEW
 */

const cvReady = () => !!(window.cv && window.cv.Mat);

/* ── Tuning knobs ────────────────────────────────────────────────────────────
 *
 * ADAPTIVE_BLOCK_SIZE (odd integer ≥ 3)
 *   Neighbourhood size for local mean threshold. Default: 11.
 *
 * ADAPTIVE_C
 *   Subtracted from local mean. Lower = more sensitive, catches faint ink.
 *   Default: 4.
 *
 * BLUR_KSIZE (odd integer ≥ 1)
 *   Gaussian kernel for pre-blur. Default: 3.
 *
 * OPEN_KSIZE
 *   1 = no-op (safe — no stroke erosion). Default: 1.
 *
 * MIN_BLOB_AREA (pixels)
 *   Delete specks smaller than this. Default: 4 (only 1–2px specks removed).
 *
 * BLEND_ALPHA (0.0 – 1.0)   ← replaces BURN_STRENGTH
 *   Controls how strongly the original divided tones are blended in.
 *   result = divided × BLEND_ALPHA + white_canvas × (1 − BLEND_ALPHA)
 *
 *   0.0  = pure white canvas, no ink visible at all
 *   0.3  = very faint — subtle ink, light appearance
 *   0.5  = medium — natural document look  ← recommended start
 *   0.7  = stronger — darker ink, more contrast
 *   1.0  = full divided image tones (same as just whitening, no extra darkening)
 *
 *   Want lighter text/lines? → lower BLEND_ALPHA (e.g. 0.3–0.4)
 *   Want darker text/lines? → raise BLEND_ALPHA (e.g. 0.7–0.9)
 *
 * INK_DARKEN (0.0 – 1.0)
 *   Extra darkening multiplier applied ONLY on ink-detected pixels.
 *   final_ink = divided[i] × INK_DARKEN
 *   1.0 = no extra darkening (use divided value as-is)
 *   0.7 = ink pixels darkened to 70% of their divided value
 *   0.5 = ink pixels darkened to 50% — bold, clear lines
 *
 *   This lets you darken ink further without touching paper pixels at all.
 *   Want even darker lines/text? → lower INK_DARKEN (e.g. 0.5)
 *   Want lighter? → raise towards 1.0
 *
 * SHARPEN_AMOUNT (0.0 – 3.0+)   ← NEW for Step 10
 *   Strength of unsharp mask. Controls how much edge detail is added back.
 *   sharpened = result + SHARPEN_AMOUNT × (result − blurred_result)
 *
 *   0.0  = no sharpening (Step 10 is effectively skipped)
 *   0.5  = subtle crispness — good for already-sharp captures
 *   1.0  = standard sharpening — recommended default
 *   1.5  = strong — good for slightly soft/zoomed images
 *   2.0+ = aggressive — watch for halo artefacts around strokes
 *
 *   Blurry at zoom? → raise SHARPEN_AMOUNT (e.g. 1.5–2.0)
 *   Halo/ringing artefacts appearing? → lower SHARPEN_AMOUNT or raise SHARPEN_BLUR_KSIZE
 *
 * SHARPEN_BLUR_KSIZE (odd integer ≥ 3)   ← NEW for Step 10
 *   Gaussian kernel used internally by the unsharp mask.
 *   Larger = broader halo radius but smoother edge response.
 *   Smaller = tighter, more local sharpening.
 *   Recommended: 3 for text, 5 for fine lines or noisy sources.
 *
 * ─────────────────────────────────────────────────────────────────────────── */
const ADAPTIVE_C = 5; // Reduced from 8 to 5 to catch faint table lines (default was 4)
const BLUR_KSIZE = 3;
const OPEN_KSIZE = 1; // RESET TO 1 TO PREVENT ERASURE OF THIN LINES

/* Note: These are now used as base values or defaults,
 * but are overridden by dynamic calculations inside enhanceImage. */
const BLEND_ALPHA = 0.8;    // Balanced
const INK_DARKEN = 0.5;      // Slightly bolder

export const enhanceImage = async (
    canvas,
    onProgress = () => { },
    source = 'camera'
) => {
    if (!cvReady()) {
        console.warn('[Enhance] OpenCV not ready — returning original.');
        return canvas;
    }

    const tick = () => new Promise(r => setTimeout(r, 0));
    const safe = m => { try { if (m && !m.isDeleted()) m.delete(); } catch { } };

    let src = null;
    let gray = null;
    let small = null;
    let dilated = null;
    let bg = null;
    let divided = null;
    let result = null;
    let blurred = null;
    let mask = null;
    let opened = null;
    let labels = null;
    let stats = null;
    let centroids = null;
    let blurForSharp = null; // NEW — used in Step 10

    try {
        onProgress('Reading image…');
        await tick();
        src = cv.imread(canvas);

        /* ── STEP 1 : GRAYSCALE ─────────────────────────────── */
        onProgress('Converting to grayscale…');
        await tick();
        gray = new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const H = gray.rows;
        const W = gray.cols;
        const minDim = Math.min(H, W);

        /* ── DYNAMIC PARAMETERS ───────────────────────────────
         * Scale kernels and thresholds based on resolution.
         */
        const dynAdaptiveSize = Math.max(3, Math.floor(minDim / 100) * 2 + 1);
        // Conservative blob filtering: small enough to preserve text/dots on i's, but removes tiny 1px sensor noise
        const dynMinBlobArea = Math.max(5, Math.round((W * H) / 250000));
        const dynSharpenAmount = 1.6; // High crispness without artifacts
        const dynSharpenBlur = Math.max(3, Math.floor(minDim / 400) * 2 + 1);
        const SHARPEN_THRESHOLD = 2; // Capture even fine detail

        /* ── STEP 2 : BACKGROUND MODEL ──────────────────────────
         * Downscale → dilate → upscale.
         * Produces smooth illumination map with no ink detail.
         */
        onProgress('Building background model…');
        await tick();

        const scale = Math.min(1.0, 300 / minDim);
        const sW = Math.max(1, Math.round(W * scale));
        const sH = Math.max(1, Math.round(H * scale));

        small = new cv.Mat();
        cv.resize(gray, small, new cv.Size(sW, sH), 0, 0, cv.INTER_AREA);

        // Scaled dilation kernel: larger for higher resolution/shadows
        const dilateSize = Math.max(21, Math.round(30 * scale * (minDim / 1000)));
        const kSize = Math.max(5, Math.min(41, dilateSize % 2 === 0 ? dilateSize + 1 : dilateSize));

        const k = cv.getStructuringElement(cv.MORPH_ELLIPSE, new cv.Size(kSize, kSize));
        dilated = new cv.Mat();
        cv.dilate(small, dilated, k);
        k.delete();

        bg = new cv.Mat();
        cv.resize(dilated, bg, new cv.Size(W, H), 0, 0, cv.INTER_LINEAR);

        /* ── STEP 3 : DIVIDE ────────────────────────────────────
         * output = (gray / background) × 255
         * Flattens illumination. Paper → near-white. Ink → relatively darker.
         */
        onProgress('Whitening paper…');
        await tick();
        divided = new cv.Mat();
        cv.divide(gray, bg, divided, 255, -1);

        /* ── STEP 4 : WHITE POINT STRETCHING ──────────────────
         * Aggressively punch through "oily stains" and shadows.
         * Maps [0, WHITE_POINT] to [0, 255], effectively clipping
         * everything above WHITE_POINT to pure white.
         */
        onProgress('Stretching highlights…');
        await tick();
        result = new cv.Mat();
        const WHITE_POINT = 225; // Safer whitening point (less erasure)

        // Manual stretch: output = input * (255 / WHITE_POINT)
        divided.convertTo(result, cv.CV_8U, 255 / WHITE_POINT, 0);

        /* Pre-clean divided image for Step 9 blend */
        cv.normalize(divided, divided, 0, 255, cv.NORM_MINMAX, cv.CV_8U);
        const divData = divided.data;
        for (let i = 0; i < divData.length; i++) {
            if (divData[i] > 220) {
                // Only push very light pixels to pure white (prevents erasing faint lines that are ~180-200)
                divData[i] = Math.min(255, divData[i] + (255 - divData[i]) * 0.8);
            }
        }

        /* ── STEP 5 : NOISE REMOVAL ──────────────────────────────────
         * Median blur on original gray before adaptive threshold.
         * Specifically targets "salt and pepper" noise (dots) while
         * preserving sharp text edges much better than Gaussian blur.
         */
        onProgress('Removing sensor noise…');
        await tick();
        blurred = new cv.Mat();
        cv.medianBlur(gray, blurred, 3);

        /* ── STEP 6 : ADAPTIVE THRESHOLD → RAW INK MASK ─────────
         * Detects ink pixels locally. Output: 255 = ink, 0 = paper.
         * The mask now guides WHERE blending happens, not WHAT value is written.
         */
        onProgress('Detecting ink and lines…');
        await tick();
        mask = new cv.Mat();
        cv.adaptiveThreshold(
            blurred,
            mask,
            255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY_INV,
            dynAdaptiveSize,
            ADAPTIVE_C
        );

        /* ── STEP 7 : MORPHOLOGICAL OPENING ─────────────────────
         * OPEN_KSIZE=1 → 1×1 kernel → no-op. Zero stroke erosion.
         */
        onProgress('Cleaning mask…');
        await tick();
        const openKernel = cv.getStructuringElement(
            cv.MORPH_RECT,
            new cv.Size(OPEN_KSIZE, OPEN_KSIZE)
        );
        opened = new cv.Mat();
        cv.morphologyEx(mask, opened, cv.MORPH_OPEN, openKernel);
        openKernel.delete();

        /* ── STEP 8 : CONNECTED COMPONENT FILTERING ─────────────
         * Delete blobs with area < MIN_BLOB_AREA=4.
         * Removes only genuine 1–2px specks. All real ink marks survive.
         */
        onProgress('Filtering noise blobs…');
        await tick();

        labels = new cv.Mat();
        stats = new cv.Mat();
        centroids = new cv.Mat();

        const numLabels = cv.connectedComponentsWithStats(
            opened, labels, stats, centroids, 8, cv.CV_32S
        );

        const keepLabel = new Uint8Array(numLabels);
        keepLabel[0] = 0;
        for (let lbl = 1; lbl < numLabels; lbl++) {
            const area = stats.intAt(lbl, cv.CC_STAT_AREA);
            keepLabel[lbl] = area >= dynMinBlobArea ? 1 : 0;
        }

        const labelData = labels.data32S;
        const openedData = opened.data;
        const totalPx = labelData.length;
        for (let i = 0; i < totalPx; i++) {
            if (!keepLabel[labelData[i]]) {
                openedData[i] = 0;
            }
        }

        /* ── STEP 9 : SOFT BLEND ────────────────────────────────
         *
         * OLD (v13): result[i] = BURN_STRENGTH  (flat 60 for all ink)
         *   Problem: faint ink and bold ink both got the same flat value.
         *            ink pixels missed by the mask were left as pure white.
         *
         * NEW: blend divided image tones into the white canvas.
         *
         * For ink-detected pixels (mask = 255):
         *   tone     = divided[i] × INK_DARKEN          ← real pixel value, darkened
         *   result[i] = tone × BLEND_ALPHA + result[i] × (1 − BLEND_ALPHA)
         *
         *   Effect: the actual luminance of each ink pixel is preserved.
         *   A faint digit at divided=180 stays lighter than bold text at divided=60.
         *   Nothing is erased — pixels are only shifted darker, never to white.
         *
         * For paper pixels (mask = 0):
         *   result[i] unchanged (stays white canvas value ≈ 255)
         *
         * WHY this prevents erasure:
         *   Even if the mask MISSES a faint ink pixel (classifies it as paper),
         *   the pixel still holds its value from the white canvas (Step 4) which
         *   already contains the divided image — it just won't get the extra
         *   INK_DARKEN boost. It remains visible as a slightly lighter stroke
         *   rather than disappearing entirely.
         *
         * TUNING:
         *   Lighter result → lower BLEND_ALPHA or raise INK_DARKEN toward 1.0
         *   Darker result  → raise BLEND_ALPHA or lower INK_DARKEN toward 0.5
         */
        onProgress('Blending ink tones…');
        await tick();

        const resultData = result.data;
        const dividedData = divided.data;
        const finalMask = opened.data;
        const len = resultData.length;

        for (let i = 0; i < len; i++) {
            if (finalMask[i] === 255) {
                const baseVal = dividedData[i];
                
                // Only apply strong darkening to actual dark ink.
                // Prevents faint false-positive background dots from turning into dark grey spots.
                let effectiveDarken = INK_DARKEN;
                // Fade out darkening for very light pixels (which are likely background noise)
                // We keep lines by only fading out > 180 instead of > 150
                if (baseVal > 180) {
                    const factor = Math.min(1.0, (baseVal - 180) / 40);
                    effectiveDarken = INK_DARKEN + (1.0 - INK_DARKEN) * factor;
                }
                
                const tone = baseVal * effectiveDarken;
                resultData[i] = Math.round(
                    tone * BLEND_ALPHA + resultData[i] * (1 - BLEND_ALPHA)
                );
            }
            // Paper pixel: leave result[i] as-is (white canvas)
        }

        /* ── STEP 10 : UNSHARP MASK ─────────────────────────────
         *
         * WHY: The Gaussian pre-blur (Step 5) and soft blend (Step 9) can
         *   leave strokes slightly soft, especially visible when zooming in.
         *   Unsharp masking restores edge crispness without re-introducing noise.
         *
         * HOW: Unsharp mask formula:
         *   blurredResult  = GaussianBlur(result, SHARPEN_BLUR_KSIZE)
         *   sharpened[i]   = result[i] + SHARPEN_AMOUNT × (result[i] − blurredResult[i])
         *   final[i]       = clamp(sharpened[i], 0, 255)
         *
         *   (result − blurredResult) is the "edge detail" signal.
         *   Multiplying by SHARPEN_AMOUNT and adding it back emphasises those edges.
         *
         * PAPER SAFETY: Paper pixels are near-white (≈255). Their blurred
         *   neighbours are also ≈255. The edge signal is ≈0, so paper stays white.
         *   Sharpening only visibly affects pixels near ink/paper transitions.
         *
         * TUNING:
         *   More crispness at zoom  → raise SHARPEN_AMOUNT (e.g. 1.5 – 2.0)
         *   Halo / ringing artefact → lower SHARPEN_AMOUNT or raise SHARPEN_BLUR_KSIZE
         *   Very fine/thin strokes  → keep SHARPEN_BLUR_KSIZE at 3 (tighter kernel)
         */
        if (dynSharpenAmount > 0) {
            onProgress('Sharpening edges…');
            await tick();

            blurForSharp = new cv.Mat();
            cv.GaussianBlur(
                result,
                blurForSharp,
                new cv.Size(dynSharpenBlur, dynSharpenBlur),
                0
            );

            const blurData = blurForSharp.data;
            for (let i = 0; i < len; i++) {
                // edge detail = original − blurred
                const detail = resultData[i] - blurData[i];

                // Noise deadzone: only sharpen if detail exceeds threshold
                if (Math.abs(detail) > SHARPEN_THRESHOLD) {
                    // add scaled detail back
                    const sharpened = resultData[i] + dynSharpenAmount * detail;
                    // clamp to valid byte range
                    resultData[i] = Math.min(255, Math.max(0, Math.round(sharpened)));
                }
            }
        }

        const out = document.createElement('canvas');
        cv.imshow(out, result);

        console.log(
            `[Enhance] v14-robust ✓ Dynamic scaling + aggressive whitening | ` +
            `adaptiveSize=${dynAdaptiveSize} minBlob=${dynMinBlobArea} ` +
            `alpha=${BLEND_ALPHA} darken=${INK_DARKEN} ` +
            `sharpen=${dynSharpenAmount} sharpBlur=${dynSharpenBlur} | src:${source}`
        );
        return out;

    } catch (err) {
        console.error('[Enhance] Pipeline crashed:', err);
        return canvas;
    } finally {
        [src, gray, small, dilated, bg, divided, result,
            blurred, mask, opened, labels, stats, centroids,
            blurForSharp   // NEW — must be freed
        ].forEach(safe);
    }
};

/* ── canvas → File ──────────────────────────────────────────────── */
export const canvasToFile = (canvas, name = 'enhanced.jpg') =>
    new Promise(r =>
        canvas.toBlob(
            b => r(new File([b], name, { type: 'image/jpeg' })),
            'image/jpeg',
            0.95
        )
    );

/* ── enhance + export ───────────────────────────────────────────── */
export const enhanceAndExport = async (
    canvas,
    filename = 'scanned.jpg',
    onProgress = () => { },
    source = 'camera'
) => {
    const enhanced = await enhanceImage(canvas, onProgress, source);
    const file = await canvasToFile(enhanced, filename);
    return { canvas: enhanced, file };
};

export default { enhanceImage, canvasToFile, enhanceAndExport };