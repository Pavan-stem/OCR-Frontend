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
    cv.Canny(blur, edges, 60, 180);
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        const area = cv.contourArea(c);
        if (area < src.rows * src.cols * 0.1) continue;

        const peri = cv.arcLength(c, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(c, approx, 0.02 * peri, true);

        if (approx.rows === 4 && area > bestArea) {
            bestArea = area;
            best = approx.clone();
        }
        approx.delete();
    }

    gray.delete(); blur.delete(); edges.delete();
    contours.delete(); hierarchy.delete();

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
    const sum = pts.map(p => p.x + p.y);
    const diff = pts.map(p => p.x - p.y);

    const ordered = [
        pts[sum.indexOf(Math.min(...sum))],
        pts[diff.indexOf(Math.max(...diff))],
        pts[sum.indexOf(Math.max(...sum))],
        pts[diff.indexOf(Math.min(...diff))]
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

    if (brightness < 50) issues.push("Image too dark");
    if (brightness > 240 && contrast < 25) issues.push("Image overexposed");
    if (contrast < 20) issues.push("Low contrast");

    return { issues, brightness, contrast };
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
                canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);

                const issues = [];
                let crop = null;

                if (cvReady()) {
                    const src = cv.imread(canvas);

                    const blur = detectBlurOpenCV(src);
                    if (blur < 80) issues.push("Image is blurry");

                    const light = detectLightingOpenCV(src);
                    issues.push(...light.issues);

                    const edges = detectEdgesOpenCV(src);
                    if (!edges.detected) issues.push("No document detected");
                    else crop = edges.bounds;

                    src.delete();
                } else {
                    issues.push("OpenCV not loaded");
                }

                resolve({
                    isValid: issues.length === 0,
                    issues,
                    crop,
                    canvas
                });

            } catch (e) {
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
    c.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
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
