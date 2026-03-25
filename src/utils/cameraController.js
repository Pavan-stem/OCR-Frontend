let currentStream = null;

/**
 * Starts the camera stream and attaches it to the provided video element.
 * @param {HTMLVideoElement} videoElement - The video element to attach the stream to.
 * @returns {Promise<MediaStream>} - The camera stream.
 */
export async function startCamera(videoElement) {
    if (currentStream) {
        if (videoElement && videoElement.srcObject !== currentStream) {
            videoElement.srcObject = currentStream;
        }
        return currentStream;
    }

    try {
        currentStream = await navigator.mediaDevices.getUserMedia({
            video: { 
                facingMode: { ideal: "environment" },
                width: { ideal: 4096, min: 1920 },
                height: { ideal: 2160, min: 1080 }
            },
            audio: false
        });

        if (videoElement) {
            videoElement.srcObject = currentStream;
        }
        return currentStream;
    } catch (err) {
        console.error("Error starting camera:", err);
        throw err;
    }
}

/**
 * Stops the camera stream and detaches it from the provided video element.
 * @param {HTMLVideoElement} videoElement - The video element to detach the stream from.
 */
export function stopCamera(videoElement) {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
        currentStream = null;
    }

    if (videoElement) {
        videoElement.srcObject = null;
    }
}
