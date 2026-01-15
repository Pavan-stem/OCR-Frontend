/**
 * Advanced Document Scanner Utility
 * Comprehensive validation for professional document scanning
 * Features: Blur detection, lighting analysis, document edge detection, table detection, text validation
 */

/**
 * Step 1: Blur Detection using Laplacian Variance
 */
const detectBlur = (grayData, width, height) => {
    let variance = 0;
    let mean = 0;
    let pixelCount = 0;

    // Calculate Laplacian for each pixel
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

    // Calculate variance
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

    // Threshold for blur (typically < 100 indicates blur)
    const BLUR_THRESHOLD = 100;
    const isBlurry = variance < BLUR_THRESHOLD;

    return {
        isBlurry,
        blurScore: variance,
        threshold: BLUR_THRESHOLD
    };
};

/**
 * Step 2: Lighting Quality Analysis
 */
const analyzeLighting = (grayData, width, height) => {
    let totalBrightness = 0;
    let pixelCount = grayData.length;

    for (let i = 0; i < pixelCount; i++) {
        totalBrightness += grayData[i];
    }

    const avgBrightness = totalBrightness / pixelCount;
    const issues = [];

    // Check for darkness
    if (avgBrightness < 50) {
        issues.push("Image is too dark. Please use flash or improve lighting and capture again.");
        return { quality: "dark", avgBrightness, issues };
    }

    // Check for overexposure
    if (avgBrightness > 200) {
        issues.push("Image is overexposed. Avoid glare and capture again.");
        return { quality: "overexposed", avgBrightness, issues };
    }

    // Check contrast/dynamic range
    let minBrightness = 255;
    let maxBrightness = 0;

    for (let i = 0; i < pixelCount; i++) {
        minBrightness = Math.min(minBrightness, grayData[i]);
        maxBrightness = Math.max(maxBrightness, grayData[i]);
    }

    const dynamicRange = maxBrightness - minBrightness;
    
    if (dynamicRange < 50) {
        issues.push("Low contrast image. Capture in better lighting.");
        return { quality: "lowcontrast", avgBrightness, dynamicRange, issues };
    }

    // Check for uneven lighting (shadow detection)
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
    const shadowDifference = maxQuad - minQuad;

    if (shadowDifference > 80) {
        issues.push("Shadow detected. Ensure even lighting and capture again.");
    }

    return {
        quality: issues.length === 0 ? "good" : "warning",
        avgBrightness,
        dynamicRange,
        shadowDifference,
        issues
    };
};

/**
 * Step 3: Document Edge Detection
 */
const detectDocumentEdges = (grayData, width, height) => {
    const issues = [];
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let edgePixels = 0;

    // Simple edge detection using Sobel-like approach
    const sampleStep = 2;
    for (let y = sampleStep; y < height - sampleStep; y += sampleStep) {
        for (let x = sampleStep; x < width - sampleStep; x += sampleStep) {
            const idx = y * width + x;
            const gx = Math.abs(grayData[idx + 1] - grayData[idx - 1]);
            const gy = Math.abs(grayData[idx + width] - grayData[idx - width]);
            const edgeStrength = gx + gy;

            if (edgeStrength > 40) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
                edgePixels++;
            }
        }
    }

    // Check if document edges are detected
    const documentWidth = maxX - minX;
    const documentHeight = maxY - minY;
    const minDocumentSize = Math.min(width, height) * 0.3; // At least 30% of image

    if (documentWidth < minDocumentSize || documentHeight < minDocumentSize) {
        issues.push("Document edges not detected. Please capture the full page.");
    }

    // Check if all four edges are visible
    const marginX = width * 0.1;
    const marginY = height * 0.1;

    const hasTopEdge = minY > marginY;
    const hasBottomEdge = maxY < (height - marginY);
    const hasLeftEdge = minX > marginX;
    const hasRightEdge = maxX < (width - marginX);

    if (!hasTopEdge || !hasBottomEdge || !hasLeftEdge || !hasRightEdge) {
        issues.push("Document edges not fully visible. Ensure all four edges are in the frame.");
    }

    return {
        detected: issues.length === 0,
        bounds: { minX, minY, maxX, maxY },
        dimensions: { width: documentWidth, height: documentHeight },
        edgePixels,
        issues
    };
};

