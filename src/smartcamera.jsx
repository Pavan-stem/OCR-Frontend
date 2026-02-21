import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, X, AlertTriangle, CheckCircle, Loader, RotateCw, Crop, RefreshCw, Image as ImageIcon, ScanLine, Flashlight } from "lucide-react";
import { scanDocument, canvasToFile, rotateCanvas, cropCanvas, warpPerspective, enhanceImage, detectDocument } from "./utils/documentScanner";

const cvReady = () => !!(window.cv && window.cv.Mat);

const SmartCamera = ({ open, onClose, onCapture, shgId, shgName, t }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const reviewContainerRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedImageData, setCapturedImageData] = useState(null);
    const [processingMessage, setProcessingMessage] = useState("");
    const [cameraError, setCameraError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [shutterFlash, setShutterFlash] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);

    // Live Validation State
    const [liveStatus, setLiveStatus] = useState({
        isValid: false,
        message: "Searching for document...",
        color: "text-white",
        orientation: "Portrait"
    });
    const [captureProgress, setCaptureProgress] = useState(0);
    const [manualRotation, setManualRotation] = useState(0); // 0, 90, 180, 270
    const stabilityTimer = useRef(null);
    const steadyCount = useRef(0);

    // Smoothing & Tracking State
    const [stableContour, setStableContour] = useState(null);
    const [smoothedContour, setSmoothedContour] = useState(null);
    const lastStableUpdate = useRef(0);
    const pointsTracker = useRef(null); // Stores interpolated points
    const animationFrameId = useRef(null);
    const uiAnimationFrameId = useRef(null);
    const processingTimeoutId = useRef(null);
    const isLoopingRef = useRef(false);
    const captureTriggeredRef = useRef(false);

    const maxBlurVarRef = useRef(0);
    const bestFrameRef = useRef(null);
    const bestPointsRef = useRef(null);
    const rawPointsRef = useRef(null); // High-speed sync ref for dots
    const [deviceRotation, setDeviceRotation] = useState(0);

    useEffect(() => {
        const handleRotation = () => {
            const angle = window.orientation || (window.screen?.orientation?.angle) || 0;
            setDeviceRotation(angle);
        };
        window.addEventListener("orientationchange", handleRotation);
        handleRotation();
        return () => window.removeEventListener("orientationchange", handleRotation);
    }, []);

    const rotationScale = React.useMemo(() => {
        if (manualRotation % 180 === 0 || !reviewContainerRef.current) return 1;
        const w = reviewContainerRef.current.offsetWidth;
        const h = reviewContainerRef.current.offsetHeight;
        if (!w || !h) return 1;
        return Math.min(w / h, h / w);
    }, [manualRotation, capturedImageData]);

    const handleRotate = (dir) => {
        setManualRotation(prev => {
            if (dir === 'left') return (prev - 90 + 360) % 360;
            return (prev + 90) % 360;
        });
    };

    useEffect(() => {
        if (open) {
            setCapturedImageData(null);
            setIsProcessing(false);
            captureTriggeredRef.current = false;
            setLiveStatus({
                isValid: false,
                message: "Searching for document...",
                color: "text-white"
            });
            setStableContour(null);
            setSmoothedContour(null);
            pointsTracker.current = null;
            setCameraError(null);
            lastStableUpdate.current = 0;
        }
    }, [open]);

    // Initialize camera
    useEffect(() => {
        if (!open || capturedImageData) return;

        let stream = null;
        const initCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "environment" },
                        width: { ideal: 4096, min: 1920 },
                        height: { ideal: 2160, min: 1080 }
                    }
                });

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current.play();
                        setIsCameraActive(true);
                        setCameraError(null);
                        startProcessingLoop();
                    };
                }
            } catch (err) {
                console.error("Camera error:", err);
                setCameraError("Camera access denied. Please allow camera permissions.");
                setIsCameraActive(false);
            }
        };

        if (cvReady()) {
            initCamera();
        } else {
            const checkCv = setInterval(() => {
                if (cvReady()) {
                    clearInterval(checkCv);
                    initCamera();
                }
            }, 100);
            return () => clearInterval(checkCv);
        }

        return () => {
            isLoopingRef.current = false;
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (uiAnimationFrameId.current) {
                cancelAnimationFrame(uiAnimationFrameId.current);
            }
            if (processingTimeoutId.current) {
                clearTimeout(processingTimeoutId.current);
            }
            // Deep Memory Cleanup
            maxBlurVarRef.current = 0;
            bestFrameRef.current = null;
            bestPointsRef.current = null;
            rawPointsRef.current = null;
        };
    }, [open, capturedImageData]);

    const startProcessingLoop = () => {
        if (isLoopingRef.current) return; // Prevent multiple loops
        isLoopingRef.current = true;

        const processFrame = () => {
            if (!videoRef.current || !canvasRef.current || !open || capturedImageData || !isLoopingRef.current) {
                isLoopingRef.current = false;
                return;
            }

            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                let src, gray, lap, mean, std, blurred, edges, contours, hierarchy, detected, shadowRoi;
                try {
                    let isAnyPartBlurry = false;
                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    // Downscale to 0.3 for faster CV processing on mobile
                    const scale = 0.3;
                    if (video.videoWidth === 0 || video.videoHeight === 0) return;

                    canvas.width = video.videoWidth * scale;
                    canvas.height = video.videoHeight * scale;
                    if (canvas.width === 0 || canvas.height === 0) return;

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    src = cv.imread(canvas);
                    gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                    // 1. Quality Checks (Periodic to save CPU)
                    let blurVar = 150; // Optimized default
                    let avgBrightness = 100;

                    lap = new cv.Mat();
                    cv.Laplacian(gray, lap, cv.CV_64F);
                    mean = new cv.Mat();
                    std = new cv.Mat();
                    cv.meanStdDev(lap, mean, std);
                    blurVar = std.data64F[0] ** 2;
                    // Global blur is now more lenient (Quality over Stillness)
                    const isGloballyBlurry = blurVar < 150;
                    lap.delete(); lap = null;

                    cv.meanStdDev(gray, mean, std);
                    avgBrightness = mean.data64F[0];

                    let hasHardShadow = false;

                    // 2. Hybrid Detection Logic (Paper Boundary Focused)
                    blurred = new cv.Mat();
                    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
                    // Removed medianBlur as it might be washing out the paper edges on low-res frames

                    edges = new cv.Mat();
                    // Lower thresholds to catch weaker edges of the paper on light surfaces
                    cv.Canny(blurred, edges, 30, 100);

                    // Dilate slightly to bridge gaps in the paper outline
                    const kernelSize = new cv.Size(3, 3);
                    const kernel = cv.getStructuringElement(cv.MORPH_RECT, kernelSize);
                    cv.dilate(edges, edges, kernel);
                    kernel.delete();

                    contours = new cv.MatVector();
                    hierarchy = new cv.Mat();
                    // RETR_EXTERNAL is much faster and cleaner for finding document boundaries
                    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

                    detected = null;
                    let maxArea = 0;
                    let detectedArea = 0;
                    let isLandscape = liveStatus.orientation === "Landscape"; // Preserve last known

                    for (let i = 0; i < contours.size(); i++) {
                        const c = contours.get(i);
                        const area = cv.contourArea(c);

                        // Ignore extremely small table noise
                        if (area < 10000) continue;

                        const peri = cv.arcLength(c, true);
                        const approx = new cv.Mat();
                        cv.approxPolyDP(c, approx, 0.015 * peri, true);

                        if (approx.rows === 4) {
                            const rect = cv.boundingRect(approx);
                            const aspectRatio = rect.width / rect.height;

                            const isPotentiallyPaper = (aspectRatio >= 0.35 && aspectRatio <= 0.95) ||
                                (aspectRatio >= 1.05 && aspectRatio <= 2.8);

                            if (isPotentiallyPaper) {
                                let score = area;
                                if (stableContour) {
                                    const prevPoints = stableContour.flatMap(p => [p.x * scale, p.y * scale]);
                                    const prevMat = cv.matFromArray(4, 1, cv.CV_32S, prevPoints);
                                    const prevArea = cv.contourArea(prevMat);
                                    prevMat.delete();

                                    const areaDiff = Math.abs(area - prevArea) / prevArea;
                                    if (areaDiff < 0.2) score *= 3.0; // Higher lock for auto-capture stability
                                }

                                if (score > maxArea) {
                                    maxArea = score;
                                    detectedArea = area;
                                    if (detected) detected.delete();
                                    detected = approx.clone();
                                }
                            }
                        }
                        approx.delete();
                    }

                    // 3. Document-Aware Shadow Detection (ROI ONLY)
                    if (detected) {
                        const rect = cv.boundingRect(detected);
                        shadowRoi = gray.roi(rect);

                        const rows = 4;
                        const cols = 4;
                        const tileW = Math.floor(shadowRoi.cols / cols);
                        const tileH = Math.floor(shadowRoi.rows / rows);
                        const tileMeans = [];

                        // Safety: Ensure tile dimensions are valid
                        if (tileW > 1 && tileH > 1) {
                            for (let r = 0; r < rows; r++) {
                                for (let c = 0; c < cols; c++) {
                                    const tileRect = new cv.Rect(c * tileW, r * tileH, tileW, tileH);
                                    const tile = shadowRoi.roi(tileRect);
                                    const meanVal = cv.mean(tile);
                                    tileMeans.push(meanVal[0]);
                                    tile.delete();
                                }
                            }
                            const shadowDiff = Math.max(...tileMeans) - Math.min(...tileMeans);
                            if (shadowDiff > 60) hasHardShadow = true;
                        }

                        // 4. Regional Blur Check (3x3 Grid on Document)
                        const bRows = 3;
                        const bCols = 3;
                        const bTileW = Math.floor(shadowRoi.cols / bCols);
                        const bTileH = Math.floor(shadowRoi.rows / bRows);
                        const tileBlurs = [];

                        if (bTileW > 4 && bTileH > 4) {
                            for (let r = 0; r < bRows; r++) {
                                for (let c = 0; c < bCols; c++) {
                                    const tileRect = new cv.Rect(c * bTileW, r * bTileH, bTileW, bTileH);
                                    const tile = shadowRoi.roi(tileRect);
                                    const tLap = new cv.Mat();
                                    cv.Laplacian(tile, tLap, cv.CV_64F);
                                    const tMean = new cv.Mat();
                                    const tStd = new cv.Mat();
                                    cv.meanStdDev(tLap, tMean, tStd);
                                    tileBlurs.push(tStd.data64F[0] ** 2);

                                    tLap.delete();
                                    tMean.delete();
                                    tStd.delete();
                                    tile.delete();
                                }
                            }
                            const minSharpness = Math.min(...tileBlurs);
                            // Regional threshold is strict (250 for ultra-clear text)
                            if (minSharpness < 250) isAnyPartBlurry = true;
                        }
                    }

                    // 3. Stability & Smoothing Logic
                    const now = Date.now();
                    let rawPoints = null;
                    let isCutOff = false;

                    if (detected) {
                        const data = detected.data32S;
                        const points = [];
                        for (let i = 0; i < 8; i += 2) {
                            points.push({ x: data[i] / scale, y: data[i + 1] / scale });
                        }

                        // Industry-Standard 4-Corner Sorting (Most Robust for Doc Scanners)
                        // TL: smallest sum(x+y), BR: largest sum(x+y)
                        // TR: smallest diff(y-x), BL: largest diff(y-x)

                        const sorted = [...points];
                        const sums = sorted.map(p => p.x + p.y);
                        const diffs = sorted.map(p => p.y - p.x);

                        rawPoints = [
                            sorted[sums.indexOf(Math.min(...sums))],  // Top-Left
                            sorted[diffs.indexOf(Math.min(...diffs))], // Top-Right
                            sorted[sums.indexOf(Math.max(...sums))],  // Bottom-Right
                            sorted[diffs.indexOf(Math.max(...diffs))]  // Bottom-Left
                        ];

                        // Validation: Border check on UNPADDED points (prevents padding conflict)
                        isCutOff = false;
                        rawPoints.forEach(p => {
                            if (p.x < 20 || p.x > video.videoWidth - 20 || p.y < 20 || p.y > video.videoHeight - 20) {
                                isCutOff = true;
                            }
                        });

                        // Calculate orientation for Smart Padding
                        const w = Math.hypot(rawPoints[1].x - rawPoints[0].x, rawPoints[1].y - rawPoints[0].y);
                        const h = Math.hypot(rawPoints[3].x - rawPoints[0].x, rawPoints[3].y - rawPoints[0].y);
                        isLandscape = h > w; // Inverted based on user feedback (Portrait camera feed)

                        // Apply Orientation-Aware Padding: (Increased)
                        // Refined Landscape: 6% Top/Bottom, 10% Side
                        const padSide = isLandscape ? 0.10 : 0.08;
                        const padTopBot = isLandscape ? 0.06 : 0.25;


                        const centerX = rawPoints.reduce((sum, p) => sum + p.x, 0) / 4;
                        const centerY = rawPoints.reduce((sum, p) => sum + p.y, 0) / 4;

                        rawPoints = rawPoints.map(p => {
                            let newX = p.x + (p.x - centerX) * padSide;
                            let newY = p.y + (p.y - centerY) * padTopBot;
                            return {
                                x: Math.max(0, Math.min(newX, video.videoWidth)),
                                y: Math.max(0, Math.min(newY, video.videoHeight))
                            };
                        });

                        // Update high-speed ref for drawLoop immediately
                        rawPointsRef.current = rawPoints;

                        // High-Frequency Sync (200ms)
                        if (now - lastStableUpdate.current > 200) {
                            setStableContour(rawPoints);
                            lastStableUpdate.current = now;
                        }

                        // "Perfect Frame" Selector: Area * Sharpness Score
                        // RELAXED: Use a lower threshold (30) to ensure we always have a best frame
                        const qualityScore = detectedArea * blurVar;
                        if (qualityScore > maxBlurVarRef.current || !bestFrameRef.current) {
                            maxBlurVarRef.current = qualityScore;
                            if (!bestFrameRef.current) {
                                bestFrameRef.current = document.createElement("canvas");
                            }
                            bestFrameRef.current.width = video.videoWidth;
                            bestFrameRef.current.height = video.videoHeight;
                            bestFrameRef.current.getContext("2d").drawImage(video, 0, 0);

                            // SYNC: Store exact points for this specific "Perfect Frame"
                            bestPointsRef.current = JSON.parse(JSON.stringify(rawPoints));
                        }
                    } else if (now - lastStableUpdate.current > 1000) {
                        // Reset if lost for 1s
                        setStableContour(null);
                        setSmoothedContour(null);
                        pointsTracker.current = null;
                    }

                    // 4. Smooth Interpolation (The "Tracker")
                    if (rawPoints) {
                        if (!pointsTracker.current) {
                            pointsTracker.current = JSON.parse(JSON.stringify(rawPoints));
                        } else {
                            // Interpolate for smoothness
                            const lerp = (start, end, amt) => start + (end - start) * amt;
                            pointsTracker.current = pointsTracker.current.map((p, i) => ({
                                x: lerp(p.x, rawPoints[i].x, 0.5), // Faster interpolation for better tracking
                                y: lerp(p.y, rawPoints[i].y, 0.5)
                            }));
                        }
                        setSmoothedContour([...pointsTracker.current]);
                    }

                    // 5. Validation Logic
                    let isValid = true;
                    let msg = "Document Detected";
                    let color = "text-green-500";

                    if (!rawPoints) {
                        isValid = false;
                        msg = "Searching for document...";
                        color = "text-white";
                        steadyCount.current = 0;
                        setCaptureProgress(0);
                        maxBlurVarRef.current = 0; // Reset sampling
                    } else {
                        // 6. Tilt Detection (Anti-Squeeze)
                        const topWidth = Math.hypot(rawPoints[1].x - rawPoints[0].x, rawPoints[1].y - rawPoints[0].y);
                        const bottomWidth = Math.hypot(rawPoints[2].x - rawPoints[3].x, rawPoints[2].y - rawPoints[3].y);
                        const leftHeight = Math.hypot(rawPoints[3].x - rawPoints[0].x, rawPoints[3].y - rawPoints[0].y);
                        const rightHeight = Math.hypot(rawPoints[2].x - rawPoints[1].x, rawPoints[2].y - rawPoints[1].y);

                        const widthRatio = Math.max(topWidth, bottomWidth) / Math.min(topWidth, bottomWidth);
                        const heightRatio = Math.max(leftHeight, rightHeight) / Math.min(leftHeight, rightHeight);
                        const isTooTilted = widthRatio > 1.15 || heightRatio > 1.15;

                        if (isCutOff) {
                            isValid = false; msg = "Center the Document"; color = "text-orange-500";
                            steadyCount.current = 0;
                            setCaptureProgress(0);
                        } else if (isTooTilted) {
                            isValid = false;
                            msg = "Hold Phone Parallel to Paper";
                            color = "text-orange-500";
                            steadyCount.current = 0;
                            setCaptureProgress(0);
                        } else if (isGloballyBlurry || isAnyPartBlurry) {
                            isValid = false;
                            msg = isGloballyBlurry ? "Keep Phone Steady" : "Poor Focus (Check Corners)";
                            color = "text-orange-500";
                            steadyCount.current = 0;
                            setCaptureProgress(0);
                        } else if (hasHardShadow) {
                            isValid = false;
                            msg = "Uneven Lighting / Hard Shadow";
                            color = "text-orange-500";
                            steadyCount.current = 0;
                            setCaptureProgress(0);
                        } else {
                            // Faster Auto-Capture (0.3s window - 5 frames)
                            steadyCount.current += 1;
                            const progress = Math.min(100, (steadyCount.current / 5) * 100);
                            setCaptureProgress(progress);

                            if (progress >= 100 && !capturedImageData) {
                                steadyCount.current = 0;
                                setCaptureProgress(0);
                                handleCapture(rawPoints);
                            }
                        }
                    }

                    setLiveStatus({
                        isValid,
                        message: msg,
                        color,
                        orientation: isLandscape ? "Landscape" : "Portrait"
                    });

                } catch (e) {
                    console.error("OpenCV Processing Error:", e);
                } finally {
                    // Robust Cleanup
                    if (src) src.delete();
                    if (gray) gray.delete();
                    if (lap) lap.delete();
                    if (mean) mean.delete();
                    if (std) std.delete();
                    if (blurred) blurred.delete();
                    if (edges) edges.delete();
                    if (contours) contours.delete();
                    if (hierarchy) hierarchy.delete();
                    if (detected) detected.delete();
                    if (shadowRoi) shadowRoi.delete();
                }
            }
            // Processing loop runs at ~10-15fps to prevent "hanging"
            processingTimeoutId.current = setTimeout(processFrame, 60);
        };

        // Separate UI Loop for 60fps Zero-Lag Dots
        const drawLoop = () => {
            if (!videoRef.current || !open || capturedImageData || !isLoopingRef.current) return;

            // Fast LERP for the UI dots (Happens every frame regardless of CV speed)
            if (rawPointsRef.current) {
                if (!pointsTracker.current) {
                    pointsTracker.current = JSON.parse(JSON.stringify(rawPointsRef.current));
                } else {
                    const lerp = (start, end, amt) => start + (end - start) * amt;
                    pointsTracker.current = pointsTracker.current.map((p, i) => ({
                        x: lerp(p.x, rawPointsRef.current[i].x, 0.4),
                        y: lerp(p.y, rawPointsRef.current[i].y, 0.4)
                    }));
                }
                setSmoothedContour([...pointsTracker.current]);
            }

            uiAnimationFrameId.current = requestAnimationFrame(drawLoop);
        };

        processFrame();
        drawLoop();
    };

    const handleCapture = async (pointsFromLoop = null) => {
        if (!videoRef.current || captureTriggeredRef.current) return;

        captureTriggeredRef.current = true;
        setShutterFlash(true);
        setTimeout(() => setShutterFlash(false), 150); // Instant visual feedback

        setIsProcessing(true);
        isLoopingRef.current = false; // Kill loop immediately

        // REAL-TIME SYNC: Use sampled points for sampled frame, or live points for live frame
        const sourceCanvas = bestFrameRef.current || videoRef.current;

        // Ensure pointsFromLoop is actually a coordinate array (and not a React Event object)
        const validPointsFromLoop = Array.isArray(pointsFromLoop) ? pointsFromLoop : null;

        const finalContour = (bestFrameRef.current && bestPointsRef.current)
            ? bestPointsRef.current
            : (validPointsFromLoop || stableContour || smoothedContour);

        const video = videoRef.current;
        const canvas = document.createElement("canvas");

        // Ensure accurate dims regardless of source type
        canvas.width = (bestFrameRef.current) ? bestFrameRef.current.width : video.videoWidth;
        canvas.height = (bestFrameRef.current) ? bestFrameRef.current.height : video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(sourceCanvas, 0, 0);

        try {
            let resultCanvas = canvas;

            // 1. CROP (Warp) FIRST using the exact synced points
            // This now uses a 5% "Safety Buffer" from documentScanner.js to handle motion
            if (finalContour && cvReady()) {
                resultCanvas = warpPerspective(canvas, finalContour);

                // 1b. SECONDARY PASS: Detect and tighten crop to fix motion cutoff
                // Fire up table detection again on the frozen frame
                const refinedContour = detectDocument(resultCanvas);
                if (refinedContour) {
                    // Warp again to tighten the crop perfectly to the document edges
                    resultCanvas = warpPerspective(resultCanvas, refinedContour);
                }
            }

            // 2. HARDWARE ROTATION: Rotate image based on how the phone was held
            if (deviceRotation !== 0) {
                resultCanvas = rotateCanvas(resultCanvas, -deviceRotation);
            }

            // SHOW RAW CROP IMMEDIATELY (UX: Open review screen instantly)
            setCapturedImageData(resultCanvas.toDataURL("image/jpeg", 0.95));
            setIsProcessing(false);
            setIsEnhancing(true);

            if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
            if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);

            // 2. APPLY FILTERS IN BACKGROUND
            setTimeout(() => {
                try {
                    if (cvReady()) {
                        const finalCanvas = enhanceImage(resultCanvas);
                        setCapturedImageData(finalCanvas.toDataURL("image/jpeg", 0.95));
                    }
                    setIsEnhancing(false);
                } catch (err) {
                    console.error("Enhancement failed:", err);
                    setIsEnhancing(false);
                }
            }, 100);

            const stream = videoRef.current.srcObject;
            if (stream) stream.getTracks().forEach(track => track.stop());
        } catch (e) {
            console.error("Capture Error:", e);
            setIsProcessing(false);
            setIsEnhancing(false);
        }
    };

    const handleConfirm = async () => {
        if (!capturedImageData) return;
        const image = new Image();
        image.src = capturedImageData;
        await new Promise(r => image.onload = r);

        let canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d").drawImage(image, 0, 0);

        // Apply manual rotation if any
        if (manualRotation !== 0) {
            canvas = rotateCanvas(canvas, manualRotation);
        }

        const file = await canvasToFile(canvas, "scanned_doc.jpg");
        onCapture(file);
        onClose();
    };

    const handleRetake = () => {
        isLoopingRef.current = false;
        if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
        if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);

        setCapturedImageData(null);
        setManualRotation(0);
        setStableContour(null);
        setSmoothedContour(null);
        pointsTracker.current = null;
        rawPointsRef.current = null;
        maxBlurVarRef.current = 0;
        bestFrameRef.current = null;
        bestPointsRef.current = null;
        steadyCount.current = 0;
        setCaptureProgress(0);
        setIsProcessing(false);
        captureTriggeredRef.current = false;
        // The initCamera side-effect will restart the stream because capturedImageData changes
    };

    const handleGalleryUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            setCapturedImageData(event.target.result);
            setIsProcessing(false);
            setProcessingMessage("");
            setManualRotation(0);
        };
        reader.readAsDataURL(file);
    };

    // Draw Smooth Overlay with Blue Dots
    useEffect(() => {
        if (!overlayRef.current || !videoRef.current || capturedImageData) return;
        const canvas = overlayRef.current;
        const ctx = canvas.getContext('2d');

        // Use offsetWidth/Height for more reliable layout dimensions
        const width = videoRef.current.offsetWidth;
        const height = videoRef.current.offsetHeight;

        if (width === 0 || height === 0) return;

        canvas.width = width;
        canvas.height = height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (smoothedContour) {
            const video = videoRef.current;
            const scaleX = canvas.width / video.videoWidth;
            const scaleY = canvas.height / video.videoHeight;

            // 1. Draw connecting lines
            ctx.beginPath();
            ctx.lineWidth = 3;
            ctx.strokeStyle = liveStatus.isValid ? 'rgba(34, 197, 94, 0.8)' : 'rgba(59, 130, 246, 0.6)'; // Green if valid, Blue if searching

            smoothedContour.forEach((p, i) => {
                const x = p.x * scaleX;
                const y = p.y * scaleY;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();

            // 2. Fill area
            ctx.fillStyle = liveStatus.isValid ? 'rgba(34, 197, 94, 0.2)' : 'rgba(59, 130, 246, 0.1)';
            ctx.fill();

            // 3. Draw Blue Corner Dots
            smoothedContour.forEach(p => {
                const x = p.x * scaleX;
                const y = p.y * scaleY;

                // Outer Glow
                ctx.beginPath();
                ctx.arc(x, y, 12, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
                ctx.fill();

                // Inner Dot
                ctx.beginPath();
                ctx.arc(x, y, 6, 0, Math.PI * 2);
                ctx.fillStyle = '#3b82f6'; // Bright Blue
                ctx.shadowBlur = 10;
                ctx.shadowColor = '#3b82f6';
                ctx.fill();
                ctx.shadowBlur = 0; // Reset

                // White Center
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();
            });
        }
    }, [smoothedContour, liveStatus, capturedImageData]);

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black z-[10000] flex flex-col font-sans overflow-hidden">
            {/* Header - Fixed Height & Solid Background to prevent overlap */}
            <div className="h-16 flex justify-between items-center px-6 bg-black border-b border-white/10 text-white z-[20000] shrink-0">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                        <span className="font-bold text-sm text-gray-400 capitalize -mb-1">{shgName || "Document Scan"}</span>
                        <span className="font-bold text-lg tracking-tight">{shgId || "Smart Scanner"}</span>
                    </div>
                    {capturedImageData && (
                        <div className="flex items-center gap-2 ml-4">
                            <button
                                onClick={() => handleRotate('left')}
                                className="p-2.5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                                title="Rotate Left"
                            >
                                <RotateCw className="scale-x-[-1]" size={20} />
                            </button>
                            <button
                                onClick={() => handleRotate('right')}
                                className="p-2.5 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                                title="Rotate Right"
                            >
                                <RotateCw size={20} />
                            </button>
                        </div>
                    )}
                </div>
                <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            {/* Viewfinder / Review Container - Strictly constrained */}
            <div className="flex-1 relative min-h-0 bg-black flex flex-col overflow-hidden">
                {!capturedImageData ? (
                    <div className="absolute inset-0 flex flex-col">
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="absolute inset-0 w-full h-full object-cover"
                        />
                        {/* Shutter Flash Effect */}
                        {shutterFlash && (
                            <div className="absolute inset-0 bg-white z-[60] animate-pulse" />
                        )}
                        <canvas
                            ref={overlayRef}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleGalleryUpload}
                            className="hidden"
                        />

                        {/* Status Messages */}
                        <div className="absolute top-4 left-0 right-0 flex flex-col items-center z-20 gap-2">
                            {/* Orientation Badge */}
                            <div className={`px-3 py-1 ${liveStatus.isValid ? 'bg-blue-600/80' : 'bg-gray-600/50'} rounded-full text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/20 transition-colors`}>
                                {liveStatus.isValid ? liveStatus.orientation : "Detecting"} Mode
                            </div>

                            <div className={`px-4 py-1.5 rounded-full backdrop-blur-md bg-black/60 border border-white/20 font-bold text-sm ${liveStatus.color} shadow-lg transition-colors duration-300`}>
                                {liveStatus.message}
                            </div>
                            {/* Auto-Capture Progress Bar */}
                            {captureProgress > 0 && (
                                <div className="mt-2 w-32 h-1 bg-black/40 rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                        style={{ width: `${captureProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Capture Button Container */}
                        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-20 gap-8">
                            {/* Gallery Button */}
                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95 shadow-lg"
                                title={t?.('upload.gallery') || "Upload from Gallery"}
                            >
                                <ImageIcon size={24} />
                            </button>

                            {/* Camera Shutter */}
                            <button
                                onClick={() => handleCapture()} // Wrap in lambda to avoid event object pollution
                                disabled={!isCameraActive || isProcessing}
                                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${liveStatus.isValid ? 'border-green-500 scale-110' : 'border-white'}`}
                            >
                                <div className={`w-16 h-16 rounded-full ${liveStatus.isValid ? 'bg-green-500 animate-pulse' : 'bg-white'}`}></div>
                            </button>

                            {/* Spacer to balance the layout if needed, or another button */}
                            <div className="w-12" />
                        </div>

                        {/* Processing Overlay */}
                        {isProcessing && (
                            <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-[100] backdrop-blur-sm">
                                <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(34,197,94,0.5)]"></div>
                                <div className="bg-black/40 px-6 py-2 rounded-full border border-white/10 text-white font-bold animate-pulse">
                                    Processing HD Image...
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Review Screen - Enhanced Flex/Grid to prevent button cut-off */
                    <div className="flex-1 flex flex-col min-h-0 bg-black w-full overflow-hidden">
                        <div
                            ref={reviewContainerRef}
                            className="flex-1 min-h-0 flex items-center justify-center p-4 relative bg-black overflow-hidden"
                        >
                            <div className="relative w-full h-full flex items-center justify-center transition-transform duration-300 ease-out"
                                style={{ transform: `rotate(${manualRotation}deg) scale(${rotationScale})` }}
                            >
                                <img
                                    src={capturedImageData}
                                    className="max-w-full max-h-full object-contain shadow-2xl"
                                    alt="Scanned"
                                />
                            </div>
                            {/* Enhancement Label */}
                            {isEnhancing && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/20 flex items-center gap-2 z-30">
                                    <RotateCw className="animate-spin text-green-500" size={14} />
                                    <span className="text-white font-bold text-xs tracking-wide">Enhancing details...</span>
                                </div>
                            )}
                        </div>
                        {/* Footer - Fixed at bottom without floating gaps */}
                        <div className="bg-gray-900 border-t border-white/10 p-4 sm:p-6 flex gap-4 shrink-0 pb-6 shadow-[0_-4px_10px_rgba(0,0,0,0.5)]">
                            <button
                                onClick={handleRetake}
                                className="flex-1 py-3.5 sm:py-4 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-white transition-colors text-sm sm:text-base border border-white/5"
                            >
                                Retake
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-3.5 sm:py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white shadow-lg transition-colors text-sm sm:text-base"
                            >
                                Save Scan
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Error Overlay */}
            {cameraError && (
                <div className="absolute inset-0 bg-black flex items-center justify-center p-8 text-center text-white">
                    <div>
                        <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
                        <p>{cameraError}</p>
                        <button onClick={onClose} className="mt-6 px-6 py-2 bg-gray-800 rounded-lg">Close</button>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default SmartCamera;
