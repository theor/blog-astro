// typical use case with :
// wasm-pack build --release --target web -d "[..]blog-astro/src/content/blog/lorem-ipsum/_pkg" --no-typescript   
import { Pane } from "tweakpane";
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';

const wasm_template = document.createElement("template");
wasm_template.innerHTML = `
<style>
.root {
    width: 100%;
  display: flex;
  flex-direction: column;
}

/* Medium devices (landscape tablets, 768px and up) */
@media only screen and (min-width: 768px) {
    .root {
        flex-direction: row;

    }
}
canvas {
    image-rendering: pixelated;
    border: solid 1px black;
}
.root > div {
    flex: 1;
}
</style>
<div class="root">
<div id="content"></div>
<div id="pane"></div>
</div>`;

export class WasmHost<T, TD>  {

    f: T;
    pane?: Pane;
    div: HTMLElement;

    onChange: (data: any, f: T) => any;
    onCreate: (div: HTMLElement, pane: Pane) => any;
    onUpdate?: (data: TD, t: number) => void;

    constructor(
        div: HTMLElement,
        f: T,
        onCreate: (div: HTMLElement, pane: Pane) => Promise<TD>,
        onChange: (data: TD, f: T) => any,
        onUpdate?: (data: TD, t: number) => void) {
        // super();
        this.div = div;
        this.f = f;
        this.onCreate = onCreate;
        this.onChange = onChange;
        this.onUpdate = onUpdate;
    }

    connectedCallback() {
        this.create();
    }
    async create() {
        const tpl = wasm_template.content.cloneNode(true);
        this.div.appendChild(tpl);
       

        new IntersectionObserver((entries, observer) => {
            entries.forEach(async entry => {
              if(entry.isIntersecting) {
                console.log(entry);

                this.pane = new Pane({ container: this.div.querySelector("#pane")!, title: "SVG" });
                
this.pane.registerPlugin(EssentialsPlugin);
        const pane = this.pane;
                const data = await this.onCreate(this.div.querySelector("#content")!, this.pane);
        
                this.pane.on('change', (ev) => {
                    // console.log('changed: ' + JSON.stringify(ev.value), data);
                    // data.result = this.f(...Object.values(this.mapData(data)));
                    this.onChange(data, this.f)
                });

let prev_t = 0;                
                if (this.onUpdate) {
                    (data as any).paused = false;
                    pane.addInput(data, "paused");
                    const update = (t:DOMHighResTimeStamp) => {
                        if(t - prev_t > 33) {
                            prev_t = t;
                        // console.log(t)
                        if (!data.paused) {
                            this.onUpdate!(data, t / 1000.0);
                            this.onChange(data, this.f);
                        }
                    }
                    requestAnimationFrame(update);
                    }
        
                    requestAnimationFrame(update);
                } else {
        
                    this.onChange(data, this.f)
                }
                observer.disconnect();
              }
            });
          }, {threshold: 0.4}).observe(this.div);


    }
}