/**
 * Step 4: Table Structure Detection
 */
const detectTableStructure = (grayData, width, height) => {
    const issues = [];
    let horizontalLines = 0;
    let verticalLines = 0;

    // Detect horizontal lines (rows)
    for (let y = 5; y < height - 5; y += 3) {
        let lineStrength = 0;
        for (let x = 5; x < width - 5; x += 3) {
            const idx = y * width + x;
            const diff = Math.abs(grayData[idx] - grayData[idx + width]);
            if (diff > 30) lineStrength++;
        }
        if (lineStrength > (width - 10) * 0.3) {
            horizontalLines++;
        }
    }

    // Detect vertical lines (columns)
    for (let x = 5; x < width - 5; x += 3) {
        let lineStrength = 0;
        for (let y = 5; y < height - 5; y += 3) {
            const idx = y * width + x;
            const diff = Math.abs(grayData[idx] - grayData[idx + 1]);
            if (diff > 30) lineStrength++;
        }
        if (lineStrength > (height - 10) * 0.3) {
            verticalLines++;
        }
    }

    // A table should have multiple lines in both directions
    const MIN_HORIZONTAL_LINES = 3;
    const MIN_VERTICAL_LINES = 2;

    if (horizontalLines < MIN_HORIZONTAL_LINES || verticalLines < MIN_VERTICAL_LINES) {
        issues.push("No table detected in the image. Please capture an image with a table.");
    }

    return {
        detected: issues.length === 0,
        horizontalLines,
        verticalLines,
        issues
    };
};

/**
 * Step 5: Text Presence Validation (Simple OCR-ready check)
 */
const validateTextPresence = (grayData, width, height) => {
    const issues = [];
    let textPixels = 0;

    // Text typically has high contrast with background
    // Count pixels that are either very dark or very light
    for (let i = 0; i < grayData.length; i++) {
        if (grayData[i] < 100 || grayData[i] > 200) {
            textPixels++;
        }
    }

    const textDensity = textPixels / grayData.length;

    // If text density is too low, likely no readable text
    if (textDensity < 0.05) {
        issues.push("Text not detected. Please capture clearly with visible text.");
    }

    return {
        textPresent: issues.length === 0,
        textDensity,
        textPixels,
        issues
    };
};

/**
 * Step 6: Image Enhancement
 */
const enhanceImage = (canvas) => {
    const ctx = canvas.getContext("2d");
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    // Convert to grayscale and apply adaptive thresholding
    const grayData = new Uint8ClampedArray(canvas.width * canvas.height);
    
    // First pass: convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayData[i / 4] = gray;
    }

    // Second pass: apply contrast enhancement
    let minGray = 255, maxGray = 0;
    for (let i = 0; i < grayData.length; i++) {
        minGray = Math.min(minGray, grayData[i]);
        maxGray = Math.max(maxGray, grayData[i]);
    }

    const range = maxGray - minGray || 1;
    const enhancedData = new Uint8ClampedArray(grayData.length);
    
    for (let i = 0; i < grayData.length; i++) {
        enhancedData[i] = Math.round(((grayData[i] - minGray) / range) * 255);
    }

    // Apply adaptive thresholding (simple version)
    const blockSize = Math.floor(Math.sqrt(canvas.width * canvas.height) / 20);
    const thresholdData = new Uint8ClampedArray(enhancedData.length);

    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            const idx = y * canvas.width + x;
            let sum = 0;
            let count = 0;

            // Calculate local mean
            for (let dy = -blockSize; dy <= blockSize; dy++) {
                for (let dx = -blockSize; dx <= blockSize; dx++) {
                    const ny = y + dy;
                    const nx = x + dx;
                    if (ny >= 0 && ny < canvas.height && nx >= 0 && nx < canvas.width) {
                        sum += enhancedData[ny * canvas.width + nx];
                        count++;
                    }
                }
            }

            const mean = sum / count;
            // Threshold: pixel darker than local mean becomes black, else white
            thresholdData[idx] = enhancedData[idx] < mean ? 0 : 255;
        }
    }

    // Create output canvas with enhanced image
    const enhancedCanvas = document.createElement("canvas");
    enhancedCanvas.width = canvas.width;
    enhancedCanvas.height = canvas.height;
    const enhancedCtx = enhancedCanvas.getContext("2d");
    const enhancedImageData = enhancedCtx.createImageData(canvas.width, canvas.height);

    for (let i = 0; i < thresholdData.length; i++) {
        const val = thresholdData[i];
        enhancedImageData.data[i * 4] = val;
        enhancedImageData.data[i * 4 + 1] = val;
        enhancedImageData.data[i * 4 + 2] = val;
        enhancedImageData.data[i * 4 + 3] = 255;
    }

    enhancedCtx.putImageData(enhancedImageData, 0, 0);
    return enhancedCanvas;
};

