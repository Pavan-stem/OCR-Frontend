import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, X, AlertTriangle, CheckCircle, Loader, RotateCw, Crop, RefreshCw, Image as ImageIcon, ScanLine, Flashlight } from "lucide-react";
import { scanDocument, canvasToFile, rotateCanvas, cropCanvas, warpPerspective, detectDocument, validateSHGTableStructure, drawTableOverlay } from "./utils/documentScanner";
import { enhanceImage } from "./utils/imageEnhancer";
import { validateGalleryImage } from "./utils/galleryValidator";
import { startCamera, stopCamera } from "./utils/cameraController";
import { setSelectedPage, classifyImage, validatePage } from "./utils/documentClassifier";

const cvReady = () => !!(window.cv && window.cv.Mat);

const SmartCamera = ({ open, onClose, onCapture, isUploading, shgId, shgName, page = 1, t }) => {
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
    const [enhancementStatus, setEnhancementStatus] = useState("");
    const [galleryError, setGalleryError] = useState(null);
    const [isGalleryLoading, setIsGalleryLoading] = useState(false);
    const [galleryRejection, setGalleryRejection] = useState(null); // { message } when scan fails
    const [isGalleryMode, setIsGalleryMode] = useState(false); // Explicitly track gallery flow
    const [cameraEnabled, setCameraEnabled] = useState(true); // Flag to prevent auto-restart

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
    const isFromGalleryRef = useRef(false);

    const maxBlurVarRef = useRef(0);
    const bestFrameRef = useRef(null);
    const bestPointsRef = useRef(null);
    const rawPointsRef = useRef(null); // High-speed sync ref for dots
    const [deviceRotation, setDeviceRotation] = useState(0);
    const [selectedPageInternal, setSelectedPageInternal] = useState(1);
    const currentSessionId = useRef(Date.now());

    // Manual Crop State
    const [showManualCrop, setShowManualCrop] = useState(false);
    const [rawCaptureCanvas, setRawCaptureCanvas] = useState(null);
    const [manualCropPoints, setManualCropPoints] = useState(null);
    const [autoCropPoints, setAutoCropPoints] = useState(null);

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
            setGalleryRejection(null);
            setGalleryError(null);
            setIsGalleryMode(false); // Ensure fresh start on open
            setSelectedPageInternal(page);
            setSelectedPage(page);
        }
    }, [open, page]);

    // When gallery rejection is dismissed, restart the camera processing loop.
    // We use useEffect (not an onClick handler) so startProcessingLoop captures fresh state.
    const hadGalleryRejectionRef = useRef(false);
    useEffect(() => {
        if (galleryRejection) {
            hadGalleryRejectionRef.current = true;
            isLoopingRef.current = false; // Ensure loop is stopped
        } else if (hadGalleryRejectionRef.current && open && !capturedImageData && !isLoopingRef.current) {
            hadGalleryRejectionRef.current = false;
            // Only restart the loop if we aren't in gallery mode
            if (!isGalleryMode) {
                startProcessingLoop();
            }
        }
    }, [galleryRejection, open, capturedImageData, isGalleryMode]);

    // Initialize camera and recovery-from-cancel logic
    useEffect(() => {
        // Recovery: If window gets focus and we are stuck in gallery mode without loading, return to camera
        const handleFocus = () => {
            // Delay slightly to allow handleGalleryUpload to set isGalleryLoading if a file was picked
            setTimeout(() => {
                if (isGalleryMode && !isGalleryLoading && !capturedImageData && open) {
                    console.log("Gallery picker likely cancelled, returning to camera...");
                    setIsGalleryMode(false);
                }
            }, 500);
        };

        if (isGalleryMode) {
            window.addEventListener('focus', handleFocus);
        }

        // CRITICAL: Block initialization if camera is disabled, if in gallery mode, if image already captured, if uploading, or if processing/enhancing
        if (!open || !cameraEnabled || capturedImageData || isGalleryMode || isUploading || isProcessing || isEnhancing) {
            return () => {
                window.removeEventListener('focus', handleFocus);
            };
        }

        const initCamera = async () => {
            try {
                await startCamera(videoRef.current);
                if (videoRef.current) {
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
            window.removeEventListener('focus', handleFocus);
            isLoopingRef.current = false;

            // Comprehensive Track Stopping via Utility
            stopCamera(videoRef.current);

            if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);
            if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
            maxBlurVarRef.current = 0;
            bestFrameRef.current = null;
            bestPointsRef.current = null;
            rawPointsRef.current = null;
        };
    }, [open, cameraEnabled, capturedImageData, isGalleryMode, isGalleryLoading, isUploading, isProcessing, isEnhancing]);

    const startProcessingLoop = () => {
        if (isLoopingRef.current) return; // Prevent multiple loops
        isLoopingRef.current = true;

        const processFrame = () => {
            if (!videoRef.current || !canvasRef.current || !open || capturedImageData || !isLoopingRef.current || isGalleryMode) {
                isLoopingRef.current = false;
                return;
            }

            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                let src, gray, lap, mean, std, blurred, edges, contours, hierarchy, detected, shadowRoi, paddedPoints;
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
                    // Balanced blur for document silhouette (not too aggressive)
                    cv.GaussianBlur(gray, blurred, new cv.Size(7, 7), 0);

                    edges = new cv.Mat();
                    // More sensitive thresholds to catch paper boundaries on light surfaces
                    cv.Canny(blurred, edges, 20, 80);

                    // Dilate and close to solidify the paper perimeter
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

                        // Ignore extremely small table noise (Threshold lowered to 1% to support 1.5m distance)
                        if (area < (canvas.width * canvas.height * 0.01)) continue;

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

                            // NEW: Relax shadow detection for distant shots (small documents)
                            // A document covering < 5% of the frame at 1m distance is more prone to minor background shadows.
                            const areaRatio = detectedArea / (canvas.width * canvas.height);
                            const shadowThreshold = areaRatio < 0.05 ? 100 : 60;
                            if (shadowDiff > shadowThreshold) hasHardShadow = true;
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
                            // Regional threshold — relaxed to allow slight hand shake
                            if (minSharpness < 120) isAnyPartBlurry = true;
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

                        // Calculate orientation & Distance-Aware Padding
                        const w = Math.hypot(rawPoints[1].x - rawPoints[0].x, rawPoints[1].y - rawPoints[0].y);
                        const h = Math.hypot(rawPoints[3].x - rawPoints[0].x, rawPoints[3].y - rawPoints[0].y);
                        isLandscape = h > w;

                        // NEW: Distance-Aware Dynamic Padding (0.3m -> 1.5m)
                        // distFactor: 0 (near/large) to 1 (far/small)
                        const areaRatio = detectedArea / (canvas.width * canvas.height);
                        const distFactor = Math.max(0, Math.min(1.0, 1.0 - (areaRatio * 1.8)));

                        const padSide = 0.08 + (distFactor * 0.12); // Near: 8% | Far: 20%
                        const padTopBot = (isLandscape ? 0.04 : 0.06) + (distFactor * 0.08); // Near: 4-6% | Far: 12-14%


                        const centerX = rawPoints.reduce((sum, p) => sum + p.x, 0) / 4;
                        const centerY = rawPoints.reduce((sum, p) => sum + p.y, 0) / 4;

                        const PAD_RATIO = 0.05; // 5% outward padding on all sides
                        paddedPoints = rawPoints.map(p => ({
                            x: Math.max(0, Math.min(video.videoWidth, p.x + (p.x - centerX) * PAD_RATIO)),
                            y: Math.max(0, Math.min(video.videoHeight, p.y + (p.y - centerY) * PAD_RATIO)),
                        }));

                        // UI Visual Feedback: Dots snap to REAL corners (unpadded)
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
                            bestPointsRef.current = JSON.parse(JSON.stringify(paddedPoints));
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
                            // LOWER amt = Smoother/Slower movement (0.2 is ideal for stabilization)
                            const lerp = (start, end, amt) => start + (end - start) * amt;

                            // Dead-zone check: Only update if total corner movement is significant (> 1.5 pixels)
                            // This prevents microscopic sensor jitter from causing visual flickering.
                            const totalMove = rawPoints.reduce((sum, p, i) =>
                                sum + Math.abs(p.x - pointsTracker.current[i].x) + Math.abs(p.y - pointsTracker.current[i].y), 0);

                            if (totalMove > 1.5) {
                                pointsTracker.current = pointsTracker.current.map((p, i) => ({
                                    x: lerp(p.x, rawPoints[i].x, 0.2),
                                    y: lerp(p.y, rawPoints[i].y, 0.2)
                                }));
                            }
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
                        maxBlurVarRef.current = 0; // Reset sampling
                    } else {
                        // 6. Dynamic Stability Logic (Distance-Aware)
                        const topWidth = Math.hypot(rawPoints[1].x - rawPoints[0].x, rawPoints[1].y - rawPoints[0].y);
                        const bottomWidth = Math.hypot(rawPoints[2].x - rawPoints[3].x, rawPoints[2].y - rawPoints[3].y);
                        const leftHeight = Math.hypot(rawPoints[3].x - rawPoints[0].x, rawPoints[3].y - rawPoints[0].y);
                        const rightHeight = Math.hypot(rawPoints[2].x - rawPoints[1].x, rawPoints[2].y - rawPoints[1].y);

                        const widthRatio = Math.max(topWidth, bottomWidth) / Math.min(topWidth, bottomWidth);
                        const heightRatio = Math.max(leftHeight, rightHeight) / Math.min(leftHeight, rightHeight);

                        const areaRatio = detectedArea / (canvas.width * canvas.height);

                        // Relax tilt requirement for small, distant documents
                        // 1.15 (15% diff) for large, 1.25 (25% diff) for small
                        const tiltThreshold = areaRatio < 0.10 ? 1.25 : 1.15;
                        const isTooTilted = widthRatio > tiltThreshold || heightRatio > tiltThreshold;

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
                            // Auto-capture Speed (Distance-Aware)
                            // Distant (small) documents get a faster lock (7 frames vs 10)
                            const STABLE_FRAMES_NEEDED = areaRatio < 0.10 ? 7 : 10;
                            steadyCount.current += 1;
                            const progress = Math.min(100, (steadyCount.current / STABLE_FRAMES_NEEDED) * 100);
                            setCaptureProgress(progress);

                            // Update message to show countdown phase
                            if (progress < 40) {
                                msg = "Hold still — locking on…";
                            } else if (progress < 80) {
                                msg = "Stay steady — almost ready…";
                            } else if (progress < 100) {
                                msg = "Capturing…";
                            }

                            if (progress >= 100 && !capturedImageData && !captureTriggeredRef.current) {
                                // Final lock-in: don't reset progress until handleCapture takes over
                                handleCapture(paddedPoints);
                            }
                        }
                    }

                    // Stability Latch (De-flicker): Keep the box visible if we have a recent lock
                    const isUiStable = isValid || steadyCount.current > 0;

                    setLiveStatus({
                        isValid: isUiStable,
                        message: isUiStable ? msg : "Searching for document...",
                        color: isUiStable ? color : "text-white",
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

        const sourceFrame = bestFrameRef.current || videoRef.current;

        const finalContour = (bestFrameRef.current && bestPointsRef.current)
            ? bestPointsRef.current
            : (Array.isArray(pointsFromLoop) ? pointsFromLoop : (stableContour || smoothedContour));

        const video = videoRef.current;
        const canvas = document.createElement("canvas");

        // Ensure accurate dims regardless of source type
        canvas.width = (bestFrameRef.current) ? bestFrameRef.current.width : video.videoWidth;
        canvas.height = (bestFrameRef.current) ? bestFrameRef.current.height : video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(sourceFrame, 0, 0);

        try {
            let resultCanvas = canvas;
            isFromGalleryRef.current = false; // Reset source on every manual capture

            // 1. CROP (Warp) FIRST using the exact synced points
            // This now uses a 5% "Safety Buffer" from documentScanner.js to handle motion
            if (finalContour && cvReady()) {
                // Primary warp with orientation-aware padding from the live loop
                resultCanvas = warpPerspective(canvas, finalContour);
            }

            // 2. HARDWARE ROTATION: Rotate image based on how the phone was held
            if (deviceRotation !== 0) {
                resultCanvas = rotateCanvas(resultCanvas, -deviceRotation);
            }

            // [NEW] STORE RAW DATA AND SHOW MANUAL CROP IMMEDIATELY
            setRawCaptureCanvas(canvas);
            setManualCropPoints(JSON.parse(JSON.stringify(finalContour)));
            setAutoCropPoints(JSON.parse(JSON.stringify(finalContour)));
            setShowManualCrop(true); // Go straight to manual adjustment

            // Clear live loop refs
            if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
            if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);
        } catch (e) {
            console.error("Capture Error:", e);
            setIsProcessing(false);
            setIsEnhancing(false);
        }

        // Explicitly stop camera stream after capture (UX: Review and Enhance phase)
        stopCamera(videoRef.current);
        setIsCameraActive(false);
        currentSessionId.current = Date.now(); // Track this session
    };

    const handleConfirm = async () => {
        if (!capturedImageData) return;

        setIsProcessing(true);
        setProcessingMessage("Finalizing image...");

        try {
            const image = new Image();
            image.src = capturedImageData;
            await new Promise(r => image.onload = r);

            let canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(image, 0, 0);

            // Apply manual rotation if any
            if (manualRotation !== 0) {
                canvas = rotateCanvas(canvas, manualRotation);
            }

            // [NEW] Orientation Gate: Reject portrait images inside the camera viewer
            // This allows the user to rotate and try again without closing the camera.
            if (canvas.height > canvas.width) {
                console.warn('[Camera] Rejection: Portrait orientation detected.');
                setGalleryRejection({
                    message: t?.('upload.portraitError') || "Please rotate the image to landscape and try again.",
                    stayInReview: true
                });
                setIsProcessing(false);
                return;
            }

            console.log('[Camera] Proceeding to capture finalized image.');

            const file = await canvasToFile(canvas, "scanned_doc.jpg");
            onCapture(file);
            onClose();
        } catch (err) {
            console.error("Confirmation error:", err);
            setGalleryRejection({ message: "Failed to finalize image. Please try again." });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRetake = () => {
        isLoopingRef.current = false;
        if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
        if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);

        setCapturedImageData(null);
        setManualRotation(0);
        setStableContour(null);
        setSmoothedContour(null);
        setIsGalleryMode(false); // Returning to live camera
        pointsTracker.current = null;
        rawPointsRef.current = null;
        maxBlurVarRef.current = 0;
        bestFrameRef.current = null;
        bestPointsRef.current = null;
        steadyCount.current = 0;
        setCaptureProgress(0);
        setIsProcessing(false);
        captureTriggeredRef.current = false;
        setGalleryRejection(null);
        setIsGalleryMode(false); // Returning to manual scanning
        setCameraEnabled(true); // Allow camera to restart
    };

    /**
     * Layer-1 pre-validation: metadata checks that run before any OpenCV processing.
     * Returns a rejection reason string, or null if the file looks OK.
     */
    const checkScreenshotMetadata = useCallback(async (file) => {
        // ── 1. Filename pattern (most reliable for Android & iOS) ──
        const name = file.name.toLowerCase();
        const SCREENSHOT_PATTERNS = [
            /^screenshot/,        // Android: Screenshot_20240101_...
            /screen.?shot/,       // screen_shot, screenShot, screen-shot
            /screen.?cap/,        // screencap, screen_cap
            /^capture/,           // Capture_...
            /^img_\d{4}$/,        // iOS: IMG_1234 (bare numbers only — photo roll format)
        ];
        if (SCREENSHOT_PATTERNS.some(p => p.test(name))) {
            return 'Screenshots are not allowed. Please capture a real photo of the document.';
        }

        // ── 2. EXIF binary scan (first 64 KB) ──
        // Screenshots from some Android phones embed a "Software: Screenshot" tag in EXIF.
        try {
            const buf = await file.slice(0, 65536).arrayBuffer();
            const text = new TextDecoder('latin1').decode(new Uint8Array(buf));
            const EXIF_SCREENSHOT_MARKERS = [
                'Screenshot', 'screencap', 'screen_shot', 'ScreenShot',
                'com.android.systemui',  // Android system UI package in MakerNote
                'QuickTime Screen',       // iOS screen recording metadata
            ];
            if (EXIF_SCREENSHOT_MARKERS.some(m => text.includes(m))) {
                return 'Screenshots are not allowed. Please capture a real photo of the document.';
            }
        } catch {
            // EXIF read failure is non-fatal — fall through to OpenCV checks
        }

        // ── 3. Image dimension / aspect-ratio check ──
        // Phone screens are very tall portrait (aspect > 1.85) or exact device resolutions.
        try {
            const url = URL.createObjectURL(file);
            const { width, height } = await new Promise((res, rej) => {
                const img = new Image();
                img.onload = () => { URL.revokeObjectURL(url); res({ width: img.width, height: img.height }); };
                img.onerror = () => { URL.revokeObjectURL(url); rej(); };
                img.src = url;
            });

            const aspect = Math.max(width, height) / Math.min(width, height);
            // Phone screenshots: aspect > 2.4 (modern phones are up to 2.22, but screenshots often include UI)
            // Relaxed from 1.85 to 2.4 to allow "Full Screen" camera modes (21:9 etc)
            if (aspect > 2.4) {
                return 'This image appears to be a phone screenshot. Please take a real photo of the document.';
            }

            // Common exact phone screen widths (the other side is always a standard height)
            const KNOWN_SCREEN_WIDTHS = new Set([
                360, 375, 390, 393, 402, 412, 414, 428, 480, 540,
                720, 750, 828, 1080, 1125, 1170, 1218, 1242, 1284
            ]);
            const shortSide = Math.min(width, height);
            // Relaxed aspect check for known widths from 1.6 to 2.2
            if (KNOWN_SCREEN_WIDTHS.has(shortSide) && aspect > 2.2) {
                return 'This image appears to be a phone screenshot. Please take a real photo of the document.';
            }
        } catch {
            // If we can't read dimensions, fall through to OpenCV
        }

        return null; // looks OK — proceed to OpenCV validation
    }, []);

    const handleGalleryUpload = useCallback(async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        e.target.value = ''; // reset so the same file can be re-selected

        if (!file.type.startsWith('image/')) {
            setGalleryError('Please select a valid image file (JPG, PNG, WebP).');
            return;
        }

        setGalleryError(null);
        setGalleryRejection(null);
        setIsGalleryLoading(true);
        setManualRotation(0);

        try {
            // ── Layer 1: Fast metadata / dimension pre-check ──
            const metaRejection = await checkScreenshotMetadata(file);
            if (metaRejection) {
                // Stop the camera processing loop so it doesn't auto-capture behind the overlay
                isLoopingRef.current = false;
                if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
                if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);

                // 🔴 STOP CAMERA IMMEDIATELY
                setCameraEnabled(false);
                stopCamera(videoRef.current);
                setIsCameraActive(false);

                setGalleryRejection({ message: metaRejection });
                return;
            }

            // 🔴 STOP CAMERA IMMEDIATELY before heavy validation
            setCameraEnabled(false);
            stopCamera(videoRef.current);
            setIsCameraActive(false);

            // ── Layer 2: Full Robust Validation (Extracted from project_submission) ──
            const result = await validateGalleryImage(file);

            if (!result.isValid) {
                // Stop the camera processing loop so it doesn't auto-capture behind the overlay
                isLoopingRef.current = false;
                if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
                if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);
                setGalleryRejection({
                    message: result.message,
                    metrics: result.metrics
                });
                return;
            }

            // ── Validation passed ── use the pre-decoded safe canvas
            const sourceCanvas = result.fullCanvas;
            isFromGalleryRef.current = true; // Mark as gallery source
            const finalContour = result.corners;

            // [NEW] STORE RAW DATA AND SHOW MANUAL CROP IMMEDIATELY
            setRawCaptureCanvas(sourceCanvas);
            setManualCropPoints(JSON.parse(JSON.stringify(finalContour || [])));
            setAutoCropPoints(JSON.parse(JSON.stringify(finalContour || [])));
            setShowManualCrop(true);

            // Skip immediate background enhancement for now, let manual crop handle it
            setIsProcessing(false);
            setProcessingMessage('');
            setIsEnhancing(false);

        } catch (err) {
            setGalleryError(err.message || 'Failed to process image.');
        } finally {
            setIsGalleryLoading(false);
        }
    }, [checkScreenshotMetadata]);

    // Draw Smooth Overlay with Professional "L" brackets
    useEffect(() => {
        if (!overlayRef.current || !videoRef.current || capturedImageData) return;
        const canvas = overlayRef.current;

        // Use offsetWidth/Height for more reliable layout dimensions
        const width = videoRef.current.offsetWidth;
        const height = videoRef.current.offsetHeight;

        if (width === 0 || height === 0) return;
        canvas.width = width;
        canvas.height = height;

        // Don't draw if camera is hidden or in gallery mode
        if (capturedImageData || isGalleryMode) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        if (smoothedContour) {
            const video = videoRef.current;
            const scaleX = canvas.width / video.videoWidth;
            const scaleY = canvas.height / video.videoHeight;

            drawTableOverlay(
                canvas,
                smoothedContour,
                liveStatus.isValid,
                scaleX,
                scaleY
            );
        } else {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [smoothedContour, liveStatus, capturedImageData, isGalleryMode]);

    const resetCaptureState = () => {
        isLoopingRef.current = false;
        if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
        if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);

        setCapturedImageData(null);
        setManualRotation(0);
        setStableContour(null);
        setSmoothedContour(null);
        setIsGalleryMode(false);
        setIsProcessing(false);
        setIsEnhancing(false);
        setEnhancementStatus('');
        setGalleryRejection(null);
        setGalleryError(null);
        pointsTracker.current = null;
        rawPointsRef.current = null;
        maxBlurVarRef.current = 0;
        bestFrameRef.current = null;
        bestPointsRef.current = null;
        steadyCount.current = 0;
        setCaptureProgress(0);
        captureTriggeredRef.current = false;

        // Ensure camera re-mounts if it was stopped
        setCameraEnabled(false);
        setTimeout(() => setCameraEnabled(true), 10);

        setShowManualCrop(false);
        setRawCaptureCanvas(null);
        setManualCropPoints(null);
        setAutoCropPoints(null);
    };

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black z-[10000] flex flex-col font-sans overflow-hidden">
            {showManualCrop && rawCaptureCanvas && (
                <ManualCropper
                    canvas={rawCaptureCanvas}
                    initialPoints={manualCropPoints}
                    onCancel={() => resetCaptureState()}
                    onApply={async (newPoints) => {
                        setShowManualCrop(false);
                        setIsProcessing(true);
                        setIsEnhancing(true);
                        try {
                            setManualCropPoints(newPoints);
                            const warped = warpPerspective(rawCaptureCanvas, newPoints);

                            setEnhancementStatus("Enhancing adjusted crop...");
                            const finalCanvas = await enhanceImage(warped, (msg) => {
                                setEnhancementStatus(msg);
                            }, isFromGalleryRef.current ? 'gallery' : 'camera');

                            if (finalCanvas) {
                                setCapturedImageData(finalCanvas.toDataURL("image/jpeg", 0.95));
                            }
                        } catch (err) {
                            console.error("Manual crop application failed:", err);
                        } finally {
                            setIsProcessing(false);
                            setIsEnhancing(false);
                            setEnhancementStatus("");
                        }
                    }}
                />
            )}
            {/* Header - Fixed Height & Solid Background */}
            <div className="h-16 flex justify-between items-center px-6 bg-black border-b border-white/10 text-white z-[20000] shrink-0 relative">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col min-w-0">
                        <span className="font-bold text-[9px] text-gray-400 uppercase tracking-wider truncate max-w-[150px]">{shgName || "Document Scan"}</span>
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs tracking-tighter truncate max-w-[120px] sm:max-w-none">{shgId || "Smart Scanner"}</span>
                            <div className="bg-white text-black px-1.5 py-0.5 rounded text-[9px] font-black uppercase shadow-lg shrink-0">
                                Page{page}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {capturedImageData && (
                        <div className="flex items-center gap-1 sm:gap-2 mr-2">
                            <button
                                onClick={() => setShowManualCrop(true)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                                title="Adjust Crop"
                            >
                                <Crop size={18} />
                            </button>
                            <button
                                onClick={() => handleRotate('left')}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                                title="Rotate Left"
                            >
                                <RotateCw className="scale-x-[-1]" size={18} />
                            </button>
                            <button
                                onClick={() => handleRotate('right')}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors border border-white/10"
                                title="Rotate Right"
                            >
                                <RotateCw size={18} />
                            </button>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        disabled={isUploading}
                        className={`p-2 hover:bg-white/10 rounded-full transition-colors ${isUploading ? 'opacity-30 cursor-not-allowed' : ''}`}
                    >
                        <X size={24} />
                    </button>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 relative min-h-0 bg-black flex flex-col overflow-hidden">

                {/* Status Overlays */}
                <div className="absolute top-4 left-0 right-0 flex flex-col items-center z-[110] gap-3 pointer-events-none">
                    {!capturedImageData && (
                        <>
                            <div className={`px-3 py-1 ${liveStatus.isValid ? 'bg-blue-600/80' : 'bg-gray-600/50'} rounded-full text-white text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm border border-white/20 transition-colors`}>
                                {liveStatus.isValid ? liveStatus.orientation : "Detecting"} Mode
                            </div>

                            <div className={`px-4 py-1.5 rounded-full backdrop-blur-md bg-black/60 border border-white/20 font-bold text-sm ${liveStatus.color} shadow-lg transition-colors duration-300`}>
                                {liveStatus.message}
                            </div>

                            {captureProgress > 0 && (
                                <div className="flex flex-col items-center gap-1.5 mt-1">
                                    <div className="px-3 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-green-400 text-[11px] font-bold tracking-wide backdrop-blur-sm animate-pulse">
                                        🔒 Auto-capturing…
                                    </div>
                                    <div className="w-44 h-2 bg-black/50 rounded-full overflow-hidden border border-white/10">
                                        <div
                                            className="h-full bg-green-500 rounded-full transition-all duration-100 ease-linear shadow-[0_0_12px_rgba(34,197,94,0.7)]"
                                            style={{ width: `${captureProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {!capturedImageData ? (
                    /* CAMERA VIEW */
                    <div className="absolute inset-0 flex flex-col">
                        <video
                            ref={videoRef}
                            playsInline
                            autoPlay
                            muted
                            className="absolute inset-0 w-full h-full object-cover"
                        />
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

                        {/* Gallery Error Banner */}
                        {galleryError && !galleryRejection && (
                            <div className="absolute bottom-32 left-4 right-4 bg-red-900/80 backdrop-blur-sm border border-red-500/40 text-red-200 text-xs font-medium px-4 py-2 rounded-xl text-center z-30">
                                {galleryError}
                            </div>
                        )}

                        {/* Capture Button Container */}
                        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center z-20 gap-8">
                            <button
                                onClick={() => {
                                    isLoopingRef.current = false;
                                    setCameraEnabled(false);
                                    setIsGalleryMode(true);
                                    stopCamera(videoRef.current);
                                    setIsCameraActive(false);
                                    fileInputRef.current?.click();
                                }}
                                disabled={isGalleryLoading}
                                className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white hover:bg-white/20 transition-all active:scale-95 shadow-lg disabled:opacity-50"
                            >
                                {isGalleryLoading ? <Loader size={24} className="animate-spin" /> : <ImageIcon size={24} />}
                            </button>

                            <button
                                onClick={() => handleCapture()}
                                disabled={!isCameraActive || isProcessing}
                                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${liveStatus.isValid ? 'border-green-500 scale-110' : 'border-white'}`}
                            >
                                <div className={`w-16 h-16 rounded-full ${liveStatus.isValid ? 'bg-green-500 animate-pulse' : 'bg-white'}`}></div>
                            </button>

                            <div className="w-12" />
                        </div>
                    </div>
                ) : (
                    /* REVIEW SCREEN */
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

                            {isEnhancing && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-5 py-2.5 rounded-2xl border border-indigo-100 flex items-center gap-3 z-30 shadow-2xl">
                                    <RotateCw className="animate-spin text-indigo-600" size={16} />
                                    <span className="text-gray-900 font-bold text-xs">{enhancementStatus || "Enhancing..."}</span>
                                </div>
                            )}
                        </div>

                        {/* Footer Buttons */}
                        <div className="bg-gray-900 border-t border-white/10 p-4 sm:p-6 flex gap-4 shrink-0 pb-6 shadow-[0_-4px_10px_rgba(0,0,0,0.5)] z-[120]">
                            <button
                                onClick={handleRetake}
                                disabled={isUploading}
                                className="flex-1 py-3.5 bg-gray-800 hover:bg-gray-700 rounded-xl font-bold text-white transition-colors border border-white/5 active:scale-95"
                            >
                                {isFromGalleryRef.current ? "Reupload" : "Retake"}
                            </button>
                            <button
                                onClick={handleConfirm}
                                disabled={isUploading || isProcessing}
                                className={`flex-1 py-3.5 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95 ${isUploading || isProcessing ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                {isUploading ? "Uploading..." : "Proceed"}
                            </button>
                        </div>
                    </div>
                )}

                {/* OVERLAYS (Processing, Gallery Rejection, etc.) */}
                {isProcessing && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-[200] backdrop-blur-sm">
                        <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mb-4 shadow-[0_0_15px_rgba(34,197,94,0.5)]"></div>
                        <div className="bg-black/40 px-6 py-2 rounded-full border border-white/10 text-white font-bold animate-pulse">
                            {processingMessage || "Processing..."}
                        </div>
                    </div>
                )}

                {galleryRejection && (
                    <div className="absolute inset-0 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center z-[300] p-8 text-center animate-in fade-in duration-300">
                        <div className="w-20 h-20 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center mb-6 shadow-2xl">
                            <X size={40} className="text-red-500" />
                        </div>
                        <h3 className="text-white font-bold text-xl mb-3">Validation Failed</h3>
                        <p className="text-red-300 text-sm mb-8 max-w-xs leading-relaxed font-medium">{galleryRejection.message}</p>
                        <button
                            onClick={() => {
                                const shouldStay = galleryRejection?.stayInReview;
                                setGalleryRejection(null);
                                // If it's an orientation error, we stay in the review screen to allow rotation.
                                // Otherwise, we go back to the camera (handleRetake).
                                if (capturedImageData && !shouldStay) handleRetake();
                            }}
                            className="px-8 py-3 bg-red-600 hover:bg-red-500 rounded-full text-white font-bold text-sm transition-all shadow-xl active:scale-95"
                        >
                            {galleryRejection?.stayInReview ? (t?.('common.close') || 'Close') : (t?.('common.retry') || 'Try Again')}
                        </button>
                    </div>
                )}

                {isUploading && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-[400] backdrop-blur-md">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                        <div className="text-white font-bold text-lg animate-pulse">Uploading Document...</div>
                    </div>
                )}
            </div>

            {/* Camera Error Overlay */}
            {cameraError && (
                <div className="absolute inset-0 bg-black flex items-center justify-center p-8 text-center text-white z-[500]">
                    <div>
                        <AlertTriangle className="mx-auto mb-4 text-red-500" size={48} />
                        <p className="font-bold text-lg">{cameraError}</p>
                        <button onClick={onClose} className="mt-8 px-8 py-3 bg-white/10 border border-white/20 rounded-xl hover:bg-white/20 transition-all">Close Scanner</button>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

const ManualCropper = ({ canvas, initialPoints, onApply, onCancel }) => {
    const containerRef = useRef(null);
    const handlesRef = useRef([]);
    const polygonRef = useRef(null);
    const crosshairVRef = useRef(null);
    const crosshairHRef = useRef(null);
    const activeTouchId = useRef(null);

    // Core 4 corners state
    const pointsRef = useRef(initialPoints && initialPoints.length === 4 ? initialPoints : [
        { x: canvas.width * 0.1, y: canvas.height * 0.1 },
        { x: canvas.width * 0.9, y: canvas.height * 0.1 },
        { x: canvas.width * 0.9, y: canvas.height * 0.9 },
        { x: canvas.width * 0.1, y: canvas.height * 0.9 }
    ]);
    const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
    const draggingIdx = useRef(null);

    // Initial state setup for UI sync
    const [hasInteraction, setHasInteraction] = useState(false);

    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerSize({ width: rect.width, height: rect.height });
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        setTimeout(updateSize, 100);
        return () => window.removeEventListener('resize', updateSize);
    }, []);

    const imgScale = Math.min(
        containerSize.width / canvas.width,
        containerSize.height / canvas.height
    ) || 0;

    const offsetX = (containerSize.width - canvas.width * imgScale) / 2;
    const offsetY = (containerSize.height - canvas.height * imgScale) / 2;

    const toScreen = (p) => ({
        x: p.x * imgScale + offsetX,
        y: p.y * imgScale + offsetY
    });

    const fromScreen = (x, y) => ({
        x: (x - offsetX) / imgScale,
        y: (y - offsetY) / imgScale
    });

    // Helper to get edge midpoints
    const getMidpoint = (p1, p2) => ({
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
    });

    const magnifierRef = useRef(null);
    const [isDragging, setIsDragging] = useState(false);
    const [magnifierSide, setMagnifierSide] = useState("top"); // "top" or "bottom"

    const updateUI = () => {
        if (!containerSize.width || !containerSize.height) return;

        const corners = pointsRef.current;
        // 4 corners + 4 midpoints
        const midpoints = [
            getMidpoint(corners[0], corners[1]), // top
            getMidpoint(corners[1], corners[2]), // right
            getMidpoint(corners[2], corners[3]), // bottom
            getMidpoint(corners[3], corners[0])  // left
        ];
        const allHandles = [...corners, ...midpoints];

        // Update Polygon
        if (polygonRef.current) {
            const screenPoints = corners.map(toScreen);
            const ptsAttr = screenPoints.map(p => `${p.x},${p.y}`).join(' ');
            polygonRef.current.setAttribute('points', ptsAttr);
        }

        // Update 8 Handles and Crosshairs
        allHandles.forEach((p, i) => {
            const s = toScreen(p);
            if (handlesRef.current[i]) {
                handlesRef.current[i].style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
            }

            if (i === draggingIdx.current) {
                if (crosshairVRef.current) {
                    crosshairVRef.current.setAttribute('x1', s.x);
                    crosshairVRef.current.setAttribute('x2', s.x);
                    crosshairVRef.current.style.display = 'block';
                }
                if (crosshairHRef.current) {
                    crosshairHRef.current.setAttribute('y1', s.y);
                    crosshairHRef.current.setAttribute('y2', s.y);
                    crosshairHRef.current.style.display = 'block';
                }

                // Update Magnifier Canvas
                if (magnifierRef.current) {
                    const ctx = magnifierRef.current.getContext('2d');
                    const size = 120;
                    const zoom = 2.5;
                    magnifierRef.current.width = size;
                    magnifierRef.current.height = size;

                    ctx.fillStyle = "#000";
                    ctx.fillRect(0, 0, size, size);

                    // Source rect from original canvas
                    const sw = size / zoom;
                    const sh = size / zoom;
                    const sx = p.x - sw / 2;
                    const sy = p.y - sh / 2;

                    ctx.filter = 'brightness(1.1) contrast(1.05)';
                    ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, size, size);
                    ctx.filter = 'none';

                    // Crosshair in magnifier
                    ctx.strokeStyle = '#2563eb';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size);
                    ctx.moveTo(0, size / 2); ctx.lineTo(size, size / 2);
                    ctx.stroke();
                }

                // Smart Position: Move magnifier to bottom if handle is in top 40%
                const containerHeight = containerSize.height;
                if (s.y < containerHeight * 0.4 && magnifierSide !== "bottom") {
                    setMagnifierSide("bottom");
                } else if (s.y > containerHeight * 0.5 && magnifierSide !== "top") {
                    setMagnifierSide("top");
                }
            }
        });
    };

    // Initial positioning
    useEffect(() => {
        if (containerSize.width) updateUI();
    }, [containerSize]);

    const handleStart = (idx, e) => {
        // Prevent multi-touch drag jump: only allow one finger drag at a time
        if (activeTouchId.current !== null) return;

        if (e.touches && e.touches.length > 0) {
            activeTouchId.current = e.touches[0].identifier;
        }

        e.preventDefault();
        draggingIdx.current = idx;
        setIsDragging(true);
        setHasInteraction(true);
        updateUI();
    };

    const handleMove = (e) => {
        if (draggingIdx.current === null) return;

        let touch;
        if (e.touches) {
            // Find the touch that matches our active identifier
            touch = Array.from(e.touches).find(t => t.identifier === activeTouchId.current);
            if (!touch) return;
        } else {
            touch = e;
        }

        const rect = containerRef.current.getBoundingClientRect();
        const screenPos = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        const { x, y } = fromScreen(screenPos.x, screenPos.y);

        const currentPoints = pointsRef.current;
        const idx = draggingIdx.current;

        if (idx < 4) {
            // Corner handles (Single point movement)
            currentPoints[idx] = {
                x: Math.max(0, Math.min(canvas.width, x)),
                y: Math.max(0, Math.min(canvas.height, y))
            };
        } else {
            // Midpoint handles (Move the entire edge)
            const corners = currentPoints;
            const prevPoints = [...corners];

            // Calculate midpoint before movement to get current delta
            const mid = idx === 4 ? getMidpoint(corners[0], corners[1]) :
                idx === 5 ? getMidpoint(corners[1], corners[2]) :
                    idx === 6 ? getMidpoint(corners[2], corners[3]) :
                        getMidpoint(corners[3], corners[0]);

            const dx = x - mid.x;
            const dy = y - mid.y;

            if (idx === 4) { // Top edge
                corners[0].x = Math.max(0, Math.min(canvas.width, corners[0].x + dx));
                corners[0].y = Math.max(0, Math.min(canvas.height, corners[0].y + dy));
                corners[1].x = Math.max(0, Math.min(canvas.width, corners[1].x + dx));
                corners[1].y = Math.max(0, Math.min(canvas.height, corners[1].y + dy));
            } else if (idx === 5) { // Right edge
                corners[1].x = Math.max(0, Math.min(canvas.width, corners[1].x + dx));
                corners[1].y = Math.max(0, Math.min(canvas.height, corners[1].y + dy));
                corners[2].x = Math.max(0, Math.min(canvas.width, corners[2].x + dx));
                corners[2].y = Math.max(0, Math.min(canvas.height, corners[2].y + dy));
            } else if (idx === 6) { // Bottom edge
                corners[2].x = Math.max(0, Math.min(canvas.width, corners[2].x + dx));
                corners[2].y = Math.max(0, Math.min(canvas.height, corners[2].y + dy));
                corners[3].x = Math.max(0, Math.min(canvas.width, corners[3].x + dx));
                corners[3].y = Math.max(0, Math.min(canvas.height, corners[3].y + dy));
            } else if (idx === 7) { // Left edge
                corners[3].x = Math.max(0, Math.min(canvas.width, corners[3].x + dx));
                corners[3].y = Math.max(0, Math.min(canvas.height, corners[3].y + dy));
                corners[0].x = Math.max(0, Math.min(canvas.width, corners[0].x + dx));
                corners[0].y = Math.max(0, Math.min(canvas.height, corners[0].y + dy));
            }
        }

        requestAnimationFrame(updateUI);
    };

    const handleEnd = (e) => {
        if (e && e.touches && activeTouchId.current !== null) {
            const stillActive = Array.from(e.touches).some(t => t.identifier === activeTouchId.current);
            if (stillActive) return; // Keep dragging if the primary finger is still down
        }

        draggingIdx.current = null;
        activeTouchId.current = null;
        if (crosshairVRef.current) crosshairVRef.current.style.display = 'none';
        if (crosshairHRef.current) crosshairHRef.current.style.display = 'none';
        setIsDragging(false);
        setMagnifierSide("top"); // Reset for next use
    };

    return (
        <div className="fixed inset-0 bg-black/98 z-[25000] flex flex-col pt-safe px-4 pb-4">
            {/* Action Bar */}
            <div className="h-16 flex justify-between items-center z-[200]">
                <button
                    onClick={onCancel}
                    className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-full hover:bg-blue-500 transition-colors flex items-center gap-2 shadow-lg active:scale-95"
                >
                    <X size={20} />
                    <span>Cancel</span>
                </button>
                <button
                    onClick={() => onApply(pointsRef.current)}
                    className="px-6 py-2.5 bg-green-600 text-white font-bold rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:bg-green-500 active:scale-95 transition-all flex items-center gap-2"
                >
                    <CheckCircle size={20} />
                    <span>Done</span>
                </button>
            </div>

            {/* Instruction Overlay (Temporary) */}
            {!hasInteraction && (
                <div className="absolute top-24 left-0 right-0 z-[150] flex justify-center animate-bounce">
                    <div className="bg-blue-600/90 text-white px-4 py-2 rounded-full font-bold text-sm shadow-xl backdrop-blur-md">
                        Drag corners or edges to fit
                    </div>
                </div>
            )}

            <div
                ref={containerRef}
                className="flex-1 relative overflow-hidden touch-none select-none"
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
            >
                {/* Source Image */}
                <img
                    src={canvas.toDataURL('image/jpeg')}
                    className="absolute pointer-events-none rounded shadow-2xl"
                    style={{
                        width: canvas.width * imgScale,
                        height: canvas.height * imgScale,
                        left: offsetX,
                        top: offsetY,
                        maxWidth: 'none',
                        imageRendering: 'crisp-edges',
                        filter: 'brightness(1.1) contrast(1.05)'
                    }}
                    alt="Source"
                />

                {/* SVG Overlay */}
                <svg
                    className="absolute inset-0 pointer-events-none"
                    width={containerSize.width}
                    height={containerSize.height}
                    style={{ opacity: imgScale > 0 ? 1 : 0 }}
                >
                    <defs>
                        <mask id="cropMask">
                            <rect width="100%" height="100%" fill="white" />
                            <polygon ref={polygonRef} fill="black" />
                        </mask>
                    </defs>
                    <rect width="100%" height="100%" fill="rgba(0,0,0,0.1)" mask="url(#cropMask)" />

                    <polygon
                        ref={polygonRef}
                        fill="transparent"
                        stroke="rgba(37, 99, 235, 1)"
                        strokeWidth="2.5"
                    />

                    {/* Alignment Crosshairs */}
                    <line
                        ref={crosshairVRef}
                        x1="0" y1="0" x2="0" y2={containerSize.height}
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1"
                        style={{ display: 'none' }}
                    />
                    <line
                        ref={crosshairHRef}
                        x1="0" y1="0" x2={containerSize.width} y2="0"
                        stroke="rgba(255,255,255,0.5)"
                        strokeWidth="1"
                        style={{ display: 'none' }}
                    />
                </svg>

                {/* Dragging Magnifier (Smart Position) */}
                {isDragging && (
                    <div className={`absolute right-4 z-[400] w-32 h-32 rounded-lg border-2 border-white shadow-2xl bg-black overflow-hidden pointer-events-none animate-in zoom-in duration-200 ${magnifierSide === "top" ? "top-4" : "bottom-20"}`}>
                        <canvas ref={magnifierRef} className="w-full h-full" />
                        <div className="absolute top-1 left-2 text-[10px] text-white/70 font-bold tracking-widest uppercase bg-black/40 px-1 rounded">Zoom</div>
                    </div>
                )}

                {/* 8 Handles (4 Corners + 4 Midpoints) */}
                {[0, 1, 2, 3, 4, 5, 6, 7].map(idx => (
                    <div
                        key={idx}
                        ref={el => handlesRef.current[idx] = el}
                        onMouseDown={(e) => handleStart(idx, e)}
                        onTouchStart={(e) => handleStart(idx, e)}
                        className="absolute w-12 h-12 -ml-6 -mt-6 flex items-center justify-center cursor-move z-[300]"
                        style={{ willChange: 'transform' }}
                    >
                        {/* Target Circle (Smaller, No Scale) */}
                        <div className={`rounded-full border border-white shadow-lg flex items-center justify-center ${idx < 4 ? 'w-5 h-5 bg-blue-600' : 'w-4 h-4 bg-white/40 backdrop-blur-sm'}`}>
                            {idx < 4 && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                    </div>
                ))}
            </div>

            <div className="h-12 flex items-center justify-center text-white/50 text-xs font-medium tracking-widest uppercase mt-2">
                Drag corners to align boundaries
            </div>
        </div>
    );
};

export default SmartCamera;
