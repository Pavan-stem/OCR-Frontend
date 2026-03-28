/**
 * documentClassifier.js  —  PAGE-1 vs PAGE-2 DETECTOR  (v7)
 * ===========================================================
 *
 * CHANGES FROM v6 → v7
 * ─────────────────────
 * 1. MARGIN TRIMMING (_trimContent):
 *    Raw camera images contain black/white borders around the document that
 *    shift all zone percentages. v7 detects the actual ink content bounding
 *    box first, then computes all zones relative to that trimmed region.
 *
 * 2. C2 now uses mbkPeakInk (max ink in MBK zone) instead of mbkToTitle ratio.
 *    With trimmed zones the title area includes table borders which inflate
 *    titleInk, making the ratio unreliable. A high peak in the MBK zone is a
 *    direct, robust indicator of the MBK ID row.
 *
 * 3. PAGE1_PASS lowered from 10 → 8.
 *    The three strongest criteria (C1 + C2 + C5) already total 8 pts.
 *    Requiring 10 created false rejections on raw camera docs with slightly
 *    different brightness/framing.
 *
 * 4. C3 threshold relaxed (hdrToBody ≥ 0.90 for partial, ≥ 1.00 for full).
 *    Table grid lines inflate bodyInk in raw images, compressing the ratio.
 *
 * CALIBRATED VALUES (content-relative after margin trim)
 * ──────────────────────────────────────────────────────
 *                        PAGE 1      PAGE 2
 *  rightVsMid            ≥0.70       ~0.47   ← hard disqualifier @ 0.65
 *  mbkInk                ≥0.06       ~0.001  ← C1 (absolute MBK row density)
 *  mbkPeakInk            ≥0.25       ~0.001  ← C2 (dense text peak in MBK zone)
 *  rightVsMid            ≥0.75       ~0.47   ← C7 (uniform column layout)
 *
 * RULE
 * ────
 *   PAGE1 slot → accept ONLY if Page 1 criteria met
 *   PAGE2 slot → accept ONLY if Page 1 criteria NOT met
 *   Portrait   → always rejected (enforced upstream in documentProcessor.js)
 */

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC HELPERS
// ─────────────────────────────────────────────────────────────────────────────

export function validateLandscape(canvas) {
    if (canvas.width > canvas.height) {
        return { ok: true, message: 'Valid landscape orientation.' };
    }
    return { ok: false, message: 'Please rotate your phone to Landscape.' };
}

export async function buildFinalCanvas(imageInput, rotationDeg = 0) {
    return new Promise((resolve, reject) => {
        try {
            if (imageInput?.tagName?.toLowerCase() === 'canvas') {
                return resolve(rotationDeg === 0 ? imageInput : _rotateCanvas(imageInput, rotationDeg));
            }
            const img = new Image();
            img.onload = () => {
                const c = document.createElement('canvas');
                c.width = img.width;
                c.height = img.height;
                c.getContext('2d').drawImage(img, 0, 0);
                resolve(rotationDeg === 0 ? c : _rotateCanvas(c, rotationDeg));
            };
            img.onerror = reject;
            if (imageInput instanceof File || imageInput instanceof Blob) {
                img.src = URL.createObjectURL(imageInput);
            } else if (typeof imageInput === 'string') {
                img.src = imageInput;
            } else {
                reject(new Error('Unsupported image input type'));
            }
        } catch (err) { reject(err); }
    });
}

