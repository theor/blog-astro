import init, { StatefulFire, make_fragment, render } from "./_pkg/sample_rust";
import { WasmHost } from "@/wasmhost";
// export class AstroGreet extends WasmHost<typeof make_fragment, {
//     div: HTMLDivElement,
//     x: number,
//     t: number,
// }> {
//     constructor(e:HTMLElement) {
//         console.warn(e)
//         super(e, make_fragment, (div, pane) => {

//         const message = e.dataset;
//         console.log("define", e, message);
//             const output = document.createElement("div");
//             div.appendChild(output);
//             const data = { div: output, x: parseFloat(e.dataset.x ?? "50"), t: 0, s: e.dataset.message };
//             pane.addInput(data, "x");
//             pane.addMonitor(data, "t");
//             pane.addMonitor(data, "s");
//             return init().then(() => data);
//         }, (data, f) => {
//             const fragment = f(data.x, data.t);
//             if (data.div.hasChildNodes())
//                 data.div.replaceChild(fragment, data.div.firstChild!)
//             else
//                 data.div.appendChild(fragment);
//         },

//       data => {
//         data.t += 0.16;

//       });
//     }
// }


const WIDTH = 32 * 4;
const HEIGHT = 32 * 4;
export class AstroGreet extends WasmHost<typeof render, {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    x: number;
    t: number;
    r: number;
    b: Uint8ClampedArray;
    fireBuffer: Uint8Array;
    mousePos: number[];
}> {
    constructor(e: HTMLElement) {
        console.warn(e)
        super(e, render, (div, pane) => {
            const canvas = document.createElement("canvas");
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.style.width = `${WIDTH * 4}px`;
            canvas.style.height = `${HEIGHT * 4}px`;
            div.appendChild(canvas);

            const arrayBuffer = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
            const fireBuffer = new Uint8Array(WIDTH * HEIGHT);

            const data = {
                canvas: canvas,
                ctx: canvas.getContext('2d')!,
                x: 0.995,
                t: 0,
                r: 5,
                b: arrayBuffer,
                fireBuffer: fireBuffer,
                mousePos: [0, 0],
            };
            data.ctx.scale(2,2);

            pane.addInput(data, "r", { label: "mouse radius", min: 1, max: 50, step: 1 });
            pane.addInput(data, "x", { min: 0.9, max: 1, step: 0.005 });
            pane.addMonitor(data, "t");


            canvas.addEventListener('mousemove', e => {
                const bb = canvas.getBoundingClientRect();
                const x = Math.floor((e.clientX - bb.left) / bb.width * canvas.width);
                const y = Math.floor((e.clientY - bb.top) / bb.height * canvas.height);

                data.mousePos = [x, y];
            });

            return Promise.resolve(data);
        }, (data, f) => {

            const b = new ImageData(data.b, WIDTH, HEIGHT);
            const fb = data.fireBuffer;
            const r = data.r;

            // circle around mouse pos
            for (let x = -r; x < r; x++) {
                for (let y = -r; y < r; y++) {
                    const d = x * x + y * y;
                    if (d <= r * r)
                        fb[Math.min(HEIGHT - 1, Math.max(0, data.mousePos[1] + y)) * WIDTH +
                            ((data.mousePos[0] + x) % WIDTH)] =
                            Math.random() * 255 * ((d / (r)));

                }
            }

            f(data.x, data.b, fb, WIDTH, HEIGHT);
            data.ctx.putImageData(b, 0, 0);
        },

            data => {
                data.t += 0.16;

            });
    }
}

