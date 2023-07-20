// typical use case with :
// wasm-pack build --release --target web -d "[..]blog-astro/src/content/blog/lorem-ipsum/_pkg" --no-typescript   
import { Pane } from "tweakpane";
import * as EssentialsPlugin from '@tweakpane/plugin-essentials';
import type { FpsGraphBladeApi } from "@tweakpane/plugin-essentials";

const wasm_template = document.createElement("template");
wasm_template.innerHTML = `
<style>
.root {
    width: 100%;
  display: flex;
  flex-direction: column;
  margin-bottom: 2em;
}

/* Medium devices (landscape tablets, 768px and up) */
@media only screen and (min-width: 768px) {
    .root {
        flex-direction: row;
        flex-wrap: wrap;

    }
}
canvas {
    image-rendering: pixelated;
    border: solid 1px black;
    background: black;
    margin-right: 1em;
}
.root > div {
    flex: 1;
}

#pane {
    margin-left: 8px;
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
    data?: TD;

    onCreate: (div: HTMLElement, pane: Pane, host: WasmHost<T, TD>) => Promise<TD>;
    onChange: (data: any, f: T, host: WasmHost<T, TD>) => void;
    onUpdate?: (data: TD, t: number) => void;

    constructor(
        div: HTMLElement,
        f: T,
        onCreate: (div: HTMLElement, pane: Pane, host: WasmHost<T, TD>) => Promise<TD>,
        onChange: (data: TD, f: T, host: WasmHost<T, TD>) => void,
        onUpdate?: (data: TD, t: number) => void,
    ) {
        // super();
        this.div = div;
        this.f = f;
        this.onCreate = onCreate;
        this.onChange = onChange;
        this.onUpdate = onUpdate;
    }

    async create(name: string, options?: { static: boolean, disablePane: boolean }) {
        const tpl = wasm_template.content.cloneNode(true);
        this.div.appendChild(tpl);


        new IntersectionObserver((entries, observer) => {
            entries.forEach(async entry => {
                // console.log(entry);
                if (entry.isIntersecting) {

                    if (entry.target.hasAttribute("data-created")) {

                        if (this.onUpdate && this.data)
                            (this.data as any).paused = false;
                        return;
                    }

                    entry.target.setAttribute("data-created", '');
                    let fpsGraph: FpsGraphBladeApi;
                    // console.log(options);
                    if (!options?.disablePane) {
                        this.pane = new Pane({ container: this.div.querySelector("#pane")!, title: name });
                        this.pane.registerPlugin(EssentialsPlugin);
                        this.pane.on('change', (ev) => {
                            // console.log('changed: ', ev, this.data);
                            // data.result = this.f(...Object.values(this.mapData(data)));
                            this.onChange(data, this.f, this)
                        });

                        if (this.onUpdate) {
                            fpsGraph = this.pane.addBlade({
                                view: 'fpsgraph',

                                label: 'fpsgraph',
                                lineCount: 2,
                            }) as FpsGraphBladeApi;
                        }
                    }
                    const pane = this.pane;


                    const data = Object.assign(await this.onCreate(this.div.querySelector("#content")!, this.pane, this), options);

                    this.data = data;
                    // console.warn(data)

                    let first = true;

                    let prev_t = 0;
                    if (this.onUpdate) {
                        if ((data as any).paused === undefined)
                            (data as any).paused = false;
                        if (pane && !data.static)
                            pane.addInput(data, "paused");
                        const update = (t: DOMHighResTimeStamp) => {
                            if (t - prev_t > 33) {
                                prev_t = t;
                                if (!data.paused && (first || !data.static)) {
                                    // console.log("update")
                                    this.onUpdate!(data, t / 1000.0);

                                    fpsGraph?.begin();
                                    this.onChange(data, this.f, this);
                                    fpsGraph?.end();
                                    first = false;
                                }
                            }
                            requestAnimationFrame(update);
                        }

                        requestAnimationFrame(update);
                    } else {

                        this.onChange(data, this.f, this)
                    }
                    // observer.disconnect();
                } else {
                    // console.log("pause", this);
                    if (this.onUpdate && this.data)
                        (this.data as any).paused = true;
                    this.pane?.refresh();
                }
            });
        }, { threshold: [0] }).observe(this.div);


    }
}