import init, { Palette, Plasma, Step } from "./_pkg/sample_rust";

export type PlasmaInit = {
    type: "i",
    width: number,
    height: number,
    buffer: ImageData,
    canvas: OffscreenCanvas,
    paletteCanvas: OffscreenCanvas,
    ptr: number,
    step: keyof typeof Step,
    palette: keyof typeof Palette,

}
export type PlasmaUpdate = {
    type: "u",
    time: number,
}

export type PlasmaMsg = PlasmaInit | PlasmaUpdate;

let plasma: Plasma;
let ctx: OffscreenCanvasRenderingContext2D;
let buffer: ImageData;
let ready = false;
onmessage = async (e: MessageEvent<PlasmaMsg>) => {

    switch (e.data.type) {
        case "i":
            const width = e.data.width;
            const height = e.data.height;
const wasm = await init();
plasma = new Plasma(width, height, Step[e.data.step], Palette[e.data.palette]);// Step[step], Palette[pal]);
        const ptr = plasma.get_ptr();
        // wAsm
        buffer = new ImageData(new Uint8ClampedArray(wasm.memory.buffer, ptr, width * height * 4), width, height);
    
    

            ctx = e.data.canvas.getContext('2d')!;

          const palette = plasma.get_palette();
          const paletteCanvas = e.data.paletteCanvas;
            const palCtx = paletteCanvas.getContext('2d')!;
            const pw = paletteCanvas.width / palette.length;
            for (let i = 0; i < palette.length; i++) {
                const s = palette[i].toString(16).padStart(8, '0');
                palCtx.fillStyle = '#' + s;
                // console.log(palette[i], palette[i].toString(), s);
                palCtx.fillRect(i * pw, 0, pw, 20);
            }

            ready = true;
            // buffer = e.data.buffer;
            break;
        case "u":
            if(!ready)
            return;

            plasma.update(e.data.time);
            ctx.putImageData(buffer, 0, 0);
            postMessage(true);
            break;
    }



    // const update = plasma.update.bind(plasma);// `Result: ${e.data[0] * e.data[1]}`;
    // const workerResult = update()
    // console.log("Posting message back to main script", workerResult);
    // postMessage(workerResult);
};