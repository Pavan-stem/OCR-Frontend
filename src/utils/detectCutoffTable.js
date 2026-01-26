export function detectCutoffTable(mat) {
    console.log("🔥 detectCutoffTable CALLED");

    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    const edges = new cv.Mat();
    cv.Canny(gray, edges, 50, 150);

    const lines = new cv.Mat();
    cv.HoughLinesP(
        edges,
        lines,
        1,
        Math.PI / 180,
        100,
        mat.cols * 0.3,
        20
    );

    if (!lines || lines.rows === 0) {
        cleanup();
        return { error: "No table borders detected" };
    }

    let top = Infinity, bottom = 0, left = Infinity, right = 0;

    for (let i = 0; i < lines.rows; i++) {
        const x1 = lines.data32S[i * 4];
        const y1 = lines.data32S[i * 4 + 1];
        const x2 = lines.data32S[i * 4 + 2];
        const y2 = lines.data32S[i * 4 + 3];

        // horizontal
        if (Math.abs(y1 - y2) < 10) {
            top = Math.min(top, y1);
            bottom = Math.max(bottom, y1);
        }

        // vertical
        if (Math.abs(x1 - x2) < 10) {
            left = Math.min(left, x1);
            right = Math.max(right, x1);
        }
    }

    const margin = 20;

    if (
        top < margin ||
        left < margin ||
        bottom > mat.rows - margin ||
        right > mat.cols - margin
    ) {
        cleanup();
        return {
            error: "Table is cut off. Capture all four borders clearly."
        };
    }

    cleanup();
    return { success: true };

    function cleanup() {
        gray.delete();
        edges.delete();
        lines.delete();
    }
}
