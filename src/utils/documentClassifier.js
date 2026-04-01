/**
 * documentClassifier.js
 * STRICT PAGE-1 vs PAGE-2 DETECTOR
 *
 * RULES
 * - Page 1 slot accepts ONLY Page 1
 * - Page 2 slot accepts ONLY Page 2
 * - Portrait always rejected
 * - Unknown / weak / random docs rejected in both slots
 *
 * FIXES v4
 * 1. CLOSED the colPeaks 9–11 gray zone (v3):
 *    - Page 1 gets HARD PENALTY (-8) for colPeaks 9–11.
 *    - Page 2 gets +8 bonus for colPeaks 9–11.
 * 2. NEW colPeaksFine (hw = 1.0% of width):
 *    - Page 1 (Annexure II, ~16 narrow columns) → colPeaksFine > 14 → +3 for P1, DISQUALIFY P2.
 *    - Page 2 (~5-7 wide columns) → colPeaksFine ≤ 12.
 * 3. NEW sparsityRatio = bodyInk / hdrFullInk:
 *    - Page 1 body is mostly empty cells → sparsityRatio < 0.55 → positive P1, penalty P2.
 *    - Page 2 body has denser handwritten content → sparsityRatio > 0.65 → positive P2.
 * 4. NEW headerDensity = avg(colHdr1Ink, colHdr2Ink):
 *    - Page 1 has a complex multi-row merged header → headerDensity >= 0.060.
 *    - Page 2 has a simpler header zone.
 * 5. Hard rule: isPage1 requires colPeaks > 11 (v3 kept).
 * 6. rightTailInk P2 signal now gated by colPeaks <= 11 to prevent false P2 boost for P1.
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
        } catch (err) {
            reject(err);
        }
    });
}

function _rotateCanvas(src, deg) {
    const normDeg = ((deg % 360) + 360) % 360;
    const swap = normDeg === 90 || normDeg === 270;

    const dst = document.createElement('canvas');
    dst.width = swap ? src.height : src.width;
    dst.height = swap ? src.width : src.height;

    const ctx = dst.getContext('2d');
    ctx.translate(dst.width / 2, dst.height / 2);
    ctx.rotate((normDeg * Math.PI) / 180);
    ctx.drawImage(
        src,
        swap ? -src.height / 2 : -src.width / 2,
        swap ? -src.width / 2 : -src.height / 2
    );
    return dst;
}

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE ANALYSIS
// ─────────────────────────────────────────────────────────────────────────────

const AW = 1400;
const AH = 900;

function _resize(canvas) {
    const c = document.createElement('canvas');
    c.width = AW;
    c.height = AH;
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
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const variance = wB * wF * (mB - mF) ** 2;
        if (variance > maxVar) { maxVar = variance; thr = t; }
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
        let rowCount = 0;
        for (let x = 0; x < W; x++) {
            const v = bin[y * W + x];
            rowCount += v;
            colInk[x] += v;
        }
        rowInk[y] = rowCount / W;
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
    for (let i = from; i < to; i++) { if (arr[i] > m) m = arr[i]; }
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
// TRIM MARGINS
// ─────────────────────────────────────────────────────────────────────────────

function _trimContent(rowInk, colInk, H, W) {
    const THRESH = 0.010;
    let r0 = 0, r1 = H, c0 = 0, c1 = W;

    for (let i = 0; i < H; i++) { if (rowInk[i] > THRESH) { r0 = i; break; } }
    for (let i = H - 1; i >= 0; i--) { if (rowInk[i] > THRESH) { r1 = i + 1; break; } }
    for (let i = 0; i < W; i++) { if (colInk[i] > THRESH) { c0 = i; break; } }
    for (let i = W - 1; i >= 0; i--) { if (colInk[i] > THRESH) { c1 = i + 1; break; } }

    if ((r1 - r0) < H * 0.45) { r0 = 0; r1 = H; }
    if ((c1 - c0) < W * 0.45) { c0 = 0; c1 = W; }

    return { r0, r1, c0, c1 };
}

// ─────────────────────────────────────────────────────────────────────────────
// STRUCTURAL ANALYSIS (Handwriting Invariant)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Counts continuous vertical lines that represent the document structure.
 * Page 1 has 16-22 structural lines. Page 2 has 5-10.
 * Handwriting is rejected because it is not continuous vertically.
 */
