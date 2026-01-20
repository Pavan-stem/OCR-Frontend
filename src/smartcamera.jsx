import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Camera, X, AlertTriangle, CheckCircle, Loader, RotateCw, Crop, RefreshCw, Image as ImageIcon, ChevronDown, ChevronUp } from "lucide-react";
import { scanDocument, canvasToFile, rotateCanvas, cropCanvas, warpPerspective } from "./utils/documentScanner";

const SmartCamera = ({ open, onClose, onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [validationResult, setValidationResult] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [capturedImageData, setCapturedImageData] = useState(null);
    const [rotation, setRotation] = useState(0);
    const [showCropEditor, setShowCropEditor] = useState(false);

    // Custom Crop State (4 Points for Perspective Warp)
    // Points are in coordinates (0-100) relative to image container
    const [cropPoints, setCropPoints] = useState({
        tl: { x: 20, y: 20 },
        tr: { x: 80, y: 20 },
        bl: { x: 20, y: 80 },
        br: { x: 80, y: 80 }
    });

    const [draggingCorner, setDraggingCorner] = useState(null);
    const imageContainerRef = useRef(null);
    const [expandedSection, setExpandedSection] = useState("overview");
    const [cameraError, setCameraError] = useState(null);

    // Initialize camera
    useEffect(() => {
        if (!open || showValidationModal) return;

        let stream = null;
        const initCamera = async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsCameraActive(true);
                    setCameraError(null);
                }
            } catch (err) {
                console.error("Camera error:", err);
                setCameraError("Camera access denied. Please allow camera permissions.");
                setIsCameraActive(false);
            }
        };

        initCamera();

        return () => {
            if (stream) {
                stream.getTracks().forEach(track => track.stop());
            }
        };
    }, [open, showValidationModal]);

    // Initialize crop when editor opens
    useEffect(() => {
        if (showCropEditor && capturedImageData) {
            if (validationResult?.crop?.bounds?.contourPoints) {
                const { contourPoints } = validationResult.crop.bounds;
                const { width, height } = validationResult.crop.originalDimensions;

                // Map pixel points to 0-100 coordinates
                setCropPoints({
                    tl: { x: (contourPoints[0].x / width) * 100, y: (contourPoints[0].y / height) * 100 },
                    tr: { x: (contourPoints[1].x / width) * 100, y: (contourPoints[1].y / height) * 100 },
                    br: { x: (contourPoints[2].x / width) * 100, y: (contourPoints[2].y / height) * 100 },
                    bl: { x: (contourPoints[3].x / width) * 100, y: (contourPoints[3].y / height) * 100 }
                });
            } else {
                // Default to a wide frame near the image edges (5% margin)
                setCropPoints({
                    tl: { x: 5, y: 5 },
                    tr: { x: 95, y: 5 },
                    bl: { x: 5, y: 95 },
                    br: { x: 95, y: 95 }
                });
            }
        }
    }, [showCropEditor]);

    const handleTouchStart = (corner, e) => {
        e.preventDefault();
        setDraggingCorner(corner);
    };

    const handleTouchMove = (e) => {
        if (!draggingCorner || !imageContainerRef.current) return;
        e.preventDefault();

        const rect = imageContainerRef.current.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Calculate 0-100 coordinate
        let x = ((clientX - rect.left) / rect.width) * 100;
        let y = ((clientY - rect.top) / rect.height) * 100;

        x = Math.max(0, Math.min(100, x));
        y = Math.max(0, Math.min(100, y));

        setCropPoints(prev => ({
            ...prev,
            [draggingCorner]: { x, y }
        }));
    };

    const handleTouchEnd = () => {
        setDraggingCorner(null);
    };

    const handleApplyPerspectiveCrop = async () => {
        if (!capturedImageData) return;
        setIsCapturing(true);
        try {
            const image = new Image();
            image.src = capturedImageData;
            await new Promise(r => image.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            // Convert 0-100 points to pixel coords
            const pixelPoints = [
                { x: (cropPoints.tl.x / 100) * image.width, y: (cropPoints.tl.y / 100) * image.height },
                { x: (cropPoints.tr.x / 100) * image.width, y: (cropPoints.tr.y / 100) * image.height },
                { x: (cropPoints.br.x / 100) * image.width, y: (cropPoints.br.y / 100) * image.height },
                { x: (cropPoints.bl.x / 100) * image.width, y: (cropPoints.bl.y / 100) * image.height }
            ];

            const warpedCanvas = warpPerspective(canvas, pixelPoints);
            setCapturedImageData(warpedCanvas.toDataURL('image/jpeg'));
            setValidationResult(prev => ({ ...prev, isValid: true, issues: [] }));
            setShowCropEditor(false);
        } catch (e) {
            console.error("Crop error:", e);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleRotate = async (deg) => {
        if (!capturedImageData) return;
        setIsCapturing(true);
        try {
            const image = new Image();
            image.src = capturedImageData;
            await new Promise(r => image.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const rotatedCanvas = rotateCanvas(canvas, deg);
            setCapturedImageData(rotatedCanvas.toDataURL('image/jpeg'));
        } catch (e) {
            console.error("Rotate error:", e);
        } finally {
            setIsCapturing(false);
        }
    };

    const handleCameraCapture = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        setIsCapturing(true);

        const canvas = canvasRef.current;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);

        canvas.toBlob(async (blob) => {
            const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
            await processCaughtFile(file);
        }, "image/jpeg");
    };

    const handleGalleryUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setIsCapturing(true);
        await processCaughtFile(file);
    };

    const processCaughtFile = async (file) => {
        try {
            const result = await scanDocument(file);
            setValidationResult(result);

            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                setCapturedImageData(reader.result);
                setShowValidationModal(true);
                setShowCropEditor(false);
            };

            setIsCapturing(false);
        } catch (err) {
            alert(`Error processing image: ${err.message}`);
            setIsCapturing(false);
        }
    };

    const handleUploadDocument = async () => {
        if (!capturedImageData) return;
        try {
            const image = new Image();
            image.src = capturedImageData;
            await new Promise(r => image.onload = r);

            const canvas = document.createElement('canvas');
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(image, 0, 0);

            const file = await canvasToFile(canvas, "scanned_doc.jpg");
            onCapture(file);
            handleClose();
        } catch (e) {
            console.error("Final upload error:", e);
        }
    };

    const handleClose = () => {
        setCapturedImageData(null);
        setValidationResult(null);
        setShowValidationModal(false);
        setShowCropEditor(false);
        setIsCapturing(false);
        onClose();
    };

    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black z-[10000] flex flex-col font-sans overflow-hidden">
            {showValidationModal && capturedImageData ? (
                <div className="flex flex-col h-full bg-gray-900">
                    <div className="flex justify-between items-center p-4 bg-gray-800 text-white shadow-md z-10">
                        <h3 className="font-bold text-lg">{showCropEditor ? "Adjust Crop" : "Review & Edit"}</h3>
                        <button onClick={handleClose} className="p-2 -mr-2 hover:bg-white/10 rounded-full transition"><X /></button>
                    </div>

                    <div className="flex-1 relative bg-black flex items-center justify-center p-4 overflow-hidden touch-none select-none"
                        onMouseUp={handleTouchEnd} onMouseMove={handleTouchMove} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove}>

                        {showCropEditor ? (
                            <div className="relative inline-block max-w-full max-h-full" ref={imageContainerRef}>
                                <img
                                    src={capturedImageData}
                                    className="max-w-full max-h-[70vh] w-auto h-auto object-contain pointer-events-none shadow-xl border border-white/10"
                                    alt="To Crop"
                                />

                                {/* SVG Perspective Overlay */}
                                <div className="absolute inset-0 pointer-events-none">
                                    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
                                        <defs>
                                            <mask id="cropMask">
                                                <rect width="100" height="100" fill="white" />
                                                <polygon
                                                    points={`${cropPoints.tl.x} ${cropPoints.tl.y}, ${cropPoints.tr.x} ${cropPoints.tr.y}, ${cropPoints.br.x} ${cropPoints.br.y}, ${cropPoints.bl.x} ${cropPoints.bl.y}`}
                                                    fill="black"
                                                />
                                            </mask>
                                        </defs>

                                        {/* Dimmed Outside */}
                                        <rect width="100" height="100" fill="rgba(0,0,0,0.6)" mask="url(#cropMask)" />

                                        {/* Connector Lines */}
                                        <polygon
                                            points={`${cropPoints.tl.x} ${cropPoints.tl.y}, ${cropPoints.tr.x} ${cropPoints.tr.y}, ${cropPoints.br.x} ${cropPoints.br.y}, ${cropPoints.bl.x} ${cropPoints.bl.y}`}
                                            fill="none"
                                            stroke="#3b82f6"
                                            strokeWidth="0.8"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    </svg>
                                </div>

                                {/* Drag Handles */}
                                {['tl', 'tr', 'bl', 'br'].map(corner => (
                                    <div
                                        key={corner}
                                        className="absolute w-10 h-10 -ml-5 -mt-5 bg-blue-600 border-2 border-white rounded-full shadow-lg z-30"
                                        style={{ left: `${cropPoints[corner].x}%`, top: `${cropPoints[corner].y}%` }}
                                        onMouseDown={e => handleTouchStart(corner, e)}
                                        onTouchStart={e => handleTouchStart(corner, e)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="relative w-full h-full flex items-center justify-center">
                                <img src={capturedImageData} className="max-w-full max-h-full object-contain shadow-2xl" alt="Preview" />

                                {validationResult && !validationResult.isValid && (
                                    <div className="absolute top-4 left-4 right-4 bg-red-500/90 text-white p-3 rounded-lg backdrop-blur-sm shadow-xl z-20 animate-in slide-in-from-top-4">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle className="shrink-0" />
                                            <div>
                                                <p className="font-bold">Issues Detected</p>
                                                <ul className="text-xs list-disc pl-4 mt-1 space-y-1">
                                                    {validationResult.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {isCapturing && (
                            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center">
                                <div className="bg-white/10 p-4 rounded-2xl flex flex-col items-center gap-3">
                                    <Loader className="animate-spin text-white" size={32} />
                                    <span className="text-white text-sm font-medium">Processing...</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-gray-800 p-6 space-y-4 shadow-t z-10">
                        {showCropEditor ? (
                            <div className="flex gap-4">
                                <button onClick={() => setShowCropEditor(false)} className="flex-1 py-4 bg-gray-600 text-white rounded-2xl font-bold active:scale-95 transition">Cancel</button>
                                <button onClick={handleApplyPerspectiveCrop} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold active:scale-95 transition">Apply Crop</button>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-center gap-10 pb-2">
                                    <button onClick={() => setShowCropEditor(true)} className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition">
                                        <div className="p-4 bg-gray-700 rounded-2xl"><Crop size={24} /></div>
                                        <span className="text-xs font-semibold">Crop</span>
                                    </button>
                                    <button onClick={() => handleRotate(90)} className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition">
                                        <div className="p-4 bg-gray-700 rounded-2xl"><RotateCw size={24} /></div>
                                        <span className="text-xs font-semibold">Rotate</span>
                                    </button>
                                    <button onClick={() => { setCapturedImageData(null); setShowValidationModal(false); }} className="flex flex-col items-center gap-2 text-gray-400 hover:text-white transition">
                                        <div className="p-4 bg-gray-700 rounded-2xl"><RefreshCw size={24} /></div>
                                        <span className="text-xs font-semibold">Retake</span>
                                    </button>
                                </div>
                                <button
                                    onClick={handleUploadDocument}
                                    disabled={!validationResult?.isValid || isCapturing}
                                    className={`w-full py-4 rounded-2xl font-bold text-lg shadow-lg active:scale-[0.98] transition-all ${validationResult?.isValid ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white' : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    {validationResult?.isValid ? 'Confirm & Upload' : 'Fix Issues to Upload'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <>
                    <div className="flex-1 relative bg-black flex flex-col">
                        <div className="flex-1 relative overflow-hidden">
                            {isCameraActive ? (
                                <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-contain" />
                            ) : (
                                <div className="flex items-center justify-center h-full text-white/50">
                                    {cameraError ? (
                                        <div className="text-center p-8">
                                            <AlertTriangle size={64} className="mx-auto mb-4 text-red-500" />
                                            <p className="text-lg font-medium">{cameraError}</p>
                                        </div>
                                    ) : <Loader className="animate-spin" size={48} />}
                                </div>
                            )}

                            {/* Camera Overlay */}
                            <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-12">
                                <div className="w-full h-full border-2 border-white/30 rounded-3xl relative">
                                    <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-white rounded-tl-3xl"></div>
                                    <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-white rounded-tr-3xl"></div>
                                    <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-white rounded-bl-3xl"></div>
                                    <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-white rounded-br-3xl"></div>
                                </div>
                            </div>

                            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent z-10">
                                <span className="text-white text-xl font-bold tracking-tight">Scan Document</span>
                                <button onClick={handleClose} className="p-3 bg-black/40 backdrop-blur-xl rounded-full text-white hover:bg-black/60 transition"><X size={24} /></button>
                            </div>
                        </div>

                        <div className="bg-black p-8 flex items-center justify-around">
                            <button onClick={() => fileInputRef.current?.click()} className="p-5 rounded-2xl bg-gray-900 text-white hover:bg-gray-800 transition active:scale-90">
                                <ImageIcon size={28} />
                            </button>
                            <button
                                onClick={handleCameraCapture}
                                disabled={!isCameraActive || isCapturing}
                                className="relative p-2 rounded-full border-4 border-white transition-transform active:scale-90"
                            >
                                <div className="w-16 h-16 bg-white rounded-full"></div>
                                {isCapturing && <Loader className="absolute inset-0 m-auto animate-spin text-black" size={32} />}
                            </button>
                            <div className="w-16"></div>
                        </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleGalleryUpload} className="hidden" />
                    <canvas ref={canvasRef} className="hidden" />
                </>
            )}
        </div>,
        document.body
    );
};

export default SmartCamera;
