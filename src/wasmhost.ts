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

let stack: IWasmHost[] = [];


interface Options {
    static: boolean, disablePane: boolean,
}
interface IWasmHost {
    title: string;
    start(): void;
    stop(): void;
}
export class WasmHost<T, TD extends { paused: boolean }> implements IWasmHost {

    f: T;
    pane?: Pane;
    div: HTMLElement;
    data?: TD;
    options: Options;
    title: string;

    onCreate: (div: HTMLElement, pane?: Pane) => TD;
    onChange: (data: any, f: T) => void;
    onUpdate?: (data: TD, t: number) => void;

    private first = true;
    private prev_t = 0;

    constructor(
        title: string,
        div: HTMLElement,
        f: T,
        onCreate: (div: HTMLElement, pane?: Pane) => TD,
        onChange: (data: TD, f: T) => void,
        onUpdate?: (data: TD, t: number) => void,
        options?: Options,
    ) {
        // super();
        this.div = div;
        this.f = f;
        this.onCreate = onCreate;
        this.onChange = onChange;
        this.onUpdate = onUpdate;
        this.options = options ?? { static: false, disablePane: false };
        this.title = title;
    }

    update(t: DOMHighResTimeStamp) {
        if (t - this.prev_t > 33) {
            this.prev_t = t;
            if (this.data && !this.data.paused && (this.first || !this.options.static)) {
                // console.log("update")
                this.onUpdate!(this.data, t / 1000.0);

                // fpsGraph?.begin();
                this.onChange(this.data, this.f);
                // fpsGraph?.end();
                this.first = false;
            }
        }
        requestAnimationFrame(this.update.bind(this));

    }

    start() {
        console.log("START ", this.title, stack.map(x => x.title));
        if (this.div.hasAttribute("data-created")) {
            if (this.onUpdate && this.data)
                (this.data as any).paused = false;
            this.pane?.refresh();
            return;
        }

        this.div.setAttribute("data-created", '');
        // console.log(options);
        if (!this.options.disablePane) {
            this.pane = new Pane({ container: this.div.querySelector("#pane")! as HTMLElement, title: this.title });
            this.pane.registerPlugin(EssentialsPlugin);
            this.pane.on('change', (ev) => {
                // console.log('changed: ', ev, this.data);
                // data.result = this.f(...Object.values(this.mapData(data)));
                this.onChange(data, this.f)
            });
        }
        const pane = this.pane;


        const data = this.onCreate(this.div.querySelector("#content")!, this.pane);

        this.data = data;
        // console.warn(data)

        if (this.onUpdate) {
            if ((data as any).paused === undefined)
                (data as any).paused = false;
            if (pane && !this.options.static)
                pane.addInput(data, "paused");

            requestAnimationFrame(this.update.bind(this));
        } else {

            this.onChange(data, this.f)
        }


        // observer.disconnect();
    }
    stop() {
        console.warn("STOP ", this.title, stack.map(x => x.title));

        // console.log("pause", this);
        if (this.onUpdate && this.data)
            (this.data as any).paused = true;
        this.pane?.refresh();
    }
    async create() {
        const tpl = wasm_template.content.cloneNode(true);
        this.div.appendChild(tpl);
        this.start();

        new IntersectionObserver((entries, observer) => {
            const self = this;
            entries.forEach(async entry => {
                // console.log(entry);
                if (entry.isIntersecting) {
                    // let found = false;
                    // for (let i = 0; i < stack.length; i++) {
                    //     if (stack[i] === this) { stack[i].start(); found = true; }
                    //     else {
                    //         stack[i].stop();
                    //     }
                    // }
                    // if (!found) {
                        this.start()
                        // stack.push(this);
                    // }

                } else { // left viewport
                    this.stop();
                    // if (stack[stack.length - 1] === this) {
                        // stack.pop();
                    // }
                }
            });
        }, { threshold: [0] }).observe(this.div);
    }
}