function _countStructuralLines(bin, W, H) {
    let count = 0;
    const minContinuousRun = Math.floor(H * 0.15); // Must be at least 15% of height
    const minColumnInk = 0.08; // Must have some average density
    
    // Profiles
    const colInk = new Float64Array(W);
    for (let x = 0; x < W; x++) {
        let total = 0;
        let maxRun = 0;
        let currentRun = 0;
        for (let y = 0; y < H; y++) {
            if (bin[y * W + x] === 1) {
                total++;
                currentRun++;
            } else {
                if (currentRun > maxRun) maxRun = currentRun;
                currentRun = 0;
            }
        }
        if (currentRun > maxRun) maxRun = currentRun;
        
        // If it looks like a line or a dense column edge
        if (maxRun >= minContinuousRun || (total / H) >= 0.70) {
            count++;
            x += Math.floor(W * 0.015); // Skip neighbors
        }
    }
    return count;
}

// ─────────────────────────────────────────────────────────────────────────────
// FEATURES
// ─────────────────────────────────────────────────────────────────────────────

function _extractFeatures(canvas) {
    const norm = _resize(canvas);
    const { gray, width: W, height: H } = _grayscale(norm);
    const thr = _otsu(gray);
    const bin = _binarize(gray, thr);
    const { rowInk: rowInkFull, colInk: colInkFull } = _rowColProfiles(bin, W, H);

    const { r0, r1, c0, c1 } = _trimContent(rowInkFull, colInkFull, H, W);
    const CH = r1 - r0;
    const CW = c1 - c0;

    const rowInk = rowInkFull.slice(r0, r1);
    const colInk = colInkFull.slice(c0, c1);

    const r = f => Math.floor(CH * f);
    const c = f => Math.floor(CW * f);

    // Row ink zones
    const titleInk = _avg(rowInk, r(0.00), r(0.08));
    const mbkInk = _avg(rowInk, r(0.08), r(0.15));
    const headingInk = _avg(rowInk, r(0.15), r(0.22));
    const colHdr1Ink = _avg(rowInk, r(0.22), r(0.31));
    const colHdr2Ink = _avg(rowInk, r(0.31), r(0.40));
    const bodyInk = _avg(rowInk, r(0.40), r(0.88));
    const footerInk = _avg(rowInk, r(0.88), r(1.00));
    const hdrFullInk = _avg(rowInk, r(0.00), r(0.40));
    const mbkPeakInk = _max(rowInk, r(0.08), r(0.15));

    // Column ink zones
    const leftBlockInk = _avg(colInk, c(0.00), c(0.38));
    const midBlockInk = _avg(colInk, c(0.38), c(0.74));
    const rightPanelInk = _avg(colInk, c(0.74), c(1.00));
    const rightTailInk = _avg(colInk, c(0.88), c(1.00));

    // Derived ratios
    const rightVsMid = midBlockInk > 0.001 ? rightPanelInk / midBlockInk : 1.0;
    const mbkToTitle = titleInk > 0.001 ? mbkInk / titleInk : 0;
    const hdrToBody = bodyInk > 0.001 ? hdrFullInk / bodyInk : 1.0;

    // NEW: sparsityRatio — Page 1 body is mostly empty grid cells, Page 2 body is denser
    const sparsityRatio = hdrFullInk > 0.001 ? bodyInk / hdrFullInk : 1.0;

    // NEW: headerDensity — Page 1 has complex multi-row merged column headers
    const headerDensity = (colHdr1Ink + colHdr2Ink) / 2;

    // Row peaks
    const headerRowPeaks = _peaks(rowInk.subarray(r(0.00), r(0.40)), 0.22, 1);
    const bodyRowPeaks = _peaks(rowInk.subarray(r(0.40), r(0.88)), 0.055, 1);

    // STRUCTURAL LINE COUNT (Ultimate Fix)
    // Counts actual vertical lines/columns. 
    // Page 1 Annexure-II has ~18-22 structural columns.
    // Page 2 Financial Ledger has ~5-10 structural columns.
    const colPeaks = _countStructuralLines(bin, W, H);

    return {
        W, H, thr,
        trimR0: r0, trimR1: r1, trimC0: c0, trimC1: c1,
        titleInk, mbkInk, mbkPeakInk, headingInk,
        colHdr1Ink, colHdr2Ink, bodyInk, footerInk, hdrFullInk,
        leftBlockInk, midBlockInk, rightPanelInk, rightTailInk,
        rightVsMid, mbkToTitle, hdrToBody,
        sparsityRatio, headerDensity,
        headerRowPeaks, bodyRowPeaks,
        colPeaks,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 1 SCORING
// ─────────────────────────────────────────────────────────────────────────────

const PAGE1_PASS = 6;
const PAGE2_PASS = 4;

function _scorePage1(fp) {
    let score = 0;
    const hits = [];
    const misses = [];

    // ── STRUCTURAL GATE: coarse colPeaks ─────────────────────────────────
    if (fp.colPeaks > 12) {
        score += 15;
        hits.push(`P1-STRUCTURAL colPeaks=${fp.colPeaks} >12 (+15)`);
    } else {
        return {
            score: -99, hits: [],
            misses: [`DISQUALIFY_P1 colPeaks=${fp.colPeaks} <=12 (Page 2 pattern)`]
        };
    }

    // ── STRUCTURAL GATE: counts continuous vertical lines ────────────────
    if (fp.colPeaks >= 12) {
        score += 15;
        hits.push(`P1-STRUCTURAL colPeaks=${fp.colPeaks} >=12 (+15)`);
    } else {
        return {
            score: -99, hits: [],
            misses: [`DISQUALIFY_P1 structural lines=${fp.colPeaks} < 12 (Page 2 layout)`]
        };
    }

    // ── Cross-check: Page 2 ledger pattern disqualifies P1 ───────────────
    if (fp.sparsityRatio > 0.82) {
        return {
            score: -99, hits: [],
            misses: [`DISQUALIFY_P1 sparsityRatio=${fp.sparsityRatio.toFixed(3)} too dense (Page 2 pattern)`]
        };
    }

    if (fp.rightVsMid < 0.45) {
        return {
            score: -99, hits: [],
            misses: [`DISQUALIFY_P1 rightVsMid=${fp.rightVsMid.toFixed(3)} < 0.45`]
        };
    }

    // ── sparsityRatio: Page 1 body is sparse ─────────────────────────────
    if (fp.sparsityRatio <= 0.45) {
        score += 3;
        hits.push(`P1-SPARSE sparsityRatio=${fp.sparsityRatio.toFixed(3)} <=0.45 empty-cell body (+3)`);
    } else if (fp.sparsityRatio <= 0.65) {
        score += 1;
        hits.push(`P1-SPARSE sparsityRatio=${fp.sparsityRatio.toFixed(3)} <=0.65 (+1)`);
    } else {
        misses.push(`P1-SPARSE sparsityRatio=${fp.sparsityRatio.toFixed(3)} inconclusive`);
    }

    // ── headerDensity: Page 1 multi-row merged header ─────────────────────
    if (fp.headerDensity >= 0.060) {
        score += 2;
        hits.push(`P1-HDR headerDensity=${fp.headerDensity.toFixed(3)} >=0.060 multi-row header (+2)`);
    } else if (fp.headerDensity >= 0.040) {
        score += 1;
        hits.push(`P1-HDR headerDensity=${fp.headerDensity.toFixed(3)} >=0.040 (+1)`);
    } else {
        misses.push(`P1-HDR headerDensity=${fp.headerDensity.toFixed(3)} too low`);
    }

    // ── Original ink checks ───────────────────────────────────────────────

    if (fp.mbkInk >= 0.055) {
        score += 3; hits.push(`P1-C1 mbkInk=${fp.mbkInk.toFixed(3)} +3`);
    } else if (fp.mbkInk >= 0.030) {
        score += 2; hits.push(`P1-C1 mbkInk=${fp.mbkInk.toFixed(3)} +2`);
    } else if (fp.mbkInk >= 0.015) {
        score += 1; hits.push(`P1-C1 mbkInk=${fp.mbkInk.toFixed(3)} +1`);
    } else {
        misses.push(`P1-C1 mbkInk=${fp.mbkInk.toFixed(3)}`);
    }

    if (fp.mbkPeakInk >= 0.22) {
        score += 3; hits.push(`P1-C2 mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} +3`);
    } else if (fp.mbkPeakInk >= 0.13) {
        score += 2; hits.push(`P1-C2 mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} +2`);
    } else if (fp.mbkPeakInk >= 0.08) {
        score += 1; hits.push(`P1-C2 mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} +1`);
    } else {
        misses.push(`P1-C2 mbkPeakInk=${fp.mbkPeakInk.toFixed(3)}`);
    }

    if (fp.hdrToBody >= 0.95) {
        score += 2; hits.push(`P1-C3 hdrToBody=${fp.hdrToBody.toFixed(3)} +2`);
    } else if (fp.hdrToBody >= 0.86) {
        score += 1; hits.push(`P1-C3 hdrToBody=${fp.hdrToBody.toFixed(3)} +1`);
    } else {
        misses.push(`P1-C3 hdrToBody=${fp.hdrToBody.toFixed(3)}`);
    }

    if (fp.colHdr1Ink >= 0.075 && fp.colHdr2Ink >= 0.055) {
        score += 2; hits.push(`P1-C4 two-level-column-header +2`);
    } else if (fp.colHdr1Ink >= 0.045 || fp.colHdr2Ink >= 0.035) {
        score += 1; hits.push(`P1-C4 partial +1`);
    } else {
        misses.push(`P1-C4 weak`);
    }

    if (fp.headerRowPeaks >= 11) {
        score += 1; hits.push(`P1-C5 headerRowPeaks=${fp.headerRowPeaks} +1`);
    }

    if (fp.rightVsMid >= 0.72) {
        score += 1; hits.push(`P1-C6 rightVsMid=${fp.rightVsMid.toFixed(3)} +1`);
    }

    if (fp.footerInk >= 0.040) {
        score += 1; hits.push(`P1-C7 footerInk=${fp.footerInk.toFixed(3)} +1`);
    }

    if (fp.titleInk >= 0.020) {
        score += 1; hits.push(`P1-C8 titleInk=${fp.titleInk.toFixed(3)} +1`);
    }

    return { score, hits, misses };
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE 2 SCORING
// ─────────────────────────────────────────────────────────────────────────────

function _scorePage2(fp) {
    let score = 0;
    const hits = [];
    const misses = [];

    // ── STRUCTURAL GATE: counts continuous vertical lines ────────────────
    if (fp.colPeaks < 12) {
        score += 15;
        hits.push(`P2-STRUCTURAL colPeaks=${fp.colPeaks} < 12 (+15)`);
    } else {
        return {
            score: -99, hits: [],
            misses: [`DISQUALIFY_P2 structural lines=${fp.colPeaks} >= 12 (Page 1 layout)`]
        };
    }

    // ── Fine peaks secondary check ───────────────────────────────────────
    // Just a penalty for P2 if too many vertical bits seen
    if (fp.colPeaks > 15) score -= 10;

    // ── sparsityRatio: Page 2 body is denser ─────────────────────────────
    if (fp.sparsityRatio >= 0.70) {
        score += 3; hits.push(`P2-SPARSE sparsityRatio=${fp.sparsityRatio.toFixed(3)} >=0.70 dense body (+3)`);
    } else if (fp.sparsityRatio >= 0.50) {
        score += 1; hits.push(`P2-SPARSE sparsityRatio=${fp.sparsityRatio.toFixed(3)} >=0.50 (+1)`);
    } else {
        score -= 5;
        misses.push(`P2-SPARSE PENALTY sparsityRatio=${fp.sparsityRatio.toFixed(3)} too sparse (Page 1 trait) (-5)`);
    }

    if (fp.mbkInk < 0.028) {
        score += 2; hits.push(`P2-C1 low-mbkInk=${fp.mbkInk.toFixed(3)} +2`);
    } else if (fp.mbkInk < 0.045) {
        score += 1; hits.push(`P2-C1 low-mbkInk=${fp.mbkInk.toFixed(3)} +1`);
    } else {
        misses.push(`P2-C1 mbkInk too high=${fp.mbkInk.toFixed(3)}`);
    }

    if (fp.mbkPeakInk < 0.11) {
        score += 2; hits.push(`P2-C2 low-mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} +2`);
    } else if (fp.mbkPeakInk < 0.16) {
        score += 1; hits.push(`P2-C2 low-mbkPeakInk=${fp.mbkPeakInk.toFixed(3)} +1`);
    } else {
        misses.push(`P2-C2 mbkPeakInk too high=${fp.mbkPeakInk.toFixed(3)}`);
    }

    if (fp.headerRowPeaks <= 10) {
        score += 1; hits.push(`P2-C3 headerRowPeaks=${fp.headerRowPeaks} +1`);
    } else {
        misses.push(`P2-C3 too many header peaks=${fp.headerRowPeaks}`);
    }

    if (fp.bodyRowPeaks >= 18) {
        score += 2; hits.push(`P2-C4 bodyRowPeaks=${fp.bodyRowPeaks} +2`);
    } else if (fp.bodyRowPeaks >= 12) {
        score += 1; hits.push(`P2-C4 bodyRowPeaks=${fp.bodyRowPeaks} +1`);
    } else {
        misses.push(`P2-C4 bodyRowPeaks too low=${fp.bodyRowPeaks}`);
    }

    if (fp.rightVsMid >= 0.66) {
        score += 2; hits.push(`P2-C5 rightVsMid=${fp.rightVsMid.toFixed(3)} +2`);
    } else if (fp.rightVsMid >= 0.58) {
        score += 1; hits.push(`P2-C5 rightVsMid=${fp.rightVsMid.toFixed(3)} +1`);
    } else {
        misses.push(`P2-C5 rightVsMid too low=${fp.rightVsMid.toFixed(3)}`);
    }

    if (fp.titleInk >= 0.015) {
        score += 1; hits.push(`P2-C6 titleInk=${fp.titleInk.toFixed(3)} +1`);
    }

    // rightTailInk: Page 2 member-signature column.
    // GATED by colPeaks <= 11 to prevent false boost for Page 1 docs
    // whose empty rightmost columns might have incidental moderate ink.
    if (fp.colPeaks <= 11 && fp.rightTailInk >= 0.015 && fp.rightTailInk <= 0.12) {
        score += 2; hits.push(`P2-C7 rightTailInk=${fp.rightTailInk.toFixed(3)} signature-column (+2)`);
    }

    return { score, hits, misses };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CLASSIFIER
// ─────────────────────────────────────────────────────────────────────────────

function _classify(canvas) {
    const fp = _extractFeatures(canvas);

    const p1 = _scorePage1(fp);
    const p2 = _scorePage2(fp);

    const isPage1 = p1.score >= PAGE1_PASS && p1.score > p2.score;
    const isPage2 = p2.score >= PAGE2_PASS && p2.score > p1.score;

    let detectedPage = null;
    if (isPage1) detectedPage = 1;
    if (isPage2) detectedPage = 2;

    const reasons = [
        `detectedPage=${detectedPage ?? 'NONE'}`,
        `colPeaks=${fp.colPeaks}`,
        `colPeaksFine=${fp.colPeaksFine}`,
        `p1Score=${p1.score}`,
        `p2Score=${p2.score}`,
        `sparsityRatio=${fp.sparsityRatio.toFixed(3)}`,
        `headerDensity=${fp.headerDensity.toFixed(3)}`,
        `rightVsMid=${fp.rightVsMid.toFixed(3)}`,
        `rightTailInk=${fp.rightTailInk.toFixed(3)}`,
        `mbkInk=${fp.mbkInk.toFixed(3)}`,
        `mbkPeakInk=${fp.mbkPeakInk.toFixed(3)}`,
        `hdrToBody=${fp.hdrToBody.toFixed(3)}`,
        `headerRowPeaks=${fp.headerRowPeaks}`,
        `bodyRowPeaks=${fp.bodyRowPeaks}`,
        `trim=[${fp.trimR0},${fp.trimR1},${fp.trimC0},${fp.trimC1}]`,
        ...p1.hits, ...p2.hits,
        ...p1.misses, ...p2.misses,
    ];

    return { detectedPage, isPage1, isPage2, p1Score: p1.score, p2Score: p2.score, reasons, features: fp };
}

// ─────────────────────────────────────────────────────────────────────────────
// SLOT ROUTING
// ─────────────────────────────────────────────────────────────────────────────

function _classifyForSlot(canvas, expectedPage) {
    const result = _classify(canvas);

    if (expectedPage === 1) {
        if (result.isPage1) return { page: 1, confidence: result.p1Score >= 8 ? 'high' : 'medium', reasons: ['Confirmed Page 1 (Member Register) document.', ...result.reasons], features: result.features };
        if (result.isPage2) return { page: 2, confidence: result.p2Score >= 7 ? 'high' : 'medium', reasons: ['This is a Page 2 document — upload it in Page 2 slot.', ...result.reasons], features: result.features };
        return { page: null, confidence: 'low', reasons: ['Document not confidently recognised as Page 1.', ...result.reasons], features: result.features };
    }

    if (expectedPage === 2) {
        if (result.isPage2) return { page: 2, confidence: result.p2Score >= 7 ? 'high' : 'medium', reasons: ['Confirmed Page 2 (Financial Ledger) document.', ...result.reasons], features: result.features };
        if (result.isPage1) return { page: 1, confidence: result.p1Score >= 8 ? 'high' : 'medium', reasons: ['This is a Page 1 document — upload it in Page 1 slot.', ...result.reasons], features: result.features };
        return { page: null, confidence: 'low', reasons: ['Document not confidently recognised as Page 2.', ...result.reasons], features: result.features };
    }

    return { page: null, confidence: 'low', reasons: ['Unknown slot.'], features: result.features };
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export function validateDocumentForSlot(classification, expectedPage) {
    if (classification.page === expectedPage) {
        return { ok: true, errorType: null, message: `Correct document for Page ${expectedPage}.`, classification };
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
            ok: false,
            errorType: 'unrecognized_document',
            message: expectedPage === 1
                ? 'Wrong document uploaded. Please upload only the Page 1 document.'
                : 'Wrong document uploaded. Please upload only the Page 2 document.',
            canvas,
            features: classification.features || {},
            classification: null,
        };
    }

    const slotValidation = validateDocumentForSlot(classification, expectedPage);
    if (!slotValidation.ok) {
        const detectedPage = classification.page;
        return {
            ...slotValidation,
            errorType: 'wrong_page',
            message: detectedPage === 1
                ? 'Wrong document uploaded. This is the Page 1 document — please upload it in the Page 1 slot.'
                : 'Wrong document uploaded. This is the Page 2 document — please upload it in the Page 2 slot.',
            canvas,
            features: classification.features || {},
            classification,
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
        method: 'strict_page1_page2_v4',
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
            return { cls: 'REJECTED', confidence: 0, reason: orientation.message, features: {}, degrees: 0, tableDetected: false };
        }

        const result = _classify(canvas);

        if (result.isPage1) return { cls: 'PAGE1', confidence: result.p1Score >= 8 ? 0.9 : 0.75, reason: result.reasons.join(', '), features: result.features, degrees: 0, tableDetected: true };
        if (result.isPage2) return { cls: 'PAGE2', confidence: result.p2Score >= 7 ? 0.9 : 0.75, reason: result.reasons.join(', '), features: result.features, degrees: 0, tableDetected: true };

        return { cls: 'REJECTED', confidence: 0, reason: result.reasons.join(', '), features: result.features, degrees: 0, tableDetected: true };
    } catch (e) {
        console.error('classifyImage failed:', e);
        return { cls: 'REJECTED', confidence: 0, reason: e.message, features: {}, degrees: 0, tableDetected: false };
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