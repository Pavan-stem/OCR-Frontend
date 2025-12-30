// SmartCamera.jsx
import React, { useState } from "react";
import Cropper from "react-easy-crop";
import { createPortal } from "react-dom";
import { Camera, X, AlertTriangle } from "lucide-react";

/* ---------- AI HELPERS ---------- */
const analyzeImageQuality = async (file) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    await new Promise((r) => {
        img.onload = r;
        img.src = url;
    });

    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

    let darkPixels = 0;
    let edgePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness < 40) darkPixels++;
        if (data[i] > 200) edgePixels++;
    }

    const shadow = darkPixels / (data.length / 4) > 0.25;
    const extraBackground = edgePixels < 5000;

    return {
        shadow,
        blur: false, // simplified (can extend later)
        extraBackground
    };
};

/* ---------- COMPONENT ---------- */
const SmartCamera = ({ open, onClose, onCapture }) => {
    const [imageSrc, setImageSrc] = useState(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedPixels, setCroppedPixels] = useState(null);
    const [warnings, setWarnings] = useState([]);

    if (!open) return null;

    const handleCapture = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const analysis = await analyzeImageQuality(file);
        const issues = [];

        if (analysis.shadow) issues.push("Shadow detected");
        if (analysis.extraBackground) issues.push("Extra background detected");

        setWarnings(issues);

        const reader = new FileReader();
        reader.onload = () => setImageSrc(reader.result);
        reader.readAsDataURL(file);
    };

    const applyCrop = async () => {
        const img = new Image();
        img.src = imageSrc;
        await new Promise((r) => (img.onload = r));

        const canvas = document.createElement("canvas");
        canvas.width = croppedPixels.width;
        canvas.height = croppedPixels.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(
            img,
            croppedPixels.x,
            croppedPixels.y,
            croppedPixels.width,
            croppedPixels.height,
            0,
            0,
            croppedPixels.width,
            croppedPixels.height
        );

        canvas.toBlob((blob) => {
            const finalFile = new File([blob], "smart-capture.jpg", {
                type: "image/jpeg"
            });
            onCapture(finalFile);
            onClose();
        }, "image/jpeg", 0.95);
    };

    return createPortal(
        <div className="fixed inset-0 bg-black/80 z-[9999] flex flex-col">
            <div className="p-3 flex justify-between items-center text-white">
                <h3 className="font-bold flex items-center gap-2">
                    <Camera /> Smart Camera
                </h3>
                <button onClick={onClose}>
                    <X />
                </button>
            </div>

            {!imageSrc ? (
                <div className="flex-1 flex items-center justify-center">
                    <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleCapture}
                        className="text-white"
                    />
                </div>
            ) : (
                <>
                    <div className="flex-1 relative">
                        <Cropper
                            image={imageSrc}
                            crop={crop}
                            zoom={zoom}
                            aspect={4 / 3}
                            onCropChange={setCrop}
                            onZoomChange={setZoom}
                            onCropComplete={(c, p) => setCroppedPixels(p)}
                        />
                    </div>

                    {warnings.length > 0 && (
                        <div className="bg-yellow-100 text-yellow-800 p-3 text-sm flex gap-2">
                            <AlertTriangle size={16} />
                            {warnings.join(", ")}
                        </div>
                    )}

                    <div className="bg-white p-4 flex justify-between">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-gray-400 text-white rounded"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={applyCrop}
                            className="px-4 py-2 bg-blue-600 text-white rounded"
                        >
                            Crop & Use
                        </button>
                    </div>
                </>
            )}
        </div>,
        document.body
    );
};

export default SmartCamera;
