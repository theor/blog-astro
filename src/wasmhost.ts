
import { Pane } from "tweakpane";
const wasm_template = document.createElement("template");
wasm_template.innerHTML = `
<style>
.root {
    width: 100%;
  display: flex;
  flex-direction: row;
}
.root > div {
    flex: 1;
}
</style>
<div class="root">
<div id="content"></div>
<div id="pane"></div>
</div>`;

export abstract class WasmHost<T, TD> extends HTMLElement {

    f: T;
    pane?: Pane;

    onChange: (data: any, f: T) => any;
    onCreate: (div: HTMLElement, pane: Pane) => any;
    onUpdate?: (data: TD) => void;

    constructor(f: T,
        onCreate: (div: HTMLElement, pane: Pane) => Promise<TD>,
        onChange: (data: TD, f: T) => any,
        onUpdate?: (data: TD) => void) {
        super();
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
        this.appendChild(tpl);
        this.pane = new Pane({ container: this.querySelector("#pane")!, title: "SVG" });
        const data = await this.onCreate(this.querySelector("#content")!, this.pane);

        this.pane.on('change', (ev) => {
            // console.log('changed: ' + JSON.stringify(ev.value), data);
            // data.result = this.f(...Object.values(this.mapData(data)));
            this.onChange(data, this.f)
        });
        if (this.onUpdate) {
            (data as any).paused = false;
            this.pane.addInput(data, "paused");
            const update = () => {
                if (!data.paused) {
                    this.onUpdate!(data);
                    this.onChange(data, this.f);
                }
                requestAnimationFrame(update);
            }

            requestAnimationFrame(update);
        } else {

            this.onChange(data, this.f)
        }
    }
}