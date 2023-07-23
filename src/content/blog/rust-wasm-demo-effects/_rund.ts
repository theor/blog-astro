import { string } from "astro/zod";
import init, { Plasma, StatefulFire, Stars, Roads2, Step , Palette } from "./_pkg/sample_rust";
import { WasmHost } from "@/wasmhost";

const WIDTH = 32 * 4;
const HEIGHT = 32 * 4;


enum Sample {
    Stars = "Stars",
    Plasma = "Plasma",
    Fire = "fire",
    FireState = "firestate",
    Svg = "svg",
    Roads = "Roads",

}
function roads2(x: HTMLElement, memory: WebAssembly.Memory) {
    const WIDTH = 640;
    const HEIGHT = 480;
    // 2: 2.56ms self 1.39ms
    // 1: 3.59
    const p = new Roads2(WIDTH, HEIGHT); new WasmHost(
        "Roads2",
        x,
        p.update.bind(p),
        (div, pane) => {

            const canvas = document.createElement("canvas");
            canvas.tabIndex = 0;
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.style.width = "100%";
            // canvas.style.width = `${WIDTH}px`;
            // canvas.style.height = `${HEIGHT}px`;
            div.appendChild(canvas);


            const data = {
                t: 0, ctx: canvas.getContext('2d')!,
                mousePos: [0.5, 0.5],
                speed_factor: 0.06,
                dir: [0, 1],
                paused: false,
            };

            canvas.addEventListener('keydown', e => {
                console.log(e);
                switch (e.key) {
                    case 'w':
                    case 'ArrowUp':
                        data.dir[1] = 1;
                        break;
                    case 's':
                    case 'ArrowDown':
                        data.dir[1] = -1;
                        break;
                    case 'a':
                    case 'ArrowLeft':
                        data.dir[0] = -1;
                        break;
                    case 'd':
                    case 'ArrowRight':
                        data.dir[0] = 1;
                        break;
                    default: return;
                }
                e.preventDefault();
            });
            canvas.addEventListener('keyup', e => {
                switch (e.key) {
                    case 'w':
                    case 'ArrowUp':
                    case 's':
                    case 'ArrowDown':
                        data.dir[1] = 0;
                        break;
                    case 'a':
                    case 'ArrowLeft':
                    case 'd':
                    case 'ArrowRight':
                        data.dir[0] = 0;
                        break;
                    default: return;
                }
                e.preventDefault();
            });

            canvas.addEventListener('mousemove', e => {
                const bb = canvas.getBoundingClientRect();
                const x = (e.clientX - bb.left) / bb.width;
                const y = (e.clientY - bb.top) / bb.height;

                data.mousePos = [x, y];
            });

            pane?.addInput(data, "t");
            // pane.addMonitor(data, "t");
            // pane.addInput(data, "speed_factor", { min: 0.01, max: 0.2, step: 0.01, });

            return data;
        },
        (data, f) => {

            f(data.t, data.dir[0], data.dir[1]);

            const ptr = p.get_ptr();
            // wAsm
            const buffer = new ImageData(new Uint8ClampedArray(memory.buffer, ptr, WIDTH * HEIGHT * 4), WIDTH, HEIGHT);

            data.ctx.putImageData(buffer, 0, 0);
        },
        (data, t) => {
            data.t = t;
        },
    ).create();
}

