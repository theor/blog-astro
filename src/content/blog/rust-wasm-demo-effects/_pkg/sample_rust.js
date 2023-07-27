let wasm;

const heap = new Array(128).fill(undefined);

heap.push(undefined, null, true, false);

function getObject(idx) { return heap[idx]; }

let heap_next = heap.length;

function dropObject(idx) {
    if (idx < 132) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

const cachedTextDecoder = (typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-8', { ignoreBOM: true, fatal: true }) : { decode: () => { throw Error('TextDecoder not available') } } );

if (typeof TextDecoder !== 'undefined') { cachedTextDecoder.decode(); };

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}

let cachedUint32Memory0 = null;

function getUint32Memory0() {
    if (cachedUint32Memory0 === null || cachedUint32Memory0.byteLength === 0) {
        cachedUint32Memory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32Memory0;
}

let WASM_VECTOR_LEN = 0;

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32Memory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
*/
export function main() {
    wasm.main();
}

let cachedInt32Memory0 = null;

function getInt32Memory0() {
    if (cachedInt32Memory0 === null || cachedInt32Memory0.byteLength === 0) {
        cachedInt32Memory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32Memory0;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32Memory0().subarray(ptr / 4, ptr / 4 + len);
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

const cachedTextEncoder = (typeof TextEncoder !== 'undefined' ? new TextEncoder('utf-8') : { encode: () => { throw Error('TextEncoder not available') } } );

const encodeString = (typeof cachedTextEncoder.encodeInto === 'function'
    ? function (arg, view) {
    return cachedTextEncoder.encodeInto(arg, view);
}
    : function (arg, view) {
    const buf = cachedTextEncoder.encode(arg);
    view.set(buf);
    return {
        read: arg.length,
        written: buf.length
    };
});

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8Memory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8Memory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8Memory0().subarray(ptr + offset, ptr + len);
        const ret = encodeString(arg, view);

        offset += ret.written;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}
/**
*/
export const Step = Object.freeze({ FixedCircle:0,"0":"FixedCircle",ShiftedCircle:1,"1":"ShiftedCircle",Perturbation:2,"2":"Perturbation",All:3,"3":"All", });
/**
*/
export const Palette = Object.freeze({ Greyscale:0,"0":"Greyscale",GreyscaleLooped:1,"1":"GreyscaleLooped",Colors:2,"2":"Colors",ColorsStepped:3,"3":"ColorsStepped",Rainbow:4,"4":"Rainbow",RainbowStepped:5,"5":"RainbowStepped", });
/**
*/
export const FirePalette = Object.freeze({ Default:0,"0":"Default", });
/**
*/
export class Plasma {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Plasma.prototype);
        obj.__wbg_ptr = ptr;

        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;

        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_plasma_free(ptr);
    }
    /**
    * @param {number} w
    * @param {number} h
    * @param {number} step
    * @param {number} pal
    */
    constructor(w, h, step, pal) {
        const ret = wasm.plasma_new(w, h, step, pal);
        return Plasma.__wrap(ret);
    }
    /**
    * @param {number} pal
    */
    set_palette(pal) {
        wasm.plasma_set_palette(this.__wbg_ptr, pal);
    }
    /**
    * @returns {number}
    */
    get_ptr() {
        const ret = wasm.plasma_get_ptr(this.__wbg_ptr);
        return ret;
    }
    /**
    * @returns {Uint32Array}
    */
    get_palette() {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.plasma_get_palette(retptr, this.__wbg_ptr);
            var r0 = getInt32Memory0()[retptr / 4 + 0];
            var r1 = getInt32Memory0()[retptr / 4 + 1];
            var v1 = getArrayU32FromWasm0(r0, r1).slice();
            wasm.__wbindgen_free(r0, r1 * 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
    * @param {number} time
    */
    update(time) {
        wasm.plasma_update(this.__wbg_ptr, time);
    }
}
/**
*/
export class Roads2 {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Roads2.prototype);
        obj.__wbg_ptr = ptr;

        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;

        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_roads2_free(ptr);
    }
    /**
    * @param {number} w
    * @param {number} h
    * @param {Uint32Array} bg
    */
    constructor(w, h, bg) {
        const ptr0 = passArray32ToWasm0(bg, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.roads2_new(w, h, ptr0, len0);
        return Roads2.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    get_ptr() {
        const ret = wasm.roads2_get_ptr(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} time
    * @param {number} dir_x
    * @param {number} dir_y
    */
    update(time, dir_x, dir_y) {
        wasm.roads2_update(this.__wbg_ptr, time, dir_x, dir_y);
    }
}
/**
*/
export class Stars {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(Stars.prototype);
        obj.__wbg_ptr = ptr;

        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;

        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_stars_free(ptr);
    }
    /**
    * @param {number} w
    * @param {number} h
    */
    constructor(w, h) {
        const ret = wasm.stars_new(w, h);
        return Stars.__wrap(ret);
    }
    /**
    * @returns {number}
    */
    get_ptr() {
        const ret = wasm.stars_get_ptr(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} t
    * @param {number} vx
    * @param {number} vy
    * @param {number} speed_factor
    */
    update(t, vx, vy, speed_factor) {
        wasm.stars_update(this.__wbg_ptr, t, vx, vy, speed_factor);
    }
}
/**
*/
export class StatefulFire {

    static __wrap(ptr) {
        ptr = ptr >>> 0;
        const obj = Object.create(StatefulFire.prototype);
        obj.__wbg_ptr = ptr;

        return obj;
    }

    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;

        return ptr;
    }

    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_statefulfire_free(ptr);
    }
    /**
    * @param {number} x
    * @param {number} y
    * @param {number} r
    */
    circle(x, y, r) {
        wasm.statefulfire_circle(this.__wbg_ptr, x, y, r);
    }
    /**
    * @returns {number}
    */
    get_ptr() {
        const ret = wasm.statefulfire_get_ptr(this.__wbg_ptr);
        return ret;
    }
    /**
    * @param {number} p
    */
    set_palette(p) {
        wasm.statefulfire_set_palette(this.__wbg_ptr, p);
    }
    /**
    * @param {number} w
    * @param {number} h
    */
    constructor(w, h) {
        const ret = wasm.statefulfire_new(w, h);
        return StatefulFire.__wrap(ret);
    }
    /**
    * @param {number} t
    * @param {number} attenuation
    * @param {number} min_x
    * @param {number} max_x
    */
    update(t, attenuation, min_x, max_x) {
        wasm.statefulfire_update(this.__wbg_ptr, t, attenuation, min_x, max_x);
    }
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);

            } catch (e) {
                if (module.headers.get('Content-Type') != 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else {
                    throw e;
                }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);

    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };

        } else {
            return instance;
        }
    }
}

