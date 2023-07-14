import init, { Plasma, StatefulFire, Stars, Roads } from "./_pkg/sample_rust";
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
function roads(x: HTMLElement) {
    const WIDTH = 2 * 640;
    const HEIGHT = 2 * 480;
    const p = new Roads(WIDTH, HEIGHT);
    new WasmHost(
        x,
        p.update.bind(p),
        async (div, pane) => {

            const canvas = document.createElement("canvas");
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.style.width = `${WIDTH}px`;
            canvas.style.height = `${HEIGHT}px`;
            div.appendChild(canvas);

            const arrayBuffer = new Uint32Array(WIDTH * HEIGHT);

            const data = {
                t: 0, b: arrayBuffer, ctx: canvas.getContext('2d')!,
                mousePos: [0, 0],
                speed_factor: 0.06,
            };



            canvas.addEventListener('mousemove', e => {
                const bb = canvas.getBoundingClientRect();
                const x = (e.clientX - bb.left) / bb.width;
                const y = (e.clientY - bb.top) / bb.height;

                data.mousePos = [x, y];
            });

            pane.addInput(data, "t", { min: 14, max: 25 });
            // pane.addMonitor(data, "t");
            // pane.addInput(data, "speed_factor", { min: 0.01, max: 0.2, step: 0.01, });

            return data;
        },
        (data, f) => {

            const b = new ImageData(new Uint8ClampedArray(data.b.buffer), WIDTH, HEIGHT);

            f(new Uint32Array(data.b.buffer), data.t);
            data.ctx.putImageData(b, 0, 0);
        },
        (data, t) => {
            data.t = t;
        },
    ).create("Roads");
}

function stars(x: HTMLElement) {
    const WIDTH = 512 * 2;
    const HEIGHT = 512 * 2;
    const p = new Stars(WIDTH, HEIGHT);
    new WasmHost(
        x,
        p.update.bind(p),
        async (div, pane) => {

            const canvas = document.createElement("canvas");
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.style.width = `${WIDTH}px`;
            canvas.style.height = `${HEIGHT}px`;
            div.appendChild(canvas);

            const arrayBuffer = new Uint32Array(WIDTH * HEIGHT);

            const data = {
                t: 0, b: arrayBuffer, ctx: canvas.getContext('2d')!,
                mousePos: [0, 0],
                speed_factor: 0.06,
            };



            canvas.addEventListener('mousemove', e => {
                const bb = canvas.getBoundingClientRect();
                const x = (e.clientX - bb.left) / bb.width;
                const y = (e.clientY - bb.top) / bb.height;

                data.mousePos = [x, y];
            });

            pane.addInput(data, "t", { min: 0, max: 1000 });
            pane.addInput(data, "speed_factor", { min: 0.01, max: 0.2, step: 0.01, });

            return data;
        },
        (data, f) => {

            const b = new ImageData(new Uint8ClampedArray(data.b.buffer), WIDTH, HEIGHT);

            f(new Uint8Array(data.b.buffer), data.t, data.mousePos[0], data.mousePos[1], data.speed_factor);
            data.ctx.putImageData(b, 0, 0);
        },
        (data, t) => {
            data.t = t;
            // (data as any).tInput.refresh()
        },
    ).create("Stars");
}
function plasma(x: HTMLElement) {
    const p = new Plasma(WIDTH, HEIGHT);
    new WasmHost(
        x,
        p.update.bind(p),
        async (div, pane) => {

            const canvas = document.createElement("canvas");
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            canvas.style.width = `${WIDTH * 4}px`;
            canvas.style.height = `${HEIGHT * 4}px`;
            div.appendChild(canvas);


            const arrayBuffer = new Uint32Array(WIDTH * HEIGHT);

            const data = { t: 0, b: arrayBuffer, ctx: canvas.getContext('2d')!, };
            (data as any).tInput = pane.addInput(data, "t", { min: 0, max: 1000 });

            return data;
        },
        (data, f) => {

            const b = new ImageData(new Uint8ClampedArray(data.b.buffer), WIDTH, HEIGHT);

            f(data.b, data.t);
            data.ctx.putImageData(b, 0, 0);
        },
        (data, t) => {
            data.t = t;
            // (data as any).tInput.refresh()
        },
    ).create("Plasma");
}
init().then(() => {
    document.querySelectorAll("div[data-sample]").forEach(x => {
        const sample = ((x as HTMLElement).dataset["sample"] ?? Sample.Fire) as Sample;
        switch (sample) {
            case Sample.Roads:
                roads(x as HTMLElement);
                break;
            case Sample.Stars:
                stars(x as HTMLElement);
                break;
            case Sample.Plasma:
                plasma(x as HTMLElement);
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
                            x: { min: -1, max: 2 },
                            t: 0,
                            r: 5,
                            b: arrayBuffer,
                            fireBuffer: fireBuffer,
                            mousePos: [0, 0],
                            c: { r: 0, g: 0, b: 0 },
                            attenuation: 1,
                        };

                        pane.addInput(data, "r", { label: "mouse radius", min: 1, max: 50, step: 1 });
                        pane.addMonitor(data, "t");
                        pane.addInput(data, "attenuation", { min: 0, max: 8, step: 1 });
                        pane.addInput(data, "x", { min: -8, max: 8, step: 1 });


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

                        sf.circle(data.mousePos[0], data.mousePos[1], data.r);


                        f(data.t, data.b, data.attenuation, data.x.min, data.x.max);
                        data.ctx.putImageData(b, 0, 0);
                    },

                    (data, t) => {
                        data.t = t;

                    }).create("Doom fire");

                break;

            default:
                x.innerHTML = "unknown";
                break;
        }
    });
});
// customElements.define("astro-greet", AstroGreet);