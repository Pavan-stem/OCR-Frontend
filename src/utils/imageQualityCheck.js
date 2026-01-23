/**
 * Image Quality Analysis Utility (FIXED & DOCUMENT-AWARE)
 * No false positives for scanned or cropped documents
 */

export const analyzeImage = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            try {
                /* ================= CANVAS SETUP ================= */
                const maxDim = 1000;
                let { width, height } = img;

                if (width > maxDim || height > maxDim) {
                    const r = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * r);
                    height = Math.round(height * r);
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                const { data } = ctx.getImageData(0, 0, width, height);

                /* ================= GRAYSCALE ================= */
                const gray = new Uint8ClampedArray(width * height);
                let sum = 0;

                for (let i = 0; i < data.length; i += 4) {
                    const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    gray[i / 4] = g;
                    sum += g;
                }

                const avgBrightness = sum / gray.length;

                const errors = [];
                const warnings = [];

                /* ================= LIGHTING ================= */
                let contrastSum = 0;
                for (let i = 0; i < gray.length; i++) {
                    contrastSum += Math.abs(gray[i] - avgBrightness);
                }
                const avgContrast = contrastSum / gray.length;

                if (avgBrightness < 45) {
                    errors.push("Image too dark. Use better lighting.");
                }

                if (avgBrightness > 235 && avgContrast < 18) {
                    errors.push("Image overexposed. Details are washed out.");
                }

                /* ================= SHADOW CHECK ================= */
                const hw = width >> 1, hh = height >> 1;
                const quad = [0, 0, 0, 0], cnt = [0, 0, 0, 0];

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const q = (y < hh ? 0 : 2) + (x < hw ? 0 : 1);
                        quad[q] += gray[y * width + x];
                        cnt[q]++;
                    }
                }

                const avgs = quad.map((s, i) => s / cnt[i]);
                const delta = Math.max(...avgs) - Math.min(...avgs);

                if (delta > 90 && avgContrast < 25) {
                    warnings.push("Uneven lighting detected (shadows present).");
                }

                /* ================= CONTENT BOX ================= */
                let minX = width, minY = height, maxX = 0, maxY = 0;
                let dxSum = 0, dySum = 0;

                for (let y = 1; y < height - 1; y += 2) {
                    for (let x = 1; x < width - 1; x += 2) {
                        const i = y * width + x;
                        const dx = Math.abs(gray[i + 1] - gray[i - 1]);
                        const dy = Math.abs(gray[i + width] - gray[i - width]);

                        if (dx + dy > 35) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }

                        dxSum += dx;
                        dySum += dy;
                    }
                }

                const padX = width * 0.05;
                const padY = height * 0.05;

                const contentBox = {
                    x: Math.max(0, minX - padX),
                    y: Math.max(0, minY - padY),
                    width: Math.min(width, maxX + padX) - Math.max(0, minX - padX),
                    height: Math.min(height, maxY + padY) - Math.max(0, minY - padY)
                };

                /* ================= ROTATION ================= */
                let rotation = 0;
                const ratio = dxSum / (dySum || 1);

                if (ratio > 1.3) rotation = 90;

                const bw = maxX - minX;
                const bh = maxY - minY;

                if (rotation === 0 && bh > bw * 1.15) {
                    rotation = 90;
                }

                /* ================= BLUR (NORMALIZED) ================= */
                let meanLap = 0, varLap = 0, count = 0;

                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const i = y * width + x;
                        const lap =
                            gray[i - width] + gray[i + width] +
                            gray[i - 1] + gray[i + 1] -
                            4 * gray[i];
                        meanLap += lap;
                        count++;
                    }
                }

                meanLap /= count;

                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const i = y * width + x;
                        const lap =
                            gray[i - width] + gray[i + width] +
                            gray[i - 1] + gray[i + 1] -
                            4 * gray[i];
                        varLap += (lap - meanLap) ** 2;
                    }
                }

                const blurScore = varLap / count;

                if (blurScore < 60) {
                    errors.push("Image is blurry. Hold the camera steady.");
                }

                // User Request: If errors exist, suppress warnings (only show critical errors)
                const finalWarnings = errors.length > 0 ? [] : warnings;

                resolve({
                    isValid: errors.length === 0,
                    errors,
                    warnings: finalWarnings,
                    blurScore,
                    brightness: avgBrightness,
                    contrast: avgContrast,
                    suggestedRotation: rotation,
                    contentBox
                });

            } catch (e) {
                console.error("Image analysis failed:", e);
                resolve({ isValid: true, errors: [], warnings: [] });
            }
        };

        img.onerror = () => reject(new Error("Image load failed"));
        img.src = url;
    });
};
