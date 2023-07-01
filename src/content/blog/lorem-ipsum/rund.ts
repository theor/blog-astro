import init, { make_fragment } from "./pkg/sample_rust";
import { WasmHost } from "@/wasmhost";
export class AstroGreet extends WasmHost<typeof make_fragment, {
    div: HTMLDivElement,
    x: number,
    t: number,
}> {
    constructor(e:HTMLElement) {
        console.warn(e)
        super(e, make_fragment, (div, pane) => {
            
        const message = e.dataset;
        console.log("define", e, message);
            const output = document.createElement("div");
            div.appendChild(output);
            const data = { div: output, x: 50, t: 0, s: e.dataset.message };
            pane.addInput(data, "x");
            pane.addMonitor(data, "t");
            pane.addMonitor(data, "s");
            return init().then(() => data);
        }, (data, f) => {
            const fragment = f(data.x, data.t);
            if (data.div.hasChildNodes())
                data.div.replaceChild(fragment, data.div.firstChild!)
            else
                data.div.appendChild(fragment);
        },
        
      data => {
        data.t += 0.16;

      });
    }
}

document.querySelectorAll("astro-greet").forEach(x => new AstroGreet(x).create());
// customElements.define("astro-greet", AstroGreet);
console.log("registered");