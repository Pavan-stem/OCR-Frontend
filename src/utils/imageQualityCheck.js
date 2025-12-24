/**
 * Image Quality Analysis Utility
 * Detects blur, lighting issues, and shadow presence using HTML5 Canvas
 */

export const analyzeImage = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            try {
                // Resize for performance (max 1000px dimension)
                const maxDim = 1000;
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width *= ratio;
                    height *= ratio;
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;

                // 1. Convert to Grayscale
                const grayData = new Uint8ClampedArray(width * height);
                let totalBrightness = 0;

                for (let i = 0; i < data.length; i += 4) {
                    // LUMA formula: 0.299R + 0.587G + 0.114B
                    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                    grayData[i / 4] = gray;
                    totalBrightness += gray;
                }

                const avgBrightness = totalBrightness / (width * height);
                const issues = [];

                // 2. Lighting Check
                if (avgBrightness < 50) {
                    issues.push("Low Lighting: The image is too dark. Please use flash or find better lighting.");
                } else if (avgBrightness > 200) {
                    issues.push("Overexposed: The image is too bright or washed out.");
                }

                // 3. Shadow/Contrast Check (Simple Variance)
                // Split image into 4 quadrants and compare brightness
                const halfW = Math.floor(width / 2);
                const halfH = Math.floor(height / 2);
                const quadrants = [0, 0, 0, 0];
                const counts = [0, 0, 0, 0];

                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const idx = y * width + x;
                        const val = grayData[idx];

                        const qIdx = (y < halfH ? 0 : 2) + (x < halfW ? 0 : 1);
                        quadrants[qIdx] += val;
                        counts[qIdx]++;
                    }
                }

                const quadAvgs = quadrants.map((sum, i) => sum / counts[i]);
                const minQuad = Math.min(...quadAvgs);
                const maxQuad = Math.max(...quadAvgs);

                // If distinct difference between brightest and darkest quadrant => possible heavy shadow
                if (maxQuad - minQuad > 80 && avgBrightness > 60) {
                    issues.push("Shadow Detected: Uneven lighting or heavy shadows detected.");
                }

                // 4. Blur Detection (Laplacian Variance)
                // Kernel: 
                // 0  1  0
                // 1 -4  1
                // 0  1  0
                let variance = 0;
                let mean = 0;
                let pixelCount = 0;

                // Skip borders to avoid artifacts
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const idx = y * width + x;

                        // Apply Kernel
                        const laplacian =
                            grayData[idx - width] + // Top
                            grayData[idx + width] + // Bottom
                            grayData[idx - 1] +     // Left
                            grayData[idx + 1] -     // Right
                            (4 * grayData[idx]);    // Center

                        mean += laplacian;
                        pixelCount++;
                    }
                }

                mean /= pixelCount;

                // Calculate Variance
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const idx = y * width + x;
                        const laplacian =
                            grayData[idx - width] +
                            grayData[idx + width] +
                            grayData[idx - 1] +
                            grayData[idx + 1] -
                            (4 * grayData[idx]);

                        variance += Math.pow(laplacian - mean, 2);
                    }
                }

                variance /= pixelCount;

                // Thresholds usually around 100-500 depending on resolution/content
                // Text documents usually have high variance (sharp edges)
                // Blurry images hav low variance
                console.log("Image Analysis - Variance:", variance, "Brightness:", avgBrightness);

                if (variance < 100) {
                    issues.push("Blurry Image: The document text may be unreadable. Please hold steady.");
                }

                resolve({
                    isValid: issues.length === 0,
                    score: variance,
                    issues: issues
                });

            } catch (err) {
                console.error("Image analysis failed:", err);
                // Fail safe: Allow upload if analysis breaks
                resolve({ isValid: true, issues: [] });
            }
        };

        img.onerror = () => {
            reject(new Error("Failed to load image for analysis"));
        };

        img.src = objectUrl;
    });
};
