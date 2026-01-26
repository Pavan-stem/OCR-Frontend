export function detectScreenshot(mat) {
    const w = mat.cols;
    const h = mat.rows;

    const ratio = w / h;
    const knownRatios = [9 / 16, 16 / 9, 20 / 9];

    const ratioMatch = knownRatios.some(r => Math.abs(r - ratio) < 0.02);

    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    const lap = new cv.Mat();
    cv.Laplacian(gray, lap, cv.CV_64F);

    const std = new cv.Mat();
    cv.meanStdDev(lap, new cv.Mat(), std);

    const sharpness = std.doubleAt(0, 0);

    gray.delete(); lap.delete(); std.delete();

    return ratioMatch && sharpness > 260;
}
