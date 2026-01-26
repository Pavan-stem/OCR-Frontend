export function autoCrop(mat) {
    const gray = new cv.Mat();
    cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

    const edges = new cv.Mat();
    cv.Canny(gray, edges, 80, 200);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    let best = null;
    let maxArea = 0;

    for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i);
        const area = cv.contourArea(cnt);

        if (area > maxArea) {
            const peri = cv.arcLength(cnt, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

            if (approx.rows === 4) {
                best = approx;
                maxArea = area;
            } else {
                approx.delete();
            }
        }
    }

    if (!best) {
        return { error: "Document not detected properly" };
    }

    const rect = cv.boundingRect(best);
    const cropped = mat.roi(rect);

    gray.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();

    return { cropped };
}
