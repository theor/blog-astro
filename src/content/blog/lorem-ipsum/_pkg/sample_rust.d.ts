/* tslint:disable */
/* eslint-disable */
/**
* @returns {any}
*/
export function compute_desc(): any;
/**
* @param {number} i
* @param {number} j
* @returns {number}
*/
export function compute(i: number, j: number): number;
/**
* @returns {any}
*/
export function svg_test_desc(): any;
/**
* @param {number} i
* @param {number} j
* @param {number} k
* @returns {string}
*/
export function svg_test(i: number, j: number, k: number): string;
/**
*/
export function main(): void;
/**
* @param {number} step
* @param {Float64Array} x
*/
export function halton_demo(step: number, x: Float64Array): void;
/**
* @param {number} t
* @param {Uint8Array} b
* @param {Uint8Array} fire
* @param {number} w
* @param {number} h
*/
export function render(t: number, b: Uint8Array, fire: Uint8Array, w: number, h: number): void;
/**
* @param {number} x
* @param {number} t
* @returns {Element}
*/
export function make_fragment(x: number, t: number): Element;
/**
*/
export enum Kind {
  A = 0,
  B = 1,
}

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly compute_desc: () => number;
  readonly svg_test_desc: () => number;
  readonly svg_test: (a: number, b: number, c: number, d: number) => void;
  readonly main: () => void;
  readonly halton_demo: (a: number, b: number, c: number, d: number) => void;
  readonly render: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
  readonly make_fragment: (a: number, b: number) => number;
  readonly compute: (a: number, b: number) => number;
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;
/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {SyncInitInput} module
*
* @returns {InitOutput}
*/
export function initSync(module: SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {InitInput | Promise<InitInput>} module_or_path
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: InitInput | Promise<InitInput>): Promise<InitOutput>;
