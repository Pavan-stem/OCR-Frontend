export function detectTable(mat) {
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    const bin = new cv.Mat();
    cv.adaptiveThreshold(
        gray, bin, 255,
        cv.ADAPTIVE_THRESH_MEAN_C,
        cv.THRESH_BINARY_INV, 15, 10
    );

    const horizontal = bin.clone();
    const vertical = bin.clone();

    const hKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(Math.floor(mat.cols / 25), 1)
    );
    const vKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(1, Math.floor(mat.rows / 25))
    );

    cv.morphologyEx(horizontal, horizontal, cv.MORPH_OPEN, hKernel);
    cv.morphologyEx(vertical, vertical, cv.MORPH_OPEN, vKernel);

    const grid = new cv.Mat();
    cv.add(horizontal, vertical, grid);

    const count = cv.countNonZero(grid);

    gray.delete(); bin.delete(); horizontal.delete();
    vertical.delete(); grid.delete();

    return count > mat.rows * mat.cols * 0.015;
}
