import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, X, AlertTriangle, CheckCircle, Loader, RotateCw, Crop, RefreshCw, Image as ImageIcon, ScanLine, Flashlight } from "lucide-react";
import { scanDocument, canvasToFile, rotateCanvas, cropCanvas, warpPerspective, enhanceImage } from "./utils/documentScanner";

const cvReady = () => !!(window.cv && window.cv.Mat);

const SmartCamera = ({ open, onClose, onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const fileInputRef = useRef(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [capturedImageData, setCapturedImageData] = useState(null);
    const [processingMessage, setProcessingMessage] = useState("");
    const [cameraError, setCameraError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isEnhancing, setIsEnhancing] = useState(false);

    // Live Validation State
    const [liveStatus, setLiveStatus] = useState({
        isValid: false,
        message: "Searching for document...",
        color: "text-white"
    });
    const [captureProgress, setCaptureProgress] = useState(0);
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
                try {
                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    // Downscale to 0.3 for faster CV processing on mobile
                    const scale = 0.3;
                    canvas.width = video.videoWidth * scale;
                    canvas.height = video.videoHeight * scale;
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    const src = cv.imread(canvas);
                    const gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                    // 1. Quality Checks (Periodic to save CPU)
                    let blurVar = 150; // Optimized default
                    let avgBrightness = 100;

                    const lap = new cv.Mat();
                    cv.Laplacian(gray, lap, cv.CV_64F);
                    const mean = new cv.Mat();
                    const std = new cv.Mat();
                    cv.meanStdDev(lap, mean, std);
                    blurVar = std.data64F[0] ** 2;
                    lap.delete();

                    cv.meanStdDev(gray, mean, std);
                    avgBrightness = mean.data64F[0];
                    mean.delete(); std.delete();

                    // 2. Hybrid Detection Logic (Paper Boundary Focused)
                    const blurred = new cv.Mat();
                    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
                    // Removed medianBlur as it might be washing out the paper edges on low-res frames

                    const edges = new cv.Mat();
                    // Lower thresholds to catch weaker edges of the paper on light surfaces
                    cv.Canny(blurred, edges, 30, 100);

                    // Dilate slightly to bridge gaps in the paper outline
                    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
                    cv.dilate(edges, edges, kernel);
                    kernel.delete();

                    const contours = new cv.MatVector();
                    const hierarchy = new cv.Mat();
                    // REVERT to RETR_LIST to catch the paper edge even if there are overlapping background/table lines
                    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

                    let detected = null;
                    let maxArea = 0;
                    let detectedArea = 0;

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
                        const isLandscape = w > h;

                        // Apply Balanced Motion Buffer Padding: 5% Side for Portrait, 10% Vertical for Landscape 
                        const padSide = isLandscape ? 0.15 : 0.05;
                        const padTopBot = isLandscape ? 0.10 : 0.20;


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

                        // SYNC: Update high-speed ref for drawLoop immediately
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
                        // Use the captured isCutOff flag from earlier

                        // RELAXED Validation: No more blur/shadow checks for auto-capture
                        if (isCutOff) {
                            isValid = false; msg = "Center the Document"; color = "text-orange-500";
                            steadyCount.current = 0;
                            setCaptureProgress(0);
                        } else {
                            // Faster Auto-Capture (0.5s window)
                            steadyCount.current += 1;
                            const progress = Math.min(100, (steadyCount.current / 8) * 100);
                            setCaptureProgress(progress);

                            if (progress >= 100 && !capturedImageData) {
                                steadyCount.current = 0;
                                setCaptureProgress(0);
                                handleCapture(rawPoints); // Pass points directly for 100% accurate crop
                            }
                        }
                    }

                    setLiveStatus({ isValid, message: msg, color });

                    // Cleanup
                    src.delete(); gray.delete(); blurred.delete(); edges.delete();
                    contours.delete(); hierarchy.delete();
                    if (detected) detected.delete();

                } catch (e) {
                    console.error("OpenCV Processing Error:", e);
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
            if (finalContour && cvReady()) {
                resultCanvas = warpPerspective(canvas, finalContour);
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

        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        canvas.getContext("2d").drawImage(image, 0, 0);

        const file = await canvasToFile(canvas, "scanned_doc.jpg");
        onCapture(file);
        onClose();
    };

    const handleRetake = () => {
        isLoopingRef.current = false;
        if (processingTimeoutId.current) clearTimeout(processingTimeoutId.current);
        if (uiAnimationFrameId.current) cancelAnimationFrame(uiAnimationFrameId.current);

        setCapturedImageData(null);
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
        <div className="fixed inset-0 bg-black z-[10000] flex flex-col font-sans">
            {/* Header */}
            <div className="flex justify-between items-center p-4 bg-black/80 text-white z-10">
                <span className="font-bold text-lg">Smart Scanner</span>
                <button onClick={onClose} className="p-2 bg-white/10 rounded-full"><X /></button>
            </div>

            {/* Viewfinder */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                {!capturedImageData ? (
                    <>
                        <video
                            ref={videoRef}
                            playsInline
                            muted
                            className="absolute w-full h-full object-cover"
                        />
                        <canvas
                            ref={overlayRef}
                            className="absolute w-full h-full pointer-events-none"
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Status Message */}
                        <div className="absolute top-8 left-0 right-0 flex flex-col items-center z-20">
                            <div className={`px-6 py-2 rounded-full backdrop-blur-md bg-black/40 border border-white/20 font-bold ${liveStatus.color} shadow-lg transition-colors duration-300`}>
                                {liveStatus.message}
                            </div>
                            {/* Auto-Capture Progress Bar */}
                            {captureProgress > 0 && (
                                <div className="mt-3 w-48 h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/10">
                                    <div
                                        className="h-full bg-green-500 transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(34,197,94,0.5)]"
                                        style={{ width: `${captureProgress}%` }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Capture Button */}
                        <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
                            <button
                                onClick={() => handleCapture()} // Wrap in lambda to avoid event object pollution
                                disabled={!isCameraActive || isProcessing}
                                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${liveStatus.isValid ? 'border-green-500 scale-110' : 'border-white'}`}
                            >
                                <div className={`w-16 h-16 rounded-full ${liveStatus.isValid ? 'bg-green-500 animate-pulse' : 'bg-white'}`}></div>
                            </button>
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
                    </>
                ) : (
                    /* Review Screen */
                    <div className="flex-1 flex flex-col min-h-0 bg-black">
                        <div className="flex-1 min-h-0 flex items-center justify-center p-4">
                            <img
                                src={capturedImageData}
                                className="max-w-full max-h-full object-contain shadow-2xl rounded-sm border border-white/10"
                                alt="Scanned"
                            />
                            {/* Enhancement Label */}
                            {isEnhancing && (
                                <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 flex items-center gap-3 z-30">
                                    <RotateCw className="animate-spin text-green-500" size={18} />
                                    <span className="text-white font-bold text-sm tracking-wide">Applying precision sharpness...</span>
                                </div>
                            )}
                        </div>
                        <div className="bg-gray-900/90 backdrop-blur-md p-6 flex gap-4 justify-center border-t border-white/10">
                            <button
                                onClick={handleRetake}
                                className="flex-1 py-4 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold text-white transition-colors"
                            >
                                Retake
                            </button>
                            <button
                                onClick={handleConfirm}
                                className="flex-1 py-4 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-white shadow-lg transition-colors"
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
