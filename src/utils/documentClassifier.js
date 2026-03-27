/**
 * documentClassifier.js  —  PAGE-1 vs PAGE-2 DETECTOR  (v6)
 * ===========================================================
 *
 * CALIBRATED against real pixel measurements of both documents:
 *
 *                        PAGE 1      PAGE 2
 *  rightVsMid            0.877       0.472   ← BEST separator (threshold 0.65)
 *  mbkRowInk             0.140       0.001   ← BEST separator (threshold 0.030)
 *  mbk/title ratio       2.80        0.02    ← only Page 1 has MBK row ABOVE title
 *  titleInk              0.050       0.023   ← Page 1 higher
 *  hdrVsBody ratio       1.18x       0.91x   ← Page 1 header denser
 *  colStdDev             0.086       0.073   ← NOT useful (overlap, wrong direction)
 *  bodySepPeaks          56          106     ← WRONG direction (don't use)
 *
 * RULE
 * ────
 *   PAGE1 slot → accept ONLY if Page 1 criteria met
 *   PAGE2 slot → accept ONLY if Page 1 criteria NOT met
 *   Portrait   → always rejected
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
// FEATURE EXTRACTION  (calibrated zone boundaries)
// ─────────────────────────────────────────────────────────────────────────────

function _extractFeatures(canvas) {
    const norm = _resize(canvas);
    const { gray, width: W, height: H } = _grayscale(norm);
    const thr = _otsu(gray);
    const bin = _binarize(gray, thr);
    const { rowInk, colInk } = _rowColProfiles(bin, W, H);

    const r = f => Math.floor(H * f);
    const c = f => Math.floor(W * f);

    // ── Row zone ink averages ─────────────────────────────────────────────────
    // Calibrated from measurements:
    //   Page 1 title zone   → 0.050  |  Page 2 → 0.023
    //   Page 1 mbk zone     → 0.140  |  Page 2 → 0.001   ← biggest gap
    //   Page 1 hdrfull avg  → 0.112  |  Page 2 → 0.104
    //   Page 1 body avg     → 0.095  |  Page 2 → 0.115
    const titleInk = _avg(rowInk, r(0.00), r(0.07));
    const mbkInk = _avg(rowInk, r(0.07), r(0.14));
    const headingInk = _avg(rowInk, r(0.14), r(0.20));
    const colHdr1Ink = _avg(rowInk, r(0.20), r(0.30));
    const colHdr2Ink = _avg(rowInk, r(0.30), r(0.40));
    const bodyInk = _avg(rowInk, r(0.40), r(0.88));
    const footerInk = _avg(rowInk, r(0.88), r(1.00));
    const hdrFullInk = _avg(rowInk, r(0.00), r(0.40));

    // ── Column zone ink averages ──────────────────────────────────────────────
    // Calibrated:
    //   Page 1 rightPanel → 0.095  |  Page 2 → 0.049
    //   Page 1 midBlock   → 0.108  |  Page 2 → 0.104
    //   rightVsMid: Page 1 → 0.878 |  Page 2 → 0.472   ← biggest gap
    const leftBlockInk = _avg(colInk, c(0.00), c(0.40));
    const midBlockInk = _avg(colInk, c(0.40), c(0.75));
    const rightPanelInk = _avg(colInk, c(0.75), c(1.00));
    const rightTailInk = _avg(colInk, c(0.88), c(1.00));

    const rightVsMid = midBlockInk > 0.001 ? rightPanelInk / midBlockInk : 1.0;

    // ── MBK row vs title ratio ────────────────────────────────────────────────
    // Page 1: mbk row (0.140) is MUCH denser than title row (0.050) → ratio ~2.8
    // Page 2: mbk zone is near-zero (0.001) → ratio ~0.02
    // This is the single most reliable discriminator.
    const mbkToTitle = titleInk > 0.001 ? mbkInk / titleInk : 0;

    // ── Header vs body density ratio ─────────────────────────────────────────
    // Page 1: header (0.112) denser than body (0.095) → ratio 1.18
    // Page 2: header (0.104) lighter than body (0.115) → ratio 0.91
    const hdrToBody = bodyInk > 0.001 ? hdrFullInk / bodyInk : 1.0;

    // ── Header row peaks ──────────────────────────────────────────────────────
    // Page 1: 13 peaks (title + MBK + heading + 2-level headers = many rows)
    // Page 2: 10 peaks
    const headerRowPeaks = _peaks(rowInk.subarray(r(0.00), r(0.40)), 0.25, 1);

    // ── Body row peaks ────────────────────────────────────────────────────────
    const bodyRowPeaks = _peaks(rowInk.subarray(r(0.40), r(0.88)), 0.06, 1);

    // ── Footer ────────────────────────────────────────────────────────────────
    // Page 1: footer totals row → 0.100  |  Page 2: → 0.050
    // (Page 2 has lighter footer because it's mostly blank signature lines)

    return {
        W, H, thr,
        titleInk, mbkInk, headingInk,
        colHdr1Ink, colHdr2Ink,
        bodyInk, footerInk, hdrFullInk,
        leftBlockInk, midBlockInk, rightPanelInk, rightTailInk,
        rightVsMid, mbkToTitle, hdrToBody,
        headerRowPeaks, bodyRowPeaks,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 SCORING
// Calibrated thresholds derived from real measurements:
//   Page 1 values in parentheses | Page 2 values in brackets
// ─────────────────────────────────────────────────────────────────────────────

const PAGE1_PASS = 10;

function _scorePage1(fp) {
    let score = 0;
    const hits = [], misses = [];

    // ── HARD DISQUALIFIER ────────────────────────────────────────────────────
    // rightVsMid: Page1=0.878, Page2=0.472. Threshold=0.65 safely splits them.
    // This single check catches Page 2 being uploaded to Page 1 slot.
    if (fp.rightVsMid < 0.65) {
        return {
            score: -99,
            hits: [],
            misses: [`DISQUALIFY: rightVsMid=${fp.rightVsMid.toFixed(3)} < 0.65 (Page 2 has sparse right panel)`],
        };
    }

    // ── CRITERION 1: MBK ID row ink (3 pts) ──────────────────────────────────
    // Page1=0.140, Page2=0.001. Threshold=0.030 gives huge margin.
    // This is the single strongest positive indicator for Page 1.
    if (fp.mbkInk >= 0.060) {
        score += 3; hits.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} ✓✓✓`);
    } else if (fp.mbkInk >= 0.030) {
        score += 2; hits.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} ✓`);
    } else if (fp.mbkInk >= 0.015) {
        score += 1; hits.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} partial`);
    } else {
        misses.push(`C1: mbkInk=${fp.mbkInk.toFixed(3)} too low (no MBK ID row)`);
    }

    // ── CRITERION 2: MBK row notably denser than title (3 pts) ───────────────
    // Page1: mbk(0.140) / title(0.050) = 2.80x  (MBK text fills more of the row)
    // Page2: mbk(0.001) / title(0.023) = 0.02x
    // Threshold=1.0 safely splits them.
    if (fp.mbkToTitle >= 1.5) {
        score += 3; hits.push(`C2: mbkToTitle=${fp.mbkToTitle.toFixed(2)} ✓✓✓`);
    } else if (fp.mbkToTitle >= 1.0) {
        score += 2; hits.push(`C2: mbkToTitle=${fp.mbkToTitle.toFixed(2)} ✓`);
    } else if (fp.mbkToTitle >= 0.5) {
        score += 1; hits.push(`C2: mbkToTitle=${fp.mbkToTitle.toFixed(2)} partial`);
    } else {
        misses.push(`C2: mbkToTitle=${fp.mbkToTitle.toFixed(2)} too low`);
    }

    // ── CRITERION 3: Header denser than body (2 pts) ─────────────────────────
    // Page1: hdrToBody=1.18x  |  Page2: 0.91x
    // Threshold=1.05 splits them cleanly.
    if (fp.hdrToBody >= 1.10) {
        score += 2; hits.push(`C3: hdrToBody=${fp.hdrToBody.toFixed(3)} ✓`);
    } else if (fp.hdrToBody >= 1.05) {
        score += 1; hits.push(`C3: hdrToBody=${fp.hdrToBody.toFixed(3)} partial`);
    } else {
        misses.push(`C3: hdrToBody=${fp.hdrToBody.toFixed(3)} (header not denser than body)`);
    }

    // ── CRITERION 4: Title row ink (2 pts) ───────────────────────────────────
    // Page1=0.050, Page2=0.023. Threshold=0.030.
    if (fp.titleInk >= 0.035) {
        score += 2; hits.push(`C4: titleInk=${fp.titleInk.toFixed(3)} ✓`);
    } else if (fp.titleInk >= 0.020) {
        score += 1; hits.push(`C4: titleInk=${fp.titleInk.toFixed(3)} partial`);
    } else {
        misses.push(`C4: titleInk=${fp.titleInk.toFixed(3)} too low`);
    }

    // ── CRITERION 5: Two-level column headers (2 pts) ────────────────────────
    // Page1: colHdr1=0.139, colHdr2=0.106  |  Page2: 0.189, 0.132
    // Both docs have col headers so this is not a discriminator on its own,
    // but Page 1's two levels are similarly dense (ratio close to 1.0).
    // Page 2's first level is notably denser than second (it has fewer header rows).
    if (fp.colHdr1Ink >= 0.080 && fp.colHdr2Ink >= 0.060) {
        score += 2; hits.push(`C5: two-level hdrs ${fp.colHdr1Ink.toFixed(3)}/${fp.colHdr2Ink.toFixed(3)} ✓`);
    } else if (fp.colHdr1Ink >= 0.050 || fp.colHdr2Ink >= 0.040) {
        score += 1; hits.push(`C5: col hdr partial`);
    } else {
        misses.push(`C5: col hdr weak`);
    }

    // ── CRITERION 6: Header row peaks (1 pt) ─────────────────────────────────
    // Page1=13, Page2=10.
    if (fp.headerRowPeaks >= 12) {
        score += 1; hits.push(`C6: headerRowPeaks=${fp.headerRowPeaks} ✓`);
    } else {
        misses.push(`C6: headerRowPeaks=${fp.headerRowPeaks}`);
    }

    // ── CRITERION 7: Right panel not sparse (1 pt) ───────────────────────────
    // Already handled by disqualifier, but give extra point for being clearly uniform.
    // Page1=0.878, threshold=0.75.
    if (fp.rightVsMid >= 0.75) {
        score += 1; hits.push(`C7: rightVsMid=${fp.rightVsMid.toFixed(3)} (uniform layout) ✓`);
    }

    // ── CRITERION 8: Footer totals row (1 pt) ────────────────────────────────
    // Page1=0.100, Page2=0.050.
    if (fp.footerInk >= 0.070) {
        score += 1; hits.push(`C8: footerInk=${fp.footerInk.toFixed(3)} ✓`);
    }

    // ── CRITERION 9: Body row peaks (1 pt) ───────────────────────────────────
    // Page1=30, Page2=61 (Page 2 has more rows — not a good discriminator by itself)
    // But Page 1 still has ≥10.
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
    const p1Conf = p1.score >= 14 ? 'high'
        : p1.score >= PAGE1_PASS ? 'medium' : 'low';

    const reasons = [
        `p1Score=${p1.score}/${PAGE1_PASS}`,
        `rightVsMid=${fp.rightVsMid.toFixed(3)}`,
        `mbkInk=${fp.mbkInk.toFixed(3)}`,
        `mbkToTitle=${fp.mbkToTitle.toFixed(2)}`,
        `hdrToBody=${fp.hdrToBody.toFixed(3)}`,
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
// PUBLIC API (unchanged surface)
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
        method: 'calibrated_page1_v6',
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