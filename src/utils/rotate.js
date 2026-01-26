export function rotateCanvas(canvas, angle) {
    const temp = document.createElement("canvas");
    temp.width = canvas.width;
    temp.height = canvas.height;
    temp.getContext("2d").drawImage(canvas, 0, 0);

    if (angle % 180 !== 0) {
        canvas.width = temp.height;
        canvas.height = temp.width;
    }

    const ctx = canvas.getContext("2d");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(angle * Math.PI / 180);
    ctx.drawImage(temp, -temp.width / 2, -temp.height / 2);
}
