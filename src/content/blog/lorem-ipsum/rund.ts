import init, { make_fragment } from "./pkg/sample_rust";
import { WasmHost } from "@/wasmhost";
export class AstroGreet extends WasmHost<typeof make_fragment, {
    div: HTMLDivElement,
    x: number,
    t: number,
}> {
    constructor(x:any) {
        console.warn(x)
        super(make_fragment, (div, pane) => {
            
        const message = this.dataset.message;
        console.log("define", message);
            const output = document.createElement("div");
            div.appendChild(output);
            const data = { div: output, x: 50, t: 0 };
            pane.addInput(data, "x");
            pane.addMonitor(data, "t");
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

// document.querySelectorAll("astro-greet").forEach(x => x.appendChild(document.createElement(AstroGreet)))
customElements.define("astro-greet", AstroGreet);
console.log("registered");