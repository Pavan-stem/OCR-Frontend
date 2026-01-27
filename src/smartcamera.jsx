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

    // Live Validation State
    const [liveStatus, setLiveStatus] = useState({
        isValid: false,
        message: "Searching for document...",
        color: "text-white"
    });
    const [detectedContour, setDetectedContour] = useState(null);
    const animationFrameId = useRef(null);

    useEffect(() => {
        if (open) {
            setCapturedImageData(null);
            setLiveStatus({
                isValid: false,
                message: "Searching for document...",
                color: "text-white"
            });
            setDetectedContour(null);
            setCameraError(null);
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
                        width: { ideal: 1280 }, // Resolution similar to standard webcam
                        height: { ideal: 720 }
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
            // Wait for OpenCV
            const checkCv = setInterval(() => {
                if (cvReady()) {
                    clearInterval(checkCv);
                    initCamera();
                }
            }, 100);
            return () => clearInterval(checkCv);
        }

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
            if (animationFrameId.current) {
                cancelAnimationFrame(animationFrameId.current);
            }
        };
    }, [open, capturedImageData]);

    const startProcessingLoop = () => {
        const processFrame = () => {
            if (!videoRef.current || !canvasRef.current || !open || capturedImageData) return;

            if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
                try {
                    const video = videoRef.current;
                    const canvas = canvasRef.current;
                    const ctx = canvas.getContext('2d', { willReadFrequently: true });

                    // Downscale for performance during preview processing
                    const scale = 0.5;
                    canvas.width = video.videoWidth * scale;
                    canvas.height = video.videoHeight * scale;

                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                    // OpenCV Processing (Matching Python Logic)
                    const src = cv.imread(canvas);
                    const gray = new cv.Mat();
                    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

                    // 1. Blur Detection
                    const lap = new cv.Mat();
                    cv.Laplacian(gray, lap, cv.CV_64F);
                    const mean = new cv.Mat();
                    const std = new cv.Mat();
                    cv.meanStdDev(lap, mean, std);
                    const blurVar = std.data64F[0] ** 2;
                    lap.delete(); mean.delete(); std.delete();

                    // 2. Brightness Check
                    cv.meanStdDev(gray, mean, std);
                    const avgBrightness = mean.data64F[0];
                    mean.delete(); std.delete();

                    // 3. Edge Detection
                    const blurred = new cv.Mat();
                    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
                    const edges = new cv.Mat();
                    cv.Canny(blurred, edges, 75, 200);

                    const contours = new cv.MatVector();
                    const hierarchy = new cv.Mat();
                    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

                    // Find largest 4-sided contour
                    let screenCnt = null;
                    let maxArea = 0;

                    for (let i = 0; i < contours.size(); i++) {
                        const c = contours.get(i);
                        const area = cv.contourArea(c);
                        if (area < 5000) continue; // Min area filter

                        const peri = cv.arcLength(c, true);
                        const approx = new cv.Mat();
                        cv.approxPolyDP(c, approx, 0.02 * peri, true);

                        if (approx.rows === 4 && area > maxArea) {
                            maxArea = area;
                            if (screenCnt) screenCnt.delete();
                            screenCnt = approx.clone();
                        }
                        approx.delete();
                    }

                    // Validation Logic
                    let isValid = true;
                    let msg = "Valid";
                    let color = "text-green-500";
                    let points = null;

                    if (!screenCnt) {
                        isValid = false;
                        msg = "Scanning...";
                        color = "text-white";
                    } else {
                        // Border Check
                        const data = screenCnt.data32S;
                        points = [];
                        let isCutOff = false;
                        for (let i = 0; i < 8; i += 2) {
                            const x = data[i];
                            const y = data[i + 1];
                            points.push({ x: x / scale, y: y / scale }); // Scale back up for overlay
                            if (x < 10 || x > canvas.width - 10 || y < 10 || y > canvas.height - 10) {
                                isCutOff = true;
                            }
                        }

                        if (blurVar < 100) {
                            isValid = false;
                            msg = "Too Blurry. Hold Steady.";
                            color = "text-red-500";
                        } else if (avgBrightness < 40) {
                            isValid = false;
                            msg = "Too Dark. Adjust Lighting.";
                            color = "text-yellow-500";
                        } else if (avgBrightness > 220) {
                            isValid = false;
                            msg = "Too Bright. Avoid Glare.";
                            color = "text-yellow-500";
                        } else if (isCutOff) {
                            isValid = false;
                            msg = "Borders Cut Off. Move Back.";
                            color = "text-orange-500";
                        }
                    }

                    setLiveStatus({ isValid, message: msg, color });
                    setDetectedContour(points);

                    // Cleanup
                    src.delete(); gray.delete(); blurred.delete(); edges.delete();
                    contours.delete(); hierarchy.delete();
                    if (screenCnt) screenCnt.delete();

                } catch (e) {
                    console.error("OpenCV Processing Error:", e);
                }
            }
            animationFrameId.current = requestAnimationFrame(processFrame);
        };
        processFrame();
    };

    const handleCapture = async () => {
        if (!videoRef.current) return;

        // Use detected contour if valid, otherwise full screen
        const video = videoRef.current;
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        try {
            let processedCanvas = canvas;

            // If we have a detected validated contour, create a warp
            if (liveStatus.isValid && detectedContour) {
                // Sort points for warpPerspective in documentScanner
                // Note: detectedContour points are already in full resolution coordinates?
                // Wait, in processFrame I stored them as `x / scale`. 
                // If scale was 0.5, I divided by 0.5 -> multiplied by 2. So yes, they are full res.

                // Reuse warpPerspective from utils
                // Note: warpPerspective expects {x,y} array
                processedCanvas = warpPerspective(canvas, detectedContour);
            }

            // Apply Adaptive Threshold (Scanned Effect)
            // Python: cv2.adaptiveThreshold(warped_gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 10)
            if (cvReady()) {
                const src = cv.imread(processedCanvas);
                const gray = new cv.Mat();
                cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
                const bw = new cv.Mat();
                cv.adaptiveThreshold(gray, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 11, 10);

                // Convert BW back to RGBA for canvas
                const result = new cv.Mat();
                cv.cvtColor(bw, result, cv.COLOR_GRAY2RGBA);

                cv.imshow(processedCanvas, result);
                src.delete(); gray.delete(); bw.delete(); result.delete();
            }

            setCapturedImageData(processedCanvas.toDataURL("image/jpeg"));
            // Stop camera loop
            if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
            const stream = videoRef.current.srcObject;
            if (stream) stream.getTracks().forEach(track => track.stop());

        } catch (e) {
            console.error("Capture Processing Error:", e);
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
        setCapturedImageData(null);
        // Restart Camera
        // useEffect will trigger again because detectedContour relies on state? No, capturedImageData dependency.
    };

    // Draw Overlay
    useEffect(() => {
        if (!overlayRef.current || !videoRef.current || capturedImageData) return;
        const canvas = overlayRef.current;
        const ctx = canvas.getContext('2d');
        canvas.width = videoRef.current.clientWidth;
        canvas.height = videoRef.current.clientHeight;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (detectedContour) {
            const scaleX = canvas.width / videoRef.current.videoWidth;
            const scaleY = canvas.height / videoRef.current.videoHeight;

            ctx.beginPath();
            ctx.lineWidth = 4;
            ctx.strokeStyle = liveStatus.isValid ? '#00ff00' : '#ff0000'; // Green if valid

            detectedContour.forEach((p, i) => {
                const x = p.x * scaleX;
                const y = p.y * scaleY;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();

            // Fill with refined semi-transparent color
            ctx.fillStyle = liveStatus.isValid ? 'rgba(0, 255, 0, 0.2)' : 'rgba(255, 0, 0, 0.1)';
            ctx.fill();
        }
    }, [detectedContour, liveStatus, capturedImageData]);

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
                        <div className="absolute top-8 left-0 right-0 flex justify-center z-20">
                            <div className={`px-6 py-2 rounded-full backdrop-blur-md bg-black/40 border border-white/20 font-bold ${liveStatus.color} shadow-lg transition-colors duration-300`}>
                                {liveStatus.message}
                            </div>
                        </div>

                        {/* Capture Button */}
                        <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
                            <button
                                onClick={handleCapture}
                                disabled={!isCameraActive}
                                className={`w-20 h-20 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${liveStatus.isValid ? 'border-green-500 scale-110' : 'border-white'}`}
                            >
                                <div className={`w-16 h-16 rounded-full ${liveStatus.isValid ? 'bg-green-500 animate-pulse' : 'bg-white'}`}></div>
                            </button>
                        </div>
                    </>
                ) : (
                    /* Review Screen */
                    <div className="relative w-full h-full flex flex-col">
                        <img src={capturedImageData} className="flex-1 object-contain bg-black" alt="Scanned" />
                        <div className="bg-gray-900 p-6 flex gap-4 justify-center">
                            <button onClick={handleRetake} className="flex-1 py-4 bg-gray-700 rounded-xl font-bold text-white">Retake</button>
                            <button onClick={handleConfirm} className="flex-1 py-4 bg-green-600 rounded-xl font-bold text-white">Save Scan</button>
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
