/**
 * Image Quality Analysis Utility
 * Detects blur, lighting issues, and shadow presence using HTML5 Canvas
 * Integrated with AI Document Scanner for professional document processing
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
                    issues.push("Image is too dark. Please use flash or find better lighting and capture again.");
                } else if (avgBrightness > 200) {
                    issues.push("Image is overexposed. Avoid glare and capture again.");
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

                // 4. Content Bounding Box & Orientation Detection
                let dxSum = 0;
                let dySum = 0;
                let topWeight = 0;
                let bottomWeight = 0;
                let leftWeight = 0;
                let rightWeight = 0;

                let minX = width, minY = height, maxX = 0, maxY = 0;
                const sampleStep = 2;

                for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
                    for (let x = sampleStep; x < width - sampleStep; x += sampleStep) {
                        const idx = y * width + x;
                        const dx = Math.abs(grayData[idx + 1] - grayData[idx - 1]);
                        const dy = Math.abs(grayData[idx + width] - grayData[idx - width]);

                        if (dx > 20) dxSum += dx;
                        if (dy > 20) dySum += dy;

                        const edgeStrength = dx + dy;
                        if (edgeStrength > 40) {
                            // Expand bounding box
                            if (x < minX) minX = x;
                            if (x > maxX) maxX = x;
                            if (y < minY) minY = y;
                            if (y > maxY) maxY = y;

                            // Density check for orientation
                            if (y < height * 0.25) topWeight++;
                            else if (y > height * 0.75) bottomWeight++;

                            if (x < width * 0.25) leftWeight++;
                            else if (x > width * 0.75) rightWeight++;
                        }
                    }
                }

                // Calculate Content Box with padding (5% relative)
                const padW = width * 0.05;
                const padH = height * 0.05;
                const contentBox = {
                    x: Math.max(0, minX - padW),
                    y: Math.max(0, minY - padH),
                    width: Math.min(width, maxX + padW) - Math.max(0, minX - padW),
                    height: Math.min(height, maxY + padH) - Math.max(0, minY - padH)
                };

                // Orientation Logic - Enhanced for SHG Tables
                let suggestedRotation = 0;

                // shg tables are landscape. if edges are primarily vertical, it's likely rotated
                const edgeRatio = dxSum / (dySum || 1);

                if (edgeRatio > 1.2) {
                    suggestedRotation = 90; // Likely needs 90 deg rotation to be landscape
                }

                // Fine-tune based on weights (densities)
                if (suggestedRotation === 0) {
                    // Check if upside down (more content at bottom than top)
                    if (bottomWeight > topWeight * 1.5) suggestedRotation = 180;
                } else if (suggestedRotation === 90) {
                    // Check if rotated 270 instead of 90
                    if (rightWeight > leftWeight * 1.5) suggestedRotation = 270;
                }

                // Final check: SHG forms are ALWAYS landscape. 
                // If after suggested rotation the bounding box is still portrait, 
                // force a 90 degree shift if it helps reach landscape.
                const curW = maxX - minX;
                const curH = maxY - minY;

                let finalW = (suggestedRotation === 90 || suggestedRotation === 270) ? curH : curW;
                let finalH = (suggestedRotation === 90 || suggestedRotation === 270) ? curW : curH;

                if (finalH > finalW * 1.1) {
                    // Still portrait, try to flip it to landscape
                    suggestedRotation = (suggestedRotation + 90) % 360;
                }

                // 5. Blur Detection (Laplacian Variance)
                let variance = 0;
                let mean = 0;
                let pixelCount = 0;

                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        const idx = y * width + x;
                        const laplacian =
                            grayData[idx - width] +
                            grayData[idx + width] +
                            grayData[idx - 1] +
                            grayData[idx + 1] -
                            (4 * grayData[idx]);

                        mean += laplacian;
                        pixelCount++;
                    }
                }
                mean /= pixelCount;

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

                resolve({
                    isValid: issues.length === 0,
                    score: variance,
                    issues: issues,
                    suggestedRotation: suggestedRotation,
                    contentBox: contentBox
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
