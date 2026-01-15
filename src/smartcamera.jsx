// SmartCamera.jsx
import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Camera, X, AlertTriangle, CheckCircle, Loader } from "lucide-react";
import { scanDocument, canvasToFile } from "./utils/documentScanner";

const SmartCamera = ({ open, onClose, onCapture }) => {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);
    const [validationResult, setValidationResult] = useState(null);
    const [isCapturing, setIsCapturing] = useState(false);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [capturedImageData, setCapturedImageData] = useState(null);

    if (!open) return null;

    // Initialize camera
    useEffect(() => {
        if (!open) return;

        const initCamera = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    setIsCameraActive(true);
                }
            } catch (err) {
                console.error("Camera access denied:", err);
                alert("Camera access is required for document scanning.");
            }
        };

        initCamera();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
                setIsCameraActive(false);
            }
        };
    }, [open]);

    // Capture from camera
    const handleCameraCapture = async () => {
        if (!videoRef.current || !canvasRef.current) return;

        setIsCapturing(true);
        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");

        // Set canvas dimensions
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;

        // Draw video frame to canvas
        context.drawImage(videoRef.current, 0, 0);

        // Convert canvas to blob and create file
        canvas.toBlob(async (blob) => {
            const file = new File([blob], "camera-capture.jpg", {
                type: "image/jpeg",
                lastModified: new Date().getTime()
            });

            // Perform document scanning
            try {
                const result = await scanDocument(file);
                setValidationResult(result);
                setCapturedImageData(canvas.toDataURL());
                setShowValidationModal(true);
            } catch (err) {
                alert(`Scanning error: ${err.message}`);
                setIsCapturing(false);
            }
        }, "image/jpeg", 0.95);
    };

    // Upload captured document
    const handleUploadDocument = async () => {
        if (!validationResult) return;

        try {
            const enhancedFile = await canvasToFile(validationResult.enhancedCanvas, "document-scanned.jpg");
            onCapture(enhancedFile);
            handleClose();
        } catch (err) {
            alert(`Failed to process document: ${err.message}`);
        }
    };

    // Retry scanning
    const handleRetry = () => {
        setValidationResult(null);
        setCapturedImageData(null);
        setShowValidationModal(false);
        setIsCapturing(false);
    };

    // Handle file input from gallery
    const handleGalleryUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsCapturing(true);
        try {
            const result = await scanDocument(file);
            setValidationResult(result);

            // Convert file to data URL for preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setCapturedImageData(e.target.result);
                setShowValidationModal(true);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            alert(`Scanning error: ${err.message}`);
            setIsCapturing(false);
        }
    };

    const handleClose = () => {
        setValidationResult(null);
        setCapturedImageData(null);
        setShowValidationModal(false);
        setIsCapturing(false);
        onClose();
    };

    // Validation Modal
    if (showValidationModal && validationResult) {
        return createPortal(
            <div className="fixed inset-0 bg-black/80 z-[10000] flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">
                            {validationResult.isValid ? "✓ Document Valid" : "Document Validation Results"}
                        </h2>
                        <button
                            onClick={handleClose}
                            className="p-1 hover:bg-gray-200 rounded-lg transition"
                        >
                            <X size={24} />
                        </button>
                    </div>

                    {/* Image Preview */}
                    <div className="p-4 sm:p-6 bg-gray-100">
                        {capturedImageData && (
                            <img
                                src={capturedImageData}
                                alt="Captured document"
                                className="w-full rounded-lg border-4 border-gray-300"
                            />
                        )}
                    </div>

                    {/* Validation Results */}
                    <div className="p-4 sm:p-6 space-y-4">
                        {/* Overall Status */}
                        <div className={`p-4 rounded-lg border-2 ${validationResult.isValid ? "bg-green-50 border-green-300" : "bg-red-50 border-red-300"}`}>
                            <div className="flex items-center gap-3 mb-2">
                                {validationResult.isValid ? (
                                    <>
                                        <CheckCircle className="text-green-600" size={24} />
                                        <span className="font-bold text-green-800">All Validations Passed!</span>
                                    </>
                                ) : (
                                    <>
                                        <AlertTriangle className="text-red-600" size={24} />
                                        <span className="font-bold text-red-800">Validation Failed</span>
                                    </>
                                )}
                            </div>
                            <p className="text-sm text-gray-700">
                                {validationResult.isValid
                                    ? "Your document is ready for upload. All quality checks passed!"
                                    : `${validationResult.issues.length} issue(s) detected. Please review below.`}
                            </p>
                        </div>

                        {/* Detailed Issues */}
                        {validationResult.issues.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="font-bold text-gray-800 text-lg">Issues Found:</h3>
                                {validationResult.issues.map((issue, idx) => (
                                    <div key={idx} className="flex items-start gap-3 p-3 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                                        <AlertTriangle size={20} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                                        <span className="text-sm text-gray-700">{issue}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Validation Details */}
                        <details className="border rounded-lg">
                            <summary className="p-3 font-semibold cursor-pointer hover:bg-gray-50">
                                📊 Detailed Validation Report
                            </summary>
                            <div className="p-4 bg-gray-50 space-y-3 text-sm">
                                <div>
                                    <strong>Blur Detection:</strong>
                                    <p className={validationResult.validations.blur.isBlurry ? "text-red-600" : "text-green-600"}>
                                        {validationResult.validations.blur.isBlurry ? "❌ Blurry" : "✓ Sharp"} (Score: {validationResult.validations.blur.blurScore.toFixed(2)})
                                    </p>
                                </div>
                                <div>
                                    <strong>Lighting Quality:</strong>
                                    <p className={`text-${validationResult.validations.lighting.quality === "good" ? "green" : "orange"}-600`}>
                                        {validationResult.validations.lighting.quality === "good" ? "✓" : "⚠"} {validationResult.validations.lighting.quality.toUpperCase()} (Brightness: {validationResult.validations.lighting.avgBrightness.toFixed(0)})
                                    </p>
                                </div>
                                <div>
                                    <strong>Document Edges:</strong>
                                    <p className={validationResult.validations.edges.detected ? "text-green-600" : "text-red-600"}>
                                        {validationResult.validations.edges.detected ? "✓ Detected" : "❌ Not Detected"} (Pixels: {validationResult.validations.edges.edgePixels})
                                    </p>
                                </div>
                                <div>
                                    <strong>Table Structure:</strong>
                                    <p className={validationResult.validations.table.detected ? "text-green-600" : "text-red-600"}>
                                        {validationResult.validations.table.detected ? "✓ Found" : "❌ Not Found"} (H-Lines: {validationResult.validations.table.horizontalLines}, V-Lines: {validationResult.validations.table.verticalLines})
                                    </p>
                                </div>
                                <div>
                                    <strong>Text Presence:</strong>
                                    <p className={validationResult.validations.text.textPresent ? "text-green-600" : "text-red-600"}>
                                        {validationResult.validations.text.textPresent ? "✓ Detected" : "❌ Not Detected"} (Density: {(validationResult.validations.text.textDensity * 100).toFixed(2)}%)
                                    </p>
                                </div>
                            </div>
                        </details>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 p-4 sm:p-6 border-t bg-gray-50">
                        <button
                            onClick={handleRetry}
                            className="flex-1 px-4 py-3 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-semibold transition"
                        >
                            Retry
                        </button>
                        <button
                            onClick={handleUploadDocument}
                            disabled={!validationResult.isValid}
                            className={`flex-1 px-4 py-3 rounded-lg font-semibold transition ${
                                validationResult.isValid
                                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                            }`}
                        >
                            {validationResult.isValid ? "Use Document" : "Fix Issues First"}
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    // Camera Interface
    return createPortal(
        <div className="fixed inset-0 bg-black/90 z-[10000] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 text-white">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <Camera size={24} /> AI Document Scanner
                </h3>
                <button
                    onClick={handleClose}
                    className="p-2 hover:bg-white/20 rounded-lg transition"
                >
                    <X size={24} />
                </button>
            </div>

            {/* Video Stream or Loading */}
            <div className="flex-1 flex items-center justify-center bg-black relative">
                {isCameraActive ? (
                    <>
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />

                        {/* Scanning Guide Overlay */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-4/5 aspect-video border-4 border-yellow-300 rounded-lg shadow-lg" style={{ boxShadow: "0 0 0 9999px rgba(0,0,0,0.3)" }} />
                        </div>
                    </>
                ) : (
                    <div className="text-center text-white">
                        <Loader className="animate-spin mx-auto mb-4" size={48} />
                        <p className="text-lg font-semibold">Initializing Camera...</p>
                    </div>
                )}
            </div>

            {/* Controls */}
            <div className="bg-black/80 p-4 flex flex-col sm:flex-row gap-3 justify-between items-center">
                <div className="text-white text-sm max-w-sm">
                    <p className="font-semibold mb-1">📸 Scanning Tips:</p>
                    <ul className="text-xs space-y-1 text-gray-300">
                        <li>✓ Ensure good lighting (no glare)</li>
                        <li>✓ Keep document flat and centered</li>
                        <li>✓ Capture entire table/document</li>
                        <li>✓ Avoid shadows and blur</li>
                    </ul>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                    {/* File Upload Fallback */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleGalleryUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 sm:flex-none px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition"
                    >
                        Gallery
                    </button>

                    {/* Capture Button */}
                    <button
                        onClick={handleCameraCapture}
                        disabled={isCapturing || !isCameraActive}
                        className="flex-1 sm:flex-none px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isCapturing ? "Scanning..." : "Capture"}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default SmartCamera;
