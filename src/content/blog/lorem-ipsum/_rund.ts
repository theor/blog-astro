import init, { make_fragment, render } from "./_pkg/sample_rust";
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


const WIDTH = 32 * 8;
const HEIGHT = 32 * 8;
export class AstroGreet extends WasmHost<typeof render, {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    x: number;
    t: number;
    r: number;
    b: ArrayBuffer;
    fireBuffer: ArrayBuffer;
    mousePos: number[];
    cutoff: number;
}> {
    constructor(e:HTMLElement) {
        console.warn(e)
        super(e, render, (div, pane) => {
            const canvas = document.createElement("canvas");
            canvas.width = WIDTH;
            canvas.height = HEIGHT;
            div.appendChild(canvas);
            
      const arrayBuffer = new ArrayBuffer(WIDTH * HEIGHT * 4);
      const fireBuffer = new ArrayBuffer(WIDTH * HEIGHT);
       
      const data = {
        canvas: canvas,
        ctx: canvas.getContext('2d')!,
        x: 0.995,
        t: 0,
        r: 5,
        b: arrayBuffer,
        fireBuffer: fireBuffer,
        mousePos: [0, 0],
        cutoff: 40,
      };

      pane.addInput(data, "r", { min: 1, max: 50, step: 1 });
      pane.addInput(data, "x", { min: 0.9, max: 1, step: 0.005 });
      pane.addInput(data, "cutoff", { min: -200, max: 250, step: 1 });
      pane.addMonitor(data, "t");

      
      canvas.addEventListener('mousemove', e => {
        const bb = canvas.getBoundingClientRect();
        const x = Math.floor((e.clientX - bb.left) / bb.width * canvas.width);
        const y = Math.floor((e.clientY - bb.top) / bb.height * canvas.height);

        data.mousePos = [x, y];
      });

            return init().then(() => data);
        }, (data, f) => {
            const pixels = new Uint8ClampedArray(data.b);
            const b = new ImageData(pixels, WIDTH, HEIGHT);
            const fb = new Uint8Array(data.fireBuffer);
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

            f(data.x, new Uint8Array(data.b), fb, WIDTH, HEIGHT);

            data.ctx.putImageData(b, 0, 0);
        },
        
      data => {
        data.t += 0.16;

      });
    }
}

document.querySelectorAll("astro-greet").forEach(x => new AstroGreet(x as HTMLElement).create());
// customElements.define("astro-greet", AstroGreet);
console.log("registered");