function stars(x: HTMLElement, memory: WebAssembly.Memory) {
    const WIDTH = 512;
    const HEIGHT = 512;
    const p = new Stars(WIDTH, HEIGHT);
    new WasmHost(
        "Stars",
        x,
        p.update.bind(p),
        (div, pane) => {

            const canvas = document.createElement("canvas");
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.style.width = "100%";
            canvas.style.touchAction = "none";
            // canvas.style.width = `${WIDTH}px`;
            // canvas.style.height = `${HEIGHT}px`;
            div.appendChild(canvas);


            const data = {
                paused: false,
                t: 0, ctx: canvas.getContext('2d')!,
                mousePos: [0, 0],
                speed_factor: 0.06,
                buffer: <ImageData | undefined>undefined ,
            };


            canvas.addEventListener('pointermove', e => {
                const bb = canvas.getBoundingClientRect();
                const x = (e.clientX - bb.left) / bb.width;
                const y = (e.clientY - bb.top) / bb.height;

                data.mousePos = [x, y];
            });

            pane?.addInput(data, "t", { min: 0, max: 1000 });
            pane?.addInput(data, "speed_factor", { min: 0.01, max: 0.2, step: 0.01, });

            return data;
        },
        (data, f) => {

            f(data.t, data.mousePos[0], data.mousePos[1], data.speed_factor);
            
            if (!data.buffer || data.buffer.data.byteLength === 0) {
                console.log("REALLOC FIRE");
                let raw_buffer = new Uint8ClampedArray(memory.buffer, p.get_ptr(), WIDTH * HEIGHT * 4);
                data.buffer = new ImageData(raw_buffer, WIDTH, HEIGHT);
            }
            data.ctx.putImageData(data.buffer, 0, 0);
        },
        (data, t) => {
            data.t = t;
            // (data as any).tInput.refresh()
        },
    ).create();
}

// declare var Step: { [key: string]: number };
// declare var Palette: { [key: string]: number };