function _rotateCanvas(src, deg) {
    const swap = Math.abs(deg) === 90 || Math.abs(deg) === 270;
    const dst = document.createElement('canvas');
    dst.width = swap ? src.height : src.width;
    dst.height = swap ? src.width : src.height;
    const ctx = dst.getContext('2d');
    ctx.translate(dst.width / 2, dst.height / 2);
    ctx.rotate((deg * Math.PI) / 180);
    ctx.drawImage(src,
        swap ? -src.height / 2 : -src.width / 2,
        swap ? -src.width / 2 : -src.height / 2);
    return dst;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

const AW = 1400;
const AH = 900;

function _resize(canvas) {
    const c = document.createElement('canvas');
    c.width = AW; c.height = AH;
    c.getContext('2d').drawImage(canvas, 0, 0, AW, AH);
    return c;
}

function _grayscale(canvas) {
    const { data, width, height } = canvas
        .getContext('2d', { willReadFrequently: true })
        .getImageData(0, 0, canvas.width, canvas.height);
    const gray = new Uint8ClampedArray(width * height);
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) | 0;
    }
    return { gray, width, height };
}

function _otsu(gray) {
    const hist = new Array(256).fill(0);
    for (const v of gray) hist[v]++;
    const total = gray.length;
    let sum = 0;
    for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sumB = 0, wB = 0, maxVar = 0, thr = 180;
    for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (!wB) continue;
        const wF = total - wB;
        if (!wF) break;
        sumB += t * hist[t];
        const mB = sumB / wB, mF = (sum - sumB) / wF;
        const v = wB * wF * (mB - mF) ** 2;
        if (v > maxVar) { maxVar = v; thr = t; }
    }
    return Math.max(100, Math.min(230, thr));
}

function _binarize(gray, thr) {
    const bin = new Uint8Array(gray.length);
    for (let i = 0; i < gray.length; i++) bin[i] = gray[i] < thr ? 1 : 0;
    return bin;
}

function _rowColProfiles(bin, W, H) {
    const rowInk = new Float64Array(H);
    const colInk = new Float64Array(W);
    for (let y = 0; y < H; y++) {
        let rc = 0;
        for (let x = 0; x < W; x++) {
            rc += bin[y * W + x];
            colInk[x] += bin[y * W + x];
        }
        rowInk[y] = rc / W;
    }
    for (let x = 0; x < W; x++) colInk[x] /= H;
    return { rowInk, colInk };
}

function _avg(arr, from, to) {
    let s = 0;
    for (let i = from; i < to; i++) s += arr[i];
    return s / Math.max(1, to - from);
}

function _max(arr, from, to) {
    let m = 0;
    for (let i = from; i < to; i++) if (arr[i] > m) m = arr[i];
    return m;
}

function _peaks(arr, minVal, hw) {
    let n = 0;
    for (let i = hw; i < arr.length - hw; i++) {
        if (arr[i] < minVal) continue;
        let ok = true;
        for (let d = 1; d <= hw; d++) {
            if (arr[i] < arr[i - d] || arr[i] < arr[i + d]) { ok = false; break; }
        }
        if (ok) n++;
    }
    return n;
}

// ─────────────────────────────────────────────────────────────────────────────
// MARGIN TRIMMING  (v7 — new)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Finds the actual ink-content bounding box inside the image.
 * Raw camera captures have variable-sized black/white borders around the
 * document (phone status bar, browser chrome, document shadow, etc.).
 * Trimming these out before computing zones makes zone percentages
 * consistent regardless of how much margin surrounds the document.
 *
 * @param {Float64Array} rowInk  - per-row ink fraction [0,1]
 * @param {Float64Array} colInk  - per-col ink fraction [0,1]
 * @param {number} H             - image height
 * @param {number} W             - image width
 * @returns {{ r0, r1, c0, c1 }} - trimmed content boundaries
 */
