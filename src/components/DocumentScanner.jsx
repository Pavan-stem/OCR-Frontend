import { useRef, useState, useEffect } from "react";
import { validateDocument } from "../utils/validateDocument";
import { rotateCanvas } from "../utils/rotate";

export default function DocumentScanner() {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    const [error, setError] = useState("");
    const [ready, setReady] = useState(false);
    const [cvReady, setCvReady] = useState(false);

    // ✅ WAIT FOR OPENCV (MUST BE INSIDE COMPONENT)
    useEffect(() => {
        const waitForCV = () => {
            if (window.cv && window.cv.imread) {
                console.log("OpenCV loaded");
                setCvReady(true);
            } else {
                setTimeout(waitForCV, 100);
            }
        };
        waitForCV();
    }, []);

    // ✅ START CAMERA ONLY AFTER OPENCV IS READY
    useEffect(() => {
        if (!cvReady) return;

        navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" }
        }).then(stream => {
            videoRef.current.srcObject = stream;
        });
    }, [cvReady]);

    const processCanvas = async () => {
        const mat = window.cv.imread(canvasRef.current);
        const result = await validateDocument(mat, canvasRef.current);

        if (result.error) {
            setError(result.error);
            mat.delete();
            return;
        }

        window.cv.imshow(canvasRef.current, result.cropped);
        setReady(true);
        setError("");
        mat.delete();
    };

    const capture = async () => {
        if (!cvReady) return;

        const c = canvasRef.current;
        c.width = videoRef.current.videoWidth;
        c.height = videoRef.current.videoHeight;
        c.getContext("2d").drawImage(videoRef.current, 0, 0);

        await processCanvas();
    };

    const upload = async e => {
        if (!cvReady) return;

        const img = new Image();
        img.src = URL.createObjectURL(e.target.files[0]);

        img.onload = async () => {
            const c = canvasRef.current;
            c.width = img.width;
            c.height = img.height;
            c.getContext("2d").drawImage(img, 0, 0);

            await processCanvas();
        };
    };

    return (
        <div>
            {!cvReady && <p>Loading scanner engine...</p>}

            {!ready && cvReady && (
                <video ref={videoRef} autoPlay playsInline />
            )}

            <canvas ref={canvasRef} />

            {!ready && (
                <>
                    <button onClick={capture} disabled={!cvReady}>
                        Capture
                    </button>

                    <input
                        type="file"
                        accept="image/*"
                        disabled={!cvReady}
                        onChange={upload}
                    />
                </>
            )}

            {ready && (
                <>
                    <button onClick={() => rotateCanvas(canvasRef.current, 90)}>
                        Rotate
                    </button>
                    <button onClick={() => setReady(false)}>Retake</button>
                    <button onClick={() => alert("Perfect image uploaded")}>
                        Proceed
                    </button>
                </>
            )}

            {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
    );
}
