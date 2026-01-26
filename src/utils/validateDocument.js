import { detectBlur, detectShadow } from "./imageChecks";
import { detectScreenshot } from "./screenshotCheck";
import { autoCrop } from "./autoCrop";
import { detectTable } from "./tableDetection";
import { isDocument } from "./documentClassifier";
import { detectCutoffTable } from "./detectTableCutoff";

export async function validateDocument(mat, canvas) {

    if (detectScreenshot(mat))
        return { error: "Screenshots are not allowed" };

    if (!(await isDocument(canvas)))
        return { error: "This image is not a document" };

    if (detectBlur(mat))
        return { error: "Image is blurry" };

    if (detectShadow(mat))
        return { error: "Shadow detected" };

    const crop = autoCrop(mat);
    if (crop.error)
        return { error: crop.error };

    // 🔴 THIS WAS MISSING
    const cutoffCheck = detectCutoffTable(crop.cropped);
    if (cutoffCheck?.error)
        return { error: cutoffCheck.error };

    if (!detectTable(crop.cropped))
        return { error: "No valid table detected" };

    return { success: true, cropped: crop.cropped };
}