function _trimContent(rowInk, colInk, H, W) {
    const THRESH = 0.015; // rows/cols below this are considered margin

    let r0 = 0, r1 = H, c0 = 0, c1 = W;

    for (let i = 0; i < H; i++) { if (rowInk[i] > THRESH) { r0 = i; break; } }
    for (let i = H - 1; i >= 0; i--) { if (rowInk[i] > THRESH) { r1 = i + 1; break; } }
    for (let i = 0; i < W; i++) { if (colInk[i] > THRESH) { c0 = i; break; } }
    for (let i = W - 1; i >= 0; i--) { if (colInk[i] > THRESH) { c1 = i + 1; break; } }

    // Safety: ensure at least 50% of image is kept (prevents edge cases)
    if ((r1 - r0) < H * 0.5) { r0 = 0; r1 = H; }
    if ((c1 - c0) < W * 0.5) { c0 = 0; c1 = W; }

    return { r0, r1, c0, c1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURE EXTRACTION  (v7 — zones computed on margin-trimmed region)
// ─────────────────────────────────────────────────────────────────────────────

function _extractFeatures(canvas) {
    const norm = _resize(canvas);
    const { gray, width: W, height: H } = _grayscale(norm);
    const thr = _otsu(gray);
    const bin = _binarize(gray, thr);
    const { rowInk: rowInkFull, colInk: colInkFull } = _rowColProfiles(bin, W, H);

    // ── Margin trim: find actual document content boundaries ──────────────────
    const { r0, r1, c0, c1 } = _trimContent(rowInkFull, colInkFull, H, W);
    const CH = r1 - r0; // content height
    const CW = c1 - c0; // content width

    // Slice row/col profiles to content region only
    const rowInk = rowInkFull.slice(r0, r1);
    const colInk = colInkFull.slice(c0, c1);

    const r = f => Math.floor(CH * f);
    const c = f => Math.floor(CW * f);

    // ── Row zone ink averages (content-relative) ──────────────────────────────
    const titleInk = _avg(rowInk, r(0.00), r(0.07));
    const mbkInk = _avg(rowInk, r(0.07), r(0.14));
    const headingInk = _avg(rowInk, r(0.14), r(0.20));
    const colHdr1Ink = _avg(rowInk, r(0.20), r(0.30));
    const colHdr2Ink = _avg(rowInk, r(0.30), r(0.40));
    const bodyInk = _avg(rowInk, r(0.40), r(0.88));
    const footerInk = _avg(rowInk, r(0.88), r(1.00));
    const hdrFullInk = _avg(rowInk, r(0.00), r(0.40));

    // ── NEW: MBK zone peak ink ────────────────────────────────────────────────
    // The MBK ID row in Page 1 creates a single very dense row (high peak).
    // This is more reliable than the mbkToTitle ratio when titleInk is inflated
    // by table border lines or when document margins vary.
    const mbkPeakInk = _max(rowInk, r(0.07), r(0.14));

    // ── Column zone ink averages (content-relative) ───────────────────────────
    const leftBlockInk = _avg(colInk, c(0.00), c(0.40));
    const midBlockInk = _avg(colInk, c(0.40), c(0.75));
    const rightPanelInk = _avg(colInk, c(0.75), c(1.00));
    const rightTailInk = _avg(colInk, c(0.88), c(1.00));

    const rightVsMid = midBlockInk > 0.001 ? rightPanelInk / midBlockInk : 1.0;

    // ── Legacy ratio (kept for logging/debug, not used in scoring) ────────────
    const mbkToTitle = titleInk > 0.001 ? mbkInk / titleInk : 0;

    // ── Header vs body density ratio ─────────────────────────────────────────
    const hdrToBody = bodyInk > 0.001 ? hdrFullInk / bodyInk : 1.0;

    // ── Header row peaks ──────────────────────────────────────────────────────
    const headerRowPeaks = _peaks(rowInk.subarray(r(0.00), r(0.40)), 0.25, 1);

    // ── Body row peaks ────────────────────────────────────────────────────────
    const bodyRowPeaks = _peaks(rowInk.subarray(r(0.40), r(0.88)), 0.06, 1);

    return {
        W, H, thr,
        // margin trim bounds (for debug)
        trimR0: r0, trimR1: r1, trimC0: c0, trimC1: c1,
        // row features
        titleInk, mbkInk, mbkPeakInk, headingInk,
        colHdr1Ink, colHdr2Ink,
        bodyInk, footerInk, hdrFullInk,
        // col features
        leftBlockInk, midBlockInk, rightPanelInk, rightTailInk,
        // derived ratios
        rightVsMid, mbkToTitle, hdrToBody,
        // peak counts
        headerRowPeaks, bodyRowPeaks,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 SCORING  (v7)
// Max possible = 14 pts.  Pass threshold = 8 pts.
// ─────────────────────────────────────────────────────────────────────────────

const PAGE1_PASS = 8; // lowered from 10 to handle raw camera variance

function _scorePage1(fp) {
    let score = 0;
    const hits = [], misses = [];

    // ── HARD DISQUALIFIER ────────────────────────────────────────────────────
    // rightVsMid: Page1 ≥ 0.70, Page2 ≈ 0.47. Threshold 0.65 safely splits.
    // Page 2 has a sparse right panel (blank signature / summary columns).
    // This check is the single most reliable negative indicator for Page 2.
    if (fp.rightVsMid < 0.65) {
        return {
            score: -99,
            hits: [],
            misses: [`DISQUALIFY: rightVsMid=${fp.rightVsMid.toFixed(3)} < 0.65 (Page 2 sparse right panel)`],
        };
    }

    // ── CRITERION 1: MBK ID row absolute ink density (3 pts) ─────────────────
    // Page1: mbkInk ≥ 0.06 (dense text row).  Page2: mbkInk ≈ 0.001 (near zero).
    // Computed on the margin-trimmed region so it's consistent across cameras.
    if (fp.mbkInk >= 0.060) {
        score += 3; hits.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} ✓✓✓`);
    } else if (fp.mbkInk >= 0.030) {
        score += 2; hits.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} ✓`);
    } else if (fp.mbkInk >= 0.015) {
        score += 1; hits.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} partial`);
    } else {
        misses.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} too low (no MBK ID row)`);
    }

    // ── CRITERION 2: Dense text peak in MBK zone (3 pts) ─────────────────────
    // v7 change: replaced mbkToTitle ratio with mbkPeakInk.
    // The ratio was unreliable on raw images because table border lines inflate
    // titleInk. Instead we check directly: is there a high-ink spike in the
    // MBK zone row profile? This spike = a row of Telugu text filling the zone.
    // Page1: mbkPeakInk ≥ 0.25 (clear text row).  Page2: ≈ 0.001.
    if (fp.mbkPeakInk >= 0.25) {
        score += 3; hits.push(`C2: mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} ✓✓✓`);
    } else if (fp.mbkPeakInk >= 0.15) {
        score += 2; hits.push(`C2: mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} ✓`);
    } else if (fp.mbkPeakInk >= 0.08) {
        score += 1; hits.push(`C2: mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} partial`);
    } else {
        misses.push(`C2: mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} too low`);
    }

    // ── CRITERION 3: Header vs body density (2 pts) ───────────────────────────
    // v7: threshold relaxed from 1.10/1.05 to 1.00/0.90.
    // Raw camera docs have bodyInk inflated by dense table grid lines,
    // compressing the ratio. We allow partial credit down to 0.90.
    if (fp.hdrToBody >= 1.00) {
        score += 2; hits.push(`C3: hdrToBody=${fp.hdrToBody.toFixed(3)} ✓`);
    } else if (fp.hdrToBody >= 0.90) {
        score += 1; hits.push(`C3: hdrToBody=${fp.hdrToBody.toFixed(3)} partial`);
    } else {
        misses.push(`C3: hdrToBody=${fp.hdrToBody.toFixed(3)} (header not denser than body)`);
    }

    // ── CRITERION 4: Title row ink (2 pts) ───────────────────────────────────
    // After margin trimming, the title zone should contain the top table border
    // + first header text rows, giving a moderate ink density.
    if (fp.titleInk >= 0.035) {
        score += 2; hits.push(`C4: titleInk=${fp.titleInk.toFixed(3)} ✓`);
    } else if (fp.titleInk >= 0.020) {
        score += 1; hits.push(`C4: titleInk=${fp.titleInk.toFixed(3)} partial`);
    } else {
        misses.push(`C4: titleInk=${fp.titleInk.toFixed(3)} too low`);
    }

    // ── CRITERION 5: Two-level column headers (2 pts) ────────────────────────
    if (fp.colHdr1Ink >= 0.080 && fp.colHdr2Ink >= 0.060) {
        score += 2; hits.push(`C5: two-level hdrs ${fp.colHdr1Ink.toFixed(3)}/${fp.colHdr2Ink.toFixed(3)} ✓`);
    } else if (fp.colHdr1Ink >= 0.050 || fp.colHdr2Ink >= 0.040) {
        score += 1; hits.push(`C5: col hdr partial`);
    } else {
        misses.push(`C5: col hdr weak`);
    }

    // ── CRITERION 6: Header row peaks (1 pt) ─────────────────────────────────
    if (fp.headerRowPeaks >= 12) {
        score += 1; hits.push(`C6: headerRowPeaks=${fp.headerRowPeaks} ✓`);
    } else {
        misses.push(`C6: headerRowPeaks=${fp.headerRowPeaks}`);
    }

    // ── CRITERION 7: Right panel uniformity (1 pt) ───────────────────────────
    // Already enforced by disqualifier, but gives extra credit for clearly
    // uniform right-panel density (Page 1 has data columns spanning full width).
    if (fp.rightVsMid >= 0.75) {
        score += 1; hits.push(`C7: rightVsMid=${fp.rightVsMid.toFixed(3)} ✓`);
    }

    // ── CRITERION 8: Footer totals row (1 pt) ────────────────────────────────
    if (fp.footerInk >= 0.050) {
        score += 1; hits.push(`C8: footerInk=${fp.footerInk.toFixed(3)} ✓`);
    }

    // ── CRITERION 9: Body row peaks (1 pt) ───────────────────────────────────
    if (fp.bodyRowPeaks >= 10) {
        score += 1; hits.push(`C9: bodyRowPeaks=${fp.bodyRowPeaks} ✓`);
    }

    return { score, hits, misses };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASSIFY
// ─────────────────────────────────────────────────────────────────────────────

function _classify(canvas) {
    const fp = _extractFeatures(canvas);
    const p1 = _scorePage1(fp);

    const isPage1 = p1.score >= PAGE1_PASS;
    const p1Conf = p1.score >= 12 ? 'high'
        : p1.score >= PAGE1_PASS ? 'medium' : 'low';

    const reasons = [
        `p1Score=${p1.score}/${PAGE1_PASS}`,
        `rightVsMid=${fp.rightVsMid.toFixed(3)}`,
        `mbkInk=${fp.mbkInk.toFixed(3)}`,
        `mbkPeakInk=${fp.mbkPeakInk.toFixed(3)}`,
        `mbkToTitle=${fp.mbkToTitle.toFixed(2)}`,
        `hdrToBody=${fp.hdrToBody.toFixed(3)}`,
        `trim=[${fp.trimR0},${fp.trimR1},${fp.trimC0},${fp.trimC1}]`,
        ...p1.hits,
        ...p1.misses,
    ];

    return { isPage1, p1Score: p1.score, p1Conf, reasons, features: fp };
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT ROUTING
// ─────────────────────────────────────────────────────────────────────────────

function _classifyForSlot(canvas, expectedPage) {
    const result = _classify(canvas);

    if (expectedPage === 1) {
        if (result.isPage1) {
            return {
                page: 1, confidence: result.p1Conf,
                reasons: ['Confirmed Page 1 document.', ...result.reasons],
                features: result.features,
            };
        }
        return {
            page: null, confidence: 'low',
            reasons: ['Not the Page 1 (అనుభందం - II) document.', ...result.reasons],
            features: result.features,
        };
    }

    // PAGE 2 slot: accept anything that is NOT Page 1
    if (!result.isPage1) {
        return {
            page: 2, confidence: 'medium',
            reasons: ['Accepted for Page 2 (not a Page 1 document).', ...result.reasons],
            features: result.features,
        };
    }

    // Page 1 uploaded into Page 2 slot → reject
    return {
        page: 1, confidence: result.p1Conf,
        reasons: ['Detected as Page 1 — cannot be used in Page 2 slot.', ...result.reasons],
        features: result.features,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API  (unchanged surface — drop-in replacement for v6)
// ─────────────────────────────────────────────────────────────────────────────

export function validateDocumentForSlot(classification, expectedPage) {
    if (classification.page === expectedPage) {
        return {
            ok: true, errorType: null,
            message: `Correct document for Page ${expectedPage}.`, classification
        };
    }
    return { ok: false, errorType: 'slot_mismatch', message: '', classification };
}

export async function validateSHGDocumentForProceed(fileOrUrl, rotationDeg, expectedPage) {
    const canvas = await buildFinalCanvas(fileOrUrl, rotationDeg);
    const orientation = validateLandscape(canvas);
    if (!orientation.ok) {
        return { ok: false, errorType: 'orientation', message: orientation.message };
    }

    const classification = _classifyForSlot(canvas, expectedPage);

    if (!classification.page) {
        return {
            ok: false, errorType: 'not_page1',
            message: expectedPage === 1
                ? 'Wrong document type. Please upload the correct Page 1 (అనుభందం - II) document.'
                : 'Wrong document type.',
            canvas, features: classification.features || {}, classification: null,
        };
    }

    const slotValidation = validateDocumentForSlot(classification, expectedPage);
    if (!slotValidation.ok) {
        return {
            ...slotValidation,
            message: `Wrong document type. Expected PAGE${expectedPage}, but detected PAGE${classification.page}.`,
            canvas, features: classification.features || {}, classification,
        };
    }

    return { ...slotValidation, canvas, features: classification.features || {}, classification };
}

export async function classifyAndValidate(imageInput, expectedPage) {
    const result = await validateSHGDocumentForProceed(imageInput, 0, expectedPage);
    return {
        ok: result.ok,
        errorType: result.errorType || (result.ok ? null : 'REJECTED'),
        message: result.message,
        classification: result.classification ? 'PAGE' + result.classification.page : 'REJECTED',
        confidence: result.classification
            ? (result.classification.confidence === 'high' ? 0.9
                : result.classification.confidence === 'medium' ? 0.7 : 0.5)
            : 0,
        reason: result.classification
            ? result.classification.reasons.join(', ')
            : (result.message || 'Rejected'),
        features: result.features || {},
        method: 'calibrated_page1_v7',
        tableDetected: true,
    };
}

let _selectedPage = 1;
export function setSelectedPage(page) { _selectedPage = page; }

export async function classifyImage(imageInput) {
    try {
        const canvas = await buildFinalCanvas(imageInput, 0);
        const orientation = validateLandscape(canvas);
        if (!orientation.ok) {
            return {
                cls: 'REJECTED', confidence: 0, reason: orientation.message,
                features: {}, degrees: 0, tableDetected: false
            };
        }
        const result = _classify(canvas);
        if (result.isPage1) {
            return {
                cls: 'PAGE1',
                confidence: result.p1Conf === 'high' ? 0.9 : 0.7,
                reason: result.reasons.join(', '),
                features: result.features, degrees: 0, tableDetected: true,
            };
        }
        return {
            cls: 'PAGE2', confidence: 0.7,
            reason: result.reasons.join(', '),
            features: result.features, degrees: 0, tableDetected: true,
        };
    } catch (e) {
        console.error('classifyImage failed:', e);
        return {
            cls: 'REJECTED', confidence: 0, reason: e.message,
            features: {}, degrees: 0, tableDetected: false
        };
    }
}

export function validatePage(classificationStatus, expectedPage) {
    return classificationStatus === 'PAGE' + expectedPage
        ? { ok: true }
        : { ok: false, errorType: 'slot_mismatch', msg: '' };
}

export async function isDocument(canvas) {
    try { return validateLandscape(canvas).ok; } catch { return false; }
}