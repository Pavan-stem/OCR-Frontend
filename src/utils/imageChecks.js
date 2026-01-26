export function detectBlur(mat) {
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    const lap = new cv.Mat();
    cv.Laplacian(gray, lap, cv.CV_64F);

    const mean = new cv.Mat();
    const std = new cv.Mat();
    cv.meanStdDev(lap, mean, std);

    const variance = std.doubleAt(0, 0) ** 2;

    gray.delete(); lap.delete(); mean.delete(); std.delete();

    return variance < 120; // tuned to NOT reject good images
}

export function detectShadow(mat) {
    const hsv = new cv.Mat();
    cv.cvtColor(mat, hsv, cv.COLOR_RGBA2HSV);

    const channels = new cv.MatVector();
    cv.split(hsv, channels);
    const v = channels.get(2);

    const brightness = cv.mean(v)[0];

    hsv.delete(); channels.delete(); v.delete();

    return brightness < 75;
}
