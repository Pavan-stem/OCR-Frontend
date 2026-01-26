export function detectTableCompleteness(mat) {
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    const bin = new cv.Mat();
    cv.adaptiveThreshold(
        gray,
        bin,
        255,
        cv.ADAPTIVE_THRESH_MEAN_C,
        cv.THRESH_BINARY_INV,
        15,
        8
    );

    const horizontal = bin.clone();
    const vertical = bin.clone();

    const hKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(Math.floor(mat.cols * 0.6), 1)
    );
    const vKernel = cv.getStructuringElement(
        cv.MORPH_RECT,
        new cv.Size(1, Math.floor(mat.rows * 0.6))
    );

    cv.morphologyEx(horizontal, horizontal, cv.MORPH_OPEN, hKernel);
    cv.morphologyEx(vertical, vertical, cv.MORPH_OPEN, vKernel);

    const tableMask = new cv.Mat();
    cv.add(horizontal, vertical, tableMask);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(
        tableMask,
        contours,
        hierarchy,
        cv.RETR_EXTERNAL,
        cv.CHAIN_APPROX_SIMPLE
    );

    let maxArea = 0;
    let tableRect = null;

    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);

        if (area > maxArea) {
            maxArea = area;
            tableRect = cv.boundingRect(cnt);
        }
    }

    gray.delete();
    bin.delete();
    horizontal.delete();
    vertical.delete();
    tableMask.delete();
    contours.delete();
    hierarchy.delete();

    if (!tableRect) {
        return { error: "No table detected" };
    }

    // 🔴 CRITICAL CHECKS
    const margin = 20;

    if (
        tableRect.x < margin ||
        tableRect.y < margin ||
        tableRect.x + tableRect.width > mat.cols - margin ||
        tableRect.y + tableRect.height > mat.rows - margin
    ) {
        return {
            error: "Table is incomplete or partially captured"
        };
    }

    return { success: true };
}