/**
 * Main Document Scanner Function
 * Orchestrates all validation steps and provides detailed feedback
 */
export const scanDocument = async (file) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            try {
                // Resize for performance
                const maxDim = 1200;
                let width = img.width;
                let height = img.height;

                if (width > maxDim || height > maxDim) {
                    const ratio = Math.min(maxDim / width, maxDim / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                // Create canvas and draw image
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);

                // Extract grayscale data
                const imageData = ctx.getImageData(0, 0, width, height);
                const data = imageData.data;
                const grayData = new Uint8ClampedArray(width * height);

                for (let i = 0; i < data.length; i += 4) {
                    grayData[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
                }

                // Execute validation steps
                const allIssues = [];

                // Step 1: Blur Detection
                const blurAnalysis = detectBlur(grayData, width, height);
                if (blurAnalysis.isBlurry) {
                    allIssues.push("Image is blurry. Please capture again with a steady hand.");
                }

                // Step 2: Lighting Analysis
                const lightingAnalysis = analyzeLighting(grayData, width, height);
                allIssues.push(...lightingAnalysis.issues);

                // Step 3: Document Edge Detection
                const edgeAnalysis = detectDocumentEdges(grayData, width, height);
                allIssues.push(...edgeAnalysis.issues);

                // Step 4: Table Detection
                const tableAnalysis = detectTableStructure(grayData, width, height);
                allIssues.push(...tableAnalysis.issues);

                // Step 5: Text Validation
                const textAnalysis = validateTextPresence(grayData, width, height);
                allIssues.push(...textAnalysis.issues);

                // Step 6: Enhancement (only if validation passes)
                let enhancedCanvas = canvas;
                if (allIssues.length === 0) {
                    enhancedCanvas = enhanceImage(canvas);
                }

                // Return comprehensive result
                resolve({
                    isValid: allIssues.length === 0,
                    issues: allIssues,
                    validations: {
                        blur: blurAnalysis,
                        lighting: lightingAnalysis,
                        edges: edgeAnalysis,
                        table: tableAnalysis,
                        text: textAnalysis
                    },
                    enhancedCanvas,
                    originalCanvas: canvas,
                    summary: {
                        totalIssues: allIssues.length,
                        passedChecks: 5 - (allIssues.length > 0 ? 1 : 0)
                    }
                });

            } catch (err) {
                console.error("Document scanning failed:", err);
                reject(new Error(`Scanning failed: ${err.message}`));
            }
        };

        img.onerror = () => {
            reject(new Error("Failed to load image for scanning"));
        };

        img.src = objectUrl;
    });
};

/**
 * Convert enhanced canvas to File object
 */
export const canvasToFile = (canvas, filename = "document.jpg") => {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            const file = new File([blob], filename, {
                type: "image/jpeg",
                lastModified: new Date().getTime()
            });
            resolve(file);
        }, "image/jpeg", 0.95);
    });
};