async function plasma(x: HTMLElement, dataset: DOMStringMap, memory: WebAssembly.Memory) {
    const WIDTH = 160;
    const HEIGHT = 160;
    const step = dataset["step"] ?? "All";
    const pal = dataset["palette"] ?? "Colors";
    // console.log(dataset);

    const p = new Plasma(WIDTH, HEIGHT, (Step as any)[step], (Palette as any)[pal]);
    // const worker = new Worker(new URL('./worker', import.meta.url), { type: 'module' });


    await new WasmHost(
        "Plasma",
        x,
        p.update.bind(p),
        // p.update.bind(p),
        (div, pane) => {
            const canvas = document.createElement("canvas");
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.style.width = "100%";
            // canvas.style.width = `${WIDTH * 4}px`;
            // canvas.style.height = `${HEIGHT * 4}px`;
            div.appendChild(canvas);

            const paletteCanvas = document.createElement("canvas");
            paletteCanvas.width = 256;
            paletteCanvas.height = 20;
            paletteCanvas.style.width = "100%";
            div.appendChild(paletteCanvas);

            function drawPalette() {
                const palette = p.get_palette();
                // console.log(palette);
                const palCtx = paletteCanvas.getContext('2d')!;
                const pw = paletteCanvas.width / palette.length;
                for (let i = 0; i < palette.length; i++) {
                    const s = palette[i].toString(16).padStart(8, '0');
                    palCtx.fillStyle = '#' + s;
                    // console.log(palette[i], palette[i].toString(), s);
                    palCtx.fillRect(i * pw, 0, pw, 20);
                }
            }

            drawPalette();




            const data = { paused: false, t: 0, ctx: canvas.getContext('2d')!, palette: (Palette as any)[pal], buffer: <ImageData | undefined>undefined };

            if (pane) {
                (data as any).tInput = pane.addInput(data, "t", { min: 0, max: 10 });
                pane.addInput(data, "palette", {
                    options: { ...Object.keys(Palette).filter(k => isNaN(Number(k))).reduce((p, k) => Object.assign(p, { [k]: (Palette as any)[k] }), {}) }
                }).on('change', e => {
                    const palette = Number(e.value);
                    p.set_palette(palette);
                    drawPalette();
                });
            }


            return data;
        },
        (data, f) => {
            // console.log("ADDSSD", data.buffer, data.ctx.canvas)
            f(data.t);

            const ptr = p.get_ptr();

            if (!data.buffer || data.buffer.data.byteLength === 0) {
                console.log("REALLOC");
                let raw_buffer = new Uint8ClampedArray(memory.buffer, ptr, WIDTH * HEIGHT * 4);
                data.buffer = new ImageData(raw_buffer, WIDTH, HEIGHT);
            }

            data.ctx.putImageData(data.buffer, 0, 0, 0, 0, data.ctx.canvas.width, data.ctx.canvas.height);

            // const msg: PlasmaUpdate = { type:"u", time: data.t};
            // worker.postMessage(msg);
        },
        (data, t) => {
            // console.error("TTT")
            data.t = t % 20;
            // (data as any).tInput.refresh()
        },
        { disablePane: dataset["disablepane"] === 'true', static: dataset["static"] === 'true' },
    ).create();
}
init().then(async wasm => {
    console.log("init", wasm);
    for (let x of document.querySelectorAll("div[data-sample]")) {
        const elt = x as HTMLElement;
        const sample = (elt.dataset["sample"] ?? Sample.Fire) as Sample;
        switch (sample) {
            case Sample.Roads:
                roads2(elt, wasm.memory);
                break;
            case Sample.Stars:
                stars(elt, wasm.memory);
                break;
            case Sample.Plasma:
                await plasma(elt, elt.dataset, wasm.memory);
                break;

            case Sample.FireState:
                const sf = new StatefulFire(WIDTH, HEIGHT);
                const palette = new Uint8Array(37 * 3);
                for (let index = 0; index < 37; index++) {
                    let c = [
                        Math.round(index / 37.0 * 255),
                        Math.round(255 - index / 37.0 * 255),
                        0];
                    palette[index * 3 + 0] = c[0];
                    palette[index * 3 + 1] = c[1];
                    palette[index * 3 + 2] = c[2];

                }
                // sf.set_palette(palette);
                new WasmHost("Fire", elt,
                    sf.update.bind(sf),
                    (div, pane) => {
                        const canvas = document.createElement("canvas");
                        canvas.width = WIDTH;
                        canvas.height = HEIGHT;
                        canvas.style.width = "100%";
                        canvas.style.touchAction = "none";
                        // canvas.style.width = `${WIDTH * 4}px`;
                        // canvas.style.height = `${HEIGHT * 4}px`;
                        div.appendChild(canvas);

                        const fireBuffer = new Uint8Array(WIDTH * HEIGHT);

                        const data = {
                            paused: false,
                            canvas: canvas,
                            buffer: <ImageData | undefined>undefined,
                            ctx: canvas.getContext('2d')!,
                            x: { min: -1, max: 3 },
                            t: 0,
                            r: 5,
                            fireBuffer: fireBuffer,
                            mousePos: [WIDTH / 2, HEIGHT / 2],
                            c: { r: 0, g: 0, b: 0 },
                            attenuation: 1,
                        };

                        if (pane) {
                            pane.addInput(data, "r", { label: "mouse radius", min: 1, max: 50, step: 1 });
                            pane.addMonitor(data, "t");
                            pane.addInput(data, "attenuation", { min: 0, max: 8, step: 1 });
                            pane.addInput(data, "x", { min: -8, max: 8, step: 1 });
                        }

                        // canvas.addEventListener('mousemove', e => {
                        //     const bb = canvas.getBoundingClientRect();
                        //     const x = Math.floor((e.clientX - bb.left) / bb.width * canvas.width);
                        //     const y = Math.floor((e.clientY - bb.top) / bb.height * canvas.height);

                        //     data.mousePos = [x, y];
                        // });
                        canvas.addEventListener('pointermove', e => {
                            const bb = canvas.getBoundingClientRect();
                            const x = Math.floor((e.clientX - bb.left) / bb.width * canvas.width);
                            const y = Math.floor((e.clientY - bb.top) / bb.height * canvas.height);

                            data.mousePos = [x, y];
                        });

                        return data;
                    },
                    (data, f) => {
                        sf.circle(data.mousePos[0], data.mousePos[1], data.r);

                        f(data.t, data.attenuation, data.x.min, data.x.max);

                        if (!data.buffer || data.buffer.data.byteLength === 0) {
                            console.log("REALLOC FIRE");
                            let raw_buffer = new Uint8ClampedArray(wasm.memory.buffer, sf.get_ptr(), WIDTH * HEIGHT * 4);
                            data.buffer = new ImageData(raw_buffer, WIDTH, HEIGHT);
                        }

                        data.ctx.putImageData(data.buffer, 0, 0);
                    },

                    (data, t) => {
                        data.t = t;

                    }).create();

                break;

            default:
                x.innerHTML = "unknown";
                break;
        }
    };
});
// customElements.define("astro-greet", AstroGreet);