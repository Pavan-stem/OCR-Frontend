import * as mobilenet from "@tensorflow-models/mobilenet";
import "@tensorflow/tfjs";

let model;

export async function isDocument(canvas) {
    if (!model) model = await mobilenet.load();

    const preds = await model.classify(canvas);

    const allowed = [
        "document", "paper", "notebook", "menu", "spreadsheet", "book"
    ];

    return preds.some(p =>
        allowed.some(a => p.className.toLowerCase().includes(a))
    );
}