enum Sample {
    Fire = "fire",
    FireState = "firestate",
    Svg = "svg",

}
init().then(() => {
    document.querySelectorAll("astro-greet").forEach(x => {
        const sample = ((x as HTMLElement).dataset["sample"] ?? Sample.Fire) as Sample;
        switch (sample) {
            case Sample.Fire:
                new AstroGreet(x as HTMLElement).create();
                break;
            case Sample.FireState:
                const sf = new StatefulFire(WIDTH, HEIGHT);
                const palette = new Uint8Array(37*3);
                for (let index = 0; index < 37; index++) {
                    let c = [
                        Math.round(index / 37.0 * 255),
                        Math.round(255 - index / 37.0 * 255),
                          0];
                    palette[index*3+0] = c[0];
                    palette[index*3+1] = c[1];
                    palette[index*3+2] = c[2];
                    
                }
                // sf.set_palette(palette);
                new WasmHost(x as HTMLElement,
                    sf.update.bind(sf),
                    (div, pane) => {
                        const canvas = document.createElement("canvas");
                        canvas.width = WIDTH;
                        canvas.height = HEIGHT;
                        canvas.style.width = `${WIDTH * 4}px`;
                        canvas.style.height = `${HEIGHT * 4}px`;
                        div.appendChild(canvas);

                        const arrayBuffer = new Uint8ClampedArray(WIDTH * HEIGHT * 4);
                        const fireBuffer = new Uint8Array(WIDTH * HEIGHT);

                        const data = {
                            canvas: canvas,
                            ctx: canvas.getContext('2d')!,
                            x:{min: -1, max: 1},
                            t: 0,
                            r: 5,
                            b: arrayBuffer,
                            fireBuffer: fireBuffer,
                            mousePos: [0, 0],
                            c: {r:0, g: 0, b: 0},
                            attenuation: 1,
                        };
                        pane.addBlade({
                            view: 'buttongrid',
                            size: [1,1],
                            cells: (x, y) => ({

                              title: [
                                ['NW'],
                              ][y][x],
                            }),
                            label: 'buttongrid',
                          }).on('click', (ev) => {
                            console.log(ev);
                          });
                        pane.addInput(data, "r", { label: "mouse radius", min: 1, max: 50, step: 1 });
                        // pane.addInput(data, "x", { min: 0.9, max: 1, step: 0.005 });
                        // pane.addInput(data, "c", {
                            // picker: 'inline',
                            // expanded: true,
                        // });
                        pane.addMonitor(data, "t");
                        pane.addInput(data, "attenuation", {min:0, max: 8, step: 1});
                        pane.addInput(data, "x", {min:-8, max: 8, step: 1});


                        canvas.addEventListener('mousemove', e => {
                            const bb = canvas.getBoundingClientRect();
                            const x = Math.floor((e.clientX - bb.left) / bb.width * canvas.width);
                            const y = Math.floor((e.clientY - bb.top) / bb.height * canvas.height);

                            data.mousePos = [x, y];
                        });

                        return Promise.resolve(data);
                    },
                    (data, f) => {

                        const b = new ImageData(data.b, WIDTH, HEIGHT);
                        // const fb = data.fireBuffer;
                        const r = data.r;

                        sf.circle(data.mousePos[0], data.mousePos[1], data.r);

                        // circle around mouse pos
                        // for (let x = -r; x < r; x++) {
                        //     for (let y = -r; y < r; y++) {
                        //         const d = x * x + y * y;
                        //         if (d <= r * r)
                        //             fb[Math.min(HEIGHT - 1, Math.max(0, data.mousePos[1] + y)) * WIDTH +
                        //                 ((data.mousePos[0] + x) % WIDTH)] =
                        //                 Math.random() * 255 * ((d / (r)));

                        //     }
                        // }

                        f(data.t, data.b, data.attenuation, data.x.min, data.x.max);
                        // data.ctx.scale(2, 2);
                        data.ctx.putImageData(b, 0, 0);
                    },

                    (data, t) => {
                        data.t = t;

                    }).create();

                break;
            case Sample.Svg:
                new WasmHost(x as HTMLElement, make_fragment,
                    (div, pane) => {
                        const data = { x: 1, t: 1, div: div };
                        pane.addInput(data, "x", { min: 0, max: 100 });
                        pane.addMonitor(data, "t");
                        return Promise.resolve(data);
                    },
                    (data, f) => {
                        // console.log(data)
                        data.div.replaceChildren(f(data.x, data.t))
                    },
                    (data) => data.t += 0.16,
                ).create();
                break;

            default:
                x.innerHTML = "unknown";
                break;
        }
    });
});
// customElements.define("astro-greet", AstroGreet);