function __wbg_get_imports() {
    const imports = {};
    imports.wbg = {};
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
    };
    imports.wbg.__wbg_new_abda76e883ba8a5f = function() {
        const ret = new Error();
        return addHeapObject(ret);
    };
    imports.wbg.__wbg_stack_658279fe44541cf6 = function(arg0, arg1) {
        const ret = getObject(arg1).stack;
        const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
        const len1 = WASM_VECTOR_LEN;
        getInt32Memory0()[arg0 / 4 + 1] = len1;
        getInt32Memory0()[arg0 / 4 + 0] = ptr1;
    };
    imports.wbg.__wbg_error_f851667af71bcfc6 = function(arg0, arg1) {
        let deferred0_0;
        let deferred0_1;
        try {
            deferred0_0 = arg0;
            deferred0_1 = arg1;
            console.error(getStringFromWasm0(arg0, arg1));
        } finally {
            wasm.__wbindgen_free(deferred0_0, deferred0_1, 1);
        }
    };
    imports.wbg.__wbindgen_throw = function(arg0, arg1) {
        throw new Error(getStringFromWasm0(arg0, arg1));
    };

    return imports;
}

function __wbg_init_memory(imports, maybe_memory) {

}

function __wbg_finalize_init(instance, module) {
    wasm = instance.exports;
    __wbg_init.__wbindgen_wasm_module = module;
    cachedInt32Memory0 = null;
    cachedUint32Memory0 = null;
    cachedUint8Memory0 = null;

    wasm.__wbindgen_start();
    return wasm;
}

function initSync(module) {
    if (wasm !== undefined) return wasm;

    const imports = __wbg_get_imports();

    __wbg_init_memory(imports);

    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }

    const instance = new WebAssembly.Instance(module, imports);

    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(input) {
    if (wasm !== undefined) return wasm;

    if (typeof input === 'undefined') {
        input = new URL('sample_rust_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof input === 'string' || (typeof Request === 'function' && input instanceof Request) || (typeof URL === 'function' && input instanceof URL)) {
        input = fetch(input);
    }

    __wbg_init_memory(imports);

    const { instance, module } = await __wbg_load(await input, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync }
export default __wbg_init;
