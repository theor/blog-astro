let wasm;

let cachedUint8Memory0 = null;

function getUint8Memory0() {
    if (cachedUint8Memory0 === null || cachedUint8Memory0.byteLength === 0) {
        cachedUint8Memory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8Memory0;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8Memory0().subarray(ptr / 1, ptr / 1 + len);
}

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

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return cachedTextDecoder.decode(getUint8Memory0().subarray(ptr, ptr + len));
}
/**
*/
export function main() {
    wasm.main();
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8Memory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

let cachedUint32Memory0 = null;

function getUint32Memory0() {
    if (cachedUint32Memory0 === null || cachedUint32Memory0.byteLength === 0) {
        cachedUint32Memory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32Memory0;
}

function passArray32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getUint32Memory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
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
    */
    constructor(w, h) {
        const ret = wasm.plasma_new(w, h);
        return Plasma.__wrap(ret);
    }
    /**
    * @param {Uint32Array} b
    * @param {number} time
    */
    update(b, time) {
        var ptr0 = passArray32ToWasm0(b, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.plasma_update(this.__wbg_ptr, ptr0, len0, addHeapObject(b), time);
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
    */
    constructor(w, h) {
        const ret = wasm.roads2_new(w, h);
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
    * @param {Uint8Array} b
    * @param {number} t
    * @param {number} vx
    * @param {number} vy
    * @param {number} speed_factor
    */
    update(b, t, vx, vy, speed_factor) {
        var ptr0 = passArray8ToWasm0(b, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.stars_update(this.__wbg_ptr, ptr0, len0, addHeapObject(b), t, vx, vy, speed_factor);
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
    * @param {Uint8Array} p
    */
    set_palette(p) {
        const ptr0 = passArray8ToWasm0(p, wasm.__wbindgen_malloc);
        const len0 = WASM_VECTOR_LEN;
        wasm.statefulfire_set_palette(this.__wbg_ptr, ptr0, len0);
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
    * @param {Uint8Array} b
    * @param {number} attenuation
    * @param {number} min_x
    * @param {number} max_x
    */
    update(t, b, attenuation, min_x, max_x) {
        var ptr0 = passArray8ToWasm0(b, wasm.__wbindgen_malloc);
        var len0 = WASM_VECTOR_LEN;
        wasm.statefulfire_update(this.__wbg_ptr, t, ptr0, len0, addHeapObject(b), attenuation, min_x, max_x);
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
    imports.wbg.__wbindgen_copy_to_typed_array = function(arg0, arg1, arg2) {
        new Uint8Array(getObject(arg2).buffer, getObject(arg2).byteOffset, getObject(arg2).byteLength).set(getArrayU8FromWasm0(arg0, arg1));
    };
    imports.wbg.__wbindgen_object_drop_ref = function(arg0) {
        takeObject(arg0);
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
