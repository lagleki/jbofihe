// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function shell_read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function shell_print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function shell_printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}
if (!Module['quit']) {
  Module['quit'] = function(status, toThrow) {
    throw toThrow;
  }
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { assert(DYNAMICTOP_PTR);var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    funcstr += "if (typeof EmterpreterAsync === 'object') { assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling cwrap') }";
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - Module['asm'].stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = Runtime.GLOBAL_BASE;

STATICTOP = STATIC_BASE + 567248;
/* global initializers */  __ATINIT__.push();


/* memory initializer */ allocate([1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,3,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,3,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,3,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,2,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,2,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,2,0,0,0,3,0,0,0,4,0,0,0,5,0,0,0,5,0,0,0,5,0,0,0,5,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,9,0,0,0,11,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,16,0,0,0,18,0,0,0,19,0,0,0,20,0,0,0,20,0,0,0,21,0,0,0,22,0,0,0,22,0,0,0,23,0,0,0,24,0,0,0,24,0,0,0,24,0,0,0,24,0,0,0,25,0,0,0,27,0,0,0,29,0,0,0,30,0,0,0,32,0,0,0,34,0,0,0,35,0,0,0,36,0,0,0,38,0,0,0,39,0,0,0,41,0,0,0,42,0,0,0,43,0,0,0,43,0,0,0,44,0,0,0,45,0,0,0,46,0,0,0,47,0,0,0,48,0,0,0,49,0,0,0,49,0,0,0,51,0,0,0,51,0,0,0,52,0,0,0,53,0,0,0,54,0,0,0,56,0,0,0,57,0,0,0,57,0,0,0,58,0,0,0,59,0,0,0,62,0,0,0,63,0,0,0,65,0,0,0,67,0,0,0,69,0,0,0,71,0,0,0,73,0,0,0,73,0,0,0,73,0,0,0,74,0,0,0,76,0,0,0,77,0,0,0,79,0,0,0,80,0,0,0,81,0,0,0,82,0,0,0,83,0,0,0,83,0,0,0,83,0,0,0,83,0,0,0,85,0,0,0,87,0,0,0,88,0,0,0,90,0,0,0,92,0,0,0,93,0,0,0,94,0,0,0,96,0,0,0,97,0,0,0,97,0,0,0,98,0,0,0,99,0,0,0,100,0,0,0,100,0,0,0,101,0,0,0,102,0,0,0,102,0,0,0,103,0,0,0,103,0,0,0,104,0,0,0,105,0,0,0,106,0,0,0,107,0,0,0,109,0,0,0,110,0,0,0,111,0,0,0,111,0,0,0,111,0,0,0,113,0,0,0,114,0,0,0,115,0,0,0,116,0,0,0,117,0,0,0,118,0,0,0,119,0,0,0,120,0,0,0,120,0,0,0,121,0,0,0,122,0,0,0,123,0,0,0,124,0,0,0,126,0,0,0,128,0,0,0,128,0,0,0,129,0,0,0,130,0,0,0,131,0,0,0,132,0,0,0,133,0,0,0,134,0,0,0,136,0,0,0,137,0,0,0,139,0,0,0,140,0,0,0,140,0,0,0,141,0,0,0,142,0,0,0,143,0,0,0,143,0,0,0,144,0,0,0,145,0,0,0,146,0,0,0,147,0,0,0,148,0,0,0,149,0,0,0,149,0,0,0,150,0,0,0,151,0,0,0,152,0,0,0,153,0,0,0,154,0,0,0,154,0,0,0,154,0,0,0,154,0,0,0,154,0,0,0,154,0,0,0,155,0,0,0,155,0,0,0,155,0,0,0,156,0,0,0,157,0,0,0,158,0,0,0,158,0,0,0,158,0,0,0,159,0,0,0,160,0,0,0,161,0,0,0,161,0,0,0,162,0,0,0,162,0,0,0,163,0,0,0,164,0,0,0,166,0,0,0,167,0,0,0,167,0,0,0,168,0,0,0,169,0,0,0,169,0,0,0,170,0,0,0,171,0,0,0,172,0,0,0,173,0,0,0,174,0,0,0,176,0,0,0,177,0,0,0,178,0,0,0,179,0,0,0,180,0,0,0,182,0,0,0,183,0,0,0,184,0,0,0,185,0,0,0,186,0,0,0,186,0,0,0,187,0,0,0,188,0,0,0,190,0,0,0,191,0,0,0,191,0,0,0,192,0,0,0,193,0,0,0,194,0,0,0,196,0,0,0,197,0,0,0,199,0,0,0,201,0,0,0,202,0,0,0,204,0,0,0,206,0,0,0,207,0,0,0,209,0,0,0,210,0,0,0,212,0,0,0,213,0,0,0,214,0,0,0,216,0,0,0,217,0,0,0,218,0,0,0,221,0,0,0,223,0,0,0,224,0,0,0,224,0,0,0,225,0,0,0,226,0,0,0,226,0,0,0,226,0,0,0,227,0,0,0,228,0,0,0,229,0,0,0,230,0,0,0,231,0,0,0,232,0,0,0,233,0,0,0,234,0,0,0,234,0,0,0,234,0,0,0,235,0,0,0,237,0,0,0,237,0,0,0,238,0,0,0,239,0,0,0,240,0,0,0,241,0,0,0,242,0,0,0,244,0,0,0,245,0,0,0,245,0,0,0,247,0,0,0,248,0,0,0,249,0,0,0,250,0,0,0,251,0,0,0,252,0,0,0,254,0,0,0,255,0,0,0,0,1,0,0,2,1,0,0,4,1,0,0,5,1,0,0,6,1,0,0,7,1,0,0,8,1,0,0,9,1,0,0,9,1,0,0,11,1,0,0,11,1,0,0,12,1,0,0,13,1,0,0,15,1,0,0,16,1,0,0,17,1,0,0,17,1,0,0,18,1,0,0,19,1,0,0,20,1,0,0,21,1,0,0,22,1,0,0,24,1,0,0,24,1,0,0,26,1,0,0,26,1,0,0,27,1,0,0,28,1,0,0,29,1,0,0,29,1,0,0,29,1,0,0,30,1,0,0,31,1,0,0,32,1,0,0,32,1,0,0,33,1,0,0,35,1,0,0,36,1,0,0,38,1,0,0,39,1,0,0,41,1,0,0,43,1,0,0,44,1,0,0,45,1,0,0,46,1,0,0,47,1,0,0,48,1,0,0,49,1,0,0,50,1,0,0,50,1,0,0,51,1,0,0,52,1,0,0,54,1,0,0,55,1,0,0,56,1,0,0,57,1,0,0,58,1,0,0,60,1,0,0,62,1,0,0,64,1,0,0,65,1,0,0,66,1,0,0,68,1,0,0,70,1,0,0,72,1,0,0,74,1,0,0,74,1,0,0,75,1,0,0,76,1,0,0,78,1,0,0,80,1,0,0,81,1,0,0,82,1,0,0,84,1,0,0,85,1,0,0,87,1,0,0,88,1,0,0,90,1,0,0,92,1,0,0,93,1,0,0,94,1,0,0,96,1,0,0,98,1,0,0,99,1,0,0,100,1,0,0,101,1,0,0,101,1,0,0,101,1,0,0,101,1,0,0,103,1,0,0,103,1,0,0,103,1,0,0,103,1,0,0,104,1,0,0,106,1,0,0,108,1,0,0,110,1,0,0,111,1,0,0,112,1,0,0,113,1,0,0,115,1,0,0,116,1,0,0,117,1,0,0,118,1,0,0,119,1,0,0,121,1,0,0,122,1,0,0,124,1,0,0,126,1,0,0,128,1,0,0,128,1,0,0,129,1,0,0,130,1,0,0,132,1,0,0,133,1,0,0,134,1,0,0,136,1,0,0,138,1,0,0,139,1,0,0,139,1,0,0,140,1,0,0,141,1,0,0,142,1,0,0,143,1,0,0,144,1,0,0,145,1,0,0,147,1,0,0,149,1,0,0,150,1,0,0,151,1,0,0,152,1,0,0,153,1,0,0,154,1,0,0,155,1,0,0,156,1,0,0,157,1,0,0,157,1,0,0,158,1,0,0,159,1,0,0,161,1,0,0,163,1,0,0,165,1,0,0,166,1,0,0,168,1,0,0,169,1,0,0,170,1,0,0,172,1,0,0,174,1,0,0,174,1,0,0,175,1,0,0,176,1,0,0,178,1,0,0,178,1,0,0,179,1,0,0,180,1,0,0,181,1,0,0,182,1,0,0,183,1,0,0,184,1,0,0,185,1,0,0,186,1,0,0,188,1,0,0,189,1,0,0,191,1,0,0,193,1,0,0,195,1,0,0,197,1,0,0,198,1,0,0,200,1,0,0,202,1,0,0,203,1,0,0,205,1,0,0,207,1,0,0,209,1,0,0,210,1,0,0,211,1,0,0,212,1,0,0,213,1,0,0,214,1,0,0,215,1,0,0,216,1,0,0,217,1,0,0,218,1,0,0,219,1,0,0,220,1,0,0,222,1,0,0,223,1,0,0,225,1,0,0,226,1,0,0,228,1,0,0,228,1,0,0,229,1,0,0,230,1,0,0,231,1,0,0,233,1,0,0,233,1,0,0,234,1,0,0,234,1,0,0,236,1,0,0,237,1,0,0,237,1,0,0,239,1,0,0,239,1,0,0,241,1,0,0,241,1,0,0,241,1,0,0,243,1,0,0,244,1,0,0,245,1,0,0,246,1,0,0,247,1,0,0,248,1,0,0,249,1,0,0,249,1,0,0,250,1,0,0,251,1,0,0,252,1,0,0,253,1,0,0,254,1,0,0,255,1,0,0,0,2,0,0,1,2,0,0,2,2,0,0,4,2,0,0,5,2,0,0,6,2,0,0,6,2,0,0,7,2,0,0,9,2,0,0,11,2,0,0,13,2,0,0,15,2,0,0,16,2,0,0,18,2,0,0,19,2,0,0,20,2,0,0,21,2,0,0,22,2,0,0,23,2,0,0,25,2,0,0,25,2,0,0,26,2,0,0,27,2,0,0,28,2,0,0,29,2,0,0,31,2,0,0,32,2,0,0,33,2,0,0,34,2,0,0,35,2,0,0,36,2,0,0,37,2,0,0,38,2,0,0,39,2,0,0,40,2,0,0,40,2,0,0,41,2,0,0,42,2,0,0,43,2,0,0,43,2,0,0,44,2,0,0,44,2,0,0,45,2,0,0,46,2,0,0,47,2,0,0,47,2,0,0,49,2,0,0,49,2,0,0,50,2,0,0,51,2,0,0,52,2,0,0,52,2,0,0,54,2,0,0,55,2,0,0,55,2,0,0,57,2,0,0,57,2,0,0,57,2,0,0,58,2,0,0,59,2,0,0,59,2,0,0,60,2,0,0,61,2,0,0,61,2,0,0,62,2,0,0,64,2,0,0,65,2,0,0,66,2,0,0,67,2,0,0,69,2,0,0,71,2,0,0,73,2,0,0,74,2,0,0,76,2,0,0,76,2,0,0,78,2,0,0,79,2,0,0,80,2,0,0,81,2,0,0,83,2,0,0,84,2,0,0,85,2,0,0,86,2,0,0,86,2,0,0,87,2,0,0,88,2,0,0,89,2,0,0,90,2,0,0,92,2,0,0,93,2,0,0,93,2,0,0,93,2,0,0,93,2,0,0,93,2,0,0,94,2,0,0,95,2,0,0,95,2,0,0,96,2,0,0,96,2,0,0,96,2,0,0,97,2,0,0,98,2,0,0,99,2,0,0,99,2,0,0,99,2,0,0,100,2,0,0,100,2,0,0,101,2,0,0,102,2,0,0,103,2,0,0,104,2,0,0,105,2,0,0,106,2,0,0,107,2,0,0,108,2,0,0,109,2,0,0,109,2,0,0,109,2,0,0,109,2,0,0,109,2,0,0,109,2,0,0,110,2,0,0,111,2,0,0,112,2,0,0,114,2,0,0,116,2,0,0,117,2,0,0,119,2,0,0,120,2,0,0,121,2,0,0,122,2,0,0,123,2,0,0,124,2,0,0,126,2,0,0,128,2,0,0,130,2,0,0,131,2,0,0,132,2,0,0,133,2,0,0,134,2,0,0,135,2,0,0,136,2,0,0,137,2,0,0,138,2,0,0,140,2,0,0,141,2,0,0,141,2,0,0,142,2,0,0,144,2,0,0,145,2,0,0,147,2,0,0,149,2,0,0,151,2,0,0,152,2,0,0,154,2,0,0,156,2,0,0,157,2,0,0,158,2,0,0,159,2,0,0,159,2,0,0,160,2,0,0,161,2,0,0,163,2,0,0,164,2,0,0,164,2,0,0,166,2,0,0,168,2,0,0,169,2,0,0,170,2,0,0,172,2,0,0,173,2,0,0,174,2,0,0,174,2,0,0,175,2,0,0,176,2,0,0,177,2,0,0,179,2,0,0,179,2,0,0,180,2,0,0,181,2,0,0,182,2,0,0,184,2,0,0,184,2,0,0,186,2,0,0,187,2,0,0,187,2,0,0,189,2,0,0,190,2,0,0,191,2,0,0,192,2,0,0,193,2,0,0,194,2,0,0,195,2,0,0,197,2,0,0,197,2,0,0,197,2,0,0,197,2,0,0,198,2,0,0,199,2,0,0,199,2,0,0,200,2,0,0,201,2,0,0,202,2,0,0,203,2,0,0,203,2,0,0,204,2,0,0,204,2,0,0,204,2,0,0,205,2,0,0,207,2,0,0,209,2,0,0,210,2,0,0,211,2,0,0,213,2,0,0,214,2,0,0,215,2,0,0,216,2,0,0,218,2,0,0,219,2,0,0,220,2,0,0,221,2,0,0,223,2,0,0,224,2,0,0,225,2,0,0,226,2,0,0,227,2,0,0,228,2,0,0,229,2,0,0,230,2,0,0,230,2,0,0,231,2,0,0,232,2,0,0,233,2,0,0,235,2,0,0,237,2,0,0,239,2,0,0,240,2,0,0,242,2,0,0,244,2,0,0,245,2,0,0,246,2,0,0,247,2,0,0,248,2,0,0,249,2,0,0,250,2,0,0,251,2,0,0,252,2,0,0,253,2,0,0,254,2,0,0,255,2,0,0,0,3,0,0,0,3,0,0,1,3,0,0,2,3,0,0,2,3,0,0,2,3,0,0,3,3,0,0,3,3,0,0,4,3,0,0,5,3,0,0,6,3,0,0,7,3,0,0,8,3,0,0,10,3,0,0,10,3,0,0,11,3,0,0,12,3,0,0,13,3,0,0,13,3,0,0,13,3,0,0,13,3,0,0,13,3,0,0,14,3,0,0,15,3,0,0,16,3,0,0,17,3,0,0,19,3,0,0,21,3,0,0,23,3,0,0,24,3,0,0,25,3,0,0,27,3,0,0,29,3,0,0,30,3,0,0,31,3,0,0,32,3,0,0,33,3,0,0,34,3,0,0,35,3,0,0,36,3,0,0,37,3,0,0,38,3,0,0,39,3,0,0,41,3,0,0,42,3,0,0,42,3,0,0,43,3,0,0,45,3,0,0,46,3,0,0,46,3,0,0,48,3,0,0,48,3,0,0,49,3,0,0,51,3,0,0,52,3,0,0,53,3,0,0,55,3,0,0,56,3,0,0,57,3,0,0,58,3,0,0,59,3,0,0,61,3,0,0,62,3,0,0,64,3,0,0,65,3,0,0,66,3,0,0,68,3,0,0,69,3,0,0,71,3,0,0,72,3,0,0,73,3,0,0,73,3,0,0,74,3,0,0,75,3,0,0,76,3,0,0,77,3,0,0,78,3,0,0,79,3,0,0,81,3,0,0,83,3,0,0,85,3,0,0,86,3,0,0,86,3,0,0,88,3,0,0,89,3,0,0,90,3,0,0,92,3,0,0,93,3,0,0,94,3,0,0,95,3,0,0,96,3,0,0,97,3,0,0,98,3,0,0,100,3,0,0,101,3,0,0,102,3,0,0,103,3,0,0,103,3,0,0,104,3,0,0,105,3,0,0,106,3,0,0,107,3,0,0,109,3,0,0,111,3,0,0,111,3,0,0,113,3,0,0,115,3,0,0,116,3,0,0,118,3,0,0,120,3,0,0,121,3,0,0,123,3,0,0,124,3,0,0,125,3,0,0,126,3,0,0,126,3,0,0,128,3,0,0,129,3,0,0,130,3,0,0,131,3,0,0,133,3,0,0,134,3,0,0,136,3,0,0,138,3,0,0,140,3,0,0,141,3,0,0,142,3,0,0,143,3,0,0,145,3,0,0,146,3,0,0,148,3,0,0,149,3,0,0,150,3,0,0,151,3,0,0,153,3,0,0,154,3,0,0,155,3,0,0,156,3,0,0,157,3,0,0,157,3,0,0,157,3,0,0,157,3,0,0,158,3,0,0,159,3,0,0,159,3,0,0,159,3,0,0,160,3,0,0,161,3,0,0,161,3,0,0,162,3,0,0,163,3,0,0,163,3,0,0,164,3,0,0,165,3,0,0,167,3,0,0,167,3,0,0,168,3,0,0,169,3,0,0,170,3,0,0,171,3,0,0,172,3,0,0,173,3,0,0,175,3,0,0,177,3,0,0,179,3,0,0,181,3,0,0,182,3,0,0,183,3,0,0,184,3,0,0,185,3,0,0,186,3,0,0,187,3,0,0,188,3,0,0,188,3,0,0,188,3,0,0,188,3,0,0,189,3,0,0,191,3,0,0,192,3,0,0,194,3,0,0,194,3,0,0,195,3,0,0,196,3,0,0,196,3,0,0,197,3,0,0,198,3,0,0,199,3,0,0,200,3,0,0,201,3,0,0,203,3,0,0,203,3,0,0,204,3,0,0,206,3,0,0,207,3,0,0,207,3,0,0,209,3,0,0,209,3,0,0,210,3,0,0,211,3,0,0,212,3,0,0,214,3,0,0,216,3,0,0,217,3,0,0,218,3,0,0,220,3,0,0,222,3,0,0,224,3,0,0,226,3,0,0,227,3,0,0,228,3,0,0,230,3,0,0,231,3,0,0,233,3,0,0,234,3,0,0,236,3,0,0,237,3,0,0,238,3,0,0,238,3,0,0,240,3,0,0,242,3,0,0,243,3,0,0,245,3,0,0,246,3,0,0,247,3,0,0,249,3,0,0,249,3,0,0,249,3,0,0,251,3,0,0,252,3,0,0,254,3,0,0,255,3,0,0,1,4,0,0,1,4,0,0,1,4,0,0,2,4,0,0,3,4,0,0,4,4,0,0,4,4,0,0,5,4,0,0,6,4,0,0,7,4,0,0,8,4,0,0,9,4,0,0,10,4,0,0,11,4,0,0,12,4,0,0,12,4,0,0,13,4,0,0,14,4,0,0,15,4,0,0,16,4,0,0,16,4,0,0,17,4,0,0,18,4,0,0,19,4,0,0,21,4,0,0,23,4,0,0,25,4,0,0,27,4,0,0,28,4,0,0,30,4,0,0,31,4,0,0,32,4,0,0,33,4,0,0,34,4,0,0,34,4,0,0,35,4,0,0,37,4,0,0,37,4,0,0,37,4,0,0,38,4,0,0,39,4,0,0,40,4,0,0,40,4,0,0,41,4,0,0,42,4,0,0,43,4,0,0,45,4,0,0,47,4,0,0,48,4,0,0,50,4,0,0,51,4,0,0,54,4,0,0,56,4,0,0,58,4,0,0,59,4,0,0,60,4,0,0,60,4,0,0,62,4,0,0,64,4,0,0,65,4,0,0,66,4,0,0,66,4,0,0,66,4,0,0,66,4,0,0,67,4,0,0,68,4,0,0,69,4,0,0,70,4,0,0,71,4,0,0,72,4,0,0,72,4,0,0,72,4,0,0,73,4,0,0,74,4,0,0,76,4,0,0,77,4,0,0,78,4,0,0,79,4,0,0,79,4,0,0,79,4,0,0,80,4,0,0,81,4,0,0,81,4,0,0,82,4,0,0,83,4,0,0,83,4,0,0,84,4,0,0,86,4,0,0,87,4,0,0,88,4,0,0,89,4,0,0,90,4,0,0,92,4,0,0,93,4,0,0,94,4,0,0,95,4,0,0,96,4,0,0,98,4,0,0,100,4,0,0,101,4,0,0,102,4,0,0,104,4,0,0,104,4,0,0,105,4,0,0,106,4,0,0,108,4,0,0,109,4,0,0,110,4,0,0,111,4,0,0,113,4,0,0,114,4,0,0,115,4,0,0,116,4,0,0,116,4,0,0,117,4,0,0,118,4,0,0,120,4,0,0,120,4,0,0,121,4,0,0,121,4,0,0,122,4,0,0,123,4,0,0,124,4,0,0,125,4,0,0,126,4,0,0,127,4,0,0,128,4,0,0,129,4,0,0,129,4,0,0,130,4,0,0,131,4,0,0,132,4,0,0,133,4,0,0,134,4,0,0,135,4,0,0,136,4,0,0,138,4,0,0,139,4,0,0,140,4,0,0,140,4,0,0,140,4,0,0,140,4,0,0,141,4,0,0,142,4,0,0,143,4,0,0,144,4,0,0,144,4,0,0,146,4,0,0,147,4,0,0,147,4,0,0,147,4,0,0,147,4,0,0,148,4,0,0,148,4,0,0,149,4,0,0,150,4,0,0,152,4,0,0,153,4,0,0,154,4,0,0,155,4,0,0,156,4,0,0,157,4,0,0,158,4,0,0,160,4], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);
/* memory initializer */ allocate([161,4,0,0,162,4,0,0,163,4,0,0,164,4,0,0,166,4,0,0,167,4,0,0,168,4,0,0,170,4,0,0,170,4,0,0,171,4,0,0,172,4,0,0,173,4,0,0,174,4,0,0,176,4,0,0,178,4,0,0,180,4,0,0,181,4,0,0,183,4,0,0,184,4,0,0,184,4,0,0,185,4,0,0,186,4,0,0,187,4,0,0,188,4,0,0,188,4,0,0,190,4,0,0,192,4,0,0,193,4,0,0,195,4,0,0,196,4,0,0,197,4,0,0,197,4,0,0,198,4,0,0,199,4,0,0,200,4,0,0,200,4,0,0,201,4,0,0,203,4,0,0,204,4,0,0,204,4,0,0,205,4,0,0,206,4,0,0,206,4,0,0,207,4,0,0,207,4,0,0,207,4,0,0,208,4,0,0,210,4,0,0,211,4,0,0,212,4,0,0,213,4,0,0,214,4,0,0,216,4,0,0,217,4,0,0,218,4,0,0,219,4,0,0,220,4,0,0,222,4,0,0,224,4,0,0,226,4,0,0,228,4,0,0,229,4,0,0,230,4,0,0,231,4,0,0,232,4,0,0,233,4,0,0,234,4,0,0,234,4,0,0,236,4,0,0,237,4,0,0,238,4,0,0,239,4,0,0,240,4,0,0,241,4,0,0,242,4,0,0,242,4,0,0,242,4,0,0,243,4,0,0,244,4,0,0,245,4,0,0,245,4,0,0,246,4,0,0,246,4,0,0,247,4,0,0,248,4,0,0,248,4,0,0,248,4,0,0,249,4,0,0,250,4,0,0,252,4,0,0,252,4,0,0,252,4,0,0,253,4,0,0,253,4,0,0,255,4,0,0,0,5,0,0,0,5,0,0,1,5,0,0,2,5,0,0,4,5,0,0,6,5,0,0,7,5,0,0,8,5,0,0,8,5,0,0,8,5,0,0,9,5,0,0,10,5,0,0,11,5,0,0,11,5,0,0,12,5,0,0,14,5,0,0,14,5,0,0,14,5,0,0,15,5,0,0,17,5,0,0,18,5,0,0,20,5,0,0,21,5,0,0,23,5,0,0,24,5,0,0,25,5,0,0,26,5,0,0,27,5,0,0,28,5,0,0,29,5,0,0,29,5,0,0,29,5,0,0,30,5,0,0,31,5,0,0,31,5,0,0,32,5,0,0,33,5,0,0,34,5,0,0,36,5,0,0,38,5,0,0,39,5,0,0,40,5,0,0,42,5,0,0,44,5,0,0,46,5,0,0,47,5,0,0,47,5,0,0,47,5,0,0,49,5,0,0,50,5,0,0,51,5,0,0,53,5,0,0,55,5,0,0,56,5,0,0,57,5,0,0,57,5,0,0,58,5,0,0,59,5,0,0,60,5,0,0,61,5,0,0,63,5,0,0,64,5,0,0,66,5,0,0,67,5,0,0,68,5,0,0,70,5,0,0,71,5,0,0,73,5,0,0,74,5,0,0,75,5,0,0,76,5,0,0,77,5,0,0,78,5,0,0,80,5,0,0,82,5,0,0,84,5,0,0,85,5,0,0,86,5,0,0,87,5,0,0,88,5,0,0,90,5,0,0,92,5,0,0,93,5,0,0,94,5,0,0,96,5,0,0,97,5,0,0,98,5,0,0,100,5,0,0,101,5,0,0,102,5,0,0,102,5,0,0,103,5,0,0,104,5,0,0,106,5,0,0,107,5,0,0,109,5,0,0,110,5,0,0,111,5,0,0,112,5,0,0,113,5,0,0,115,5,0,0,116,5,0,0,117,5,0,0,118,5,0,0,119,5,0,0,120,5,0,0,120,5,0,0,121,5,0,0,122,5,0,0,124,5,0,0,126,5,0,0,128,5,0,0,129,5,0,0,131,5,0,0,132,5,0,0,132,5,0,0,134,5,0,0,136,5,0,0,137,5,0,0,139,5,0,0,140,5,0,0,141,5,0,0,142,5,0,0,143,5,0,0,143,5,0,0,143,5,0,0,144,5,0,0,145,5,0,0,145,5,0,0,146,5,0,0,146,5,0,0,148,5,0,0,150,5,0,0,151,5,0,0,153,5,0,0,153,5,0,0,154,5,0,0,154,5,0,0,156,5,0,0,157,5,0,0,157,5,0,0,157,5,0,0,157,5,0,0,158,5,0,0,159,5,0,0,161,5,0,0,162,5,0,0,164,5,0,0,166,5,0,0,168,5,0,0,170,5,0,0,172,5,0,0,173,5,0,0,175,5,0,0,177,5,0,0,178,5,0,0,179,5,0,0,180,5,0,0,182,5,0,0,184,5,0,0,185,5,0,0,186,5,0,0,187,5,0,0,189,5,0,0,190,5,0,0,191,5,0,0,193,5,0,0,194,5,0,0,195,5,0,0,196,5,0,0,197,5,0,0,199,5,0,0,201,5,0,0,203,5,0,0,205,5,0,0,206,5,0,0,207,5,0,0,208,5,0,0,210,5,0,0,211,5,0,0,212,5,0,0,214,5,0,0,216,5,0,0,218,5,0,0,219,5,0,0,221,5,0,0,222,5,0,0,222,5,0,0,223,5,0,0,224,5,0,0,225,5,0,0,226,5,0,0,227,5,0,0,228,5,0,0,230,5,0,0,232,5,0,0,234,5,0,0,235,5,0,0,236,5,0,0,237,5,0,0,239,5,0,0,240,5,0,0,242,5,0,0,244,5,0,0,246,5,0,0,248,5,0,0,250,5,0,0,251,5,0,0,253,5,0,0,255,5,0,0,0,6,0,0,2,6,0,0,3,6,0,0,4,6,0,0,5,6,0,0,7,6,0,0,9,6,0,0,87,127,0,0,92,127,0,0,96,127,0,0,100,127,0,0,104,127,0,0,108,127,0,0,113,127,0,0,117,127,0,0,121,127,0,0,125,127,0,0,129,127,0,0,133,127,0,0,137,127,0,0,142,127,0,0,147,127,0,0,151,127,0,0,155,127,0,0,159,127,0,0,163,127,0,0,167,127,0,0,171,127,0,0,176,127,0,0,180,127,0,0,184,127,0,0,188,127,0,0,192,127,0,0,196,127,0,0,201,127,0,0,205,127,0,0,210,127,0,0,214,127,0,0,218,127,0,0,223,127,0,0,227,127,0,0,232,127,0,0,236,127,0,0,240,127,0,0,244,127,0,0,249,127,0,0,253,127,0,0,1,128,0,0,5,128,0,0,9,128,0,0,13,128,0,0,17,128,0,0,21,128,0,0,25,128,0,0,30,128,0,0,34,128,0,0,38,128,0,0,42,128,0,0,47,128,0,0,51,128,0,0,55,128,0,0,59,128,0,0,63,128,0,0,68,128,0,0,72,128,0,0,76,128,0,0,80,128,0,0,84,128,0,0,88,128,0,0,93,128,0,0,97,128,0,0,101,128,0,0,105,128,0,0,109,128,0,0,114,128,0,0,118,128,0,0,123,128,0,0,127,128,0,0,132,128,0,0,136,128,0,0,141,128,0,0,145,128,0,0,149,128,0,0,153,128,0,0,157,128,0,0,161,128,0,0,166,128,0,0,170,128,0,0,174,128,0,0,178,128,0,0,183,128,0,0,85,96,0,0,187,128,0,0,191,128,0,0,196,128,0,0,200,128,0,0,204,128,0,0,209,128,0,0,213,128,0,0,218,128,0,0,222,128,0,0,226,128,0,0,230,128,0,0,235,128,0,0,239,128,0,0,243,128,0,0,132,96,0,0,247,128,0,0,251,128,0,0,255,128,0,0,3,129,0,0,7,129,0,0,11,129,0,0,15,129,0,0,20,129,0,0,24,129,0,0,29,129,0,0,33,129,0,0,37,129,0,0,41,129,0,0,45,129,0,0,49,129,0,0,53,129,0,0,57,129,0,0,61,129,0,0,66,129,0,0,70,129,0,0,75,129,0,0,79,129,0,0,83,129,0,0,51,97,0,0,87,129,0,0,91,129,0,0,96,129,0,0,100,129,0,0,105,129,0,0,109,129,0,0,113,129,0,0,117,129,0,0,121,129,0,0,125,129,0,0,129,129,0,0,133,129,0,0,137,129,0,0,141,129,0,0,145,129,0,0,150,129,0,0,154,129,0,0,159,129,0,0,163,129,0,0,167,129,0,0,171,129,0,0,175,129,0,0,179,129,0,0,183,129,0,0,187,129,0,0,191,129,0,0,195,129,0,0,199,129,0,0,203,129,0,0,207,129,0,0,211,129,0,0,215,129,0,0,219,129,0,0,224,129,0,0,228,129,0,0,232,129,0,0,236,129,0,0,240,129,0,0,245,129,0,0,250,129,0,0,254,129,0,0,2,130,0,0,7,130,0,0,11,130,0,0,15,130,0,0,19,130,0,0,23,130,0,0,27,130,0,0,31,130,0,0,35,130,0,0,39,130,0,0,43,130,0,0,47,130,0,0,51,130,0,0,56,130,0,0,61,130,0,0,65,130,0,0,69,130,0,0,74,130,0,0,79,130,0,0,83,130,0,0,87,130,0,0,91,130,0,0,95,130,0,0,99,130,0,0,103,130,0,0,108,130,0,0,112,130,0,0,116,130,0,0,121,130,0,0,126,130,0,0,130,130,0,0,135,130,0,0,140,130,0,0,144,130,0,0,148,130,0,0,152,130,0,0,157,130,0,0,162,130,0,0,166,130,0,0,171,130,0,0,175,130,0,0,180,130,0,0,184,130,0,0,188,130,0,0,193,130,0,0,197,130,0,0,201,130,0,0,206,130,0,0,96,99,0,0,210,130,0,0,101,99,0,0,106,99,0,0,214,130,0,0,218,130,0,0,222,130,0,0,226,130,0,0,230,130,0,0,234,130,0,0,238,130,0,0,242,130,0,0,246,130,0,0,250,130,0,0,254,130,0,0,2,131,0,0,6,131,0,0,10,131,0,0,14,131,0,0,19,131,0,0,23,131,0,0,27,131,0,0,31,131,0,0,46,97,0,0,35,131,0,0,40,131,0,0,44,131,0,0,48,131,0,0,52,131,0,0,56,131,0,0,60,131,0,0,65,131,0,0,69,131,0,0,73,131,0,0,78,131,0,0,83,131,0,0,87,131,0,0,91,131,0,0,95,131,0,0,99,131,0,0,103,131,0,0,107,131,0,0,111,131,0,0,115,131,0,0,119,131,0,0,124,131,0,0,128,131,0,0,132,131,0,0,136,131,0,0,140,131,0,0,144,131,0,0,148,131,0,0,152,131,0,0,98,100,0,0,156,131,0,0,160,131,0,0,164,131,0,0,168,131,0,0,173,131,0,0,177,131,0,0,182,131,0,0,186,131,0,0,190,131,0,0,194,131,0,0,198,131,0,0,202,131,0,0,206,131,0,0,211,131,0,0,215,131,0,0,220,131,0,0,224,131,0,0,228,131,0,0,232,131,0,0,236,131,0,0,240,131,0,0,244,131,0,0,248,131,0,0,252,131,0,0,1,132,0,0,5,132,0,0,9,132,0,0,14,132,0,0,18,132,0,0,22,132,0,0,27,132,0,0,31,132,0,0,36,132,0,0,40,132,0,0,44,132,0,0,48,132,0,0,52,132,0,0,56,132,0,0,60,132,0,0,64,132,0,0,68,132,0,0,72,132,0,0,76,132,0,0,81,132,0,0,86,132,0,0,90,132,0,0,95,132,0,0,99,132,0,0,103,132,0,0,107,132,0,0,111,132,0,0,115,132,0,0,119,132,0,0,123,132,0,0,127,132,0,0,131,132,0,0,135,132,0,0,140,132,0,0,144,132,0,0,148,132,0,0,152,132,0,0,157,132,0,0,161,132,0,0,166,132,0,0,170,132,0,0,174,132,0,0,178,132,0,0,182,132,0,0,186,132,0,0,191,132,0,0,195,132,0,0,199,132,0,0,203,132,0,0,208,132,0,0,212,132,0,0,216,132,0,0,221,132,0,0,225,132,0,0,243,101,0,0,229,132,0,0,233,132,0,0,238,132,0,0,242,132,0,0,246,132,0,0,245,126,0,0,250,132,0,0,254,132,0,0,3,133,0,0,7,133,0,0,11,133,0,0,15,133,0,0,19,133,0,0,24,133,0,0,28,133,0,0,32,133,0,0,36,133,0,0,40,133,0,0,45,133,0,0,49,133,0,0,54,133,0,0,58,133,0,0,62,133,0,0,66,133,0,0,70,133,0,0,75,133,0,0,79,133,0,0,83,133,0,0,87,133,0,0,91,133,0,0,95,133,0,0,100,133,0,0,104,133,0,0,108,133,0,0,113,133,0,0,117,133,0,0,122,133,0,0,126,133,0,0,130,133,0,0,134,133,0,0,138,133,0,0,142,133,0,0,147,133,0,0,151,133,0,0,155,133,0,0,159,133,0,0,164,133,0,0,168,133,0,0,173,133,0,0,177,133,0,0,181,133,0,0,185,133,0,0,42,103,0,0,47,103,0,0,52,103,0,0,189,133,0,0,193,133,0,0,197,133,0,0,201,133,0,0,206,133,0,0,210,133,0,0,214,133,0,0,218,133,0,0,222,133,0,0,226,133,0,0,230,133,0,0,235,133,0,0,239,133,0,0,243,133,0,0,247,133,0,0,251,133,0,0,0,134,0,0,4,134,0,0,8,134,0,0,12,134,0,0,17,134,0,0,21,134,0,0,25,134,0,0,30,134,0,0,34,134,0,0,38,134,0,0,42,134,0,0,47,134,0,0,51,134,0,0,56,134,0,0,61,134,0,0,65,134,0,0,69,134,0,0,74,134,0,0,78,134,0,0,82,134,0,0,86,134,0,0,90,134,0,0,94,134,0,0,98,134,0,0,102,134,0,0,106,134,0,0,110,134,0,0,115,134,0,0,119,134,0,0,123,134,0,0,128,134,0,0,132,134,0,0,137,134,0,0,141,134,0,0,146,134,0,0,150,134,0,0,155,134,0,0,159,134,0,0,163,134,0,0,167,134,0,0,171,134,0,0,176,134,0,0,180,134,0,0,184,134,0,0,188,134,0,0,192,134,0,0,196,134,0,0,200,134,0,0,204,134,0,0,208,134,0,0,212,134,0,0,216,134,0,0,220,134,0,0,224,134,0,0,229,134,0,0,233,134,0,0,237,134,0,0,241,134,0,0,245,134,0,0,249,134,0,0,253,134,0,0,2,135,0,0,6,135,0,0,10,135,0,0,15,135,0,0,19,135,0,0,23,135,0,0,28,135,0,0,32,135,0,0,36,135,0,0,40,135,0,0,44,135,0,0,49,135,0,0,53,135,0,0,57,135,0,0,61,135,0,0,65,135,0,0,69,135,0,0,74,135,0,0,78,135,0,0,83,135,0,0,87,135,0,0,91,135,0,0,95,135,0,0,99,135,0,0,103,135,0,0,107,135,0,0,111,135,0,0,115,135,0,0,120,135,0,0,124,135,0,0,128,135,0,0,133,135,0,0,137,135,0,0,141,135,0,0,145,135,0,0,149,135,0,0,153,135,0,0,102,95,0,0,157,135,0,0,161,135,0,0,165,135,0,0,170,135,0,0,174,135,0,0,179,135,0,0,183,135,0,0,187,135,0,0,191,135,0,0,195,135,0,0,199,135,0,0,204,135,0,0,208,135,0,0,212,135,0,0,217,135,0,0,221,135,0,0,225,135,0,0,229,135,0,0,233,135,0,0,237,135,0,0,187,105,0,0,241,135,0,0,246,135,0,0,250,135,0,0,254,135,0,0,3,136,0,0,7,136,0,0,12,136,0,0,17,136,0,0,21,136,0,0,25,136,0,0,29,136,0,0,33,136,0,0,37,136,0,0,41,136,0,0,45,136,0,0,49,136,0,0,53,136,0,0,57,136,0,0,61,136,0,0,65,136,0,0,69,136,0,0,73,136,0,0,77,136,0,0,81,136,0,0,86,136,0,0,90,136,0,0,94,136,0,0,98,136,0,0,102,136,0,0,107,136,0,0,111,136,0,0,115,136,0,0,120,136,0,0,124,136,0,0,128,136,0,0,132,136,0,0,136,136,0,0,140,136,0,0,144,136,0,0,149,136,0,0,153,136,0,0,249,106,0,0,157,136,0,0,254,106,0,0,161,136,0,0,165,136,0,0,170,136,0,0,244,106,0,0,174,136,0,0,178,136,0,0,182,136,0,0,186,136,0,0,190,136,0,0,195,136,0,0,199,136,0,0,203,136,0,0,208,136,0,0,212,136,0,0,217,136,0,0,221,136,0,0,225,136,0,0,229,136,0,0,233,136,0,0,237,136,0,0,241,136,0,0,245,136,0,0,249,136,0,0,254,136,0,0,2,137,0,0,6,137,0,0,10,137,0,0,15,137,0,0,19,137,0,0,23,137,0,0,27,137,0,0,31,137,0,0,35,137,0,0,39,137,0,0,43,137,0,0,47,137,0,0,52,137,0,0,56,137,0,0,61,137,0,0,65,137,0,0,69,137,0,0,74,137,0,0,78,137,0,0,82,137,0,0,61,108,0,0,86,137,0,0,90,137,0,0,95,137,0,0,99,137,0,0,72,108,0,0,103,137,0,0,108,137,0,0,112,137,0,0,116,137,0,0,120,137,0,0,124,137,0,0,128,137,0,0,132,137,0,0,136,137,0,0,141,137,0,0,145,137,0,0,150,137,0,0,154,137,0,0,159,137,0,0,163,137,0,0,167,137,0,0,171,137,0,0,175,137,0,0,179,137,0,0,183,137,0,0,187,137,0,0,191,137,0,0,195,137,0,0,199,137,0,0,203,137,0,0,208,137,0,0,212,137,0,0,216,137,0,0,221,137,0,0,225,137,0,0,230,137,0,0,234,137,0,0,239,137,0,0,243,137,0,0,247,137,0,0,252,137,0,0,0,138,0,0,4,138,0,0,8,138,0,0,12,138,0,0,16,138,0,0,20,138,0,0,25,138,0,0,29,138,0,0,34,138,0,0,38,138,0,0,42,138,0,0,47,138,0,0,51,138,0,0,56,138,0,0,60,138,0,0,64,138,0,0,68,138,0,0,72,138,0,0,76,138,0,0,80,138,0,0,84,138,0,0,88,138,0,0,92,138,0,0,78,109,0,0,96,138,0,0,100,138,0,0,104,138,0,0,108,138,0,0,112,138,0,0,117,138,0,0,121,138,0,0,126,138,0,0,130,138,0,0,134,138,0,0,138,138,0,0,142,138,0,0,146,138,0,0,150,138,0,0,155,138,0,0,159,138,0,0,164,138,0,0,168,138,0,0,173,138,0,0,177,138,0,0,181,138,0,0,185,138,0,0,189,138,0,0,193,138,0,0,198,138,0,0,203,138,0,0,207,138,0,0,211,138,0,0,216,138,0,0,220,138,0,0,225,138,0,0,229,138,0,0,233,138,0,0,237,138,0,0,242,138,0,0,246,138,0,0,250,138,0,0,255,138,0,0,3,139,0,0,7,139,0,0,11,139,0,0,15,139,0,0,19,139,0,0,84,110,0,0,23,139,0,0,27,139,0,0,32,139,0,0,36,139,0,0,40,139,0,0,44,139,0,0,48,139,0,0,53,139,0,0,57,139,0,0,61,139,0,0,65,139,0,0,69,139,0,0,73,139,0,0,77,139,0,0,81,139,0,0,85,139,0,0,90,139,0,0,95,139,0,0,99,139,0,0,103,139,0,0,107,139,0,0,112,139,0,0,116,139,0,0,120,139,0,0,124,139,0,0,128,139,0,0,132,139,0,0,136,139,0,0,141,139,0,0,145,139,0,0,149,139,0,0,153,139,0,0,157,139,0,0,161,139,0,0,165,139,0,0,169,139,0,0,173,139,0,0,177,139,0,0,181,139,0,0,186,139,0,0,190,139,0,0,194,139,0,0,198,139,0,0,202,139,0,0,206,139,0,0,210,139,0,0,215,139,0,0,219,139,0,0,223,139,0,0,227,139,0,0,231,139,0,0,198,111,0,0,235,139,0,0,239,139,0,0,244,139,0,0,248,139,0,0,252,139,0,0,0,140,0,0,4,140,0,0,8,140,0,0,13,140,0,0,17,140,0,0,22,140,0,0,26,140,0,0,30,140,0,0,34,140,0,0,38,140,0,0,42,140,0,0,46,140,0,0,50,140,0,0,54,140,0,0,58,140,0,0,62,140,0,0,66,140,0,0,71,140,0,0,76,140,0,0,80,140,0,0,84,140,0,0,89,140,0,0,93,140,0,0,97,140,0,0,102,140,0,0,106,140,0,0,110,140,0,0,114,140,0,0,118,140,0,0,122,140,0,0,126,140,0,0,131,140,0,0,135,140,0,0,139,140,0,0,143,140,0,0,147,140,0,0,145,112,0,0,151,140,0,0,155,140,0,0,159,140,0,0,164,140,0,0,168,140,0,0,173,140,0,0,140,112,0,0,177,140,0,0,181,140,0,0,135,112,0,0,185,140,0,0,189,140,0,0,193,140,0,0,197,140,0,0,201,140,0,0,205,140,0,0,209,140,0,0,213,140,0,0,217,140,0,0,221,140,0,0,226,140,0,0,230,140,0,0,235,140,0,0,224,112,0,0,239,140,0,0,243,140,0,0,247,140,0,0,252,140,0,0,0,141,0,0,4,141,0,0,8,141,0,0,13,141,0,0,17,141,0,0,21,141,0,0,25,141,0,0,29,141,0,0,33,141,0,0,38,141,0,0,42,141,0,0,47,141,0,0,51,141,0,0,56,141,0,0,60,141,0,0,64,141,0,0,68,141,0,0,72,141,0,0,76,141,0,0,48,113,0,0,80,141,0,0,84,141,0,0,88,141,0,0,92,141,0,0,96,141,0,0,100,141,0,0,104,141,0,0,108,141,0,0,112,141,0,0,116,141,0,0,120,141,0,0,125,141,0,0,129,141,0,0,133,141,0,0,138,141,0,0,142,141,0,0,146,141,0,0,151,141,0,0,155,141,0,0,160,141,0,0,164,141,0,0,168,141,0,0,172,141,0,0,176,141,0,0,180,141,0,0,184,141,0,0,239,113,0,0,188,141,0,0,192,141,0,0,197,141,0,0,201,141,0,0,205,141,0,0,3,114,0,0,209,141,0,0,213,141,0,0,217,141,0,0,222,141,0,0,226,141,0,0,230,141,0,0,235,141,0,0,239,141,0,0,243,141,0,0,248,141,0,0,252,141,0,0,0,142,0,0,4,142,0,0,8,142,0,0,12,142,0,0,16,142,0,0,20,142,0,0,24,142,0,0,29,142,0,0,33,142,0,0,37,142,0,0,41,142,0,0,45,142,0,0,49,142,0,0,53,142,0,0,58,142,0,0,62,142,0,0,66,142,0,0,70,142,0,0,74,142,0,0,78,142,0,0,82,142,0,0,86,142,0,0,91,142,0,0,95,142,0,0,100,142,0,0,104,142,0,0,109,142,0,0,113,142,0,0,117,142,0,0,121,142,0,0,125,142,0,0,129,142,0,0,133,142,0,0,137,142,0,0,141,142,0,0,145,142,0,0,150,142,0,0,154,142,0,0,159,142,0,0,163,142,0,0,9,115,0,0,167,142,0,0,171,142,0,0,175,142,0,0,179,142,0,0,183,142,0,0,187,142,0,0,191,142,0,0,196,142,0,0,200,142,0,0,204,142,0,0,208,142,0,0,212,142,0,0,217,142,0,0,221,142,0,0,225,142,0,0,230,142,0,0,234,142,0,0,238,142,0,0,242,142,0,0,246,142,0,0,251,142,0,0,255,142,0,0,4,143,0,0,8,143,0,0,12,143,0,0,16,143,0,0,21,143,0,0,25,143,0,0,30,143,0,0,34,143,0,0,39,143,0,0,43,143,0,0,47,143,0,0,51,143,0,0,55,143,0,0,59,143,0,0,64,143,0,0,69,143,0,0,185,114,0,0,73,143,0,0,77,143,0,0,81,143,0,0,85,143,0,0,89,143,0,0,93,143,0,0,97,143,0,0,102,143,0,0,106,143,0,0,111,143,0,0,115,143,0,0,119,143,0,0,124,143,0,0,128,143,0,0,132,143,0,0,136,143,0,0,141,143,0,0,58,116,0,0,145,143,0,0,149,143,0,0,153,143,0,0,157,143,0,0,161,143,0,0,165,143,0,0,170,143,0,0,175,143,0,0,179,143,0,0,183,143,0,0,188,143,0,0,192,143,0,0,196,143,0,0,201,143,0,0,205,143,0,0,209,143,0,0,214,143,0,0,218,143,0,0,222,143,0,0,226,143,0,0,230,143,0,0,234,143,0,0,238,143,0,0,242,143,0,0,246,143,0,0,250,143,0,0,255,143,0,0,3,144,0,0,8,144,0,0,12,144,0,0,17,144,0,0,21,144,0,0,26,144,0,0,30,144,0,0,34,144,0,0,38,144,0,0,42,144,0,0,46,144,0,0,50,144,0,0,54,144,0,0,59,144,0,0,63,144,0,0,68,144,0,0,72,144,0,0,77,144,0,0,81,144,0,0,86,144,0,0,90,144,0,0,94,144,0,0,124,117,0,0,98,144,0,0,102,144,0,0,107,144,0,0,111,144,0,0,115,144,0,0,120,144,0,0,124,144,0,0,128,144,0,0,132,144,0,0,137,144,0,0,141,144,0,0,145,144,0,0,149,144,0,0,153,144,0,0,157,144,0,0,161,144,0,0,165,144,0,0,170,144,0,0,174,144,0,0,179,144,0,0,183,144,0,0,187,144,0,0,191,144,0,0,195,144,0,0,199,144,0,0,203,144,0,0,207,144,0,0,212,144,0,0,216,144,0,0,220,144,0,0,224,144,0,0,229,144,0,0,233,144,0,0,238,144,0,0,242,144,0,0,247,144,0,0,251,144,0,0,255,144,0,0,3,145,0,0,8,145,0,0,12,145,0,0,16,145,0,0,20,145,0,0,24,145,0,0,28,145,0,0,32,145,0,0,36,145,0,0,41,145,0,0,45,145,0,0,49,145,0,0,53,145,0,0,57,145,0,0,61,145,0,0,65,145,0,0,69,145,0,0,73,145,0,0,77,145,0,0,82,145,0,0,86,145,0,0,91,145,0,0,95,145,0,0,99,145,0,0,158,121,0,0,103,145,0,0,107,145,0,0,111,145,0,0,116,145,0,0,223,118,0,0,120,145,0,0,124,145,0,0,128,145,0,0,132,145,0,0,136,145,0,0,140,145,0,0,144,145,0,0,149,145,0,0,154,145,0,0,158,145,0,0,162,145,0,0,166,145,0,0,170,145,0,0,174,145,0,0,178,145,0,0,182,145,0,0,186,145,0,0,190,145,0,0,194,145,0,0,198,145,0,0,202,145,0,0,206,145,0,0,210,145,0,0,214,145,0,0,218,145,0,0,223,145,0,0,228,145,0,0,232,145,0,0,236,145,0,0,240,145,0,0,244,145,0,0,248,145,0,0,252,145,0,0,1,146,0,0,5,146,0,0,9,146,0,0,13,146,0,0,17,146,0,0,21,146,0,0,25,146,0,0,237,153,0,0,29,146,0,0,33,146,0,0,38,146,0,0,42,146,0,0,46,146,0,0,50,146,0,0,55,146,0,0,59,146,0,0,63,146,0,0,67,146,0,0,71,146,0,0,77,120,0,0,75,146,0,0,79,146,0,0,83,146,0,0,72,120,0,0,87,146,0,0,91,146,0,0,95,146,0,0,99,146,0,0,103,146,0,0,82,120,0,0,107,146,0,0,111,146,0,0,115,146,0,0,119,146,0,0,123,146,0,0,127,146,0,0,67,120,0,0,131,146,0,0,135,146,0,0,139,146,0,0,143,146,0,0,147,146,0,0,151,146,0,0,155,146,0,0,160,146,0,0,164,146,0,0,169,146,0,0,173,146,0,0,63,116,0,0,177,146,0,0,181,146,0,0,185,146,0,0,190,146,0,0,194,146,0,0,198,146,0,0,203,146,0,0,207,146,0,0,211,146,0,0,215,146,0,0,219,146,0,0,223,146,0,0,227,146,0,0,231,146,0,0,235,146,0,0,240,146,0,0,244,146,0,0,248,146,0,0,253,146,0,0,1,147,0,0,5,147,0,0,10,147,0,0,14,147,0,0,18,147,0,0,22,147,0,0,26,147,0,0,30,147,0,0,35,147,0,0,39,147,0,0,43,147,0,0,148,121,0,0,47,147,0,0,153,121,0,0,51,147,0,0,55,147,0,0,59,147,0,0,63,147,0,0,67,147,0,0,71,147,0,0,75,147,0,0,79,147,0,0,84,147,0,0,88,147,0,0,92,147,0,0,96,147,0,0,100,147,0,0,104,147,0,0,108,147,0,0,112,147,0,0,116,147,0,0,120,147,0,0,124,147,0,0,129,147,0,0,133,147,0,0,137,147,0,0,141,147,0,0,145,147,0,0,150,147,0,0,154,147,0,0,158,147,0,0,162,147,0,0,166,147,0,0,171,147,0,0,175,147,0,0,179,147,0,0,184,147,0,0,188,147,0,0,193,147,0,0,197,147,0,0,201,147,0,0,205,147,0,0,209,147,0,0,213,147,0,0,217,147,0,0,221,147,0,0,226,147,0,0,230,147,0,0,234,147,0,0,238,147,0,0,242,147,0,0,246,147,0,0,251,147,0,0,255,147,0,0,3,148,0,0,8,148,0,0,12,148,0,0,16,148,0,0,20,148,0,0,24,148,0,0,28,148,0,0,32,148,0,0,36,148,0,0,40,148,0,0,44,148,0,0,48,148,0,0,52,148,0,0,56,148,0,0,61,148,0,0,74,123,0,0,65,148,0,0,69,148,0,0,73,148,0,0,77,148,0,0,82,148,0,0,86,148,0,0,91,148,0,0,95,148,0,0,100,148,0,0,104,148,0,0,108,148,0,0,113,148,0,0,117,148,0,0,121,148,0,0,125,148,0,0,130,148,0,0,134,148,0,0,138,148,0,0,142,148,0,0,146,148,0,0,150,148,0,0,154,148,0,0,158,148,0,0,163,148,0,0,167,148,0,0,172,148,0,0,176,148,0,0,180,148,0,0,185,148,0,0,189,148,0,0,193,148,0,0,197,148,0,0,202,148,0,0,206,148,0,0,210,148,0,0,215,148,0,0,219,148,0,0,223,148,0,0,227,148,0,0,231,148,0,0,235,148,0,0,239,148,0,0,243,148,0,0,247,148,0,0,251,148,0,0,255,148,0,0,4,149,0,0,8,149,0,0,12,149,0,0,16,149,0,0,20,149,0,0,24,149,0,0,28,149,0,0,32,149,0,0,37,149,0,0,72,124,0,0,41,149,0,0,45,149,0,0,50,149,0,0,54,149,0,0,58,149,0,0,62,149,0,0,67,149,0,0,71,149,0,0,75,149,0,0,79,149,0,0,83,149,0,0,87,149,0,0,92,149,0,0,96,149,0,0,100,149,0,0,105,149,0,0,109,149,0,0,113,149,0,0,117,149,0,0,121,149,0,0,125,149,0,0,130,149,0,0,134,149,0,0,139,149,0,0,144,149,0,0,148,149,0,0,152,149,0,0,156,149,0,0,160,149,0,0,164,149,0,0,168,149,0,0,172,149,0,0,177,149,0,0,181,149,0,0,185,149,0,0,189,149,0,0,193,149,0,0,197,149,0,0,201,149,0,0,205,149,0,0,210,149,0,0,214,149,0,0,219,149,0,0,223,149,0,0,227,149,0,0,232,149,0,0,236,149,0,0,241,149,0,0,245,149,0,0,249,149,0,0,253,149,0,0,1,150,0,0,5,150,0,0,9,150,0,0,13,150,0,0,17,150,0,0,22,150,0,0,26,150,0,0,30,150,0,0,35,150,0,0,39,150,0,0,43,150,0,0,48,150,0,0,52,150,0,0,57,150,0,0,61,150,0,0,65,150,0,0,69,150,0,0,73,150,0,0,77,150,0,0,81,150,0,0,85,150,0,0,89,150,0,0,93,150,0,0,97,150,0,0,101,150,0,0,106,150,0,0,110,150,0,0,115,150,0,0,119,150,0,0,123,150,0,0,128,150,0,0,132,150,0,0,137,150,0,0,141,150,0,0,145,150,0,0,149,150,0,0,153,150,0,0,158,150,0,0,162,150,0,0,167,150,0,0,171,150,0,0,175,150,0,0,179,150,0,0,183,150,0,0,187,150,0,0,191,150,0,0,195,150,0,0,199,150,0,0,204,150,0,0,208,150,0,0,212,150,0,0,216,150,0,0,220,150,0,0,224,150,0,0,229,150,0,0,233,150,0,0,238,150,0,0,242,150,0,0,247,150,0,0,251,150,0,0,0,151,0,0,4,151,0,0,107,126,0,0,8,151,0,0,12,151,0,0,17,151,0,0,21,151,0,0,25,151,0,0,29,151,0,0,33,151,0,0,37,151,0,0,41,151,0,0,45,151,0,0,50,151,0,0,54,151,0,0,102,126,0,0,58,151,0,0,62,151,0,0,66,151,0,0,70,151,0,0,74,151,0,0,78,151,0,0,199,126,0,0,82,151,0,0,204,126,0,0,86,151,0,0,90,151,0,0,94,151,0,0,98,151,0,0,103,151,0,0,107,151,0,0,111,151,0,0,115,151,0,0,119,151,0,0,124,151,0,0,128,151,0,0,132,151,0,0,137,151,0,0,141,151,0,0,146,151,0,0,150,151,0,0,155,151,0,0,159,151,0,0,163,151,0,0,167,151,0,0,171,151,0,0,175,151,0,0,30,127,0,0,179,151,0,0,35,127,0,0,183,151,0,0,187,151,0,0,191,151,0,0,196,151,0,0,200,151,0,0,204,151,0,0,208,151,0,0,212,151,0,0,217,151,0,0,221,151,0,0,225,151,0,0,97,94,0,0,103,94,0,0,109,94,0,0,115,94,0,0,121,94,0,0,127,94,0,0,133,94,0,0,139,94,0,0,145,94,0,0,151,94,0,0,157,94,0,0,163,94,0,0,169,94,0,0,175,94,0,0,181,94,0,0,187,94,0,0,193,94,0,0,199,94,0,0,205,94,0,0,211,94,0,0,217,94,0,0,223,94,0,0,229,94,0,0,235,94,0,0,241,94,0,0,247,94,0,0,253,94,0,0,3,95,0,0,9,95,0,0,15,95,0,0,21,95,0,0,27,95,0,0,33,95,0,0,39,95,0,0,45,95,0,0,51,95,0,0,57,95,0,0,63,95,0,0,69,95,0,0,75,95,0,0,81,95,0,0,87,95,0,0,93,95,0,0,99,95,0,0,102,95,0,0,107,95,0,0,113,95,0,0,119,95,0,0,125,95,0,0,131,95,0,0,137,95,0,0,143,95,0,0,149,95,0,0,155,95,0,0,161,95,0,0,167,95,0,0,173,95,0,0,179,95,0,0,185,95,0,0,191,95,0,0,197,95,0,0,203,95,0,0,209,95,0,0,215,95,0,0,221,95,0,0,224,95,0,0,230,95,0,0,236,95,0,0,242,95,0,0,248,95,0,0,254,95,0,0,4,96,0,0,10,96,0,0,16,96,0,0,22,96,0,0,28,96,0,0,34,96,0,0,40,96,0,0,46,96,0,0,52,96,0,0,58,96,0,0,64,96,0,0,70,96,0,0,76,96,0,0,82,96,0,0,85,96,0,0,90,96,0,0,96,96,0,0,102,96,0,0,108,96,0,0,114,96,0,0,120,96,0,0,126,96,0,0,132,96,0,0,137,96,0,0,143,96,0,0,149,96,0,0,155,96,0,0,161,96,0,0,167,96,0,0,173,96,0,0,179,96,0,0,185,96,0,0,191,96,0,0,197,96,0,0,203,96,0,0,209,96,0,0,215,96,0,0,221,96,0,0,227,96,0,0,233,96,0,0,239,96,0,0,245,96,0,0,251,96,0,0,1,97,0,0,7,97,0,0,13,97,0,0,19,97,0,0,25,97,0,0,31,97,0,0,37,97,0,0,43,97,0,0,46,97,0,0,51,97,0,0,56,97,0,0,62,97,0,0,68,97,0,0,74,97,0,0,80,97,0,0,86,97,0,0,92,97,0,0,98,97,0,0,104,97,0,0,110,97,0,0,116,97,0,0,122,97,0,0,128,97,0,0,134,97,0,0,140,97,0,0,146,97,0,0,149,97,0,0,155,97,0,0,161,97,0,0,167,97,0,0,173,97,0,0,179,97,0,0,185,97,0,0,191,97,0,0,197,97,0,0,203,97,0,0,209,97,0,0,215,97,0,0,221,97,0,0,227,97,0,0,233,97,0,0,239,97,0,0,245,97,0,0,251,97,0,0,1,98,0,0,7,98,0,0,13,98,0,0,19,98,0,0,25,98,0,0,31,98,0,0,37,98,0,0,43,98,0,0,49,98,0,0,55,98,0,0,61,98,0,0,67,98,0,0,73,98,0,0,79,98,0,0,85,98,0,0,91,98,0,0,97,98,0,0,103,98,0,0,109,98,0,0,115,98,0,0,121,98,0,0,127,98,0,0,133,98,0,0,139,98,0,0,145,98,0,0,151,98,0,0,157,98,0,0,163,98,0,0,169,98,0,0,175,98,0,0,181,98,0,0,187,98,0,0,193,98,0,0,199,98,0,0,205,98,0,0,211,98,0,0,217,98,0,0,223,98,0,0,229,98,0,0,235,98,0,0,241,98,0,0,247,98,0,0,253,98,0,0,3,99,0,0,9,99,0,0,15,99,0,0,21,99,0,0,27,99,0,0,33,99,0,0,39,99,0,0,45,99,0,0,51,99,0,0,57,99,0,0,63,99,0,0,69,99,0,0,75,99,0,0,81,99,0,0,87,99,0,0,93,99,0,0,96,99,0,0,101,99,0,0,106,99,0,0,111,99,0,0,117,99,0,0,123,99,0,0,129,99,0,0,135,99,0,0,141,99,0,0,147,99,0,0,153,99,0,0,159,99,0,0,165,99,0,0,171,99,0,0,177,99,0,0,183,99,0,0,189,99,0,0,195,99,0,0,201,99,0,0,207,99,0,0,213,99,0,0,219,99,0,0,225,99,0,0,231,99,0,0,237,99,0,0,243,99,0,0,249,99,0,0,255,99,0,0,5,100,0,0,11,100,0,0,17,100,0,0,23,100,0,0,29,100,0,0,35,100,0,0,41,100,0,0,47,100,0,0,53,100,0,0,59,100,0,0,65,100,0,0,71,100,0,0,77,100,0,0,83,100,0,0,89,100,0,0,95,100,0,0,98,100,0,0,103,100,0,0,109,100,0,0,115,100,0,0,121,100,0,0,127,100,0,0,133,100,0,0,139,100,0,0,145,100,0,0,151,100,0,0,157,100,0,0,163,100,0,0,169,100,0,0,175,100,0,0,181,100,0,0,187,100,0,0,193,100,0,0,199,100,0,0,205,100,0,0,211,100,0,0,217,100,0,0,223,100,0,0,229,100,0,0,235,100,0,0,241,100,0,0,247,100,0,0,253,100,0,0,3,101,0,0,9,101,0,0,15,101,0,0,21,101,0,0,27,101,0,0,33,101,0,0,39,101,0,0,45,101,0,0,51,101,0,0,57,101,0,0,63,101,0,0,69,101,0,0,75,101,0,0,81,101,0,0,87,101,0,0,93,101,0,0,99,101,0,0,105,101,0,0,111,101,0,0,117,101,0,0,123,101,0,0,129,101,0,0,135,101,0,0,141,101,0,0,147,101,0,0,153,101,0,0,159,101,0,0,165,101,0,0,171,101,0,0,177,101,0,0,183,101,0,0,189,101,0,0,195,101,0,0,201,101,0,0,204,101,0,0,210,101,0,0,216,101,0,0,222,101,0,0,228,101,0,0,234,101,0,0,240,101,0,0,243,101,0,0,248,101,0,0,254,101,0,0,4,102,0,0,10,102,0,0,16,102,0,0,22,102,0,0,28,102,0,0,34,102,0,0,40,102,0,0,46,102,0,0,52,102,0,0,58,102,0,0,64,102,0,0,70,102,0,0,76,102,0,0,82,102,0,0,88,102,0,0,94,102,0,0,100,102,0,0,106,102,0,0,112,102,0,0,118,102,0,0,124,102,0,0,130,102,0,0,136,102,0,0,142,102,0,0,148,102,0,0,154,102,0,0,160,102,0,0,166,102,0,0,172,102,0,0,178,102,0,0,184,102,0,0,190,102,0,0,196,102,0,0,202,102,0,0,208,102,0,0,214,102,0,0,220,102,0,0,226,102,0,0,232,102,0,0,238,102,0,0,244,102,0,0,250,102,0,0,0,103,0,0,6,103,0,0,12,103,0,0,18,103,0,0,24,103,0,0,30,103,0,0,36,103,0,0,42,103,0,0,47,103,0,0,52,103,0,0,57,103,0,0,63,103,0,0,69,103,0,0,75,103,0,0,81,103,0,0,87,103,0,0,93,103,0,0,99,103,0,0,105,103,0,0,111,103,0,0,117,103,0,0,123,103,0,0,129,103,0,0,135,103,0,0,141,103,0,0,147,103,0,0,153,103,0,0,159,103,0,0,165,103,0,0,171,103,0,0,177,103,0,0,183,103,0,0,189,103,0,0,195,103,0,0,201,103,0,0,207,103,0,0,213,103,0,0,219,103,0,0,225,103,0,0,231,103,0,0,237,103,0,0,243,103,0,0,249,103,0,0,255,103,0,0,5,104,0,0,11,104,0,0,17,104,0,0,23,104,0,0,29,104,0,0,35,104,0,0,41,104,0,0,47,104,0,0,53,104,0,0,59,104,0,0,65,104,0,0,71,104,0,0,77,104,0,0,83,104,0,0,89,104,0,0,95,104,0,0,101,104,0,0,107,104,0,0,113,104,0,0,119,104,0,0,125,104,0,0,131,104,0,0,137,104,0,0,143,104,0,0,149,104,0,0,155,104,0,0,161,104,0,0,167,104,0,0,173,104,0,0,179,104,0,0,185,104,0,0,191,104,0,0,197,104,0,0,203,104,0,0,209,104,0,0,215,104,0,0,221,104,0,0,227,104,0,0,233,104,0,0,239,104,0,0,242,104,0,0,248,104,0,0,254,104,0,0,4,105,0,0,10,105,0,0,16,105,0,0,22,105,0,0,28,105,0,0,34,105,0,0,40,105,0,0,46,105,0,0,52,105,0,0,58,105,0,0,64,105,0,0,70,105,0,0,76,105,0,0,82,105,0,0,88,105,0,0,94,105,0,0,100,105,0,0,106,105,0,0,112,105,0,0,118,105,0,0,124,105,0,0,130,105,0,0,136,105,0,0,142,105,0,0,148,105,0,0,154,105,0,0,160,105,0,0,166,105,0,0,169,105,0,0,175,105,0,0,181,105,0,0,187,105,0,0,191,105,0,0,197,105,0,0,203,105,0,0,209,105,0,0,215,105,0,0,221,105,0,0,227,105,0,0,233,105,0,0,239,105,0,0,245,105,0,0,251,105,0,0,1,106,0,0,7,106,0,0,13,106,0,0,19,106,0,0,25,106,0,0,31,106,0,0,37,106,0,0,43,106,0,0,49,106,0,0,55,106,0,0,61,106,0,0,67,106,0,0,73,106,0,0,79,106,0,0,85,106,0,0,91,106,0,0,97,106,0,0,103,106,0,0,109,106,0,0,115,106,0,0,121,106,0,0,127,106,0,0,133,106,0,0,139,106,0,0,145,106,0,0,151,106,0,0,157,106,0,0,163,106,0,0,169,106,0,0,175,106,0,0,181,106,0,0,187,106,0,0,193,106,0,0,199,106,0,0,205,106,0,0,211,106,0,0,217,106,0,0,223,106,0,0,229,106,0,0,235,106,0,0,241,106,0,0,244,106,0,0,249,106,0,0,254,106,0,0,2,107,0,0,8,107,0,0,14,107,0,0,17,107,0,0,23,107,0,0,29,107,0,0,35,107,0,0,41,107,0,0,47,107,0,0,53,107,0,0,59,107,0,0,65,107,0,0,71,107,0,0,77,107,0,0,83,107,0,0,89,107,0,0,95,107,0,0,101,107,0,0,107,107,0,0,113,107,0,0,116,107,0,0,122,107,0,0,128,107,0,0,134,107,0,0,140,107,0,0,146,107,0,0,152,107,0,0,158,107,0,0,164,107,0,0,170,107,0,0,176,107,0,0,182,107,0,0,188,107,0,0,194,107,0,0,200,107,0,0,206,107,0,0,212,107,0,0,218,107,0,0,224,107,0,0,230,107,0,0,236,107,0,0,242,107,0,0,248,107,0,0,254,107,0,0,4,108,0,0,10,108,0,0,16,108,0,0,22,108,0,0,28,108,0,0,34,108,0,0,40,108,0,0,46,108,0,0,52,108,0,0,58,108,0,0,61,108,0,0,66,108,0,0,72,108,0,0,76,108,0,0,82,108,0,0,88,108,0,0,94,108,0,0,100,108,0,0,106,108,0,0,112,108,0,0,118,108,0,0,124,108,0,0,130,108,0,0,136,108,0,0,142,108,0,0,148,108,0,0,154,108,0,0,160,108,0,0,166,108,0,0,172,108,0,0,178,108,0,0,184,108,0,0,190,108,0,0,196,108,0,0,202,108,0,0,208,108,0,0,214,108,0,0,220,108,0,0,226,108,0,0,232,108,0,0,238,108,0,0,244,108,0,0,250,108,0,0,0,109,0,0,6,109,0,0,12,109,0,0,18,109,0,0,24,109,0,0,30,109,0,0,36,109,0,0,42,109,0,0,48,109,0,0,54,109,0,0,60,109,0,0,66,109,0,0,72,109,0,0,78,109,0,0,83,109,0,0,89,109,0,0,95,109,0,0,101,109,0,0,107,109,0,0,113,109,0,0,119,109,0,0,125,109,0,0,131,109,0,0,137,109,0,0,143,109,0,0,149,109,0,0,155,109,0,0,161,109,0,0,167,109,0,0,173,109,0,0,179,109,0,0,185,109,0,0,191,109,0,0,197,109,0,0,203,109,0,0,209,109,0,0,215,109,0,0,221,109,0,0,227,109,0,0,233,109,0,0,239,109,0,0,245,109,0,0,251,109,0,0,1,110,0,0,7,110,0,0,13,110,0,0,19,110,0,0,25,110,0,0,31,110,0,0,37,110,0,0,43,110,0,0,49,110,0,0,54,110,0,0,60,110,0,0,66,110,0,0,72,110,0,0,78,110,0,0,84,110,0,0,89,110,0,0,95,110,0,0,101,110,0,0,107,110,0,0,113,110,0,0,119,110,0,0,125,110,0,0,131,110,0,0,137,110], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+10240);
/* memory initializer */ allocate([143,110,0,0,149,110,0,0,155,110,0,0,161,110,0,0,167,110,0,0,173,110,0,0,179,110,0,0,185,110,0,0,190,110,0,0,196,110,0,0,202,110,0,0,208,110,0,0,214,110,0,0,220,110,0,0,226,110,0,0,232,110,0,0,238,110,0,0,244,110,0,0,250,110,0,0,0,111,0,0,6,111,0,0,12,111,0,0,18,111,0,0,24,111,0,0,30,111,0,0,36,111,0,0,42,111,0,0,48,111,0,0,54,111,0,0,60,111,0,0,66,111,0,0,72,111,0,0,78,111,0,0,84,111,0,0,90,111,0,0,96,111,0,0,102,111,0,0,108,111,0,0,114,111,0,0,120,111,0,0,126,111,0,0,132,111,0,0,138,111,0,0,144,111,0,0,150,111,0,0,156,111,0,0,162,111,0,0,168,111,0,0,174,111,0,0,180,111,0,0,186,111,0,0,192,111,0,0,198,111,0,0,202,111,0,0,208,111,0,0,214,111,0,0,220,111,0,0,226,111,0,0,232,111,0,0,238,111,0,0,244,111,0,0,250,111,0,0,0,112,0,0,3,112,0,0,9,112,0,0,15,112,0,0,21,112,0,0,27,112,0,0,33,112,0,0,39,112,0,0,45,112,0,0,51,112,0,0,57,112,0,0,63,112,0,0,69,112,0,0,75,112,0,0,81,112,0,0,87,112,0,0,93,112,0,0,99,112,0,0,105,112,0,0,111,112,0,0,117,112,0,0,123,112,0,0,129,112,0,0,135,112,0,0,140,112,0,0,145,112,0,0,149,112,0,0,155,112,0,0,161,112,0,0,167,112,0,0,173,112,0,0,179,112,0,0,185,112,0,0,191,112,0,0,197,112,0,0,203,112,0,0,209,112,0,0,215,112,0,0,221,112,0,0,224,112,0,0,229,112,0,0,235,112,0,0,241,112,0,0,247,112,0,0,253,112,0,0,3,113,0,0,9,113,0,0,15,113,0,0,21,113,0,0,27,113,0,0,33,113,0,0,39,113,0,0,45,113,0,0,48,113,0,0,53,113,0,0,59,113,0,0,65,113,0,0,71,113,0,0,77,113,0,0,83,113,0,0,89,113,0,0,95,113,0,0,101,113,0,0,107,113,0,0,113,113,0,0,119,113,0,0,125,113,0,0,131,113,0,0,137,113,0,0,143,113,0,0,149,113,0,0,155,113,0,0,161,113,0,0,167,113,0,0,173,113,0,0,176,113,0,0,182,113,0,0,188,113,0,0,194,113,0,0,200,113,0,0,206,113,0,0,212,113,0,0,218,113,0,0,224,113,0,0,230,113,0,0,236,113,0,0,239,113,0,0,244,113,0,0,250,113,0,0,0,114,0,0,3,114,0,0,8,114,0,0,14,114,0,0,20,114,0,0,26,114,0,0,32,114,0,0,38,114,0,0,41,114,0,0,47,114,0,0,53,114,0,0,59,114,0,0,65,114,0,0,71,114,0,0,77,114,0,0,83,114,0,0,89,114,0,0,95,114,0,0,101,114,0,0,107,114,0,0,113,114,0,0,119,114,0,0,125,114,0,0,131,114,0,0,137,114,0,0,143,114,0,0,149,114,0,0,155,114,0,0,161,114,0,0,167,114,0,0,173,114,0,0,179,114,0,0,185,114,0,0,190,114,0,0,196,114,0,0,202,114,0,0,208,114,0,0,214,114,0,0,220,114,0,0,226,114,0,0,232,114,0,0,238,114,0,0,244,114,0,0,250,114,0,0,0,115,0,0,6,115,0,0,9,115,0,0,14,115,0,0,20,115,0,0,26,115,0,0,32,115,0,0,38,115,0,0,44,115,0,0,50,115,0,0,56,115,0,0,62,115,0,0,68,115,0,0,74,115,0,0,80,115,0,0,86,115,0,0,92,115,0,0,98,115,0,0,104,115,0,0,110,115,0,0,116,115,0,0,122,115,0,0,128,115,0,0,134,115,0,0,140,115,0,0,146,115,0,0,152,115,0,0,158,115,0,0,164,115,0,0,170,115,0,0,176,115,0,0,182,115,0,0,188,115,0,0,194,115,0,0,200,115,0,0,206,115,0,0,212,115,0,0,218,115,0,0,224,115,0,0,230,115,0,0,236,115,0,0,242,115,0,0,248,115,0,0,254,115,0,0,4,116,0,0,10,116,0,0,16,116,0,0,22,116,0,0,28,116,0,0,34,116,0,0,40,116,0,0,46,116,0,0,52,116,0,0,58,116,0,0,63,116,0,0,68,116,0,0,74,116,0,0,80,116,0,0,86,116,0,0,92,116,0,0,98,116,0,0,104,116,0,0,110,116,0,0,116,116,0,0,122,116,0,0,128,116,0,0,134,116,0,0,140,116,0,0,146,116,0,0,152,116,0,0,158,116,0,0,164,116,0,0,170,116,0,0,176,116,0,0,182,116,0,0,188,116,0,0,194,116,0,0,200,116,0,0,206,116,0,0,212,116,0,0,218,116,0,0,224,116,0,0,230,116,0,0,236,116,0,0,242,116,0,0,245,116,0,0,251,116,0,0,1,117,0,0,7,117,0,0,13,117,0,0,19,117,0,0,25,117,0,0,31,117,0,0,37,117,0,0,43,117,0,0,49,117,0,0,55,117,0,0,61,117,0,0,67,117,0,0,73,117,0,0,79,117,0,0,85,117,0,0,91,117,0,0,97,117,0,0,103,117,0,0,109,117,0,0,115,117,0,0,121,117,0,0,124,117,0,0,128,117,0,0,134,117,0,0,140,117,0,0,146,117,0,0,152,117,0,0,158,117,0,0,164,117,0,0,170,117,0,0,176,117,0,0,182,117,0,0,188,117,0,0,194,117,0,0,200,117,0,0,206,117,0,0,212,117,0,0,218,117,0,0,224,117,0,0,230,117,0,0,236,117,0,0,242,117,0,0,248,117,0,0,254,117,0,0,4,118,0,0,10,118,0,0,16,118,0,0,22,118,0,0,28,118,0,0,34,118,0,0,40,118,0,0,46,118,0,0,52,118,0,0,58,118,0,0,64,118,0,0,70,118,0,0,76,118,0,0,82,118,0,0,88,118,0,0,94,118,0,0,100,118,0,0,106,118,0,0,112,118,0,0,118,118,0,0,124,118,0,0,127,118,0,0,133,118,0,0,139,118,0,0,145,118,0,0,151,118,0,0,157,118,0,0,163,118,0,0,169,118,0,0,175,118,0,0,181,118,0,0,187,118,0,0,193,118,0,0,199,118,0,0,205,118,0,0,211,118,0,0,217,118,0,0,223,118,0,0,228,118,0,0,234,118,0,0,240,118,0,0,246,118,0,0,252,118,0,0,2,119,0,0,8,119,0,0,14,119,0,0,20,119,0,0,26,119,0,0,32,119,0,0,38,119,0,0,44,119,0,0,50,119,0,0,56,119,0,0,62,119,0,0,68,119,0,0,74,119,0,0,80,119,0,0,86,119,0,0,92,119,0,0,98,119,0,0,104,119,0,0,110,119,0,0,116,119,0,0,122,119,0,0,128,119,0,0,134,119,0,0,140,119,0,0,146,119,0,0,152,119,0,0,158,119,0,0,164,119,0,0,170,119,0,0,176,119,0,0,182,119,0,0,188,119,0,0,194,119,0,0,200,119,0,0,206,119,0,0,212,119,0,0,218,119,0,0,224,119,0,0,230,119,0,0,236,119,0,0,242,119,0,0,248,119,0,0,254,119,0,0,4,120,0,0,10,120,0,0,16,120,0,0,22,120,0,0,28,120,0,0,34,120,0,0,40,120,0,0,46,120,0,0,52,120,0,0,58,120,0,0,64,120,0,0,67,120,0,0,72,120,0,0,77,120,0,0,82,120,0,0,87,120,0,0,92,120,0,0,98,120,0,0,104,120,0,0,110,120,0,0,116,120,0,0,122,120,0,0,128,120,0,0,134,120,0,0,140,120,0,0,146,120,0,0,152,120,0,0,158,120,0,0,164,120,0,0,170,120,0,0,176,120,0,0,182,120,0,0,188,120,0,0,194,120,0,0,200,120,0,0,206,120,0,0,212,120,0,0,218,120,0,0,224,120,0,0,230,120,0,0,236,120,0,0,242,120,0,0,248,120,0,0,254,120,0,0,4,121,0,0,10,121,0,0,16,121,0,0,22,121,0,0,28,121,0,0,34,121,0,0,40,121,0,0,46,121,0,0,52,121,0,0,58,121,0,0,64,121,0,0,70,121,0,0,76,121,0,0,82,121,0,0,88,121,0,0,94,121,0,0,100,121,0,0,106,121,0,0,112,121,0,0,118,121,0,0,124,121,0,0,130,121,0,0,136,121,0,0,142,121,0,0,148,121,0,0,153,121,0,0,158,121,0,0,163,121,0,0,169,121,0,0,175,121,0,0,181,121,0,0,187,121,0,0,193,121,0,0,199,121,0,0,205,121,0,0,211,121,0,0,217,121,0,0,223,121,0,0,229,121,0,0,232,121,0,0,238,121,0,0,244,121,0,0,250,121,0,0,0,122,0,0,6,122,0,0,12,122,0,0,18,122,0,0,24,122,0,0,30,122,0,0,36,122,0,0,42,122,0,0,48,122,0,0,54,122,0,0,60,122,0,0,66,122,0,0,72,122,0,0,78,122,0,0,84,122,0,0,90,122,0,0,96,122,0,0,102,122,0,0,108,122,0,0,114,122,0,0,120,122,0,0,126,122,0,0,132,122,0,0,138,122,0,0,144,122,0,0,150,122,0,0,156,122,0,0,162,122,0,0,168,122,0,0,174,122,0,0,180,122,0,0,186,122,0,0,192,122,0,0,198,122,0,0,204,122,0,0,210,122,0,0,213,122,0,0,219,122,0,0,225,122,0,0,231,122,0,0,237,122,0,0,243,122,0,0,249,122,0,0,252,122,0,0,2,123,0,0,8,123,0,0,14,123,0,0,20,123,0,0,26,123,0,0,32,123,0,0,38,123,0,0,44,123,0,0,50,123,0,0,56,123,0,0,62,123,0,0,68,123,0,0,74,123,0,0,79,123,0,0,85,123,0,0,91,123,0,0,97,123,0,0,103,123,0,0,109,123,0,0,115,123,0,0,121,123,0,0,127,123,0,0,133,123,0,0,139,123,0,0,145,123,0,0,151,123,0,0,157,123,0,0,163,123,0,0,169,123,0,0,175,123,0,0,181,123,0,0,187,123,0,0,190,123,0,0,196,123,0,0,202,123,0,0,208,123,0,0,214,123,0,0,220,123,0,0,226,123,0,0,232,123,0,0,238,123,0,0,244,123,0,0,250,123,0,0,0,124,0,0,6,124,0,0,9,124,0,0,15,124,0,0,21,124,0,0,27,124,0,0,33,124,0,0,39,124,0,0,45,124,0,0,51,124,0,0,57,124,0,0,63,124,0,0,69,124,0,0,72,124,0,0,77,124,0,0,83,124,0,0,89,124,0,0,95,124,0,0,101,124,0,0,104,124,0,0,110,124,0,0,116,124,0,0,122,124,0,0,128,124,0,0,134,124,0,0,140,124,0,0,146,124,0,0,152,124,0,0,158,124,0,0,164,124,0,0,170,124,0,0,176,124,0,0,182,124,0,0,188,124,0,0,194,124,0,0,200,124,0,0,206,124,0,0,212,124,0,0,218,124,0,0,221,124,0,0,227,124,0,0,233,124,0,0,239,124,0,0,245,124,0,0,251,124,0,0,1,125,0,0,7,125,0,0,13,125,0,0,19,125,0,0,22,125,0,0,28,125,0,0,31,125,0,0,37,125,0,0,43,125,0,0,49,125,0,0,55,125,0,0,61,125,0,0,67,125,0,0,73,125,0,0,79,125,0,0,85,125,0,0,91,125,0,0,97,125,0,0,103,125,0,0,109,125,0,0,115,125,0,0,121,125,0,0,127,125,0,0,133,125,0,0,139,125,0,0,145,125,0,0,151,125,0,0,157,125,0,0,163,125,0,0,169,125,0,0,175,125,0,0,181,125,0,0,184,125,0,0,190,125,0,0,196,125,0,0,202,125,0,0,208,125,0,0,214,125,0,0,220,125,0,0,226,125,0,0,232,125,0,0,238,125,0,0,244,125,0,0,250,125,0,0,0,126,0,0,6,126,0,0,12,126,0,0,18,126,0,0,24,126,0,0,30,126,0,0,36,126,0,0,42,126,0,0,48,126,0,0,54,126,0,0,60,126,0,0,66,126,0,0,72,126,0,0,78,126,0,0,84,126,0,0,90,126,0,0,96,126,0,0,102,126,0,0,107,126,0,0,112,126,0,0,118,126,0,0,124,126,0,0,130,126,0,0,136,126,0,0,142,126,0,0,148,126,0,0,154,126,0,0,160,126,0,0,166,126,0,0,172,126,0,0,178,126,0,0,184,126,0,0,190,126,0,0,196,126,0,0,199,126,0,0,204,126,0,0,209,126,0,0,215,126,0,0,221,126,0,0,227,126,0,0,233,126,0,0,239,126,0,0,245,126,0,0,250,126,0,0,0,127,0,0,6,127,0,0,12,127,0,0,18,127,0,0,24,127,0,0,30,127,0,0,35,127,0,0,40,127,0,0,45,127,0,0,51,127,0,0,57,127,0,0,63,127,0,0,69,127,0,0,75,127,0,0,81,127,0,0,132,91,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,188,163,8,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,144,163,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,92,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,4,0,0,0,3,0,0,0,196,163,8,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,92,0,0,36,78,97,109,101,36,0,45,118,0,106,118,111,99,117,104,97,100,106,117,32,118,101,114,115,105,111,110,32,37,115,10,0,45,97,0,45,108,0,85,110,114,101,99,111,103,110,105,115,101,100,32,99,111,109,109,97,110,100,32,108,105,110,101,32,111,112,116,105,111,110,32,37,115,10,0,67,97,110,110,111,116,32,117,115,101,32,99,111,109,112,111,110,101,110,116,32,91,37,115,93,32,105,110,32,102,111,114,109,105,110,103,32,108,117,106,118,111,10,0,80,111,115,115,105,98,108,101,32,114,97,102,115,105,32,102,111,114,32,105,110,112,117,116,32,119,111,114,100,115,32,58,10,0,37,115,32,0,10,0,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,45,10,0,32,83,99,111,114,101,32,32,76,117,106,118,111,10,0,97,101,105,111,117,0,85,110,109,97,116,99,104,101,100,32,114,97,102,115,105,32,91,37,115,93,10,0,37,54,100,32,37,115,10,0,98,97,99,114,117,0,98,97,100,110,97,0,98,97,100,114,105,0,98,97,106,114,97,0,98,97,107,102,117,0,98,97,107,110,105,0,98,97,107,114,105,0,98,97,107,116,117,0,98,97,108,106,105,0,98,97,108,110,105,0,98,97,108,114,101,0,98,97,108,118,105,0,98,97,110,99,117,0,98,97,110,100,117,0,98,97,110,102,105,0,98,97,110,103,117,0,98,97,110,108,105,0,98,97,110,114,111,0,98,97,110,120,97,0,98,97,110,122,117,0,98,97,112,108,105,0,98,97,114,100,97,0,98,97,114,103,117,0,98,97,114,106,97,0,98,97,114,110,97,0,98,97,114,116,117,0,98,97,115,110,97,0,98,97,115,116,105,0,98,97,116,99,105,0,98,97,116,107,101,0,98,97,118,109,105,0,98,97,120,115,111,0,98,101,98,110,97,0,98,101,109,114,111,0,98,101,110,100,101,0,98,101,110,103,111,0,98,101,110,106,105,0,98,101,114,115,97,0,98,101,114,116,105,0,98,101,115,110,97,0,98,101,116,102,117,0,98,101,116,114,105,0,98,101,118,114,105,0,98,105,0,98,105,39,105,0,98,105,100,106,117,0,98,105,102,99,101,0,98,105,107,108,97,0,98,105,108,103,97,0,98,105,108,109,97,0,98,105,108,110,105,0,98,105,110,100,111,0,98,105,110,114,97,0,98,105,110,120,111,0,98,105,114,106,101,0,98,105,114,107,97,0,98,105,114,116,105,0,98,105,115,108,105,0,98,105,116,109,117,0,98,108,97,98,105,0,98,108,97,99,105,0,98,108,97,110,117,0,98,108,105,107,117,0,98,108,111,116,105,0,98,111,0,98,111,108,99,105,0,98,111,110,103,117,0,98,111,116,112,105,0,98,111,120,102,111,0,98,111,120,110,97,0,98,114,97,100,105,0,98,114,97,116,117,0,98,114,97,122,111,0,98,114,101,100,105,0,98,114,105,100,105,0,98,114,105,102,101,0,98,114,105,106,117,0,98,114,105,116,111,0,98,114,111,100,97,0,98,114,111,100,101,0,98,114,111,100,105,0,98,114,111,100,111,0,98,114,111,100,117,0,98,114,117,110,97,0,98,117,0,98,117,39,97,0,98,117,100,106,111,0,98,117,107,112,117,0,98,117,109,114,117,0,98,117,110,100,97,0,98,117,110,114,101,0,98,117,114,99,117,0,98,117,114,110,97,0,99,97,39,97,0,99,97,98,110,97,0,99,97,98,114,97,0,99,97,99,114,97,0,99,97,100,122,117,0,99,97,102,110,101,0,99,97,107,108,97,0,99,97,108,107,117,0,99,97,110,99,105,0,99,97,110,100,111,0,99,97,110,103,101,0,99,97,110,106,97,0,99,97,110,107,111,0,99,97,110,108,117,0,99,97,110,112,97,0,99,97,110,114,101,0,99,97,110,116,105,0,99,97,114,99,101,0,99,97,114,109,105,0,99,97,114,110,97,0,99,97,114,116,117,0,99,97,114,118,105,0,99,97,115,110,117,0,99,97,116,107,101,0,99,97,116,108,117,0,99,97,116,110,105,0,99,97,116,114,97,0,99,97,120,110,111,0,99,101,0,99,101,39,105,0,99,101,39,111,0,99,101,99,108,97,0,99,101,99,109,117,0,99,101,100,114,97,0,99,101,110,98,97,0,99,101,110,115,97,0,99,101,110,116,105,0,99,101,114,100,97,0,99,101,114,110,105,0,99,101,114,116,117,0,99,101,118,110,105,0,99,102,97,114,105,0,99,102,105,107,97,0,99,102,105,108,97,0,99,102,105,110,101,0,99,102,105,112,117,0,99,105,0,99,105,98,108,117,0,99,105,99,110,97,0,99,105,100,106,97,0,99,105,100,110,105,0,99,105,100,114,111,0,99,105,102,110,117,0,99,105,103,108,97,0,99,105,107,110,97,0,99,105,107,114,101,0,99,105,107,115,105,0,99,105,108,99,101,0,99,105,108,109,111,0,99,105,108,114,101,0,99,105,108,116,97,0,99,105,109,100,101,0,99,105,109,110,105,0,99,105,110,98,97,0,99,105,110,100,117,0,99,105,110,102,111,0,99,105,110,106,101,0,99,105,110,107,105,0,99,105,110,108,97,0,99,105,110,109,111,0,99,105,110,114,105,0,99,105,110,115,101,0,99,105,110,116,97,0,99,105,110,122,97,0,99,105,112,110,105,0,99,105,112,114,97,0,99,105,114,107,111,0,99,105,114,108,97,0,99,105,115,107,97,0,99,105,115,109,97,0,99,105,115,116,101,0,99,105,116,107,97,0,99,105,116,110,111,0,99,105,116,114,105,0,99,105,116,115,105,0,99,105,118,108,97,0,99,105,122,114,97,0,99,107,97,98,117,0,99,107,97,102,105,0,99,107,97,106,105,0,99,107,97,110,97,0,99,107,97,112,101,0,99,107,97,115,117,0,99,107,101,106,105,0,99,107,105,107,117,0,99,107,105,108,117,0,99,107,105,110,105,0,99,107,105,114,101,0,99,107,117,108,101,0,99,107,117,110,117,0,99,108,97,100,117,0,99,108,97,110,105,0,99,108,97,120,117,0,99,108,105,107,97,0,99,108,105,114,97,0,99,108,105,116,101,0,99,108,105,118,97,0,99,108,117,112,97,0,99,109,97,99,105,0,99,109,97,108,117,0,99,109,97,110,97,0,99,109,97,118,111,0,99,109,101,110,101,0,99,109,105,108,97,0,99,109,105,109,97,0,99,109,111,110,105,0,99,110,97,110,111,0,99,110,101,98,111,0,99,110,101,109,117,0,99,110,105,99,105,0,99,110,105,110,111,0,99,110,105,115,97,0,99,110,105,116,97,0,99,111,0,99,111,39,97,0,99,111,39,101,0,99,111,39,117,0,99,111,107,99,117,0,99,111,110,100,105,0,99,111,114,116,117,0,99,112,97,99,117,0,99,112,97,110,97,0,99,112,97,114,101,0,99,112,101,100,117,0,99,112,105,110,97,0,99,114,97,100,105,0,99,114,97,110,101,0,99,114,101,107,97,0,99,114,101,112,117,0,99,114,105,98,101,0,99,114,105,100,97,0,99,114,105,110,111,0,99,114,105,112,117,0,99,114,105,115,97,0,99,114,105,116,117,0,99,116,97,114,117,0,99,116,101,98,105,0,99,116,101,107,105,0,99,116,105,108,101,0,99,116,105,110,111,0,99,116,117,99,97,0,99,117,107,108,97,0,99,117,107,116,97,0,99,117,108,110,111,0,99,117,109,107,105,0,99,117,109,108,97,0,99,117,110,109,105,0,99,117,110,115,111,0,99,117,110,116,117,0,99,117,112,114,97,0,99,117,114,109,105,0,99,117,114,110,117,0,99,117,114,118,101,0,99,117,115,107,117,0,99,117,116,99,105,0,99,117,116,110,101,0,99,117,120,110,97,0,100,97,0,100,97,39,97,0,100,97,99,114,117,0,100,97,99,116,105,0,100,97,100,106,111,0,100,97,107,102,117,0,100,97,107,108,105,0,100,97,109,98,97,0,100,97,109,114,105,0,100,97,110,100,117,0,100,97,110,102,117,0,100,97,110,108,117,0,100,97,110,109,111,0,100,97,110,114,101,0,100,97,110,115,117,0,100,97,110,116,105,0,100,97,112,108,117,0,100,97,112,109,97,0,100,97,114,103,117,0,100,97,114,108,117,0,100,97,114,110,111,0,100,97,114,115,105,0,100,97,114,120,105,0,100,97,115,107,105,0,100,97,115,110,105,0,100,97,115,112,111,0,100,97,115,114,105,0,100,97,116,107,97,0,100,97,116,110,105,0,100,101,99,116,105,0,100,101,103,106,105,0,100,101,106,110,105,0,100,101,107,112,117,0,100,101,107,116,111,0,100,101,108,110,111,0,100,101,109,98,105,0,100,101,110,99,105,0,100,101,110,109,105,0,100,101,110,112,97,0,100,101,114,116,117,0,100,101,114,120,105,0,100,101,115,107,117,0,100,101,116,114,105,0,100,105,99,114,97,0,100,105,107,99,97,0,100,105,107,108,111,0,100,105,107,110,105,0,100,105,108,99,117,0,100,105,108,110,117,0,100,105,109,110,97,0,100,105,110,106,117,0,100,105,110,107,111,0,100,105,114,98,97,0,100,105,114,99,101,0,100,105,114,103,111,0,100,105,122,108,111,0,100,106,97,99,117,0,100,106,101,100,105,0,100,106,105,99,97,0,100,106,105,110,101,0,100,106,117,110,111,0,100,111,0,100,111,110,114,105,0,100,111,116,99,111,0,100,114,97,99,105,0,100,114,97,110,105,0,100,114,97,116,97,0,100,114,117,100,105,0,100,117,0,100,117,39,117,0,100,117,103,114,105,0,100,117,107,115,101,0,100,117,107,116,105,0,100,117,110,100,97,0,100,117,110,106,97,0,100,117,110,107,117,0,100,117,110,108,105,0,100,117,110,114,97,0,100,122,101,110,97,0,100,122,105,112,111,0,102,97,99,107,105,0,102,97,100,110,105,0,102,97,103,114,105,0,102,97,108,110,117,0,102,97,109,116,105,0,102,97,110,99,117,0,102,97,110,103,101,0,102,97,110,109,111,0,102,97,110,114,105,0,102,97,110,116,97,0,102,97,110,118,97,0,102,97,110,122,97,0,102,97,112,114,111,0,102,97,114,108,117,0,102,97,114,110,97,0,102,97,114,118,105,0,102,97,115,110,117,0,102,97,116,99,105,0,102,97,116,110,101,0,102,97,116,114,105,0,102,101,98,118,105,0,102,101,109,116,105,0,102,101,110,100,105,0,102,101,110,103,117,0,102,101,110,107,105,0,102,101,110,114,97,0,102,101,110,115,111,0,102,101,112,110,105,0,102,101,112,114,105,0,102,101,114,116,105,0,102,101,115,116,105,0,102,101,116,115,105,0,102,105,103,114,101,0,102,105,108,115,111,0,102,105,110,112,101,0,102,105,110,116,105,0,102,108,97,108,117,0,102,108,97,110,105,0,102,108,101,99,117,0,102,108,105,98,97,0,102,108,105,114,97,0,102,111,39,97,0,102,111,39,101,0,102,111,39,105,0,102,111,108,100,105,0,102,111,110,109,111,0,102,111,110,120,97,0,102,111,114,99,97,0,102,114,97,115,111,0,102,114,97,116,105,0,102,114,97,120,117,0,102,114,105,99,97,0,102,114,105,107,111,0,102,114,105,108,105,0,102,114,105,110,117,0,102,114,105,116,105,0,102,114,117,109,117,0,102,117,107,112,105,0,102,117,108,116,97,0,102,117,110,99,97,0,102,117,115,114,97,0,102,117,122,109,101,0,103,97,99,114,105,0,103,97,100,114,105,0,103,97,108,102,105,0,103,97,108,116,117,0,103,97,108,120,101,0,103,97,110,108,111,0,103,97,110,114,97,0,103,97,110,115,101,0,103,97,110,116,105,0,103,97,110,120,111,0,103,97,110,122,117,0,103,97,112,99,105,0,103,97,112,114,117,0,103,97,114,110,97,0,103,97,115,110,117,0,103,97,115,116,97,0,103,101,110,106,97,0,103,101,110,116,111,0,103,101,110,120,117,0,103,101,114,107,117,0,103,101,114,110,97,0,103,105,100,118,97,0,103,105,103,100,111,0,103,105,110,107,97,0,103,105,114,122,117,0,103,105,115,109,117,0,103,108,97,114,101,0,103,108,101,107,105,0,103,108,101,116,117,0,103,108,105,99,111,0,103,108,117,116,97,0,103,111,99,116,105,0,103,111,116,114,111,0,103,114,97,100,117,0,103,114,97,107,101,0,103,114,97,110,97,0,103,114,97,115,117,0,103,114,101,107,117,0,103,114,117,115,105,0,103,114,117,116,101,0,103,117,98,110,105,0,103,117,103,100,101,0,103,117,110,100,105,0,103,117,110,107,97,0,103,117,110,109,97,0,103,117,110,114,111,0,103,117,110,115,101,0,103,117,110,116,97,0,103,117,114,110,105,0,103,117,115,107,97,0,103,117,115,110,105,0,103,117,115,116,97,0,103,117,116,99,105,0,103,117,116,114,97,0,103,117,122,109,101,0,106,97,0,106,97,98,114,101,0,106,97,100,110,105,0,106,97,107,110,101,0,106,97,108,103,101,0,106,97,108,110,97,0,106,97,108,114,97,0,106,97,109,102,117,0,106,97,109,110,97,0,106,97,110,98,101,0,106,97,110,99,111,0,106,97,110,108,105,0,106,97,110,115,117,0,106,97,110,116,97,0,106,97,114,98,117,0,106,97,114,99,111,0,106,97,114,107,105,0,106,97,115,112,117,0,106,97,116,110,97,0,106,97,118,110,105,0,106,98,97,109,97,0,106,98,97,114,105,0,106,98,101,110,97,0,106,98,101,114,97,0,106,98,105,110,105,0,106,100,97,114,105,0,106,100,105,99,101,0,106,100,105,107,97,0,106,100,105,109,97,0,106,100,105,110,105,0,106,100,117,108,105,0,106,101,0,106,101,99,116,97,0,106,101,102,116,117,0,106,101,103,118,111,0,106,101,105,0,106,101,108,99,97,0,106,101,109,110,97,0,106,101,110,99,97,0,106,101,110,100,117,0,106,101,110,109,105,0,106,101,114,110,97,0,106,101,114,115,105,0,106,101,114,120,111,0,106,101,115,110,105,0,106,101,116,99,101,0,106,101,116,110,117,0,106,103,97,108,117,0,106,103,97,110,117,0,106,103,97,114,105,0,106,103,101,110,97,0,106,103,105,110,97,0,106,103,105,114,97,0,106,103,105,116,97,0,106,105,98,110,105,0,106,105,98,114,105,0,106,105,99,108,97,0,106,105,99,109,117,0,106,105,106,110,117,0,106,105,107,99,97,0,106,105,107,114,117,0,106,105,108,107,97,0,106,105,108,114,97,0,106,105,109,99,97,0,106,105,109,112,101,0,106,105,109,116,101,0,106,105,110,99,105,0,106,105,110,103,97,0,106,105,110,107,117,0,106,105,110,109,101,0,106,105,110,114,117,0,106,105,110,115,97,0,106,105,110,116,111,0,106,105,110,118,105,0,106,105,110,122,105,0,106,105,112,99,105,0,106,105,112,110,111,0,106,105,114,110,97,0,106,105,115,114,97,0,106,105,116,102,97,0,106,105,116,114,111,0,106,105,118,98,117,0,106,105,118,110,97,0,106,109,97,106,105,0,106,109,105,102,97,0,106,109,105,110,97,0,106,109,105,118,101,0,106,111,0,106,111,39,101,0,106,111,39,117,0,106,111,105,0,106,111,114,100,111,0,106,111,114,110,101,0,106,117,0,106,117,98,109,101,0,106,117,100,114,105,0,106,117,102,114,97,0,106,117,107,110,105,0,106,117,107,112,97,0,106,117,108,110,101,0,106,117,110,100,105,0,106,117,110,103,111,0,106,117,110,108,97,0,106,117,110,114,105,0,106,117,110,116,97,0,106,117,114,109,101,0,106,117,114,115,97,0,106,117,116,115,105,0,106,117,120,114,101,0,106,118,105,110,117,0,107,97,0,107,97,98,114,105,0,107,97,99,109,97,0,107,97,100,110,111,0,107,97,102,107,101,0,107,97,103,110,105,0,107,97,106,100,101,0,107,97,106,110,97,0,107,97,107,110,101,0,107,97,107,112,97,0,107,97,108,99,105,0,107,97,108,114,105,0,107,97,108,115,97,0,107,97,108,116,101,0,107,97,109,106,117,0,107,97,109,110,105,0,107,97,109,112,117,0,107,97,110,98,97,0,107,97,110,99,117,0,107,97,110,100,105,0,107,97,110,106,105,0,107,97,110,108,97,0,107,97,110,114,111,0,107,97,110,115,97,0,107,97,110,116,117,0,107,97,110,120,101,0,107,97,114,98,105,0,107,97,114,99,101,0,107,97,114,100,97,0,107,97,114,103,117,0,107,97,114,108,105,0,107,97,114,110,105,0,107,97,116,110,97,0,107,97,118,98,117,0,107,101,0,107,101,39,101,0,107,101,99,116,105,0,107,101,105,0,107,101,108,99,105,0,107,101,108,118,111,0,107,101,110,114,97,0,107,101,110,115,97,0,107,101,114,102,97,0,107,101,114,108,111,0,107,101,116,99,111,0,107,101,118,110,97,0,107,105,99,110,101,0,107,105,106,110,111,0,107,105,108,116,111,0,107,105,110,108,105,0,107,105,115,116,111,0,107,108,97,106,105,0,107,108,97,107,117,0,107,108,97,109,97,0,107,108,97,110,105,0,107,108,101,115,105,0,107,108,105,110,97,0,107,108,105,114,117,0,107,108,105,116,105,0,107,108,117,112,101,0,107,108,117,122,97,0,107,111,98,108,105,0,107,111,106,110,97,0,107,111,108,109,101,0,107,111,109,99,117,0,107,111,110,106,117,0,107,111,114,98,105,0,107,111,114,99,117,0,107,111,114,107,97,0,107,111,115,116,97,0,107,114,97,109,117,0,107,114,97,115,105,0,107,114,97,116,105,0,107,114,101,102,117,0,107,114,105,99,105,0,107,114,105,108,105,0,107,114,105,110,117,0,107,114,105,120,97,0,107,114,117,99,97,0,107,114,117,106,105,0,107,114,117,118,105,0,107,117,39,97,0,107,117,98,108,105,0,107,117,99,108,105,0,107,117,102,114,97,0,107,117,107,116,101,0,107,117,108,110,117,0,107,117,109,102,97,0,107,117,109,116,101,0,107,117,110,114,97,0,107,117,110,116,105,0,107,117,114,102,97,0,107,117,114,106,105,0,107,117,114,107,105,0,107,117,115,112,101,0,107,117,115,114,117,0,108,97,98,110,111,0,108,97,99,112,117,0,108,97,99,114,105,0,108,97,100,114,117,0,108,97,102,116,105,0,108,97,107,110,101,0,108,97,107,115,101,0,108,97,108,120,117,0,108,97,109,106,105,0,108,97,110,98,105,0,108,97,110,99,105,0,108,97,110,107,97,0,108,97,110,108,105,0,108,97,110,109,101,0,108,97,110,116,101,0,108,97,110,120,101,0,108,97,110,122,117,0,108,97,114,99,117,0,108,97,115,110,97,0,108,97,115,116,117,0,108,97,116,109,111,0,108,97,116,110,97,0,108,97,122,110,105,0,108,101,39,101,0,108,101,98,110,97,0,108,101,110,106,111,0,108,101,110,107,117,0,108,101,114,99,105,0,108,101,114,102,117,0,108,105,39,105,0,108,105,98,106,111,0,108,105,100,110,101,0,108,105,102,114,105,0,108,105,106,100,97,0,108,105,109,110,97,0,108,105,110,100,105,0,108,105,110,106,105,0,108,105,110,115,105,0,108,105,110,116,111,0,108,105,115,114,105,0,108,105,115,116,101,0,108,105,116,99,101,0,108,105,116,107,105,0,108,105,116,114,117,0,108,105,118,103,97,0,108,105,118,108,97,0,108,111,39,101,0,108,111,103,106,105,0,108,111,106,98,111,0,108,111,108,100,105,0,108,111,114,120,117,0,108,117,98,110,111,0,108,117,106,118,111,0,108,117,109,99,105,0,108,117,110,98,101,0,108,117,110,114,97,0,108,117,110,115,97,0,109,97,98,108,97,0,109,97,98,114,117,0,109,97,99,110,117,0,109,97,107,99,117,0,109,97,107,102,97,0,109,97,107,115,105,0,109,97,108,115,105,0,109,97,109,116,97,0,109,97,110,99,105,0,109,97,110,102,111,0,109,97,110,107,117,0,109,97,110,114,105,0,109,97,110,115,97,0,109,97,110,116,105,0,109,97,112,107,117,0,109,97,112,110,105,0,109,97,112,116,105,0,109,97,114,98,105,0,109,97,114,99,101,0,109,97,114,100,101,0,109,97,114,103,117,0,109,97,114,106,105,0,109,97,114,110,97,0,109,97,114,120,97,0,109,97,115,110,111,0,109,97,115,116,105,0,109,97,116,99,105,0,109,97,116,108,105,0,109,97,116,110,101,0,109,97,116,114,97,0,109,97,118,106,105,0,109,97,120,114,105,0,109,101,98,114,105,0,109,101,103,100,111,0,109,101,105,0,109,101,107,115,111,0,109,101,108,98,105,0,109,101,108,106,111,0,109,101,110,108,105,0,109,101,110,115,105,0,109,101,110,116,117,0,109,101,114,107,111,0,109,101,114,108,105,0,109,101,120,110,111,0,109,105,0,109,105,100,106,117,0,109,105,102,114,97,0,109,105,107,99,101,0,109,105,107,114,105,0,109,105,108,116,105,0,109,105,108,120,101,0,109,105,110,100,101,0,109,105,110,106,105,0,109,105,110,108,105,0,109,105,110,114,97,0,109,105,110,116,117,0,109,105,112,114,105,0,109,105,114,108,105,0,109,105,115,110,111,0,109,105,115,114,111,0,109,105,116,114,101,0,109,105,120,114,101,0,109,108,97,110,97,0,109,108,97,116,117,0,109,108,101,99,97,0,109,108,101,100,105,0,109,108,117,110,105,0,109,111,39,97,0,109,111,39,105,0,109,111,105,0,109,111,107,99,97,0,109,111,107,108,117,0,109,111,108,107,105,0,109,111,108,114,111,0,109,111,114,106,105,0,109,111,114,107,111,0,109,111,114,110,97,0,109,111,114,115,105,0,109,111,115,114,97,0,109,114,97,106,105,0,109,114,105,108,117,0,109,114,117,108,105,0,109,117,0,109,117,39,101,0,109,117,99,116,105,0,109,117,100,114,105,0,109,117,107,116,105,0,109,117,108,110,111,0,109,117,110,106,101,0,109,117,112,108,105,0,109,117,114,115,101,0,109,117,114,116,97,0,109,117,115,108,111,0,109,117,116,99,101,0,109,117,118,100,117,0,109,117,122,103,97,0,110,97,0,110,97,39,101,0,110,97,98,109,105,0,110,97,107,110,105,0,110,97,108,99,105,0,110,97,109,99,117,0,110,97,110,98,97,0,110,97,110,99,97,0,110,97,110,100,117,0,110,97,110,108,97,0,110,97,110,109,117,0,110,97,110,118,105,0,110,97,114,103,101,0,110,97,114,106,117,0,110,97,116,102,101,0,110,97,116,109,105,0,110,97,118,110,105,0,110,97,120,108,101,0,110,97,122,98,105,0,110,101,106,110,105,0,110,101,108,99,105,0,110,101,110,114,105,0,110,105,0,110,105,98,108,105,0,110,105,99,116,101,0,110,105,107,108,101,0,110,105,108,99,101,0,110,105,109,114,101,0,110,105,110,109,117,0,110,105,114,110,97,0,110,105,116,99,117,0,110,105,118,106,105,0,110,105,120,108,105,0,110,111,0,110,111,39,101,0,110,111,98,108,105,0,110,111,116,99,105,0,110,117,0,110,117,39,111,0,110,117,107,110,105,0,110,117,112,114,101,0,110,117,114,109,97,0,110,117,116,108,105,0,110,117,122,98,97,0,112,97,0,112,97,99,110,97,0,112,97,103,98,117,0,112,97,103,114,101,0,112,97,106,110,105,0,112,97,108,99,105,0,112,97,108,107,117,0,112,97,108,110,101,0,112,97,108,116,97,0,112,97,109,98,101,0,112,97,110,99,105,0,112,97,110,100,105,0,112,97,110,106,101,0,112,97,110,107,97,0,112,97,110,108,111,0,112,97,110,112,105,0,112,97,110,114,97,0,112,97,110,116,101,0,112,97,110,122,105,0,112,97,112,114,105,0,112,97,114,98,105,0,112,97,115,116,117,0,112,97,116,102,117,0,112,97,116,108,117,0,112,97,116,120,117,0,112,101,39,97,0,112,101,108,106,105,0,112,101,108,120,117,0,112,101,109,99,105,0,112,101,110,98,105,0,112,101,110,99,117,0,112,101,110,100,111,0,112,101,110,109,105,0,112,101,110,115,105,0,112,101,114,108,105,0,112,101,115,120,117,0,112,101,116,115,111,0,112,101,122,108,105,0,112,105,0,112,105,39,117,0,112,105,99,116,105,0,112,105,106,110,101,0,112,105,107,99,105,0,112,105,107,116,97,0,112,105,108,106,105,0,112,105,108,107,97,0,112,105,108,110,111,0,112,105,109,108,117,0,112,105,110,99,97,0,112,105,110,100,105,0,112,105,110,102,117,0,112,105,110,106,105,0,112,105,110,107,97,0,112,105,110,115,105,0,112,105,110,116,97,0,112,105,110,120,101,0,112,105,112,110,111,0,112,105,120,114,97,0,112,108,97,110,97,0,112,108,97,116,117,0,112,108,101,106,105,0,112,108,105,98,117,0,112,108,105,110,105,0,112,108,105,112,101,0,112,108,105,115,101,0,112,108,105,116,97,0,112,108,105,120,97,0,112,108,117,106,97,0,112,108,117,107,97,0,112,108,117,116,97,0,112,111,108,106,101,0,112,111,108,110,111,0,112,111,110,106,111,0,112,111,110,115,101,0,112,111,114,112,105,0,112,111,114,115,105,0,112,111,114,116,111,0,112,114,97,108,105,0,112,114,97,109,105,0,112,114,97,110,101,0,112,114,101,106,97,0,112,114,101,110,117,0,112,114,101,116,105,0,112,114,105,106,101,0,112,114,105,110,97,0,112,114,105,116,117,0,112,114,111,115,97,0,112,114,117,99,101,0,112,114,117,110,105,0,112,114,117,120,105,0,112,117,39,105,0,112,117,39,117,0,112,117,108,99,101,0,112,117,108,106,105,0,112,117,108,110,105,0,112,117,110,106,105,0,112,117,110,108,105,0,112,117,114,99,105,0,112,117,114,100,105,0,112,117,114,109,111,0,114,97,99,108,105,0,114,97,99,116,117,0,114,97,100,110,111,0,114,97,102,115,105,0,114,97,103,118,101,0,114,97,107,115,111,0,114,97,107,116,117,0,114,97,108,99,105,0,114,97,108,106,117,0,114,97,108,116,101,0,114,97,110,100,97,0,114,97,110,103,111,0,114,97,110,106,105,0,114,97,110,109,105,0,114,97,110,115,117,0,114,97,110,116,105,0,114,97,110,120,105,0,114,97,112,108,105,0,114,97,114,110,97,0,114,97,116,99,117,0,114,97,116,110,105,0,114,101,0,114,101,98,108,97,0,114,101,99,116,117,0,114,101,109,110,97,0,114,101,110,114,111,0,114,101,110,118,105,0,114,101,115,112,97,0,114,105,99,102,117,0,114,105,103,110,105,0,114,105,106,110,111,0,114,105,108,116,105,0,114,105,109,110,105,0,114,105,110,99,105,0,114,105,110,106,117,0,114,105,110,107,97,0,114,105,110,115,97,0,114,105,114,99,105,0,114,105,114,110,105,0,114,105,114,120,101,0,114,105,115,109,105,0,114,105,115,110,97,0,114,105,116,108,105,0,114,105,118,98,105,0,114,111,0,114,111,105,0,114,111,107,99,105,0,114,111,109,103,101,0,114,111,112,110,111,0,114,111,114,99,105,0,114,111,116,115,117,0,114,111,122,103,117,0,114,117,98,108,101,0,114,117,102,115,117,0,114,117,110,109,101,0,114,117,110,116,97,0,114,117,112,110,117,0,114,117,115,107,111,0,114,117,116,110,105,0,115,97,98,106,105,0,115,97,98,110,117,0,115,97,99,107,105,0,115,97,99,108,117,0,115,97,100,106,111,0,115,97,107,99,105,0,115,97,107,108,105,0,115,97,107,116,97,0,115,97,108,99,105,0,115,97,108,112,111,0,115,97,108,116,97,0,115,97,109,99,117,0,115,97,109,112,117,0,115,97,110,99,101,0,115,97,110,103,97,0,115,97,110,106,105,0,115,97,110,108,105,0,115,97,110,109,105,0,115,97,110,115,111,0,115,97,110,116,97,0,115,97,114,99,117,0,115,97,114,106,105,0,115,97,114,108,117,0,115,97,114,120,101,0,115,97,115,107,101,0,115,97,116,99,105,0,115,97,116,114,101,0,115,97,118,114,117,0,115,97,122,114,105,0,115,101,0,115,101,102,116,97,0,115,101,108,99,105,0,115,101,108,102,117,0,115,101,109,116,111,0,115,101,110,99,105,0,115,101,110,112,105,0,115,101,110,116,97,0,115,101,110,118,97,0,115,101,112,108,105,0,115,101,114,116,105,0,115,101,116,99,97,0,115,101,118,122,105,0,115,102,97,110,105,0,115,102,97,115,97,0,115,102,111,102,97,0,115,102,117,98,117,0,115,105,39,111,0,115,105,99,108,117,0,115,105,99,110,105,0,115,105,100,98,111,0,115,105,100,106,117,0,115,105,103,106,97,0,115,105,108,107,97,0,115,105,108,110,97,0,115,105,109,108,117,0,115,105,109,115,97,0,115,105,109,120,117,0,115,105,110,99,101,0,115,105,110,109,97,0,115,105,110,115,111,0,115,105,110,120,97,0,115,105,112,110,97,0,115,105,114,106,105,0,115,105,114,120,111,0,115,105,115,107,117,0,115,105,115,116,105,0,115,105,116,110,97,0,115,105,118,110,105,0,115,107,97,99,105,0,115,107,97,109,105,0,115,107,97,112,105,0,115,107,97,114,105,0,115,107,105,99,117,0,115,107,105,106,105,0,115,107,105,110,97,0,115,107,111,114,105,0,115,107,111,116,111,0,115,107,117,114,111,0,115,108,97,98,117,0,115,108,97,107,97,0,115,108,97,109,105,0,115,108,97,110,117,0,115,108,97,114,105,0,115,108,97,115,105,0,115,108,105,103,117,0,115,108,105,108,117,0,115,108,105,114,105,0,115,108,111,118,111,0,115,108,117,106,105,0,115,108,117,110,105,0,115,109,97,99,117,0,115,109,97,100,105,0,115,109,97,106,105,0,115,109,97,110,105,0,115,109,111,107,97,0,115,109,117,99], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+20480);
/* memory initializer */ allocate([105,0,115,109,117,110,105,0,115,110,97,100,97,0,115,110,97,110,117,0,115,110,105,100,117,0,115,110,105,109,101,0,115,110,105,112,97,0,115,110,117,106,105,0,115,110,117,114,97,0,115,110,117,116,105,0,115,111,0,115,111,39,97,0,115,111,39,101,0,115,111,39,105,0,115,111,39,111,0,115,111,39,117,0,115,111,98,100,101,0,115,111,100,110,97,0,115,111,100,118,97,0,115,111,102,116,111,0,115,111,108,106,105,0,115,111,108,114,105,0,115,111,109,98,111,0,115,111,110,99,105,0,115,111,114,99,117,0,115,111,114,103,117,0,115,111,118,100,97,0,115,112,97,106,105,0,115,112,97,108,105,0,115,112,97,110,111,0,115,112,97,116,105,0,115,112,101,110,105,0,115,112,105,115,97,0,115,112,105,116,97,0,115,112,111,102,117,0,115,112,111,106,97,0,115,112,117,100,97,0,115,112,117,116,117,0,115,114,97,106,105,0,115,114,97,107,117,0,115,114,97,108,111,0,115,114,97,110,97,0,115,114,97,115,117,0,115,114,101,114,97,0,115,114,105,116,111,0,115,114,117,109,97,0,115,114,117,114,105,0,115,116,97,99,101,0,115,116,97,103,105,0,115,116,97,107,117,0,115,116,97,108,105,0,115,116,97,110,105,0,115,116,97,112,97,0,115,116,97,115,117,0,115,116,97,116,105,0,115,116,101,98,97,0,115,116,101,99,105,0,115,116,101,100,117,0,115,116,101,108,97,0,115,116,101,114,111,0,115,116,105,99,105,0,115,116,105,100,105,0,115,116,105,107,97,0,115,116,105,122,117,0,115,116,111,100,105,0,115,116,117,110,97,0,115,116,117,114,97,0,115,116,117,122,105,0,115,117,39,101,0,115,117,39,111,0,115,117,39,117,0,115,117,99,116,97,0,115,117,100,103,97,0,115,117,102,116,105,0,115,117,107,115,97,0,115,117,109,106,105,0,115,117,109,110,101,0,115,117,109,116,105,0,115,117,110,103,97,0,115,117,110,108,97,0,115,117,114,108,97,0,115,117,116,114,97,0,116,97,0,116,97,98,110,111,0,116,97,98,114,97,0,116,97,100,106,105,0,116,97,100,110,105,0,116,97,103,106,105,0,116,97,108,115,97,0,116,97,109,99,97,0,116,97,109,106,105,0,116,97,109,110,101,0,116,97,110,98,111,0,116,97,110,99,101,0,116,97,110,106,111,0,116,97,110,107,111,0,116,97,110,114,117,0,116,97,110,115,105,0,116,97,110,120,101,0,116,97,112,108,97,0,116,97,114,98,105,0,116,97,114,99,105,0,116,97,114,108,97,0,116,97,114,109,105,0,116,97,114,116,105,0,116,97,115,107,101,0,116,97,116,112,105,0,116,97,116,114,117,0,116,97,118,108,97,0,116,97,120,102,117,0,116,99,97,99,105,0,116,99,97,100,117,0,116,99,97,110,97,0,116,99,97,116,105,0,116,99,101,110,97,0,116,99,105,99,97,0,116,99,105,100,117,0,116,99,105,107,97,0,116,99,105,108,97,0,116,99,105,109,97,0,116,99,105,110,105,0,116,99,105,116,97,0,116,101,0,116,101,109,99,105,0,116,101,110,102,97,0,116,101,110,103,117,0,116,101,114,100,105,0,116,101,114,112,97,0,116,101,114,116,111,0,116,105,0,116,105,103,110,105,0,116,105,107,112,97,0,116,105,108,106,117,0,116,105,110,98,101,0,116,105,110,99,105,0,116,105,110,115,97,0,116,105,114,110,97,0,116,105,114,115,101,0,116,105,114,120,117,0,116,105,115,110,97,0,116,105,116,108,97,0,116,105,118,110,105,0,116,105,120,110,117,0,116,111,39,101,0,116,111,107,110,117,0,116,111,108,100,105,0,116,111,110,103,97,0,116,111,114,100,117,0,116,111,114,110,105,0,116,114,97,106,105,0,116,114,97,110,111,0,116,114,97,116,105,0,116,114,101,110,101,0,116,114,105,99,117,0,116,114,105,110,97,0,116,114,105,120,101,0,116,114,111,99,105,0,116,115,97,108,105,0,116,115,97,110,105,0,116,115,97,112,105,0,116,115,105,106,117,0,116,115,105,110,97,0,116,117,0,116,117,98,110,117,0,116,117,103,110,105,0,116,117,106,108,105,0,116,117,109,108,97,0,116,117,110,98,97,0,116,117,110,107,97,0,116,117,110,108,111,0,116,117,110,116,97,0,116,117,112,108,101,0,116,117,114,110,105,0,116,117,116,99,105,0,116,117,116,114,97,0,118,97,0,118,97,99,114,105,0,118,97,106,110,105,0,118,97,108,115,105,0,118,97,109,106,105,0,118,97,109,116,117,0,118,97,110,98,105,0,118,97,110,99,105,0,118,97,110,106,117,0,118,97,115,114,117,0,118,97,115,120,117,0,118,101,0,118,101,39,101,0,118,101,99,110,117,0,118,101,110,102,117,0,118,101,110,115,97,0,118,101,114,98,97,0,118,105,0,118,105,98,110,97,0,118,105,100,110,105,0,118,105,100,114,117,0,118,105,102,110,101,0,118,105,107,109,105,0,118,105,107,110,117,0,118,105,109,99,117,0,118,105,110,100,117,0,118,105,110,106,105,0,118,105,112,115,105,0,118,105,114,110,117,0,118,105,115,107,97,0,118,105,116,99,105,0,118,105,116,107,101,0,118,105,116,110,111,0,118,108,97,103,105,0,118,108,105,108,101,0,118,108,105,110,97,0,118,108,105,112,97,0,118,111,0,118,111,102,108,105,0,118,111,107,115,97,0,118,111,114,109,101,0,118,114,97,103,97,0,118,114,101,106,105,0,118,114,101,116,97,0,118,114,105,99,105,0,118,114,117,100,101,0,118,114,117,115,105,0,118,117,0,118,117,107,114,111,0,120,97,0,120,97,98,106,117,0,120,97,100,98,97,0,120,97,100,110,105,0,120,97,103,106,105,0,120,97,103,114,105,0,120,97,106,109,105,0,120,97,107,115,117,0,120,97,108,98,111,0,120,97,108,107,97,0,120,97,108,110,105,0,120,97,109,103,117,0,120,97,109,112,111,0,120,97,109,115,105,0,120,97,110,99,101,0,120,97,110,107,97,0,120,97,110,114,105,0,120,97,110,116,111,0,120,97,114,99,105,0,120,97,114,106,117,0,120,97,114,110,117,0,120,97,115,108,105,0,120,97,115,110,101,0,120,97,116,114,97,0,120,97,116,115,105,0,120,97,122,100,111,0,120,101,0,120,101,98,110,105,0,120,101,98,114,111,0,120,101,99,116,111,0,120,101,100,106,97,0,120,101,107,114,105,0,120,101,108,115,111,0,120,101,110,100,111,0,120,101,110,114,117,0,120,101,120,115,111,0,120,105,110,100,111,0,120,105,110,109,111,0,120,105,114,109,97,0,120,105,115,108,117,0,120,105,115,112,111,0,120,108,97,108,105,0,120,108,117,114,97,0,120,111,116,108,105,0,120,114,97,98,111,0,120,114,97,110,105,0,120,114,105,115,111,0,120,114,117,98,97,0,120,114,117,107,105,0,120,114,117,108,97,0,120,114,117,116,105,0,120,117,107,109,105,0,120,117,110,114,101,0,120,117,114,100,111,0,120,117,115,114,97,0,120,117,116,108,97,0,122,97,39,105,0,122,97,39,111,0,122,97,98,110,97,0,122,97,106,98,97,0,122,97,108,118,105,0,122,97,110,114,117,0,122,97,114,99,105,0,122,97,114,103,117,0,122,97,115,110,105,0,122,97,115,116,105,0,122,98,97,98,117,0,122,98,97,110,105,0,122,98,97,115,117,0,122,98,101,112,105,0,122,100,97,110,105,0,122,100,105,108,101,0,122,101,0,122,101,39,101,0,122,101,39,111,0,122,101,107,114,105,0,122,101,110,98,97,0,122,101,112,116,105,0,122,101,116,114,111,0,122,103,97,110,97,0,122,103,105,107,101,0,122,105,39,111,0,122,105,102,114,101,0,122,105,110,107,105,0,122,105,114,112,117,0,122,105,118,108,101,0,122,109,97,100,117,0,122,109,105,107,117,0,122,111,39,97,0,122,111,39,105,0,122,117,39,111,0,122,117,107,116,101,0,122,117,109,114,105,0,122,117,110,103,105,0,122,117,110,108,101,0,122,117,110,116,105,0,122,117,116,115,101,0,122,118,97,116,105,0,98,97,39,117,0,100,114,105,0,98,97,106,0,98,97,102,0,98,97,107,0,98,97,39,101,0,98,97,118,0,98,97,99,0,98,97,100,0,98,97,110,0,98,97,117,0,98,97,108,0,98,97,39,105,0,98,97,39,111,0,98,97,120,0,98,97,122,0,98,97,112,0,98,97,105,0,98,114,97,0,98,97,103,0,98,97,39,97,0,98,97,114,0,98,97,115,0,98,97,116,0,98,101,98,0,98,101,109,0,98,101,39,111,0,98,101,100,0,98,101,39,101,0,98,101,103,0,98,101,106,0,98,101,39,105,0,98,101,115,0,98,101,39,97,0,98,101,114,0,98,101,110,0,98,101,102,0,98,101,39,117,0,98,101,116,0,98,101,118,0,98,101,105,0,98,105,118,0,98,105,122,0,98,105,99,0,98,105,107,0,98,105,103,0,98,105,39,97,0,98,105,108,0,98,105,100,0,98,105,120,0,98,105,39,111,0,98,105,114,0,98,105,116,0,98,105,115,0,98,105,109,0,98,105,39,117,0,108,97,98,0,98,108,97,0,98,108,105,0,108,111,116,0,98,108,111,0,108,111,39,105,0,98,111,114,0,98,111,108,0,98,111,105,0,98,111,103,0,98,111,39,117,0,98,111,116,0,98,111,39,105,0,98,111,102,0,98,111,39,111,0,98,111,110,0,98,111,39,97,0,114,97,122,0,114,101,100,0,98,114,101,0,98,114,105,0,98,105,102,0,98,105,39,101,0,98,105,106,0,114,105,116,0,114,111,100,0,98,111,39,101,0,98,117,110,0,98,117,115,0,98,117,39,105,0,98,117,108,0,98,117,106,0,98,117,39,111,0,98,117,107,0,98,117,39,117,0,98,117,109,0,98,117,100,0,98,117,114,0,98,117,39,101,0,98,114,117,0,99,97,122,0,99,97,98,0,100,122,117,0,99,97,102,0,99,97,107,0,99,97,100,0,99,97,103,0,99,97,106,0,99,97,39,111,0,99,97,108,0,99,97,39,117,0,99,110,97,0,99,97,110,0,99,97,109,0,99,97,105,0,99,97,114,0,99,97,116,0,99,97,118,0,115,110,117,0,99,97,39,101,0,99,116,97,0,99,97,39,105,0,99,97,120,0,99,101,99,0,99,101,122,0,99,101,108,0,99,101,39,97,0,99,101,109,0,99,101,39,117,0,99,110,101,0,99,101,115,0,99,101,110,0,99,101,100,0,99,101,114,0,99,114,101,0,99,101,118,0,99,101,105,0,99,102,97,0,102,105,107,0,102,105,39,97,0,99,102,105,0,102,105,39,117,0,99,105,98,0,98,108,117,0,100,106,97,0,99,105,100,0,100,114,111,0,99,105,102,0,99,105,103,0,99,105,107,0,99,107,105,0,99,105,99,0,99,105,109,0,99,108,105,0,99,105,108,0,99,105,106,0,99,110,105,0,99,105,39,105,0,99,105,110,0,99,112,105,0,99,105,112,0,99,114,105,0,99,105,39,97,0,99,105,39,101,0,99,116,105,0,99,105,116,0,99,105,39,111,0,99,105,114,0,99,105,118,0,99,105,122,0,107,97,102,0,107,97,105,0,99,107,97,0,99,97,112,0,99,97,115,0,107,101,106,0,99,107,101,0,107,105,107,0,99,105,39,117,0,107,105,39,105,0,107,105,114,0,107,117,108,0,99,117,39,101,0,107,117,39,117,0,108,97,117,0,99,108,97,0,99,97,117,0,108,105,114,0,108,105,116,0,108,105,118,0,108,105,39,97,0,99,117,112,0,99,109,97,0,109,97,39,97,0,109,97,39,111,0,99,109,101,0,109,101,39,101,0,109,105,39,97,0,109,105,109,0,99,109,105,0,99,109,111,0,99,111,39,105,0,110,97,39,111,0,110,101,98,0,110,101,39,111,0,110,101,109,0,110,101,39,117,0,110,105,99,0,110,105,110,0,110,105,39,111,0,110,105,115,0,110,105,116,0,110,105,39,97,0,99,111,108,0,99,111,109,0,99,107,111,0,99,111,110,0,99,110,111,0,99,111,105,0,99,111,114,0,99,114,111,0,99,112,97,0,112,97,114,0,99,112,101,0,99,114,97,0,99,101,107,0,114,101,112,0,114,105,98,0,114,105,100,0,114,105,39,111,0,114,105,112,0,99,105,115,0,116,101,98,0,116,101,107,0,116,105,39,111,0,99,116,117,0,99,117,107,0,99,107,117,0,99,108,117,0,99,117,109,0,99,117,39,105,0,99,117,108,0,99,117,110,0,99,117,39,111,0,99,117,39,117,0,112,114,97,0,99,114,117,0,99,117,114,0,99,117,118,0,99,117,115,0,115,107,117,0,99,117,99,0,99,117,116,0,99,117,120,0,99,117,39,97,0,100,97,118,0,100,122,97,0,100,97,122,0,100,97,99,0,100,97,105,0,100,97,106,0,100,97,107,0,100,97,98,0,100,97,100,0,100,97,102,0,100,97,108,0,100,97,39,117,0,100,97,109,0,100,97,39,101,0,100,97,110,0,112,108,117,0,100,97,112,0,100,97,103,0,100,97,117,0,100,97,114,0,100,97,39,111,0,100,97,120,0,100,97,39,105,0,100,97,115,0,115,112,111,0,115,114,105,0,100,101,99,0,100,101,103,0,100,101,106,0,100,101,107,0,100,101,108,0,100,101,39,111,0,100,101,98,0,100,101,110,0,100,101,39,105,0,100,101,109,0,100,101,112,0,100,101,39,97,0,100,101,114,0,100,101,39,117,0,100,114,101,0,100,101,115,0,100,101,116,0,100,105,114,0,100,105,99,0,107,108,111,0,100,105,107,0,100,105,108,0,100,105,109,0,100,105,106,0,100,105,39,117,0,100,105,39,111,0,100,105,98,0,100,105,39,101,0,100,105,103,0,100,105,122,0,100,122,105,0,106,97,99,0,106,97,117,0,100,106,101,0,100,101,105,0,100,106,105,0,106,105,110,0,106,117,110,0,106,117,39,111,0,100,111,110,0,100,111,105,0,100,111,114,0,100,111,39,105,0,100,111,116,0,100,111,39,111,0,100,114,97,0,100,97,116,0,114,117,100,0,100,114,117,0,100,117,98,0,100,117,39,111,0,100,117,109,0,100,117,103,0,100,117,115,0,100,117,39,101,0,100,117,116,0,100,117,100,0,100,117,39,97,0,100,117,106,0,100,117,107,0,100,117,110,0,100,117,39,105,0,100,117,114,0,100,122,101,0,122,105,112,0,102,97,107,0,102,97,39,105,0,102,97,100,0,102,97,103,0,102,97,110,0,102,97,109,0,102,97,39,111,0,102,97,122,0,102,97,112,0,112,114,111,0,102,97,108,0,102,97,39,117,0,102,97,114,0,102,97,39,97,0,102,97,118,0,102,97,117,0,102,97,99,0,102,97,116,0,102,97,39,101,0,102,97,105,0,102,101,98,0,102,101,109,0,102,101,100,0,102,101,103,0,102,101,39,117,0,102,101,107,0,102,101,114,0,102,101,39,97,0,102,101,110,0,102,101,39,111,0,102,101,112,0,102,101,105,0,102,114,101,0,102,101,115,0,102,101,116,0,102,101,39,105,0,102,105,103,0,102,105,115,0,102,105,112,0,102,105,39,101,0,102,105,110,0,102,105,39,105,0,102,108,97,0,102,108,101,0,102,108,105,0,102,105,114,0,102,108,111,0,102,111,105,0,102,111,109,0,102,111,39,111,0,102,111,110,0,102,114,111,0,102,97,115,0,102,114,97,0,102,97,120,0,102,105,99,0,102,105,39,111,0,102,105,108,0,102,105,116,0,102,114,117,0,102,117,107,0,102,117,39,105,0,102,117,108,0,102,108,117,0,102,117,110,0,102,117,39,97,0,102,117,114,0,102,117,122,0,102,117,39,101,0,103,97,105,0,103,97,100,0,103,97,102,0,103,97,39,105,0,103,97,108,0,103,97,39,117,0,103,97,39,111,0,103,97,110,0,103,97,115,0,103,97,39,101,0,103,97,120,0,103,97,122,0,103,97,99,0,103,97,112,0,103,97,114,0,103,97,117,0,103,97,116,0,103,101,106,0,103,101,116,0,103,101,39,111,0,103,101,120,0,103,101,114,0,103,101,39,117,0,103,101,110,0,103,101,39,97,0,103,105,100,0,103,105,39,97,0,103,105,103,0,103,105,39,111,0,103,105,107,0,103,105,114,0,103,114,105,0,103,105,109,0,103,105,39,117,0,103,108,97,0,103,101,107,0,103,101,105,0,108,101,116,0,103,108,101,0,103,105,99,0,103,108,105,0,103,108,117,0,103,111,99,0,103,111,116,0,114,97,117,0,103,114,97,0,103,97,39,97,0,114,97,115,0,114,101,107,0,114,117,115,0,114,117,116,0,103,117,98,0,103,117,103,0,103,117,39,101,0,103,117,100,0,103,117,110,0,103,117,39,97,0,103,117,109,0,103,117,114,0,103,117,39,111,0,103,117,116,0,103,114,117,0,103,117,107,0,103,117,115,0,103,117,39,105,0,103,117,99,0,103,117,122,0,122,109,101,0,106,97,118,0,106,97,100,0,106,97,39,105,0,106,97,103,0,106,97,39,101,0,106,97,102,0,106,109,97,0,106,97,109,0,106,97,98,0,106,97,110,0,106,97,108,0,106,97,115,0,106,97,116,0,106,97,39,111,0,106,97,107,0,106,97,112,0,106,97,39,97,0,106,118,97,0,98,97,109,0,106,98,97,0,106,98,101,0,106,101,114,0,98,105,110,0,106,97,114,0,106,100,105,0,100,105,39,97,0,100,105,110,0,100,105,39,105,0,100,117,108,0,106,100,117,0,106,101,118,0,106,118,101,0,106,101,99,0,106,101,39,97,0,106,101,102,0,106,101,103,0,106,101,39,111,0,106,101,122,0,106,101,108,0,106,109,101,0,106,101,110,0,106,101,100,0,106,101,109,0,106,101,39,105,0,106,101,120,0,106,101,115,0,106,101,39,101,0,106,101,116,0,106,101,39,117,0,106,97,39,117,0,106,103,97,0,106,97,105,0,106,103,101,0,103,105,110,0,106,103,105,0,103,105,116,0,106,98,105,0,106,105,98,0,99,109,117,0,106,105,106,0,106,105,107,0,106,105,108,0,106,105,99,0,106,109,105,0,106,105,116,0,106,105,103,0,106,105,39,97,0,106,105,109,0,106,105,114,0,106,105,115,0,106,105,118,0,106,105,39,105,0,106,105,122,0,106,105,112,0,106,105,39,111,0,106,105,102,0,116,114,111,0,106,118,105,0,106,97,106,0,109,105,110,0,109,105,118,0,106,105,39,101,0,106,111,118,0,106,111,109,0,106,111,108,0,106,111,114,0,106,111,39,111,0,106,111,110,0,106,117,118,0,106,117,98,0,106,98,117,0,106,117,102,0,106,117,39,97,0,106,117,107,0,106,117,112,0,106,117,39,101,0,106,117,100,0,106,117,39,105,0,106,117,103,0,106,117,108,0,106,117,114,0,106,117,109,0,106,117,115,0,106,117,116,0,106,117,120,0,118,105,110,0,106,105,39,117,0,107,97,109,0,107,97,103,0,106,100,101,0,107,97,39,101,0,107,97,114,0,107,97,115,0,107,97,116,0,107,97,117,0,107,97,99,0,107,97,100,0,107,97,106,0,107,97,108,0,107,97,39,111,0,107,97,110,0,107,97,39,117,0,107,97,120,0,107,97,98,0,107,97,39,97,0,107,97,118,0,107,101,109,0,107,101,112,0,107,101,99,0,107,101,39,105,0,107,101,122,0,107,101,108,0,107,101,39,111,0,107,101,110,0,107,101,115,0,107,114,101,0,107,101,114,0,107,101,116,0,116,99,111,0,107,101,118,0,107,101,39,97,0,107,105,99,0,107,105,39,101,0,107,105,106,0,107,105,39,111,0,107,105,108,0,107,105,115,0,108,97,106,0,107,97,107,0,107,108,97,0,108,97,105,0,107,108,101,0,108,101,105,0,107,108,105,0,107,105,116,0,108,117,112,0,108,117,39,101,0,108,117,122,0,107,111,98,0,107,111,39,105,0,107,111,106,0,107,111,39,97,0,107,111,108,0,107,111,39,101,0,107,111,109,0,107,111,110,0,107,111,39,117,0,107,111,114,0,107,111,105,0,107,114,111,0,107,111,107,0,107,111,115,0,107,114,97,0,107,97,39,105,0,114,101,102,0,107,101,39,117,0,107,114,105,0,114,105,110,0,107,105,39,117,0,107,105,120,0,107,105,39,97,0,107,117,99,0,114,117,106,0,114,117,118,0,107,114,117,0,107,117,122,0,107,117,98,0,107,117,102,0,107,117,107,0,107,108,117,0,107,117,109,0,107,117,110,0,107,117,116,0,107,117,114,0,107,117,106,0,107,117,39,105,0,107,117,112,0,107,117,39,101,0,107,117,115,0,108,97,112,0,99,112,117,0,108,97,99,0,108,97,100,0,108,97,102,0,108,97,39,101,0,108,97,107,0,108,97,39,117,0,108,97,109,0,108,97,39,105,0,108,97,108,0,108,97,110,0,108,97,120,0,108,97,122,0,108,97,114,0,108,97,39,97,0,108,97,39,111,0,108,101,109,0,108,101,98,0,108,101,39,97,0,108,101,110,0,108,101,39,111,0,108,101,107,0,108,101,99,0,108,101,114,0,108,101,39,117,0,108,105,122,0,108,105,98,0,108,105,39,101,0,108,105,102,0,102,114,105,0,106,100,97,0,108,105,109,0,108,105,100,0,108,105,106,0,108,105,110,0,108,105,39,111,0,108,105,115,0,115,116,101,0,108,105,99,0,108,105,107,0,108,105,39,117,0,108,105,108,0,108,111,109,0,108,111,106,0,108,111,98,0,106,98,111,0,108,111,108,0,108,111,105,0,108,111,114,0,108,111,39,117,0,108,117,39,111,0,108,117,118,0,106,118,111,0,108,117,109,0,108,117,39,105,0,108,117,98,0,108,117,114,0,108,117,115,0,109,97,108,0,109,97,98,0,99,110,117,0,109,97,39,117,0,109,97,102,0,109,97,107,0,109,97,115,0,109,97,109,0,109,97,99,0,109,97,110,0,109,97,114,0,109,97,112,0,109,97,116,0,109,114,97,0,109,97,39,101,0,109,97,100,0,109,97,103,0,109,97,106,0,109,97,105,0,109,97,120,0,115,110,111,0,109,97,39,105,0,109,97,118,0,120,114,105,0,109,101,98,0,109,101,103,0,109,101,109,0,109,101,107,0,109,101,39,111,0,109,101,108,0,109,108,101,0,109,101,106,0,109,101,110,0,109,101,115,0,109,101,39,105,0,109,101,116,0,109,101,39,117,0,109,101,114,0,109,114,101,0,109,101,120,0,109,105,98,0,109,105,106,0,109,105,102,0,109,105,99,0,109,105,107,0,109,105,108,0,109,108,105,0,109,105,100,0,109,105,39,101,0,109,105,39,105,0,109,105,114,0,109,105,116,0,109,105,39,117,0,109,105,112,0,109,105,115,0,109,105,39,111,0,116,114,101,0,109,105,120,0,120,114,101,0,109,108,97,0,108,97,116,0,109,101,99,0,109,101,39,97,0,108,101,100,0,108,117,110,0,109,111,98,0,109,111,118,0,109,111,109,0,109,111,99,0,109,111,108,0,109,111,39,117,0,109,108,111,0,109,111,39,111,0,109,111,106,0,109,111,114,0,109,111,110,0,109,114,111,0,109,111,115,0,109,114,105,0,109,114,117,0,109,117,109,0,109,117,102,0,109,117,116,0,109,117,100,0,109,117,107,0,109,117,39,105,0,109,117,108,0,109,117,39,111,0,109,117,106,0,109,117,112,0,109,117,114,0,109,117,39,97,0,109,117,115,0,116,99,101,0,109,117,118,0,109,117,39,117,0,109,117,122,0,110,97,114,0,110,97,108,0,110,97,109,0,110,97,107,0,110,97,39,105,0,110,97,99,0,110,97,39,117,0,110,97,98,0,110,97,39,97,0,110,97,100,0,110,97,117,0,110,97,118,0,110,97,103,0,110,97,106,0,110,97,102,0,110,97,116,0,110,97,105,0,110,97,120,0,120,108,101,0,110,97,122,0,122,98,105,0,110,101,110,0,110,101,108,0,110,101,105,0,110,101,114,0,110,101,39,105,0,110,105,108,0,110,105,98,0,110,105,39,105,0,99,116,101,0,110,105,107,0,110,105,39,101,0,110,105,109,0,110,105,39,117,0,110,105,114,0,116,99,117,0,110,105,118,0,110,105,120,0,120,108,105,0,110,111,110,0,110,111,114,0,110,111,108,0,110,111,39,105,0,110,111,116,0,110,111,105,0,110,117,110,0,110,117,107,0,110,117,112,0,110,117,39,101,0,110,117,109,0,110,117,108,0,110,117,39,105,0,110,117,122,0,112,97,118,0,112,97,39,97,0,112,97,103,0,112,97,117,0,103,114,101,0,112,97,105,0,112,97,99,0,112,97,107,0,112,97,110,0,112,97,100,0,112,97,39,111,0,112,97,112,0,112,97,116,0,112,97,122,0,112,97,98,0,112,97,115,0,112,97,102,0,112,97,39,117,0,112,97,120,0,112,101,118,0,112,108,101,0,112,101,108,0,112,101,109,0,112,101,98,0,112,101,99,0,112,101,39,117,0,112,101,100,0,112,101,39,111,0,112,101,110,0,112,101,39,105,0,112,101,115,0,112,101,105,0,112,101,114,0,112,101,120,0,112,101,116,0,112,101,122,0,112,105,122,0,112,105,118,0,112,105,99,0,112,105,39,105,0,112,105,108,0,112,105,39,97,0,112,108,105,0,112,105,109,0,112,105,100,0,112,105,102,0,112,105,107,0,112,105,115,0,112,105,110,0,112,105,120,0,112,105,39,111,0,112,105,114,0,120,114,97,0,112,108,97,0,108,101,106,0,108,101,39,105,0,112,105,98,0,112,105,112,0,112,105,39,101,0,112,105,116,0,108,105,120,0,108,117,106,0,112,117,107,0,112,117,39,97,0,108,117,116,0,108,117,39,97,0,112,108,111,0,112,111,108,0,112,111,110,0,112,111,39,111,0,112,111,115,0,112,111,39,101,0,112,111,112,0,112,111,39,105,0,112,111,114,0,112,111,105,0,112,111,116,0,112,97,108,0,112,97,109,0,112,97,39,105,0,112,97,39,101,0,112,101,106,0,112,114,101,0,114,101,116,0,114,101,105,0,112,105,106,0,112,114,105,0,114,111,115,0,114,111,39,97,0,114,117,99,0,114,117,39,101,0,112,117,110,0,114,117,120,0,114,117,39,105,0,112,117,115,0,112,117,118,0,112,117,99,0,112,117,39,101,0,112,117,106,0,112,117,108,0,112,117,114,0,112,114,117,0,112,117,100,0,112,117,109,0,112,117,39,111,0,114,97,39,111,0,114,97,102,0,114,97,118,0,114,97,39,117,0,114,97,99,0,114,97,108,0,114,97,39,101,0,114,97,100,0,114,97,103,0,114,97,39,105,0,114,97,109,0,114,97,110,0,114,97,120,0,114,97,112,0,114,97,114,0,114,97,116,0,114,101,108,0,114,101,98,0,114,101,99,0,114,101,39,117,0,114,101,109,0,114,101,39,97,0,114,101,114,0,114,101,39,111,0,114,101,118,0,114,101,39,105,0,114,101,115,0,114,105,102,0,99,102,117,0,114,105,103,0,114,105,106,0,114,105,108,0,114,105,109,0,114,105,39,117,0,114,105,107,0,114,105,39,97,0,114,105,114,0,114,105,39,101,0,114,105,115,0,114,105,39,105,0,114,105,118,0,114,111,108,0,114,111,109,0,114,111,107,0,114,111,39,105,0,114,111,103,0,114,111,110,0,114,111,39,111,0,114,111,114,0,114,111,116,0,116,115,117,0,114,111,39,117,0,114,111,122,0,122,103,117,0,114,117,98,0,98,108,101,0,114,117,102,0,114,117,109,0,114,117,112,0,114,117,39,117,0,114,117,107,0,114,117,39,111,0,114,117,110,0,115,97,98,0,100,106,111,0,115,97,107,0,115,97,108,0,115,97,116,0,115,108,97,0,115,97,39,111,0,115,97,112,0,115,110,97,0,115,97,103,0,115,97,39,97,0,115,97,106,0,115,97,39,105,0,115,97,105,0,115,97,39,117,0,115,114,97,0,115,97,120,0,115,107,101,0,115,97,39,101,0,115,97,118,0,118,114,117,0,115,97,122,0,115,101,108,0,115,102,101,0,115,108,101,0,115,101,102,0,115,101,39,117,0,115,109,101,0,115,101,99,0,115,101,110,0,115,101,116,0,115,101,118,0,115,110,101,0,115,101,112,0,115,101,105,0,115,101,114,0,115,101,39,97,0,115,101,122,0,115,101,39,105,0,115,102,97,0,115,102,111,0,115,117,98,0,115,105,122,0,115,105,108,0,115,105,39,105,0,115,105,98,0,100,106,117,0,115,105,103,0,115,105,107,0,109,108,117,0,115,109,105,0,115,105,109,0,115,105,39,117,0,115,105,39,97,0,115,110,105,0,115,105,112,0,115,105,114,0,115,105,120,0,115,105,115,0,115,116,105,0,115,105,116,0,115,105,118,0,115,97,109,0,107,97,112,0,115,107,97,0,115,107,105,0,115,105,106,0,107,105,110,0,115,107,111,0,107,111,116,0,107,111,39,111,0,107,117,39,111,0,115,97,117,0,115,97,114,0,108,97,115,0,108,105,103,0,115,108,105,0,108,111,118,0,108,111,39,111,0,115,108,117,0,115,109,97,0,115,109,111,0,109,117,99,0,109,117,110,0,115,109,117,0,115,97,100,0,110,105,100,0,115,105,39,101,0,110,105,112,0,110,117,106,0,110,117,114,0,110,117,39,97,0,110,117,116,0,115,111,122,0,115,111,106,0,115,111,112,0,115,111,114,0,115,111,115,0,115,111,116,0,115,111,98,0,115,111,100,0,115,111,102,0,115,108,111,0,115,111,108,0,115,111,109,0,115,111,110,0,115,111,105,0,115,111,99,0,115,114,111,0,115,111,103,0,115,111,118,0,112,97,106,0,115,97,110,0,115,112,97,0,115,112,101,0,115,112,105,0,112,111,102,0,112,111,39,117,0,112,111,106,0,112,111,39,97,0,115,112,117,0,112,117,116,0,114,97,106,0,114,97,107,0,114,97,39,97,0,115,97,115,0,115,114,101,0,114,117,39,97,0,114,117,114,0,115,114,117,0,115,97,99,0,116,97,107,0,115,116,97,0,116,97,112,0,115,101,98,0,116,101,99,0,116,101,39,105,0,115,101,100,0,116,101,108,0,116,101,39,111,0,115,105,99,0,115,105,100,0,116,105,39,105,0,116,105,107,0,116,105,122,0,115,116,111,0,115,117,110,0,116,117,114,0,115,117,39,97,0,116,117,122,0,115,116,117,0,115,117,112,0,115,117,122,0,115,117,118,0,115,117,99,0,115,117,100,0,115,102,117,0,115,117,107,0,115,117,106,0,115,117,109,0,115,117,39,105,0,115,117,103,0,115,117,108,0,115,117,114,0,115,117,116,0,116,97,122,0,116,97,98,0,116,97,100,0,116,97,103,0,116,97,108,0,116,97,106,0,116,97,39,111,0,116,97,99,0,116,97,117,0,116,97,115,0,116,97,120,0,116,97,39,101,0,116,97,114,0,116,97,109,0,116,97,105,0,116,114,97,0,116,97,39,105,0,116,97,116,0,116,97,118,0,116,97,39,97,0,116,97,102,0,116,97,39,117,0,99,97,99,0,116,99,97,0,116,101,110,0,116,105,99,0,116,105,100,0,116,105,108,0,116,105,109,0,116,105,39,97,0,116,101,114,0,116,101,109,0,116,101,105,0,116,101,102,0,116,101,103,0,116,101,39,117,0,116,101,100,0,116,101,112,0,116,101,39,97,0,116,101,116,0,116,105,102,0,116,105,103,0,116,105,112,0,116,105,106,0,116,105,98,0,116,105,110,0,116,105,114,0,116,105,115,0,116,105,116,0,116,105,118,0,116,105,120,0,116,105,39,117,0,116,111,108,0,116,111,107,0,116,111,100,0,116,111,103,0,116,111,39,97,0,116,111,114,0,116,111,39,117,0,116,111,110,0,116,111,39,105,0,114,97,105,0,114,101,110,0,114,101,39,101,0,114,105,99,0,116,114,105,0,114,105,120,0,116,105,39,101,0,116,111,99,0,116,111,105,0,116,115,97,0,116,97,110,0,116,115,105,0,115,105,110,0,116,117,102,0,116,117,39,117,0,116,117,103,0,116,117,39,105,0,116,117,106,0,116,117,109,0,116,117,39,97,0,116,117,98,0,116,117,107,0,116,117,108,0,116,117,39,111,0,116,117,110,0,116,117,112,0,116,117,39,101,0,116,114,117,0,116,99,105,0,116,117,116,0,118,97,122,0,118,97,114,0,118,97,106,0,118,97,105,0,118,97,108,0,118,108,97,0,118,97,109,0,118,97,39,105,0,118,97,116,0,118,97,98,0,118,97,99,0,118,97,110,0,118,97,115,0,118,97,117,0,118,97,120,0,118,97,39,117,0,118,101,108,0,118,101,110,0,118,101,39,117,0,118,101,102,0,118,101,115,0,118,101,114,0,118,101,39,97,0,118,105,122,0,118,105,98,0,118,105,114,0,118,105,102,0,118,105,109,0,118,105,39,105,0,118,105,107,0,118,105,99,0,118,105,39,117,0,118,105,100,0,118,105,106,0,118,105,112,0,118,114,105,0,118,105,115,0,118,105,39,97,0,118,105,116,0,118,105,39,101,0,118,105,39,111,0,108,97,103,0,118,105,108,0,118,108,105,0,118,111,110,0,118,111,108,0,118,111,105,0,118,111,107,0,118,111,39,97,0,118,111,114,0,118,114,111,0,118,114,97,0,114,101,106,0,118,101,105,0,118,114,101,0,118,117,100,0,118,117,39,101,0,118,117,115,0,118,117,39,105,0,118,117,122,0,118,117,114,0,118,117,39,111,0,120,97,118,0,120,97,39,117,0,120,97,98,0,120,97,100,0,120,97,109,0,120,97,107,0,120,97,108,0,120,97,103,0,120,97,117,0,120,97,112,0,120,97,39,111,0,120,97,115,0,120,97,110,0,120,97,39,101,0,120,97,114,0,120,97,99,0,120,97,39,105,0,120,97,106,0,120,97,39,97,0,120,97,116,0,120,97,122,0,122,100,111,0,120,101,108,0,120,101,110,0,120,101,105,0,120,101,98,0,98,114,111,0,120,101,116,0,99,116,111,0,120,101,106,0,120,101,39,97,0,120,101,107,0,120,101,39,105,0,120,101,115,0,120,101,100,0,120,101,39,111,0,120,101,114,0,120,101,39,117,0,120,101,120,0,120,105,110,0,120,105,109,0,120,105,114,0,120,105,39,97,0,120,105,108,0,120,105,39,117,0,120,105,112,0,120,108,97,0,120,108,117,0,120,111,108,0,120,111,105,0,114,97,98,0,120,97,105,0,120,105,115,0,120,105,39,111,0,120,117,98,0,120,117,107,0,114,117,108,0,120,114,117,0,120,117,109,0,120,117,39,105,0,120,117,110,0,120,117,39,101,0,120,117,114,0,120,117,39,111,0,120,117,115,0,120,117,39,97,0,120,117,108,0,122,97,122,0,122,97,110,0,122,97,39,97,0,122,97,106,0,122,97,108,0,122,97,114,0,122,97,117,0,122,97,99,0,122,97,105,0,122,97,103,0,122,97,39,117,0,122,97,115,0,122,97,116,0,98,97,98,0,122,98,97,0,122,98,101,0,122,100,97,0,122,100,105,0,122,101,108,0,122,101,118,0,122,101,114,0,122,101,105,0,122,101,110,0,122,101,39,97,0,122,101,112,0,122,101,116,0,122,103,97,0,122,103,105,0,103,105,39,101,0,122,105,108,0,122,105,102,0,122,105,39,101,0,122,105,110,0,122,105,39,105,0,122,105,114,0,122,105,39,117,0,122,105,118,0,118,108,101,0,122,109,97,0,109,97,117,0,122,109,105,0,122,111,110,0,122,111,114,0,122,117,109,0,122,117,107,0,122,117,39,101,0,122,109,117,0,122,117,103,0,122,117,108,0,122,117,110,0,122,117,39,105,0,122,117,116,0,116,115,101,0,122,118,97,0,100,106,0,100,122,0,116,99,0,116,115,0,17,0,10,0,17,17,17,0,0,0,0,5,0,0,0,0,0,0,9,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,15,10,17,17,17,3,10,7,0,1,19,9,11,11,0,0,9,6,11,0,0,11,0,6,17,0,0,0,17,17,17,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,17,0,10,10,17,17,17,0,10,0,0,2,0,9,11,0,0,0,9,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,0,0,0,0,0,0,0,0,0,0,0,13,0,0,0,4,13,0,0,0,0,9,14,0,0,0,0,0,14,0,0,14,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,15,0,0,0,0,9,16,0,0,0,0,0,16,0,0,16,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,18,0,0,0,18,18,18,0,0,0,0,0,0,9,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,11,0,0,0,0,0,0,0,0,0,0,0,10,0,0,0,0,10,0,0,0,0,9,11,0,0,0,0,0,11,0,0,11,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,0,0,0,0,0,0,0,12,0,0,0,0,12,0,0,0,0,9,12,0,0,0,0,0,12,0,0,12,0,0,45,43,32,32,32,48,88,48,120,0,40,110,117,108,108,41,0,45,48,88,43,48,88,32,48,88,45,48,120,43,48,120,32,48,120,0,105,110,102,0,73,78,70,0,110,97,110,0,78,65,78,0,48,49,50,51,52,53,54,55,56,57,65,66,67,68,69,70,46,0,84,33,34,25,13,1,2,3,17,75,28,12,16,4,11,29,18,30,39,104,110,111,112,113,98,32,5,6,15,19,20,21,26,8,22,7,40,36,23,24,9,10,14,27,31,37,35,131,130,125,38,42,43,60,61,62,63,67,71,74,77,88,89,90,91,92,93,94,95,96,97,99,100,101,102,103,105,106,107,108,114,115,116,121,122,123,124,0,73,108,108,101,103,97,108,32,98,121,116,101,32,115,101,113,117,101,110,99,101,0,68,111,109,97,105,110,32,101,114,114,111,114,0,82,101,115,117,108,116,32,110,111,116,32,114,101,112,114,101,115,101,110,116,97,98,108,101,0,78,111,116,32,97,32,116,116,121,0,80,101,114,109,105,115,115,105,111,110,32,100,101,110,105,101,100,0,79,112,101,114,97,116,105,111,110,32,110,111,116,32,112,101,114,109,105,116,116,101,100,0,78,111,32,115,117,99,104,32,102,105,108,101,32,111,114,32,100,105,114,101,99,116,111,114,121,0,78,111,32,115,117,99,104,32,112,114,111,99,101,115,115,0,70,105,108,101,32,101,120,105,115,116,115,0,86,97,108,117,101,32,116,111,111,32,108,97,114,103,101,32,102,111,114,32,100,97,116,97,32,116,121,112,101,0,78,111,32,115,112,97,99,101,32,108,101,102,116,32,111,110,32,100,101,118,105,99,101,0,79,117,116,32,111,102,32,109,101,109,111,114,121,0,82,101,115,111,117,114,99,101,32,98,117,115,121,0,73,110,116,101,114,114,117,112,116,101,100,32,115,121,115,116,101,109,32,99,97,108,108,0,82,101,115,111,117,114,99,101,32,116,101,109,112,111,114,97,114,105,108,121,32,117,110,97,118,97,105,108,97,98,108,101,0,73,110,118,97,108,105,100,32,115,101,101,107,0,67,114,111,115,115,45,100,101,118,105,99,101,32,108,105,110,107,0,82,101,97,100,45,111,110,108,121,32,102,105,108,101,32,115,121,115,116,101,109,0,68,105,114,101,99,116,111,114,121,32,110,111,116,32,101,109,112,116,121,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,112,101,101,114,0,79,112,101,114,97,116,105,111,110,32,116,105,109,101,100,32,111,117,116,0,67,111,110,110,101,99,116,105,111,110,32,114,101,102,117,115,101,100,0,72,111,115,116,32,105,115,32,100,111,119,110,0,72,111,115,116,32,105,115,32,117,110,114,101,97,99,104,97,98,108,101,0,65,100,100,114,101,115,115,32,105,110,32,117,115,101,0,66,114,111,107,101,110,32,112,105,112,101,0,73,47,79,32,101,114,114,111,114,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,32,111,114,32,97,100,100,114,101,115,115,0,66,108,111,99,107,32,100,101,118,105,99,101,32,114,101,113,117,105,114,101,100,0,78,111,32,115,117,99,104,32,100,101,118,105,99,101,0,78,111,116,32,97,32,100,105,114,101,99,116,111,114,121,0,73,115,32,97,32,100,105,114,101,99,116,111,114,121,0,84,101,120,116,32,102,105,108,101,32,98,117,115,121,0,69,120,101,99,32,102,111,114,109,97,116,32,101,114,114,111,114,0,73,110,118,97,108,105,100,32,97,114,103,117,109,101,110,116,0,65,114,103,117,109,101,110,116,32,108,105,115,116,32,116,111,111,32,108,111,110,103,0,83,121,109,98,111,108,105,99,32,108,105,110,107,32,108,111,111,112,0,70,105,108,101,110,97,109,101,32,116,111,111,32,108,111,110,103,0,84,111,111,32,109,97,110,121,32,111,112,101,110,32,102,105,108,101,115,32,105,110,32,115,121,115,116,101,109,0,78,111,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,115,32,97,118,97,105,108,97,98,108,101,0,66,97,100,32,102,105,108,101,32,100,101,115,99,114,105,112,116,111,114,0,78,111,32,99,104,105,108,100,32,112,114,111,99,101,115,115,0,66,97,100,32,97,100,100,114,101,115,115,0,70,105,108,101,32,116,111,111,32,108,97,114,103,101,0,84,111,111,32,109,97,110,121,32,108,105,110,107,115,0,78,111,32,108,111,99,107,115,32,97,118,97,105,108,97,98,108,101,0,82,101,115,111,117,114,99,101,32,100,101,97,100,108,111,99,107,32,119,111,117,108,100,32,111,99,99,117,114,0,83,116,97,116,101,32,110,111,116,32,114,101,99,111,118,101,114,97,98,108,101,0,80,114,101,118,105,111,117,115,32,111,119,110,101,114,32,100,105,101,100,0,79,112,101,114,97,116,105,111,110,32,99,97,110,99,101,108,101,100,0,70,117,110,99,116,105,111,110,32,110,111,116,32,105,109,112,108,101,109,101,110,116,101,100,0,78,111,32,109,101,115,115,97,103,101,32,111,102,32,100,101,115,105,114,101,100,32,116,121,112,101,0,73,100,101,110,116,105,102,105,101,114,32,114,101,109,111,118,101,100,0,68,101,118,105,99,101,32,110,111,116,32,97,32,115,116,114,101,97,109,0,78,111,32,100,97,116,97,32,97,118,97,105,108,97,98,108,101,0,68,101,118,105,99,101,32,116,105,109,101,111,117,116,0,79,117,116,32,111,102,32,115,116,114,101,97,109,115,32,114,101,115,111,117,114,99,101,115,0,76,105,110,107,32,104,97,115,32,98,101,101,110,32,115,101,118,101,114,101,100,0,80,114,111,116,111,99,111,108,32,101,114,114,111,114,0,66,97,100,32,109,101,115,115,97,103,101,0,70,105,108,101,32,100,101,115,99,114,105,112,116,111,114,32,105,110,32,98,97,100,32,115,116,97,116,101,0,78,111,116,32,97,32,115,111,99,107,101,116,0,68,101,115,116,105,110,97,116,105,111,110,32,97,100,100,114,101,115,115,32,114,101,113,117,105,114,101,100,0,77,101,115,115,97,103,101,32,116,111,111,32,108,97,114,103,101,0,80,114,111,116,111,99,111,108,32,119,114,111,110,103,32,116,121,112,101,32,102,111,114,32,115,111,99,107,101,116,0,80,114,111,116,111,99,111,108,32,110,111,116,32,97,118,97,105,108,97,98,108,101,0,80,114,111,116,111,99,111,108,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,83,111,99,107,101,116,32,116,121,112,101,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,78,111,116,32,115,117,112,112,111,114,116,101,100,0,80,114,111,116,111,99,111,108,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,0,65,100,100,114,101,115,115,32,102,97,109,105,108,121,32,110,111,116,32,115,117,112,112,111,114,116,101,100,32,98,121,32,112,114,111,116,111,99,111,108,0,65,100,100,114,101,115,115,32,110], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+30720);
/* memory initializer */ allocate([111,116,32,97,118,97,105,108,97,98,108,101,0,78,101,116,119,111,114,107,32,105,115,32,100,111,119,110,0,78,101,116,119,111,114,107,32,117,110,114,101,97,99,104,97,98,108,101,0,67,111,110,110,101,99,116,105,111,110,32,114,101,115,101,116,32,98,121,32,110,101,116,119,111,114,107,0,67,111,110,110,101,99,116,105,111,110,32,97,98,111,114,116,101,100,0,78,111,32,98,117,102,102,101,114,32,115,112,97,99,101,32,97,118,97,105,108,97,98,108,101,0,83,111,99,107,101,116,32,105,115,32,99,111,110,110,101,99,116,101,100,0,83,111,99,107,101,116,32,110,111,116,32,99,111,110,110,101,99,116,101,100,0,67,97,110,110,111,116,32,115,101,110,100,32,97,102,116,101,114,32,115,111,99,107,101,116,32,115,104,117,116,100,111,119,110,0,79,112,101,114,97,116,105,111,110,32,97,108,114,101,97,100,121,32,105,110,32,112,114,111,103,114,101,115,115,0,79,112,101,114,97,116,105,111,110,32,105,110,32,112,114,111,103,114,101,115,115,0,83,116,97,108,101,32,102,105,108,101,32,104,97,110,100,108,101,0,82,101,109,111,116,101,32,73,47,79,32,101,114,114,111,114,0,81,117,111,116,97,32,101,120,99,101,101,100,101,100,0,78,111,32,109,101,100,105,117,109,32,102,111,117,110,100,0,87,114,111,110,103,32,109,101,100,105,117,109,32,116,121,112,101,0,78,111,32,101,114,114,111,114,32,105,110,102,111,114,109,97,116,105,111,110,0,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE+40960);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function _is_valid_lujvo() {
  Module['printErr']('missing function: is_valid_lujvo'); abort(-1);
  }

   

   

  function _is_vowel() {
  Module['printErr']('missing function: is_vowel'); abort(-1);
  }

  function _is_ccvcv() {
  Module['printErr']('missing function: is_ccvcv'); abort(-1);
  }

   

  function _is_cvv() {
  Module['printErr']('missing function: is_cvv'); abort(-1);
  }

   

   

  function _is_consonant() {
  Module['printErr']('missing function: is_consonant'); abort(-1);
  }

  function _is_cvc() {
  Module['printErr']('missing function: is_cvc'); abort(-1);
  }

  function _is_cvccv() {
  Module['printErr']('missing function: is_cvccv'); abort(-1);
  }

  function ___lock() {}

  function ___unlock() {}

  function _is_initialpairok() {
  Module['printErr']('missing function: is_initialpairok'); abort(-1);
  }

  
  
  var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_STATIC);   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    } 

  function _is_cvav() {
  Module['printErr']('missing function: is_cvav'); abort(-1);
  }

   

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

  function _is_ccv() {
  Module['printErr']('missing function: is_ccv'); abort(-1);
  }

  
  function __exit(status) {
      // void _exit(int status);
      // http://pubs.opengroup.org/onlinepubs/000095399/functions/exit.html
      Module['exit'](status);
    }function _exit(status) {
      __exit(status);
    }

  function _is_pairok() {
  Module['printErr']('missing function: is_pairok'); abort(-1);
  }

   

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");


function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_iii": nullFunc_iii, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_iii": invoke_iii, "_is_cvav": _is_cvav, "_is_vowel": _is_vowel, "_is_ccv": _is_ccv, "_is_cvv": _is_cvv, "___lock": ___lock, "_is_initialpairok": _is_initialpairok, "___setErrNo": ___setErrNo, "___syscall6": ___syscall6, "_is_ccvcv": _is_ccvcv, "_is_consonant": _is_consonant, "_is_valid_lujvo": _is_valid_lujvo, "___syscall146": ___syscall146, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "___syscall140": ___syscall140, "_is_pairok": _is_pairok, "__exit": __exit, "_exit": _exit, "_is_cvccv": _is_cvccv, "_is_cvc": _is_cvc, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "cttz_i8": cttz_i8 };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;
  var cttz_i8=env.cttz_i8|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_iii=env.nullFunc_iii;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_iii=env.invoke_iii;
  var _is_cvav=env._is_cvav;
  var _is_vowel=env._is_vowel;
  var _is_ccv=env._is_ccv;
  var _is_cvv=env._is_cvv;
  var ___lock=env.___lock;
  var _is_initialpairok=env._is_initialpairok;
  var ___setErrNo=env.___setErrNo;
  var ___syscall6=env.___syscall6;
  var _is_ccvcv=env._is_ccvcv;
  var _is_consonant=env._is_consonant;
  var _is_valid_lujvo=env._is_valid_lujvo;
  var ___syscall146=env.___syscall146;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var ___syscall140=env.___syscall140;
  var _is_pairok=env._is_pairok;
  var __exit=env.__exit;
  var _exit=env._exit;
  var _is_cvccv=env._is_cvccv;
  var _is_cvc=env._is_cvc;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _main($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer1 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(240|0);
 $vararg_buffer1 = sp + 8|0;
 $vararg_buffer = sp;
 $5 = sp + 16|0;
 $2 = 0;
 $3 = $0;
 $4 = $1;
 $6 = $5;
 while(1) {
  $7 = $4;
  $8 = ((($7)) + 4|0);
  $4 = $8;
  $9 = $3;
  $10 = (($9) + -1)|0;
  $3 = $10;
  $11 = ($10|0)!=(0);
  if (!($11)) {
   label = 12;
   break;
  }
  $12 = $4;
  $13 = HEAP32[$12>>2]|0;
  $14 = (_strcmp($13,23935)|0);
  $15 = ($14|0)!=(0);
  if (!($15)) {
   label = 4;
   break;
  }
  $17 = $4;
  $18 = HEAP32[$17>>2]|0;
  $19 = (_strcmp($18,23961)|0);
  $20 = ($19|0)!=(0);
  if (!($20)) {
   HEAP32[10331] = 1;
   continue;
  }
  $21 = $4;
  $22 = HEAP32[$21>>2]|0;
  $23 = (_strcmp($22,23964)|0);
  $24 = ($23|0)!=(0);
  if (!($24)) {
   HEAP32[10332] = 1;
   continue;
  }
  $25 = $4;
  $26 = HEAP32[$25>>2]|0;
  $27 = HEAP8[$26>>0]|0;
  $28 = $27 << 24 >> 24;
  $29 = ($28|0)==(45);
  if ($29) {
   label = 10;
   break;
  }
  $33 = $4;
  $34 = HEAP32[$33>>2]|0;
  $35 = $6;
  HEAP32[$35>>2] = $34;
  $36 = $6;
  $37 = ((($36)) + 4|0);
  $6 = $37;
 }
 if ((label|0) == 4) {
  $16 = HEAP32[5856]|0;
  HEAP32[$vararg_buffer>>2] = 23928;
  (_fprintf($16,23938,$vararg_buffer)|0);
  _exit(0);
  // unreachable;
 }
 else if ((label|0) == 10) {
  $30 = HEAP32[5856]|0;
  $31 = $4;
  $32 = HEAP32[$31>>2]|0;
  HEAP32[$vararg_buffer1>>2] = $32;
  (_fprintf($30,23967,$vararg_buffer1)|0);
  _exit(1);
  // unreachable;
 }
 else if ((label|0) == 12) {
  $38 = $6;
  HEAP32[$38>>2] = 0;
  _makelujvo($5);
  STACKTOP = sp;return 0;
 }
 return (0)|0;
}
function _makelujvo($0) {
 $0 = $0|0;
 var $$sink = 0, $$sink11 = 0, $$sink3 = 0, $$sink6 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0;
 var $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, $or$cond10 = 0, $or$cond13 = 0, $or$cond5 = 0, $or$cond8 = 0, $vararg_buffer = 0, $vararg_buffer14 = 0, $vararg_buffer16 = 0, $vararg_buffer19 = 0, $vararg_buffer21 = 0, $vararg_buffer23 = 0, $vararg_buffer25 = 0, $vararg_buffer27 = 0, $vararg_buffer30 = 0;
 var $vararg_ptr33 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 3024|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(3024|0);
 $vararg_buffer30 = sp + 64|0;
 $vararg_buffer27 = sp + 56|0;
 $vararg_buffer25 = sp + 48|0;
 $vararg_buffer23 = sp + 40|0;
 $vararg_buffer21 = sp + 32|0;
 $vararg_buffer19 = sp + 24|0;
 $vararg_buffer16 = sp + 16|0;
 $vararg_buffer14 = sp + 8|0;
 $vararg_buffer = sp;
 $2 = sp + 2724|0;
 $3 = sp + 1224|0;
 $4 = sp + 368|0;
 $5 = sp + 1172|0;
 $14 = sp + 136|0;
 $19 = sp + 872|0;
 $22 = sp + 572|0;
 $1 = $0;
 $7 = 0;
 while(1) {
  $32 = $1;
  $33 = HEAP32[$32>>2]|0;
  $34 = ($33|0)!=(0|0);
  $35 = $7;
  if (!($34)) {
   break;
  }
  $36 = (($2) + (($35*6)|0)|0);
  $37 = $1;
  $38 = HEAP32[$37>>2]|0;
  (_strcpy($36,$38)|0);
  $8 = 0;
  while(1) {
   $39 = $7;
   $40 = (($2) + (($39*6)|0)|0);
   $41 = $8;
   $42 = (($40) + ($41)|0);
   $43 = HEAP8[$42>>0]|0;
   $44 = ($43<<24>>24)!=(0);
   $45 = $7;
   $46 = (($2) + (($45*6)|0)|0);
   if (!($44)) {
    break;
   }
   $47 = $8;
   $48 = (($46) + ($47)|0);
   $49 = HEAP8[$48>>0]|0;
   $50 = $49 << 24 >> 24;
   $51 = (_tolower($50)|0);
   $52 = $51&255;
   $53 = $7;
   $54 = (($2) + (($53*6)|0)|0);
   $55 = $8;
   $56 = (($54) + ($55)|0);
   HEAP8[$56>>0] = $52;
   $57 = $7;
   $58 = (($2) + (($57*6)|0)|0);
   $59 = $8;
   $60 = (($58) + ($59)|0);
   $61 = HEAP8[$60>>0]|0;
   $62 = $61 << 24 >> 24;
   $63 = ($62|0)==(104);
   if ($63) {
    $64 = $7;
    $65 = (($2) + (($64*6)|0)|0);
    $66 = $8;
    $67 = (($65) + ($66)|0);
    HEAP8[$67>>0] = 39;
   }
   $68 = $8;
   $69 = (($68) + 1)|0;
   $8 = $69;
  }
  $70 = (_lookup_gismu($46)|0);
  $12 = $70;
  $71 = $12;
  $72 = ($71|0)<(0);
  if ($72) {
   label = 9;
   break;
  }
  $76 = $1;
  $77 = ((($76)) + 4|0);
  $1 = $77;
  $78 = $1;
  $79 = HEAP32[$78>>2]|0;
  $80 = ($79|0)!=(0|0);
  $81 = $80 ^ 1;
  $82 = $81&1;
  $11 = $82;
  $83 = $12;
  $84 = (8 + ($83<<2)|0);
  $85 = HEAP32[$84>>2]|0;
  $10 = $85;
  $86 = $12;
  $87 = (5752 + ($86<<2)|0);
  $88 = HEAP32[$87>>2]|0;
  $13 = $88;
  $89 = $11;
  $90 = ($89|0)!=(0);
  $8 = 0;
  $9 = 0;
  if ($90) {
   while(1) {
    $91 = $9;
    $92 = $10;
    $93 = ($91|0)<($92|0);
    if (!($93)) {
     break;
    }
    $94 = $13;
    $95 = $9;
    $96 = (($94) + ($95))|0;
    $97 = (11496 + ($96<<2)|0);
    $98 = HEAP32[$97>>2]|0;
    $99 = (_ends_in_vowel($98)|0);
    $100 = ($99|0)!=(0);
    if ($100) {
     $101 = $7;
     $102 = (($3) + (($101*30)|0)|0);
     $103 = $8;
     $104 = (($102) + (($103*6)|0)|0);
     $105 = $13;
     $106 = $9;
     $107 = (($105) + ($106))|0;
     $108 = (11496 + ($107<<2)|0);
     $109 = HEAP32[$108>>2]|0;
     (_strcpy($104,$109)|0);
     $110 = $8;
     $111 = (($110) + 1)|0;
     $8 = $111;
    }
    $112 = $9;
    $113 = (($112) + 1)|0;
    $9 = $113;
   }
   $114 = HEAP32[10332]|0;
   $115 = ($114|0)!=(0);
   $116 = $8;
   $117 = ($116|0)==(0);
   $or$cond = $115 | $117;
   if ($or$cond) {
    $118 = $7;
    $119 = (($2) + (($118*6)|0)|0);
    $120 = (_strlen($119)|0);
    $121 = ($120|0)==(5);
    if ($121) {
     $122 = $7;
     $123 = (($3) + (($122*30)|0)|0);
     $124 = $8;
     $125 = (($123) + (($124*6)|0)|0);
     $126 = $7;
     $127 = (($2) + (($126*6)|0)|0);
     (_strcpy($125,$127)|0);
     $128 = $8;
     $129 = (($128) + 1)|0;
     $8 = $129;
    }
   }
   $130 = $8;
   $131 = $7;
   $$sink = $130;$$sink3 = $131;
  } else {
   while(1) {
    $132 = $9;
    $133 = $10;
    $134 = ($132|0)<($133|0);
    if (!($134)) {
     break;
    }
    $135 = $7;
    $136 = (($3) + (($135*30)|0)|0);
    $137 = $8;
    $138 = (($136) + (($137*6)|0)|0);
    $139 = $13;
    $140 = $9;
    $141 = (($139) + ($140))|0;
    $142 = (11496 + ($141<<2)|0);
    $143 = HEAP32[$142>>2]|0;
    (_strcpy($138,$143)|0);
    $144 = $8;
    $145 = (($144) + 1)|0;
    $8 = $145;
    $146 = $9;
    $147 = (($146) + 1)|0;
    $9 = $147;
   }
   $148 = HEAP32[10332]|0;
   $149 = ($148|0)!=(0);
   $150 = $8;
   $151 = ($150|0)==(0);
   $or$cond5 = $149 | $151;
   if ($or$cond5) {
    $152 = $7;
    $153 = (($2) + (($152*6)|0)|0);
    $154 = (_strlen($153)|0);
    $155 = ($154|0)==(5);
    if ($155) {
     $156 = $7;
     $157 = (($3) + (($156*30)|0)|0);
     $158 = $8;
     $159 = (($157) + (($158*6)|0)|0);
     $160 = $7;
     $161 = (($2) + (($160*6)|0)|0);
     (_strcpy($159,$161)|0);
     $162 = $7;
     $163 = (($3) + (($162*30)|0)|0);
     $164 = $8;
     $165 = (($163) + (($164*6)|0)|0);
     _chop_last_char($165);
     $166 = $8;
     $167 = (($166) + 1)|0;
     $8 = $167;
    }
   }
   $168 = $8;
   $169 = $7;
   $$sink = $168;$$sink3 = $169;
  }
  $170 = (($4) + ($$sink3<<2)|0);
  HEAP32[$170>>2] = $$sink;
  $171 = $7;
  $172 = (($171) + 1)|0;
  $7 = $172;
 }
 if ((label|0) == 9) {
  $73 = HEAP32[5856]|0;
  $74 = $7;
  $75 = (($2) + (($74*6)|0)|0);
  HEAP32[$vararg_buffer>>2] = $75;
  (_fprintf($73,24004,$vararg_buffer)|0);
  _exit(1);
  // unreachable;
 }
 $6 = $35;
 (_printf(24048,$vararg_buffer14)|0);
 $7 = 0;
 while(1) {
  $173 = $7;
  $174 = $6;
  $175 = ($173|0)<($174|0);
  if (!($175)) {
   break;
  }
  $8 = 0;
  while(1) {
   $176 = $8;
   $177 = $7;
   $178 = (($4) + ($177<<2)|0);
   $179 = HEAP32[$178>>2]|0;
   $180 = ($176|0)<($179|0);
   if (!($180)) {
    break;
   }
   $181 = $7;
   $182 = (($3) + (($181*30)|0)|0);
   $183 = $8;
   $184 = (($182) + (($183*6)|0)|0);
   HEAP32[$vararg_buffer16>>2] = $184;
   (_printf(24082,$vararg_buffer16)|0);
   $185 = $8;
   $186 = (($185) + 1)|0;
   $8 = $186;
  }
  (_printf(24086,$vararg_buffer19)|0);
  $187 = $7;
  $188 = (($187) + 1)|0;
  $7 = $188;
 }
 (_printf(24088,$vararg_buffer21)|0);
 (_printf(24110,$vararg_buffer23)|0);
 (_printf(24088,$vararg_buffer25)|0);
 $7 = 0;
 while(1) {
  $189 = $7;
  $190 = $6;
  $191 = ($189|0)<($190|0);
  if (!($191)) {
   break;
  }
  $192 = $7;
  $193 = (($14) + ($192<<2)|0);
  HEAP32[$193>>2] = 0;
  $194 = $7;
  $195 = (($194) + 1)|0;
  $7 = $195;
 }
 L47: while(1) {
  $7 = 0;
  while(1) {
   $196 = $7;
   $197 = $6;
   $198 = ($196|0)<($197|0);
   if (!($198)) {
    break;
   }
   $199 = $7;
   $200 = (($5) + ($199)|0);
   HEAP8[$200>>0] = 0;
   $201 = $7;
   $202 = (($201) + 1)|0;
   $7 = $202;
  }
  $203 = $6;
  $204 = ($203|0)>(2);
  do {
   if ($204) {
    $205 = HEAP32[$14>>2]|0;
    $206 = (($3) + (($205*6)|0)|0);
    $207 = (_is_cvv(($206|0))|0);
    $208 = ($207|0)!=(0);
    if (!($208)) {
     $209 = HEAP32[$14>>2]|0;
     $210 = (($3) + (($209*6)|0)|0);
     $211 = (_is_cvav(($210|0))|0);
     $212 = ($211|0)!=(0);
     if (!($212)) {
      label = 42;
      break;
     }
    }
    $213 = ((($3)) + 30|0);
    $214 = ((($14)) + 4|0);
    $215 = HEAP32[$214>>2]|0;
    $216 = (($213) + (($215*6)|0)|0);
    $217 = HEAP8[$216>>0]|0;
    $218 = $217 << 24 >> 24;
    $219 = ($218|0)==(114);
    $$sink6 = $219 ? 110 : 114;
    HEAP8[$5>>0] = $$sink6;
   } else {
    label = 42;
   }
  } while(0);
  if ((label|0) == 42) {
   label = 0;
   $220 = $6;
   $221 = ($220|0)==(2);
   $222 = $221&1;
   $15 = $222;
   $223 = HEAP32[$14>>2]|0;
   $224 = (($3) + (($223*6)|0)|0);
   $225 = (_is_cvv(($224|0))|0);
   $226 = ($225|0)!=(0);
   if ($226) {
    $232 = 1;
   } else {
    $227 = HEAP32[$14>>2]|0;
    $228 = (($3) + (($227*6)|0)|0);
    $229 = (_is_cvav(($228|0))|0);
    $230 = ($229|0)!=(0);
    $232 = $230;
   }
   $231 = $232&1;
   $16 = $231;
   $233 = ((($3)) + 30|0);
   $234 = ((($14)) + 4|0);
   $235 = HEAP32[$234>>2]|0;
   $236 = (($233) + (($235*6)|0)|0);
   $237 = (_is_ccv(($236|0))|0);
   $17 = $237;
   $238 = ((($3)) + 30|0);
   $239 = ((($14)) + 4|0);
   $240 = HEAP32[$239>>2]|0;
   $241 = (($238) + (($240*6)|0)|0);
   $242 = (_is_ccvcv(($241|0))|0);
   $18 = $242;
   $243 = $15;
   $244 = ($243|0)!=(0);
   $245 = $16;
   $246 = ($245|0)!=(0);
   $or$cond8 = $244 & $246;
   if ($or$cond8) {
    $247 = $17;
    $248 = ($247|0)==(0);
    $249 = $18;
    $250 = ($249|0)!=(0);
    $or$cond10 = $248 | $250;
    if ($or$cond10) {
     $251 = ((($3)) + 30|0);
     $252 = ((($14)) + 4|0);
     $253 = HEAP32[$252>>2]|0;
     $254 = (($251) + (($253*6)|0)|0);
     $255 = HEAP8[$254>>0]|0;
     $256 = $255 << 24 >> 24;
     $257 = ($256|0)==(114);
     $$sink11 = $257 ? 110 : 114;
     HEAP8[$5>>0] = $$sink11;
    }
   }
  }
  $7 = 0;
  while(1) {
   $258 = $7;
   $259 = $6;
   $260 = (($259) - 1)|0;
   $261 = ($258|0)<($260|0);
   if (!($261)) {
    break;
   }
   $262 = $7;
   $263 = (($5) + ($262)|0);
   $264 = HEAP8[$263>>0]|0;
   $265 = $264 << 24 >> 24;
   $266 = ($265|0)==(0);
   if ($266) {
    $267 = $7;
    $268 = (($3) + (($267*30)|0)|0);
    $269 = $7;
    $270 = (($14) + ($269<<2)|0);
    $271 = HEAP32[$270>>2]|0;
    $272 = (($268) + (($271*6)|0)|0);
    $273 = $7;
    $274 = (($273) + 1)|0;
    $275 = (($3) + (($274*30)|0)|0);
    $276 = $7;
    $277 = (($276) + 1)|0;
    $278 = (($14) + ($277<<2)|0);
    $279 = HEAP32[$278>>2]|0;
    $280 = (($275) + (($279*6)|0)|0);
    $281 = (_can_join($272,$280)|0);
    $282 = ($281|0)!=(0);
    if (!($282)) {
     $283 = $7;
     $284 = (($5) + ($283)|0);
     HEAP8[$284>>0] = 121;
    }
   }
   $285 = $7;
   $286 = (($285) + 1)|0;
   $7 = $286;
  }
  $7 = 0;
  while(1) {
   $287 = $7;
   $288 = $6;
   $289 = (($288) - 1)|0;
   $290 = ($287|0)<($289|0);
   if (!($290)) {
    break;
   }
   $291 = $7;
   $292 = (($3) + (($291*30)|0)|0);
   $293 = $7;
   $294 = (($14) + ($293<<2)|0);
   $295 = HEAP32[$294>>2]|0;
   $296 = (($292) + (($295*6)|0)|0);
   $297 = (_strlen($296)|0);
   $298 = ($297|0)==(4);
   if ($298) {
    $299 = $7;
    $300 = (($3) + (($299*30)|0)|0);
    $301 = $7;
    $302 = (($14) + ($301<<2)|0);
    $303 = HEAP32[$302>>2]|0;
    $304 = (($300) + (($303*6)|0)|0);
    $305 = ((($304)) + 2|0);
    $306 = HEAP8[$305>>0]|0;
    $307 = $306 << 24 >> 24;
    $308 = ($307|0)!=(39);
    if ($308) {
     $309 = $7;
     $310 = (($5) + ($309)|0);
     HEAP8[$310>>0] = 121;
    }
   }
   $311 = $7;
   $312 = (($311) + 1)|0;
   $7 = $312;
  }
  $313 = HEAP32[$14>>2]|0;
  $314 = (($3) + (($313*6)|0)|0);
  $315 = (_is_cvc(($314|0))|0);
  $316 = ($315|0)!=(0);
  if ($316) {
   $20 = $19;
   $317 = HEAP32[$14>>2]|0;
   $318 = (($3) + (($317*6)|0)|0);
   $319 = ((($318)) + 2|0);
   $320 = HEAP8[$319>>0]|0;
   $321 = $20;
   $322 = ((($321)) + 1|0);
   $20 = $322;
   HEAP8[$321>>0] = $320;
   $323 = HEAP8[$5>>0]|0;
   $324 = ($323<<24>>24)!=(0);
   if (!($324)) {
    $7 = 1;
    while(1) {
     $325 = $7;
     $326 = $6;
     $327 = ($325|0)<($326|0);
     if (!($327)) {
      break;
     }
     $328 = $7;
     $329 = (($3) + (($328*30)|0)|0);
     $330 = $7;
     $331 = (($14) + ($330<<2)|0);
     $332 = HEAP32[$331>>2]|0;
     $333 = (($329) + (($332*6)|0)|0);
     $21 = $333;
     while(1) {
      $334 = $21;
      $335 = HEAP8[$334>>0]|0;
      $336 = ($335<<24>>24)!=(0);
      if (!($336)) {
       break;
      }
      $337 = $21;
      $338 = HEAP8[$337>>0]|0;
      $339 = $20;
      $340 = ((($339)) + 1|0);
      $20 = $340;
      HEAP8[$339>>0] = $338;
      $341 = $21;
      $342 = ((($341)) + 1|0);
      $21 = $342;
     }
     $343 = $7;
     $344 = $6;
     $345 = (($344) - 1)|0;
     $346 = ($343|0)<($345|0);
     if ($346) {
      $347 = $7;
      $348 = (($5) + ($347)|0);
      $349 = HEAP8[$348>>0]|0;
      $350 = $349 << 24 >> 24;
      $351 = ($350|0)!=(0);
      if ($351) {
       $352 = $7;
       $353 = (($5) + ($352)|0);
       $354 = HEAP8[$353>>0]|0;
       $355 = $20;
       $356 = ((($355)) + 1|0);
       $20 = $356;
       HEAP8[$355>>0] = $354;
      }
     }
     $357 = $7;
     $358 = (($357) + 1)|0;
     $7 = $358;
    }
    $359 = $20;
    HEAP8[$359>>0] = 0;
    $360 = (_is_valid_lujvo(($19|0))|0);
    $361 = ($360|0)!=(0);
    if ($361) {
     HEAP8[$5>>0] = 121;
    }
   }
  }
  $23 = $22;
  $7 = 0;
  while(1) {
   $362 = $7;
   $363 = $6;
   $364 = ($362|0)<($363|0);
   if (!($364)) {
    break;
   }
   $365 = $7;
   $366 = (($3) + (($365*30)|0)|0);
   $367 = $7;
   $368 = (($14) + ($367<<2)|0);
   $369 = HEAP32[$368>>2]|0;
   $370 = (($366) + (($369*6)|0)|0);
   $24 = $370;
   while(1) {
    $371 = $24;
    $372 = HEAP8[$371>>0]|0;
    $373 = ($372<<24>>24)!=(0);
    if (!($373)) {
     break;
    }
    $374 = $24;
    $375 = HEAP8[$374>>0]|0;
    $376 = $23;
    $377 = ((($376)) + 1|0);
    $23 = $377;
    HEAP8[$376>>0] = $375;
    $378 = $24;
    $379 = ((($378)) + 1|0);
    $24 = $379;
   }
   $380 = $7;
   $381 = $6;
   $382 = (($381) - 1)|0;
   $383 = ($380|0)<($382|0);
   if ($383) {
    $384 = $7;
    $385 = (($5) + ($384)|0);
    $386 = HEAP8[$385>>0]|0;
    $387 = $386 << 24 >> 24;
    $388 = ($387|0)!=(0);
    if ($388) {
     $389 = $7;
     $390 = (($5) + ($389)|0);
     $391 = HEAP8[$390>>0]|0;
     $392 = $23;
     $393 = ((($392)) + 1|0);
     $23 = $393;
     HEAP8[$392>>0] = $391;
    }
   }
   $394 = $7;
   $395 = (($394) + 1)|0;
   $7 = $395;
  }
  $396 = $23;
  HEAP8[$396>>0] = 0;
  $397 = (_strlen($22)|0);
  $398 = (($397) + 1)|0;
  $399 = (_malloc($398)|0);
  $400 = HEAP32[141405]|0;
  $401 = (41332 + ($400<<3)|0);
  HEAP32[$401>>2] = $399;
  $402 = HEAP32[141405]|0;
  $403 = (41332 + ($402<<3)|0);
  $404 = HEAP32[$403>>2]|0;
  (_strcpy($404,$22)|0);
  $29 = 0;
  $28 = 0;
  $27 = 0;
  $26 = 0;
  $25 = 0;
  $7 = 0;
  while(1) {
   $405 = $7;
   $406 = $6;
   $407 = ($405|0)<($406|0);
   if (!($407)) {
    break;
   }
   $408 = $7;
   $409 = (($3) + (($408*30)|0)|0);
   $410 = $7;
   $411 = (($14) + ($410<<2)|0);
   $412 = HEAP32[$411>>2]|0;
   $413 = (($409) + (($412*6)|0)|0);
   $414 = (_strlen($413)|0);
   $415 = $25;
   $416 = (($415) + ($414))|0;
   $25 = $416;
   $8 = 0;
   while(1) {
    $417 = $7;
    $418 = (($3) + (($417*30)|0)|0);
    $419 = $7;
    $420 = (($14) + ($419<<2)|0);
    $421 = HEAP32[$420>>2]|0;
    $422 = (($418) + (($421*6)|0)|0);
    $423 = $8;
    $424 = (($422) + ($423)|0);
    $425 = HEAP8[$424>>0]|0;
    $426 = ($425<<24>>24)!=(0);
    $427 = $7;
    if (!($426)) {
     break;
    }
    $428 = (($3) + (($427*30)|0)|0);
    $429 = $7;
    $430 = (($14) + ($429<<2)|0);
    $431 = HEAP32[$430>>2]|0;
    $432 = (($428) + (($431*6)|0)|0);
    $433 = $8;
    $434 = (($432) + ($433)|0);
    $435 = HEAP8[$434>>0]|0;
    $436 = $435 << 24 >> 24;
    $437 = ($436|0)==(39);
    if ($437) {
     $438 = $26;
     $439 = (($438) + 1)|0;
     $26 = $439;
    }
    $440 = $7;
    $441 = (($3) + (($440*30)|0)|0);
    $442 = $7;
    $443 = (($14) + ($442<<2)|0);
    $444 = HEAP32[$443>>2]|0;
    $445 = (($441) + (($444*6)|0)|0);
    $446 = $8;
    $447 = (($445) + ($446)|0);
    $448 = HEAP8[$447>>0]|0;
    $449 = $448 << 24 >> 24;
    $450 = (_strchr(24125,$449)|0);
    $451 = ($450|0)!=(0|0);
    if ($451) {
     $452 = $29;
     $453 = (($452) + 1)|0;
     $29 = $453;
    }
    $454 = $8;
    $455 = (($454) + 1)|0;
    $8 = $455;
   }
   $456 = $6;
   $457 = (($456) - 1)|0;
   $458 = ($427|0)<($457|0);
   if ($458) {
    $459 = $7;
    $460 = (($5) + ($459)|0);
    $461 = HEAP8[$460>>0]|0;
    $462 = $461 << 24 >> 24;
    $463 = ($462|0)!=(0);
    if ($463) {
     $464 = $27;
     $465 = (($464) + 1)|0;
     $27 = $465;
     $466 = $25;
     $467 = (($466) + 1)|0;
     $25 = $467;
    }
   }
   $468 = $7;
   $469 = (($3) + (($468*30)|0)|0);
   $470 = $7;
   $471 = (($14) + ($470<<2)|0);
   $472 = HEAP32[$471>>2]|0;
   $473 = (($469) + (($472*6)|0)|0);
   $474 = (_is_cvccv(($473|0))|0);
   $475 = ($474|0)!=(0);
   do {
    if ($475) {
     $30 = 1;
    } else {
     $476 = $7;
     $477 = (($3) + (($476*30)|0)|0);
     $478 = $7;
     $479 = (($14) + ($478<<2)|0);
     $480 = HEAP32[$479>>2]|0;
     $481 = (($477) + (($480*6)|0)|0);
     $482 = (_is_ccvcv(($481|0))|0);
     $483 = ($482|0)!=(0);
     if ($483) {
      $30 = 3;
      break;
     }
     $484 = $7;
     $485 = (($3) + (($484*30)|0)|0);
     $486 = $7;
     $487 = (($14) + ($486<<2)|0);
     $488 = HEAP32[$487>>2]|0;
     $489 = (($485) + (($488*6)|0)|0);
     $490 = (_strlen($489)|0);
     $491 = ($490|0)==(4);
     if ($491) {
      $492 = $7;
      $493 = (($3) + (($492*30)|0)|0);
      $494 = $7;
      $495 = (($14) + ($494<<2)|0);
      $496 = HEAP32[$495>>2]|0;
      $497 = (($493) + (($496*6)|0)|0);
      $498 = HEAP8[$497>>0]|0;
      $499 = (_is_consonant(($498|0))|0);
      $500 = ($499|0)!=(0);
      if ($500) {
       $501 = $7;
       $502 = (($3) + (($501*30)|0)|0);
       $503 = $7;
       $504 = (($14) + ($503<<2)|0);
       $505 = HEAP32[$504>>2]|0;
       $506 = (($502) + (($505*6)|0)|0);
       $507 = ((($506)) + 1|0);
       $508 = HEAP8[$507>>0]|0;
       $509 = (_is_vowel(($508|0))|0);
       $510 = ($509|0)!=(0);
       if ($510) {
        $511 = $7;
        $512 = (($3) + (($511*30)|0)|0);
        $513 = $7;
        $514 = (($14) + ($513<<2)|0);
        $515 = HEAP32[$514>>2]|0;
        $516 = (($512) + (($515*6)|0)|0);
        $517 = ((($516)) + 2|0);
        $518 = HEAP8[$517>>0]|0;
        $519 = (_is_consonant(($518|0))|0);
        $520 = ($519|0)!=(0);
        if ($520) {
         $521 = $7;
         $522 = (($3) + (($521*30)|0)|0);
         $523 = $7;
         $524 = (($14) + ($523<<2)|0);
         $525 = HEAP32[$524>>2]|0;
         $526 = (($522) + (($525*6)|0)|0);
         $527 = ((($526)) + 3|0);
         $528 = HEAP8[$527>>0]|0;
         $529 = (_is_consonant(($528|0))|0);
         $530 = ($529|0)!=(0);
         if ($530) {
          $30 = 2;
          break;
         }
        }
       }
      }
     }
     $531 = $7;
     $532 = (($3) + (($531*30)|0)|0);
     $533 = $7;
     $534 = (($14) + ($533<<2)|0);
     $535 = HEAP32[$534>>2]|0;
     $536 = (($532) + (($535*6)|0)|0);
     $537 = (_strlen($536)|0);
     $538 = ($537|0)==(4);
     if ($538) {
      $539 = $7;
      $540 = (($3) + (($539*30)|0)|0);
      $541 = $7;
      $542 = (($14) + ($541<<2)|0);
      $543 = HEAP32[$542>>2]|0;
      $544 = (($540) + (($543*6)|0)|0);
      $545 = HEAP8[$544>>0]|0;
      $546 = (_is_consonant(($545|0))|0);
      $547 = ($546|0)!=(0);
      if ($547) {
       $548 = $7;
       $549 = (($3) + (($548*30)|0)|0);
       $550 = $7;
       $551 = (($14) + ($550<<2)|0);
       $552 = HEAP32[$551>>2]|0;
       $553 = (($549) + (($552*6)|0)|0);
       $554 = ((($553)) + 1|0);
       $555 = HEAP8[$554>>0]|0;
       $556 = (_is_consonant(($555|0))|0);
       $557 = ($556|0)!=(0);
       if ($557) {
        $558 = $7;
        $559 = (($3) + (($558*30)|0)|0);
        $560 = $7;
        $561 = (($14) + ($560<<2)|0);
        $562 = HEAP32[$561>>2]|0;
        $563 = (($559) + (($562*6)|0)|0);
        $564 = ((($563)) + 2|0);
        $565 = HEAP8[$564>>0]|0;
        $566 = (_is_vowel(($565|0))|0);
        $567 = ($566|0)!=(0);
        if ($567) {
         $568 = $7;
         $569 = (($3) + (($568*30)|0)|0);
         $570 = $7;
         $571 = (($14) + ($570<<2)|0);
         $572 = HEAP32[$571>>2]|0;
         $573 = (($569) + (($572*6)|0)|0);
         $574 = ((($573)) + 3|0);
         $575 = HEAP8[$574>>0]|0;
         $576 = (_is_consonant(($575|0))|0);
         $577 = ($576|0)!=(0);
         if ($577) {
          $30 = 4;
          break;
         }
        }
       }
      }
     }
     $578 = $7;
     $579 = (($3) + (($578*30)|0)|0);
     $580 = $7;
     $581 = (($14) + ($580<<2)|0);
     $582 = HEAP32[$581>>2]|0;
     $583 = (($579) + (($582*6)|0)|0);
     $584 = (_strlen($583)|0);
     $585 = ($584|0)==(4);
     if ($585) {
      $586 = $7;
      $587 = (($3) + (($586*30)|0)|0);
      $588 = $7;
      $589 = (($14) + ($588<<2)|0);
      $590 = HEAP32[$589>>2]|0;
      $591 = (($587) + (($590*6)|0)|0);
      $592 = HEAP8[$591>>0]|0;
      $593 = (_is_consonant(($592|0))|0);
      $594 = ($593|0)!=(0);
      if ($594) {
       $595 = $7;
       $596 = (($3) + (($595*30)|0)|0);
       $597 = $7;
       $598 = (($14) + ($597<<2)|0);
       $599 = HEAP32[$598>>2]|0;
       $600 = (($596) + (($599*6)|0)|0);
       $601 = ((($600)) + 1|0);
       $602 = HEAP8[$601>>0]|0;
       $603 = (_is_vowel(($602|0))|0);
       $604 = ($603|0)!=(0);
       if ($604) {
        $605 = $7;
        $606 = (($3) + (($605*30)|0)|0);
        $607 = $7;
        $608 = (($14) + ($607<<2)|0);
        $609 = HEAP32[$608>>2]|0;
        $610 = (($606) + (($609*6)|0)|0);
        $611 = ((($610)) + 2|0);
        $612 = HEAP8[$611>>0]|0;
        $613 = $612 << 24 >> 24;
        $614 = ($613|0)==(39);
        if ($614) {
         $615 = $7;
         $616 = (($3) + (($615*30)|0)|0);
         $617 = $7;
         $618 = (($14) + ($617<<2)|0);
         $619 = HEAP32[$618>>2]|0;
         $620 = (($616) + (($619*6)|0)|0);
         $621 = ((($620)) + 3|0);
         $622 = HEAP8[$621>>0]|0;
         $623 = (_is_vowel(($622|0))|0);
         $624 = ($623|0)!=(0);
         if ($624) {
          $30 = 6;
          break;
         }
        }
       }
      }
     }
     $625 = $7;
     $626 = (($3) + (($625*30)|0)|0);
     $627 = $7;
     $628 = (($14) + ($627<<2)|0);
     $629 = HEAP32[$628>>2]|0;
     $630 = (($626) + (($629*6)|0)|0);
     $631 = (_strlen($630)|0);
     $632 = ($631|0)==(3);
     if ($632) {
      $633 = $7;
      $634 = (($3) + (($633*30)|0)|0);
      $635 = $7;
      $636 = (($14) + ($635<<2)|0);
      $637 = HEAP32[$636>>2]|0;
      $638 = (($634) + (($637*6)|0)|0);
      $639 = HEAP8[$638>>0]|0;
      $640 = (_is_consonant(($639|0))|0);
      $641 = ($640|0)!=(0);
      if ($641) {
       $642 = $7;
       $643 = (($3) + (($642*30)|0)|0);
       $644 = $7;
       $645 = (($14) + ($644<<2)|0);
       $646 = HEAP32[$645>>2]|0;
       $647 = (($643) + (($646*6)|0)|0);
       $648 = ((($647)) + 1|0);
       $649 = HEAP8[$648>>0]|0;
       $650 = (_is_vowel(($649|0))|0);
       $651 = ($650|0)!=(0);
       if ($651) {
        $652 = $7;
        $653 = (($3) + (($652*30)|0)|0);
        $654 = $7;
        $655 = (($14) + ($654<<2)|0);
        $656 = HEAP32[$655>>2]|0;
        $657 = (($653) + (($656*6)|0)|0);
        $658 = ((($657)) + 2|0);
        $659 = HEAP8[$658>>0]|0;
        $660 = (_is_consonant(($659|0))|0);
        $661 = ($660|0)!=(0);
        if ($661) {
         $30 = 5;
         break;
        }
       }
      }
     }
     $662 = $7;
     $663 = (($3) + (($662*30)|0)|0);
     $664 = $7;
     $665 = (($14) + ($664<<2)|0);
     $666 = HEAP32[$665>>2]|0;
     $667 = (($663) + (($666*6)|0)|0);
     $668 = (_strlen($667)|0);
     $669 = ($668|0)==(3);
     if ($669) {
      $670 = $7;
      $671 = (($3) + (($670*30)|0)|0);
      $672 = $7;
      $673 = (($14) + ($672<<2)|0);
      $674 = HEAP32[$673>>2]|0;
      $675 = (($671) + (($674*6)|0)|0);
      $676 = HEAP8[$675>>0]|0;
      $677 = (_is_consonant(($676|0))|0);
      $678 = ($677|0)!=(0);
      if ($678) {
       $679 = $7;
       $680 = (($3) + (($679*30)|0)|0);
       $681 = $7;
       $682 = (($14) + ($681<<2)|0);
       $683 = HEAP32[$682>>2]|0;
       $684 = (($680) + (($683*6)|0)|0);
       $685 = ((($684)) + 1|0);
       $686 = HEAP8[$685>>0]|0;
       $687 = (_is_consonant(($686|0))|0);
       $688 = ($687|0)!=(0);
       if ($688) {
        $689 = $7;
        $690 = (($3) + (($689*30)|0)|0);
        $691 = $7;
        $692 = (($14) + ($691<<2)|0);
        $693 = HEAP32[$692>>2]|0;
        $694 = (($690) + (($693*6)|0)|0);
        $695 = ((($694)) + 2|0);
        $696 = HEAP8[$695>>0]|0;
        $697 = (_is_vowel(($696|0))|0);
        $698 = ($697|0)!=(0);
        if ($698) {
         $30 = 7;
         break;
        }
       }
      }
     }
     $699 = $7;
     $700 = (($3) + (($699*30)|0)|0);
     $701 = $7;
     $702 = (($14) + ($701<<2)|0);
     $703 = HEAP32[$702>>2]|0;
     $704 = (($700) + (($703*6)|0)|0);
     $705 = (_strlen($704)|0);
     $706 = ($705|0)==(3);
     if (!($706)) {
      label = 130;
      break L47;
     }
     $707 = $7;
     $708 = (($3) + (($707*30)|0)|0);
     $709 = $7;
     $710 = (($14) + ($709<<2)|0);
     $711 = HEAP32[$710>>2]|0;
     $712 = (($708) + (($711*6)|0)|0);
     $713 = HEAP8[$712>>0]|0;
     $714 = (_is_consonant(($713|0))|0);
     $715 = ($714|0)!=(0);
     if (!($715)) {
      label = 130;
      break L47;
     }
     $716 = $7;
     $717 = (($3) + (($716*30)|0)|0);
     $718 = $7;
     $719 = (($14) + ($718<<2)|0);
     $720 = HEAP32[$719>>2]|0;
     $721 = (($717) + (($720*6)|0)|0);
     $722 = ((($721)) + 1|0);
     $723 = HEAP8[$722>>0]|0;
     $724 = (_is_vowel(($723|0))|0);
     $725 = ($724|0)!=(0);
     if (!($725)) {
      label = 130;
      break L47;
     }
     $726 = $7;
     $727 = (($3) + (($726*30)|0)|0);
     $728 = $7;
     $729 = (($14) + ($728<<2)|0);
     $730 = HEAP32[$729>>2]|0;
     $731 = (($727) + (($730*6)|0)|0);
     $732 = ((($731)) + 2|0);
     $733 = HEAP8[$732>>0]|0;
     $734 = (_is_vowel(($733|0))|0);
     $735 = ($734|0)!=(0);
     if (!($735)) {
      label = 130;
      break L47;
     }
     $30 = 8;
    }
   } while(0);
   $743 = $30;
   $744 = $28;
   $745 = (($744) + ($743))|0;
   $28 = $745;
   $746 = $7;
   $747 = (($746) + 1)|0;
   $7 = $747;
  }
  $748 = $25;
  $749 = ($748*1000)|0;
  $750 = $26;
  $751 = ($750*500)|0;
  $752 = (($749) - ($751))|0;
  $753 = $27;
  $754 = ($753*100)|0;
  $755 = (($752) + ($754))|0;
  $756 = $28;
  $757 = ($756*10)|0;
  $758 = (($755) - ($757))|0;
  $759 = $29;
  $760 = (($758) - ($759))|0;
  $761 = HEAP32[141405]|0;
  $762 = (41332 + ($761<<3)|0);
  $763 = ((($762)) + 4|0);
  HEAP32[$763>>2] = $760;
  $764 = HEAP32[141405]|0;
  $765 = (($764) + 1)|0;
  HEAP32[141405] = $765;
  $31 = 1;
  $7 = 0;
  while(1) {
   $766 = $7;
   $767 = $6;
   $768 = ($766|0)<($767|0);
   if (!($768)) {
    break;
   }
   $769 = $7;
   $770 = (($14) + ($769<<2)|0);
   $771 = HEAP32[$770>>2]|0;
   $772 = (($771) + 1)|0;
   HEAP32[$770>>2] = $772;
   $773 = $7;
   $774 = (($14) + ($773<<2)|0);
   $775 = HEAP32[$774>>2]|0;
   $776 = $7;
   $777 = (($4) + ($776<<2)|0);
   $778 = HEAP32[$777>>2]|0;
   $779 = ($775|0)==($778|0);
   if (!($779)) {
    label = 136;
    break;
   }
   $780 = $7;
   $781 = (($14) + ($780<<2)|0);
   HEAP32[$781>>2] = 0;
   $782 = $7;
   $783 = (($782) + 1)|0;
   $7 = $783;
  }
  if ((label|0) == 136) {
   label = 0;
   $31 = 0;
  }
  $784 = $31;
  $785 = ($784|0)!=(0);
  if ($785) {
   label = 138;
   break;
  }
 }
 if ((label|0) == 130) {
  $736 = HEAP32[5856]|0;
  $737 = $7;
  $738 = (($3) + (($737*30)|0)|0);
  $739 = $7;
  $740 = (($14) + ($739<<2)|0);
  $741 = HEAP32[$740>>2]|0;
  $742 = (($738) + (($741*6)|0)|0);
  HEAP32[$vararg_buffer27>>2] = $742;
  (_fprintf($736,24131,$vararg_buffer27)|0);
  _exit(1);
  // unreachable;
 }
 else if ((label|0) == 138) {
  $786 = HEAP32[141405]|0;
  _qsort(41332,$786,8,5);
  $787 = HEAP32[10331]|0;
  $788 = ($787|0)==(0);
  $789 = HEAP32[141405]|0;
  $790 = ($789|0)>(8);
  $or$cond13 = $788 & $790;
  if ($or$cond13) {
   HEAP32[141405] = 8;
  }
  $7 = 0;
  while(1) {
   $791 = $7;
   $792 = HEAP32[141405]|0;
   $793 = ($791|0)<($792|0);
   if (!($793)) {
    break;
   }
   $794 = $7;
   $795 = (41332 + ($794<<3)|0);
   $796 = ((($795)) + 4|0);
   $797 = HEAP32[$796>>2]|0;
   $798 = $7;
   $799 = (41332 + ($798<<3)|0);
   $800 = HEAP32[$799>>2]|0;
   HEAP32[$vararg_buffer30>>2] = $797;
   $vararg_ptr33 = ((($vararg_buffer30)) + 4|0);
   HEAP32[$vararg_ptr33>>2] = $800;
   (_printf(24153,$vararg_buffer30)|0);
   $801 = $7;
   $802 = (($801) + 1)|0;
   $7 = $802;
  }
  STACKTOP = sp;return;
 }
}
function _lookup_gismu($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $2 = $0;
 $3 = 1436;
 $5 = 0;
 $4 = 0;
 while(1) {
  $6 = $4;
  $7 = $3;
  $8 = ($6|0)<($7|0);
  if (!($8)) {
   break;
  }
  $9 = $4;
  $10 = (17680 + ($9<<2)|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = $2;
  $13 = (_strcmp($11,$12)|0);
  $14 = ($13|0)!=(0);
  if (!($14)) {
   label = 4;
   break;
  }
  $15 = $4;
  $16 = (($15) + 1)|0;
  $4 = $16;
 }
 if ((label|0) == 4) {
  $5 = 1;
 }
 $17 = $5;
 $18 = ($17|0)!=(0);
 if ($18) {
  $19 = $4;
  $1 = $19;
  $20 = $1;
  STACKTOP = sp;return ($20|0);
 } else {
  $1 = -1;
  $20 = $1;
  STACKTOP = sp;return ($20|0);
 }
 return (0)|0;
}
function _ends_in_vowel($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $3 = $1;
 $2 = $3;
 while(1) {
  $4 = $2;
  $5 = HEAP8[$4>>0]|0;
  $6 = ($5<<24>>24)!=(0);
  $7 = $2;
  if (!($6)) {
   break;
  }
  $8 = ((($7)) + 1|0);
  $2 = $8;
 }
 $9 = ((($7)) + -1|0);
 $2 = $9;
 $10 = $2;
 $11 = HEAP8[$10>>0]|0;
 $12 = (_is_vowel(($11|0))|0);
 STACKTOP = sp;return ($12|0);
}
function _chop_last_char($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $3 = $1;
 $2 = $3;
 while(1) {
  $4 = $2;
  $5 = HEAP8[$4>>0]|0;
  $6 = ($5<<24>>24)!=(0);
  $7 = $2;
  if (!($6)) {
   break;
  }
  $8 = ((($7)) + 1|0);
  $2 = $8;
 }
 $9 = ((($7)) + -1|0);
 $2 = $9;
 $10 = $2;
 HEAP8[$10>>0] = 0;
 STACKTOP = sp;return;
}
function _can_join($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $8 = sp + 28|0;
 $3 = $0;
 $4 = $1;
 $12 = $4;
 $13 = HEAP8[$12>>0]|0;
 $6 = $13;
 $14 = $3;
 $7 = $14;
 while(1) {
  $15 = $7;
  $16 = HEAP8[$15>>0]|0;
  $17 = ($16<<24>>24)!=(0);
  $18 = $7;
  if (!($17)) {
   break;
  }
  $19 = ((($18)) + 1|0);
  $7 = $19;
 }
 $20 = ((($18)) + -1|0);
 $7 = $20;
 $21 = $7;
 $22 = HEAP8[$21>>0]|0;
 $5 = $22;
 $23 = $5;
 HEAP8[$8>>0] = $23;
 $24 = $6;
 $25 = ((($8)) + 1|0);
 HEAP8[$25>>0] = $24;
 $26 = (_is_pairok(($8|0))|0);
 $9 = $26;
 $27 = $4;
 $28 = ((($27)) + 1|0);
 $29 = HEAP8[$28>>0]|0;
 $30 = (_is_consonant(($29|0))|0);
 $31 = ($30|0)!=(0);
 if (!($31)) {
  $59 = $9;
  $2 = $59;
  $60 = $2;
  STACKTOP = sp;return ($60|0);
 }
 $32 = $4;
 $33 = (_is_initialpairok(($32|0))|0);
 $10 = $33;
 $34 = $5;
 $35 = $34 << 24 >> 24;
 $36 = ($35|0)==(110);
 if ($36) {
  $37 = $4;
  $38 = (_strncmp($37,38885,2)|0);
  $39 = ($38|0)!=(0);
  if ($39) {
   $40 = $4;
   $41 = (_strncmp($40,38888,2)|0);
   $42 = ($41|0)!=(0);
   if ($42) {
    $43 = $4;
    $44 = (_strncmp($43,38891,2)|0);
    $45 = ($44|0)!=(0);
    if ($45) {
     $46 = $4;
     $47 = (_strncmp($46,38894,2)|0);
     $48 = ($47|0)!=(0);
     $50 = $48;
    } else {
     $50 = 0;
    }
   } else {
    $50 = 0;
   }
  } else {
   $50 = 0;
  }
  $49 = $50&1;
  $11 = $49;
 } else {
  $11 = 1;
 }
 $51 = $9;
 $52 = ($51|0)!=(0);
 $53 = $10;
 $54 = ($53|0)!=(0);
 $or$cond = $52 & $54;
 if ($or$cond) {
  $55 = $11;
  $56 = ($55|0)!=(0);
  $58 = $56;
 } else {
  $58 = 0;
 }
 $57 = $58&1;
 $2 = $57;
 $60 = $2;
 STACKTOP = sp;return ($60|0);
}
function _compare_lujvo($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $7 = $3;
 $5 = $7;
 $8 = $4;
 $6 = $8;
 $9 = $5;
 $10 = ((($9)) + 4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = $6;
 $13 = ((($12)) + 4|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = ($11|0)>($14|0);
 do {
  if ($15) {
   $2 = 1;
  } else {
   $16 = $5;
   $17 = ((($16)) + 4|0);
   $18 = HEAP32[$17>>2]|0;
   $19 = $6;
   $20 = ((($19)) + 4|0);
   $21 = HEAP32[$20>>2]|0;
   $22 = ($18|0)<($21|0);
   if ($22) {
    $2 = -1;
    break;
   } else {
    $2 = 0;
    break;
   }
  }
 } while(0);
 $23 = $2;
 STACKTOP = sp;return ($23|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0172$i = 0, $$$0173$i = 0, $$$4236$i = 0, $$$4329$i = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$01$i$i = 0, $$0172$lcssa$i = 0, $$01726$i = 0, $$0173$lcssa$i = 0, $$01735$i = 0, $$0192 = 0, $$0194 = 0, $$0201$i$i = 0, $$0202$i$i = 0, $$0206$i$i = 0;
 var $$0207$i$i = 0, $$024370$i = 0, $$0260$i$i = 0, $$0261$i$i = 0, $$0262$i$i = 0, $$0268$i$i = 0, $$0269$i$i = 0, $$0320$i = 0, $$0322$i = 0, $$0323$i = 0, $$0325$i = 0, $$0331$i = 0, $$0336$i = 0, $$0337$$i = 0, $$0337$i = 0, $$0339$i = 0, $$0340$i = 0, $$0345$i = 0, $$1176$i = 0, $$1178$i = 0;
 var $$124469$i = 0, $$1264$i$i = 0, $$1266$i$i = 0, $$1321$i = 0, $$1326$i = 0, $$1341$i = 0, $$1347$i = 0, $$1351$i = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2333$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i200 = 0, $$3328$i = 0, $$3349$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$411$i = 0;
 var $$4236$i = 0, $$4329$lcssa$i = 0, $$432910$i = 0, $$4335$$4$i = 0, $$4335$ph$i = 0, $$43359$i = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i17$i = 0, $$pre$i195 = 0, $$pre$i210 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i18$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink1$i = 0;
 var $$sink1$i$i = 0, $$sink14$i = 0, $$sink2$i = 0, $$sink2$i204 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0;
 var $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0;
 var $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0;
 var $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0;
 var $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0;
 var $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0;
 var $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0;
 var $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0;
 var $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0;
 var $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0;
 var $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0;
 var $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0;
 var $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0;
 var $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0;
 var $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0;
 var $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0;
 var $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0;
 var $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0;
 var $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0;
 var $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0;
 var $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0;
 var $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0;
 var $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0;
 var $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0;
 var $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0;
 var $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0;
 var $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0;
 var $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0;
 var $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0;
 var $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0;
 var $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0;
 var $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0;
 var $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0;
 var $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0;
 var $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0;
 var $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0;
 var $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0;
 var $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0;
 var $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0;
 var $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0;
 var $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0;
 var $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0;
 var $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0;
 var $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0;
 var $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0;
 var $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0;
 var $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0;
 var $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0;
 var $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i208 = 0, $exitcond$i$i = 0, $not$$i = 0;
 var $not$$i$i = 0, $not$$i197 = 0, $not$$i209 = 0, $not$1$i = 0, $not$1$i203 = 0, $not$3$i = 0, $not$5$i = 0, $or$cond$i = 0, $or$cond$i201 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond2$i199 = 0, $or$cond49$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[141406]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (565664 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    if ($21) {
     $22 = 1 << $14;
     $23 = $22 ^ -1;
     $24 = $8 & $23;
     HEAP32[141406] = $24;
    } else {
     $25 = ((($20)) + 12|0);
     HEAP32[$25>>2] = $16;
     HEAP32[$17>>2] = $20;
    }
    $26 = $14 << 3;
    $27 = $26 | 3;
    $28 = ((($18)) + 4|0);
    HEAP32[$28>>2] = $27;
    $29 = (($18) + ($26)|0);
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $31 | 1;
    HEAP32[$30>>2] = $32;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $33 = HEAP32[(565632)>>2]|0;
   $34 = ($6>>>0)>($33>>>0);
   if ($34) {
    $35 = ($9|0)==(0);
    if (!($35)) {
     $36 = $9 << $7;
     $37 = 2 << $7;
     $38 = (0 - ($37))|0;
     $39 = $37 | $38;
     $40 = $36 & $39;
     $41 = (0 - ($40))|0;
     $42 = $40 & $41;
     $43 = (($42) + -1)|0;
     $44 = $43 >>> 12;
     $45 = $44 & 16;
     $46 = $43 >>> $45;
     $47 = $46 >>> 5;
     $48 = $47 & 8;
     $49 = $48 | $45;
     $50 = $46 >>> $48;
     $51 = $50 >>> 2;
     $52 = $51 & 4;
     $53 = $49 | $52;
     $54 = $50 >>> $52;
     $55 = $54 >>> 1;
     $56 = $55 & 2;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 1;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = (($61) + ($62))|0;
     $64 = $63 << 1;
     $65 = (565664 + ($64<<2)|0);
     $66 = ((($65)) + 8|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ($65|0)==($69|0);
     if ($70) {
      $71 = 1 << $63;
      $72 = $71 ^ -1;
      $73 = $8 & $72;
      HEAP32[141406] = $73;
      $90 = $73;
     } else {
      $74 = ((($69)) + 12|0);
      HEAP32[$74>>2] = $65;
      HEAP32[$66>>2] = $69;
      $90 = $8;
     }
     $75 = $63 << 3;
     $76 = (($75) - ($6))|0;
     $77 = $6 | 3;
     $78 = ((($67)) + 4|0);
     HEAP32[$78>>2] = $77;
     $79 = (($67) + ($6)|0);
     $80 = $76 | 1;
     $81 = ((($79)) + 4|0);
     HEAP32[$81>>2] = $80;
     $82 = (($79) + ($76)|0);
     HEAP32[$82>>2] = $76;
     $83 = ($33|0)==(0);
     if (!($83)) {
      $84 = HEAP32[(565644)>>2]|0;
      $85 = $33 >>> 3;
      $86 = $85 << 1;
      $87 = (565664 + ($86<<2)|0);
      $88 = 1 << $85;
      $89 = $90 & $88;
      $91 = ($89|0)==(0);
      if ($91) {
       $92 = $90 | $88;
       HEAP32[141406] = $92;
       $$pre = ((($87)) + 8|0);
       $$0194 = $87;$$pre$phiZ2D = $$pre;
      } else {
       $93 = ((($87)) + 8|0);
       $94 = HEAP32[$93>>2]|0;
       $$0194 = $94;$$pre$phiZ2D = $93;
      }
      HEAP32[$$pre$phiZ2D>>2] = $84;
      $95 = ((($$0194)) + 12|0);
      HEAP32[$95>>2] = $84;
      $96 = ((($84)) + 8|0);
      HEAP32[$96>>2] = $$0194;
      $97 = ((($84)) + 12|0);
      HEAP32[$97>>2] = $87;
     }
     HEAP32[(565632)>>2] = $76;
     HEAP32[(565644)>>2] = $79;
     $$0 = $68;
     STACKTOP = sp;return ($$0|0);
    }
    $98 = HEAP32[(565628)>>2]|0;
    $99 = ($98|0)==(0);
    if ($99) {
     $$0192 = $6;
    } else {
     $100 = (0 - ($98))|0;
     $101 = $98 & $100;
     $102 = (($101) + -1)|0;
     $103 = $102 >>> 12;
     $104 = $103 & 16;
     $105 = $102 >>> $104;
     $106 = $105 >>> 5;
     $107 = $106 & 8;
     $108 = $107 | $104;
     $109 = $105 >>> $107;
     $110 = $109 >>> 2;
     $111 = $110 & 4;
     $112 = $108 | $111;
     $113 = $109 >>> $111;
     $114 = $113 >>> 1;
     $115 = $114 & 2;
     $116 = $112 | $115;
     $117 = $113 >>> $115;
     $118 = $117 >>> 1;
     $119 = $118 & 1;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = (($120) + ($121))|0;
     $123 = (565928 + ($122<<2)|0);
     $124 = HEAP32[$123>>2]|0;
     $125 = ((($124)) + 4|0);
     $126 = HEAP32[$125>>2]|0;
     $127 = $126 & -8;
     $128 = (($127) - ($6))|0;
     $129 = ((($124)) + 16|0);
     $130 = HEAP32[$129>>2]|0;
     $not$3$i = ($130|0)==(0|0);
     $$sink14$i = $not$3$i&1;
     $131 = (((($124)) + 16|0) + ($$sink14$i<<2)|0);
     $132 = HEAP32[$131>>2]|0;
     $133 = ($132|0)==(0|0);
     if ($133) {
      $$0172$lcssa$i = $124;$$0173$lcssa$i = $128;
     } else {
      $$01726$i = $124;$$01735$i = $128;$135 = $132;
      while(1) {
       $134 = ((($135)) + 4|0);
       $136 = HEAP32[$134>>2]|0;
       $137 = $136 & -8;
       $138 = (($137) - ($6))|0;
       $139 = ($138>>>0)<($$01735$i>>>0);
       $$$0173$i = $139 ? $138 : $$01735$i;
       $$$0172$i = $139 ? $135 : $$01726$i;
       $140 = ((($135)) + 16|0);
       $141 = HEAP32[$140>>2]|0;
       $not$$i = ($141|0)==(0|0);
       $$sink1$i = $not$$i&1;
       $142 = (((($135)) + 16|0) + ($$sink1$i<<2)|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        $$0172$lcssa$i = $$$0172$i;$$0173$lcssa$i = $$$0173$i;
        break;
       } else {
        $$01726$i = $$$0172$i;$$01735$i = $$$0173$i;$135 = $143;
       }
      }
     }
     $145 = (($$0172$lcssa$i) + ($6)|0);
     $146 = ($$0172$lcssa$i>>>0)<($145>>>0);
     if ($146) {
      $147 = ((($$0172$lcssa$i)) + 24|0);
      $148 = HEAP32[$147>>2]|0;
      $149 = ((($$0172$lcssa$i)) + 12|0);
      $150 = HEAP32[$149>>2]|0;
      $151 = ($150|0)==($$0172$lcssa$i|0);
      do {
       if ($151) {
        $156 = ((($$0172$lcssa$i)) + 20|0);
        $157 = HEAP32[$156>>2]|0;
        $158 = ($157|0)==(0|0);
        if ($158) {
         $159 = ((($$0172$lcssa$i)) + 16|0);
         $160 = HEAP32[$159>>2]|0;
         $161 = ($160|0)==(0|0);
         if ($161) {
          $$3$i = 0;
          break;
         } else {
          $$1176$i = $160;$$1178$i = $159;
         }
        } else {
         $$1176$i = $157;$$1178$i = $156;
        }
        while(1) {
         $162 = ((($$1176$i)) + 20|0);
         $163 = HEAP32[$162>>2]|0;
         $164 = ($163|0)==(0|0);
         if (!($164)) {
          $$1176$i = $163;$$1178$i = $162;
          continue;
         }
         $165 = ((($$1176$i)) + 16|0);
         $166 = HEAP32[$165>>2]|0;
         $167 = ($166|0)==(0|0);
         if ($167) {
          break;
         } else {
          $$1176$i = $166;$$1178$i = $165;
         }
        }
        HEAP32[$$1178$i>>2] = 0;
        $$3$i = $$1176$i;
       } else {
        $152 = ((($$0172$lcssa$i)) + 8|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ((($153)) + 12|0);
        HEAP32[$154>>2] = $150;
        $155 = ((($150)) + 8|0);
        HEAP32[$155>>2] = $153;
        $$3$i = $150;
       }
      } while(0);
      $168 = ($148|0)==(0|0);
      do {
       if (!($168)) {
        $169 = ((($$0172$lcssa$i)) + 28|0);
        $170 = HEAP32[$169>>2]|0;
        $171 = (565928 + ($170<<2)|0);
        $172 = HEAP32[$171>>2]|0;
        $173 = ($$0172$lcssa$i|0)==($172|0);
        if ($173) {
         HEAP32[$171>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $174 = 1 << $170;
          $175 = $174 ^ -1;
          $176 = $98 & $175;
          HEAP32[(565628)>>2] = $176;
          break;
         }
        } else {
         $177 = ((($148)) + 16|0);
         $178 = HEAP32[$177>>2]|0;
         $not$1$i = ($178|0)!=($$0172$lcssa$i|0);
         $$sink2$i = $not$1$i&1;
         $179 = (((($148)) + 16|0) + ($$sink2$i<<2)|0);
         HEAP32[$179>>2] = $$3$i;
         $180 = ($$3$i|0)==(0|0);
         if ($180) {
          break;
         }
        }
        $181 = ((($$3$i)) + 24|0);
        HEAP32[$181>>2] = $148;
        $182 = ((($$0172$lcssa$i)) + 16|0);
        $183 = HEAP32[$182>>2]|0;
        $184 = ($183|0)==(0|0);
        if (!($184)) {
         $185 = ((($$3$i)) + 16|0);
         HEAP32[$185>>2] = $183;
         $186 = ((($183)) + 24|0);
         HEAP32[$186>>2] = $$3$i;
        }
        $187 = ((($$0172$lcssa$i)) + 20|0);
        $188 = HEAP32[$187>>2]|0;
        $189 = ($188|0)==(0|0);
        if (!($189)) {
         $190 = ((($$3$i)) + 20|0);
         HEAP32[$190>>2] = $188;
         $191 = ((($188)) + 24|0);
         HEAP32[$191>>2] = $$3$i;
        }
       }
      } while(0);
      $192 = ($$0173$lcssa$i>>>0)<(16);
      if ($192) {
       $193 = (($$0173$lcssa$i) + ($6))|0;
       $194 = $193 | 3;
       $195 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$195>>2] = $194;
       $196 = (($$0172$lcssa$i) + ($193)|0);
       $197 = ((($196)) + 4|0);
       $198 = HEAP32[$197>>2]|0;
       $199 = $198 | 1;
       HEAP32[$197>>2] = $199;
      } else {
       $200 = $6 | 3;
       $201 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$201>>2] = $200;
       $202 = $$0173$lcssa$i | 1;
       $203 = ((($145)) + 4|0);
       HEAP32[$203>>2] = $202;
       $204 = (($145) + ($$0173$lcssa$i)|0);
       HEAP32[$204>>2] = $$0173$lcssa$i;
       $205 = ($33|0)==(0);
       if (!($205)) {
        $206 = HEAP32[(565644)>>2]|0;
        $207 = $33 >>> 3;
        $208 = $207 << 1;
        $209 = (565664 + ($208<<2)|0);
        $210 = 1 << $207;
        $211 = $8 & $210;
        $212 = ($211|0)==(0);
        if ($212) {
         $213 = $8 | $210;
         HEAP32[141406] = $213;
         $$pre$i = ((($209)) + 8|0);
         $$0$i = $209;$$pre$phi$iZ2D = $$pre$i;
        } else {
         $214 = ((($209)) + 8|0);
         $215 = HEAP32[$214>>2]|0;
         $$0$i = $215;$$pre$phi$iZ2D = $214;
        }
        HEAP32[$$pre$phi$iZ2D>>2] = $206;
        $216 = ((($$0$i)) + 12|0);
        HEAP32[$216>>2] = $206;
        $217 = ((($206)) + 8|0);
        HEAP32[$217>>2] = $$0$i;
        $218 = ((($206)) + 12|0);
        HEAP32[$218>>2] = $209;
       }
       HEAP32[(565632)>>2] = $$0173$lcssa$i;
       HEAP32[(565644)>>2] = $145;
      }
      $219 = ((($$0172$lcssa$i)) + 8|0);
      $$0 = $219;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0192 = $6;
     }
    }
   } else {
    $$0192 = $6;
   }
  } else {
   $220 = ($0>>>0)>(4294967231);
   if ($220) {
    $$0192 = -1;
   } else {
    $221 = (($0) + 11)|0;
    $222 = $221 & -8;
    $223 = HEAP32[(565628)>>2]|0;
    $224 = ($223|0)==(0);
    if ($224) {
     $$0192 = $222;
    } else {
     $225 = (0 - ($222))|0;
     $226 = $221 >>> 8;
     $227 = ($226|0)==(0);
     if ($227) {
      $$0336$i = 0;
     } else {
      $228 = ($222>>>0)>(16777215);
      if ($228) {
       $$0336$i = 31;
      } else {
       $229 = (($226) + 1048320)|0;
       $230 = $229 >>> 16;
       $231 = $230 & 8;
       $232 = $226 << $231;
       $233 = (($232) + 520192)|0;
       $234 = $233 >>> 16;
       $235 = $234 & 4;
       $236 = $235 | $231;
       $237 = $232 << $235;
       $238 = (($237) + 245760)|0;
       $239 = $238 >>> 16;
       $240 = $239 & 2;
       $241 = $236 | $240;
       $242 = (14 - ($241))|0;
       $243 = $237 << $240;
       $244 = $243 >>> 15;
       $245 = (($242) + ($244))|0;
       $246 = $245 << 1;
       $247 = (($245) + 7)|0;
       $248 = $222 >>> $247;
       $249 = $248 & 1;
       $250 = $249 | $246;
       $$0336$i = $250;
      }
     }
     $251 = (565928 + ($$0336$i<<2)|0);
     $252 = HEAP32[$251>>2]|0;
     $253 = ($252|0)==(0|0);
     L74: do {
      if ($253) {
       $$2333$i = 0;$$3$i200 = 0;$$3328$i = $225;
       label = 57;
      } else {
       $254 = ($$0336$i|0)==(31);
       $255 = $$0336$i >>> 1;
       $256 = (25 - ($255))|0;
       $257 = $254 ? 0 : $256;
       $258 = $222 << $257;
       $$0320$i = 0;$$0325$i = $225;$$0331$i = $252;$$0337$i = $258;$$0340$i = 0;
       while(1) {
        $259 = ((($$0331$i)) + 4|0);
        $260 = HEAP32[$259>>2]|0;
        $261 = $260 & -8;
        $262 = (($261) - ($222))|0;
        $263 = ($262>>>0)<($$0325$i>>>0);
        if ($263) {
         $264 = ($262|0)==(0);
         if ($264) {
          $$411$i = $$0331$i;$$432910$i = 0;$$43359$i = $$0331$i;
          label = 61;
          break L74;
         } else {
          $$1321$i = $$0331$i;$$1326$i = $262;
         }
        } else {
         $$1321$i = $$0320$i;$$1326$i = $$0325$i;
        }
        $265 = ((($$0331$i)) + 20|0);
        $266 = HEAP32[$265>>2]|0;
        $267 = $$0337$i >>> 31;
        $268 = (((($$0331$i)) + 16|0) + ($267<<2)|0);
        $269 = HEAP32[$268>>2]|0;
        $270 = ($266|0)==(0|0);
        $271 = ($266|0)==($269|0);
        $or$cond2$i199 = $270 | $271;
        $$1341$i = $or$cond2$i199 ? $$0340$i : $266;
        $272 = ($269|0)==(0|0);
        $not$5$i = $272 ^ 1;
        $273 = $not$5$i&1;
        $$0337$$i = $$0337$i << $273;
        if ($272) {
         $$2333$i = $$1341$i;$$3$i200 = $$1321$i;$$3328$i = $$1326$i;
         label = 57;
         break;
        } else {
         $$0320$i = $$1321$i;$$0325$i = $$1326$i;$$0331$i = $269;$$0337$i = $$0337$$i;$$0340$i = $$1341$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 57) {
      $274 = ($$2333$i|0)==(0|0);
      $275 = ($$3$i200|0)==(0|0);
      $or$cond$i201 = $274 & $275;
      if ($or$cond$i201) {
       $276 = 2 << $$0336$i;
       $277 = (0 - ($276))|0;
       $278 = $276 | $277;
       $279 = $223 & $278;
       $280 = ($279|0)==(0);
       if ($280) {
        $$0192 = $222;
        break;
       }
       $281 = (0 - ($279))|0;
       $282 = $279 & $281;
       $283 = (($282) + -1)|0;
       $284 = $283 >>> 12;
       $285 = $284 & 16;
       $286 = $283 >>> $285;
       $287 = $286 >>> 5;
       $288 = $287 & 8;
       $289 = $288 | $285;
       $290 = $286 >>> $288;
       $291 = $290 >>> 2;
       $292 = $291 & 4;
       $293 = $289 | $292;
       $294 = $290 >>> $292;
       $295 = $294 >>> 1;
       $296 = $295 & 2;
       $297 = $293 | $296;
       $298 = $294 >>> $296;
       $299 = $298 >>> 1;
       $300 = $299 & 1;
       $301 = $297 | $300;
       $302 = $298 >>> $300;
       $303 = (($301) + ($302))|0;
       $304 = (565928 + ($303<<2)|0);
       $305 = HEAP32[$304>>2]|0;
       $$4$ph$i = 0;$$4335$ph$i = $305;
      } else {
       $$4$ph$i = $$3$i200;$$4335$ph$i = $$2333$i;
      }
      $306 = ($$4335$ph$i|0)==(0|0);
      if ($306) {
       $$4$lcssa$i = $$4$ph$i;$$4329$lcssa$i = $$3328$i;
      } else {
       $$411$i = $$4$ph$i;$$432910$i = $$3328$i;$$43359$i = $$4335$ph$i;
       label = 61;
      }
     }
     if ((label|0) == 61) {
      while(1) {
       label = 0;
       $307 = ((($$43359$i)) + 4|0);
       $308 = HEAP32[$307>>2]|0;
       $309 = $308 & -8;
       $310 = (($309) - ($222))|0;
       $311 = ($310>>>0)<($$432910$i>>>0);
       $$$4329$i = $311 ? $310 : $$432910$i;
       $$4335$$4$i = $311 ? $$43359$i : $$411$i;
       $312 = ((($$43359$i)) + 16|0);
       $313 = HEAP32[$312>>2]|0;
       $not$1$i203 = ($313|0)==(0|0);
       $$sink2$i204 = $not$1$i203&1;
       $314 = (((($$43359$i)) + 16|0) + ($$sink2$i204<<2)|0);
       $315 = HEAP32[$314>>2]|0;
       $316 = ($315|0)==(0|0);
       if ($316) {
        $$4$lcssa$i = $$4335$$4$i;$$4329$lcssa$i = $$$4329$i;
        break;
       } else {
        $$411$i = $$4335$$4$i;$$432910$i = $$$4329$i;$$43359$i = $315;
        label = 61;
       }
      }
     }
     $317 = ($$4$lcssa$i|0)==(0|0);
     if ($317) {
      $$0192 = $222;
     } else {
      $318 = HEAP32[(565632)>>2]|0;
      $319 = (($318) - ($222))|0;
      $320 = ($$4329$lcssa$i>>>0)<($319>>>0);
      if ($320) {
       $321 = (($$4$lcssa$i) + ($222)|0);
       $322 = ($$4$lcssa$i>>>0)<($321>>>0);
       if (!($322)) {
        $$0 = 0;
        STACKTOP = sp;return ($$0|0);
       }
       $323 = ((($$4$lcssa$i)) + 24|0);
       $324 = HEAP32[$323>>2]|0;
       $325 = ((($$4$lcssa$i)) + 12|0);
       $326 = HEAP32[$325>>2]|0;
       $327 = ($326|0)==($$4$lcssa$i|0);
       do {
        if ($327) {
         $332 = ((($$4$lcssa$i)) + 20|0);
         $333 = HEAP32[$332>>2]|0;
         $334 = ($333|0)==(0|0);
         if ($334) {
          $335 = ((($$4$lcssa$i)) + 16|0);
          $336 = HEAP32[$335>>2]|0;
          $337 = ($336|0)==(0|0);
          if ($337) {
           $$3349$i = 0;
           break;
          } else {
           $$1347$i = $336;$$1351$i = $335;
          }
         } else {
          $$1347$i = $333;$$1351$i = $332;
         }
         while(1) {
          $338 = ((($$1347$i)) + 20|0);
          $339 = HEAP32[$338>>2]|0;
          $340 = ($339|0)==(0|0);
          if (!($340)) {
           $$1347$i = $339;$$1351$i = $338;
           continue;
          }
          $341 = ((($$1347$i)) + 16|0);
          $342 = HEAP32[$341>>2]|0;
          $343 = ($342|0)==(0|0);
          if ($343) {
           break;
          } else {
           $$1347$i = $342;$$1351$i = $341;
          }
         }
         HEAP32[$$1351$i>>2] = 0;
         $$3349$i = $$1347$i;
        } else {
         $328 = ((($$4$lcssa$i)) + 8|0);
         $329 = HEAP32[$328>>2]|0;
         $330 = ((($329)) + 12|0);
         HEAP32[$330>>2] = $326;
         $331 = ((($326)) + 8|0);
         HEAP32[$331>>2] = $329;
         $$3349$i = $326;
        }
       } while(0);
       $344 = ($324|0)==(0|0);
       do {
        if ($344) {
         $426 = $223;
        } else {
         $345 = ((($$4$lcssa$i)) + 28|0);
         $346 = HEAP32[$345>>2]|0;
         $347 = (565928 + ($346<<2)|0);
         $348 = HEAP32[$347>>2]|0;
         $349 = ($$4$lcssa$i|0)==($348|0);
         if ($349) {
          HEAP32[$347>>2] = $$3349$i;
          $cond$i208 = ($$3349$i|0)==(0|0);
          if ($cond$i208) {
           $350 = 1 << $346;
           $351 = $350 ^ -1;
           $352 = $223 & $351;
           HEAP32[(565628)>>2] = $352;
           $426 = $352;
           break;
          }
         } else {
          $353 = ((($324)) + 16|0);
          $354 = HEAP32[$353>>2]|0;
          $not$$i209 = ($354|0)!=($$4$lcssa$i|0);
          $$sink3$i = $not$$i209&1;
          $355 = (((($324)) + 16|0) + ($$sink3$i<<2)|0);
          HEAP32[$355>>2] = $$3349$i;
          $356 = ($$3349$i|0)==(0|0);
          if ($356) {
           $426 = $223;
           break;
          }
         }
         $357 = ((($$3349$i)) + 24|0);
         HEAP32[$357>>2] = $324;
         $358 = ((($$4$lcssa$i)) + 16|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==(0|0);
         if (!($360)) {
          $361 = ((($$3349$i)) + 16|0);
          HEAP32[$361>>2] = $359;
          $362 = ((($359)) + 24|0);
          HEAP32[$362>>2] = $$3349$i;
         }
         $363 = ((($$4$lcssa$i)) + 20|0);
         $364 = HEAP32[$363>>2]|0;
         $365 = ($364|0)==(0|0);
         if ($365) {
          $426 = $223;
         } else {
          $366 = ((($$3349$i)) + 20|0);
          HEAP32[$366>>2] = $364;
          $367 = ((($364)) + 24|0);
          HEAP32[$367>>2] = $$3349$i;
          $426 = $223;
         }
        }
       } while(0);
       $368 = ($$4329$lcssa$i>>>0)<(16);
       do {
        if ($368) {
         $369 = (($$4329$lcssa$i) + ($222))|0;
         $370 = $369 | 3;
         $371 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$371>>2] = $370;
         $372 = (($$4$lcssa$i) + ($369)|0);
         $373 = ((($372)) + 4|0);
         $374 = HEAP32[$373>>2]|0;
         $375 = $374 | 1;
         HEAP32[$373>>2] = $375;
        } else {
         $376 = $222 | 3;
         $377 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$377>>2] = $376;
         $378 = $$4329$lcssa$i | 1;
         $379 = ((($321)) + 4|0);
         HEAP32[$379>>2] = $378;
         $380 = (($321) + ($$4329$lcssa$i)|0);
         HEAP32[$380>>2] = $$4329$lcssa$i;
         $381 = $$4329$lcssa$i >>> 3;
         $382 = ($$4329$lcssa$i>>>0)<(256);
         if ($382) {
          $383 = $381 << 1;
          $384 = (565664 + ($383<<2)|0);
          $385 = HEAP32[141406]|0;
          $386 = 1 << $381;
          $387 = $385 & $386;
          $388 = ($387|0)==(0);
          if ($388) {
           $389 = $385 | $386;
           HEAP32[141406] = $389;
           $$pre$i210 = ((($384)) + 8|0);
           $$0345$i = $384;$$pre$phi$i211Z2D = $$pre$i210;
          } else {
           $390 = ((($384)) + 8|0);
           $391 = HEAP32[$390>>2]|0;
           $$0345$i = $391;$$pre$phi$i211Z2D = $390;
          }
          HEAP32[$$pre$phi$i211Z2D>>2] = $321;
          $392 = ((($$0345$i)) + 12|0);
          HEAP32[$392>>2] = $321;
          $393 = ((($321)) + 8|0);
          HEAP32[$393>>2] = $$0345$i;
          $394 = ((($321)) + 12|0);
          HEAP32[$394>>2] = $384;
          break;
         }
         $395 = $$4329$lcssa$i >>> 8;
         $396 = ($395|0)==(0);
         if ($396) {
          $$0339$i = 0;
         } else {
          $397 = ($$4329$lcssa$i>>>0)>(16777215);
          if ($397) {
           $$0339$i = 31;
          } else {
           $398 = (($395) + 1048320)|0;
           $399 = $398 >>> 16;
           $400 = $399 & 8;
           $401 = $395 << $400;
           $402 = (($401) + 520192)|0;
           $403 = $402 >>> 16;
           $404 = $403 & 4;
           $405 = $404 | $400;
           $406 = $401 << $404;
           $407 = (($406) + 245760)|0;
           $408 = $407 >>> 16;
           $409 = $408 & 2;
           $410 = $405 | $409;
           $411 = (14 - ($410))|0;
           $412 = $406 << $409;
           $413 = $412 >>> 15;
           $414 = (($411) + ($413))|0;
           $415 = $414 << 1;
           $416 = (($414) + 7)|0;
           $417 = $$4329$lcssa$i >>> $416;
           $418 = $417 & 1;
           $419 = $418 | $415;
           $$0339$i = $419;
          }
         }
         $420 = (565928 + ($$0339$i<<2)|0);
         $421 = ((($321)) + 28|0);
         HEAP32[$421>>2] = $$0339$i;
         $422 = ((($321)) + 16|0);
         $423 = ((($422)) + 4|0);
         HEAP32[$423>>2] = 0;
         HEAP32[$422>>2] = 0;
         $424 = 1 << $$0339$i;
         $425 = $426 & $424;
         $427 = ($425|0)==(0);
         if ($427) {
          $428 = $426 | $424;
          HEAP32[(565628)>>2] = $428;
          HEAP32[$420>>2] = $321;
          $429 = ((($321)) + 24|0);
          HEAP32[$429>>2] = $420;
          $430 = ((($321)) + 12|0);
          HEAP32[$430>>2] = $321;
          $431 = ((($321)) + 8|0);
          HEAP32[$431>>2] = $321;
          break;
         }
         $432 = HEAP32[$420>>2]|0;
         $433 = ($$0339$i|0)==(31);
         $434 = $$0339$i >>> 1;
         $435 = (25 - ($434))|0;
         $436 = $433 ? 0 : $435;
         $437 = $$4329$lcssa$i << $436;
         $$0322$i = $437;$$0323$i = $432;
         while(1) {
          $438 = ((($$0323$i)) + 4|0);
          $439 = HEAP32[$438>>2]|0;
          $440 = $439 & -8;
          $441 = ($440|0)==($$4329$lcssa$i|0);
          if ($441) {
           label = 97;
           break;
          }
          $442 = $$0322$i >>> 31;
          $443 = (((($$0323$i)) + 16|0) + ($442<<2)|0);
          $444 = $$0322$i << 1;
          $445 = HEAP32[$443>>2]|0;
          $446 = ($445|0)==(0|0);
          if ($446) {
           label = 96;
           break;
          } else {
           $$0322$i = $444;$$0323$i = $445;
          }
         }
         if ((label|0) == 96) {
          HEAP32[$443>>2] = $321;
          $447 = ((($321)) + 24|0);
          HEAP32[$447>>2] = $$0323$i;
          $448 = ((($321)) + 12|0);
          HEAP32[$448>>2] = $321;
          $449 = ((($321)) + 8|0);
          HEAP32[$449>>2] = $321;
          break;
         }
         else if ((label|0) == 97) {
          $450 = ((($$0323$i)) + 8|0);
          $451 = HEAP32[$450>>2]|0;
          $452 = ((($451)) + 12|0);
          HEAP32[$452>>2] = $321;
          HEAP32[$450>>2] = $321;
          $453 = ((($321)) + 8|0);
          HEAP32[$453>>2] = $451;
          $454 = ((($321)) + 12|0);
          HEAP32[$454>>2] = $$0323$i;
          $455 = ((($321)) + 24|0);
          HEAP32[$455>>2] = 0;
          break;
         }
        }
       } while(0);
       $456 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $456;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0192 = $222;
      }
     }
    }
   }
  }
 } while(0);
 $457 = HEAP32[(565632)>>2]|0;
 $458 = ($457>>>0)<($$0192>>>0);
 if (!($458)) {
  $459 = (($457) - ($$0192))|0;
  $460 = HEAP32[(565644)>>2]|0;
  $461 = ($459>>>0)>(15);
  if ($461) {
   $462 = (($460) + ($$0192)|0);
   HEAP32[(565644)>>2] = $462;
   HEAP32[(565632)>>2] = $459;
   $463 = $459 | 1;
   $464 = ((($462)) + 4|0);
   HEAP32[$464>>2] = $463;
   $465 = (($462) + ($459)|0);
   HEAP32[$465>>2] = $459;
   $466 = $$0192 | 3;
   $467 = ((($460)) + 4|0);
   HEAP32[$467>>2] = $466;
  } else {
   HEAP32[(565632)>>2] = 0;
   HEAP32[(565644)>>2] = 0;
   $468 = $457 | 3;
   $469 = ((($460)) + 4|0);
   HEAP32[$469>>2] = $468;
   $470 = (($460) + ($457)|0);
   $471 = ((($470)) + 4|0);
   $472 = HEAP32[$471>>2]|0;
   $473 = $472 | 1;
   HEAP32[$471>>2] = $473;
  }
  $474 = ((($460)) + 8|0);
  $$0 = $474;
  STACKTOP = sp;return ($$0|0);
 }
 $475 = HEAP32[(565636)>>2]|0;
 $476 = ($475>>>0)>($$0192>>>0);
 if ($476) {
  $477 = (($475) - ($$0192))|0;
  HEAP32[(565636)>>2] = $477;
  $478 = HEAP32[(565648)>>2]|0;
  $479 = (($478) + ($$0192)|0);
  HEAP32[(565648)>>2] = $479;
  $480 = $477 | 1;
  $481 = ((($479)) + 4|0);
  HEAP32[$481>>2] = $480;
  $482 = $$0192 | 3;
  $483 = ((($478)) + 4|0);
  HEAP32[$483>>2] = $482;
  $484 = ((($478)) + 8|0);
  $$0 = $484;
  STACKTOP = sp;return ($$0|0);
 }
 $485 = HEAP32[141524]|0;
 $486 = ($485|0)==(0);
 if ($486) {
  HEAP32[(566104)>>2] = 4096;
  HEAP32[(566100)>>2] = 4096;
  HEAP32[(566108)>>2] = -1;
  HEAP32[(566112)>>2] = -1;
  HEAP32[(566116)>>2] = 0;
  HEAP32[(566068)>>2] = 0;
  $487 = $1;
  $488 = $487 & -16;
  $489 = $488 ^ 1431655768;
  HEAP32[$1>>2] = $489;
  HEAP32[141524] = $489;
  $493 = 4096;
 } else {
  $$pre$i195 = HEAP32[(566104)>>2]|0;
  $493 = $$pre$i195;
 }
 $490 = (($$0192) + 48)|0;
 $491 = (($$0192) + 47)|0;
 $492 = (($493) + ($491))|0;
 $494 = (0 - ($493))|0;
 $495 = $492 & $494;
 $496 = ($495>>>0)>($$0192>>>0);
 if (!($496)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $497 = HEAP32[(566064)>>2]|0;
 $498 = ($497|0)==(0);
 if (!($498)) {
  $499 = HEAP32[(566056)>>2]|0;
  $500 = (($499) + ($495))|0;
  $501 = ($500>>>0)<=($499>>>0);
  $502 = ($500>>>0)>($497>>>0);
  $or$cond1$i = $501 | $502;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $503 = HEAP32[(566068)>>2]|0;
 $504 = $503 & 4;
 $505 = ($504|0)==(0);
 L167: do {
  if ($505) {
   $506 = HEAP32[(565648)>>2]|0;
   $507 = ($506|0)==(0|0);
   L169: do {
    if ($507) {
     label = 118;
    } else {
     $$0$i20$i = (566072);
     while(1) {
      $508 = HEAP32[$$0$i20$i>>2]|0;
      $509 = ($508>>>0)>($506>>>0);
      if (!($509)) {
       $510 = ((($$0$i20$i)) + 4|0);
       $511 = HEAP32[$510>>2]|0;
       $512 = (($508) + ($511)|0);
       $513 = ($512>>>0)>($506>>>0);
       if ($513) {
        break;
       }
      }
      $514 = ((($$0$i20$i)) + 8|0);
      $515 = HEAP32[$514>>2]|0;
      $516 = ($515|0)==(0|0);
      if ($516) {
       label = 118;
       break L169;
      } else {
       $$0$i20$i = $515;
      }
     }
     $539 = (($492) - ($475))|0;
     $540 = $539 & $494;
     $541 = ($540>>>0)<(2147483647);
     if ($541) {
      $542 = (_sbrk(($540|0))|0);
      $543 = HEAP32[$$0$i20$i>>2]|0;
      $544 = HEAP32[$510>>2]|0;
      $545 = (($543) + ($544)|0);
      $546 = ($542|0)==($545|0);
      if ($546) {
       $547 = ($542|0)==((-1)|0);
       if ($547) {
        $$2234243136$i = $540;
       } else {
        $$723947$i = $540;$$748$i = $542;
        label = 135;
        break L167;
       }
      } else {
       $$2247$ph$i = $542;$$2253$ph$i = $540;
       label = 126;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 118) {
     $517 = (_sbrk(0)|0);
     $518 = ($517|0)==((-1)|0);
     if ($518) {
      $$2234243136$i = 0;
     } else {
      $519 = $517;
      $520 = HEAP32[(566100)>>2]|0;
      $521 = (($520) + -1)|0;
      $522 = $521 & $519;
      $523 = ($522|0)==(0);
      $524 = (($521) + ($519))|0;
      $525 = (0 - ($520))|0;
      $526 = $524 & $525;
      $527 = (($526) - ($519))|0;
      $528 = $523 ? 0 : $527;
      $$$i = (($528) + ($495))|0;
      $529 = HEAP32[(566056)>>2]|0;
      $530 = (($$$i) + ($529))|0;
      $531 = ($$$i>>>0)>($$0192>>>0);
      $532 = ($$$i>>>0)<(2147483647);
      $or$cond$i = $531 & $532;
      if ($or$cond$i) {
       $533 = HEAP32[(566064)>>2]|0;
       $534 = ($533|0)==(0);
       if (!($534)) {
        $535 = ($530>>>0)<=($529>>>0);
        $536 = ($530>>>0)>($533>>>0);
        $or$cond2$i = $535 | $536;
        if ($or$cond2$i) {
         $$2234243136$i = 0;
         break;
        }
       }
       $537 = (_sbrk(($$$i|0))|0);
       $538 = ($537|0)==($517|0);
       if ($538) {
        $$723947$i = $$$i;$$748$i = $517;
        label = 135;
        break L167;
       } else {
        $$2247$ph$i = $537;$$2253$ph$i = $$$i;
        label = 126;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 126) {
     $548 = (0 - ($$2253$ph$i))|0;
     $549 = ($$2247$ph$i|0)!=((-1)|0);
     $550 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $550 & $549;
     $551 = ($490>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $551 & $or$cond7$i;
     if (!($or$cond10$i)) {
      $561 = ($$2247$ph$i|0)==((-1)|0);
      if ($561) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 135;
       break L167;
      }
     }
     $552 = HEAP32[(566104)>>2]|0;
     $553 = (($491) - ($$2253$ph$i))|0;
     $554 = (($553) + ($552))|0;
     $555 = (0 - ($552))|0;
     $556 = $554 & $555;
     $557 = ($556>>>0)<(2147483647);
     if (!($557)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
     $558 = (_sbrk(($556|0))|0);
     $559 = ($558|0)==((-1)|0);
     if ($559) {
      (_sbrk(($548|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $560 = (($556) + ($$2253$ph$i))|0;
      $$723947$i = $560;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
    }
   } while(0);
   $562 = HEAP32[(566068)>>2]|0;
   $563 = $562 | 4;
   HEAP32[(566068)>>2] = $563;
   $$4236$i = $$2234243136$i;
   label = 133;
  } else {
   $$4236$i = 0;
   label = 133;
  }
 } while(0);
 if ((label|0) == 133) {
  $564 = ($495>>>0)<(2147483647);
  if ($564) {
   $565 = (_sbrk(($495|0))|0);
   $566 = (_sbrk(0)|0);
   $567 = ($565|0)!=((-1)|0);
   $568 = ($566|0)!=((-1)|0);
   $or$cond5$i = $567 & $568;
   $569 = ($565>>>0)<($566>>>0);
   $or$cond11$i = $569 & $or$cond5$i;
   $570 = $566;
   $571 = $565;
   $572 = (($570) - ($571))|0;
   $573 = (($$0192) + 40)|0;
   $574 = ($572>>>0)>($573>>>0);
   $$$4236$i = $574 ? $572 : $$4236$i;
   $or$cond11$not$i = $or$cond11$i ^ 1;
   $575 = ($565|0)==((-1)|0);
   $not$$i197 = $574 ^ 1;
   $576 = $575 | $not$$i197;
   $or$cond49$i = $576 | $or$cond11$not$i;
   if (!($or$cond49$i)) {
    $$723947$i = $$$4236$i;$$748$i = $565;
    label = 135;
   }
  }
 }
 if ((label|0) == 135) {
  $577 = HEAP32[(566056)>>2]|0;
  $578 = (($577) + ($$723947$i))|0;
  HEAP32[(566056)>>2] = $578;
  $579 = HEAP32[(566060)>>2]|0;
  $580 = ($578>>>0)>($579>>>0);
  if ($580) {
   HEAP32[(566060)>>2] = $578;
  }
  $581 = HEAP32[(565648)>>2]|0;
  $582 = ($581|0)==(0|0);
  do {
   if ($582) {
    $583 = HEAP32[(565640)>>2]|0;
    $584 = ($583|0)==(0|0);
    $585 = ($$748$i>>>0)<($583>>>0);
    $or$cond12$i = $584 | $585;
    if ($or$cond12$i) {
     HEAP32[(565640)>>2] = $$748$i;
    }
    HEAP32[(566072)>>2] = $$748$i;
    HEAP32[(566076)>>2] = $$723947$i;
    HEAP32[(566084)>>2] = 0;
    $586 = HEAP32[141524]|0;
    HEAP32[(565660)>>2] = $586;
    HEAP32[(565656)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $587 = $$01$i$i << 1;
     $588 = (565664 + ($587<<2)|0);
     $589 = ((($588)) + 12|0);
     HEAP32[$589>>2] = $588;
     $590 = ((($588)) + 8|0);
     HEAP32[$590>>2] = $588;
     $591 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($591|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $591;
     }
    }
    $592 = (($$723947$i) + -40)|0;
    $593 = ((($$748$i)) + 8|0);
    $594 = $593;
    $595 = $594 & 7;
    $596 = ($595|0)==(0);
    $597 = (0 - ($594))|0;
    $598 = $597 & 7;
    $599 = $596 ? 0 : $598;
    $600 = (($$748$i) + ($599)|0);
    $601 = (($592) - ($599))|0;
    HEAP32[(565648)>>2] = $600;
    HEAP32[(565636)>>2] = $601;
    $602 = $601 | 1;
    $603 = ((($600)) + 4|0);
    HEAP32[$603>>2] = $602;
    $604 = (($600) + ($601)|0);
    $605 = ((($604)) + 4|0);
    HEAP32[$605>>2] = 40;
    $606 = HEAP32[(566112)>>2]|0;
    HEAP32[(565652)>>2] = $606;
   } else {
    $$024370$i = (566072);
    while(1) {
     $607 = HEAP32[$$024370$i>>2]|0;
     $608 = ((($$024370$i)) + 4|0);
     $609 = HEAP32[$608>>2]|0;
     $610 = (($607) + ($609)|0);
     $611 = ($$748$i|0)==($610|0);
     if ($611) {
      label = 145;
      break;
     }
     $612 = ((($$024370$i)) + 8|0);
     $613 = HEAP32[$612>>2]|0;
     $614 = ($613|0)==(0|0);
     if ($614) {
      break;
     } else {
      $$024370$i = $613;
     }
    }
    if ((label|0) == 145) {
     $615 = ((($$024370$i)) + 12|0);
     $616 = HEAP32[$615>>2]|0;
     $617 = $616 & 8;
     $618 = ($617|0)==(0);
     if ($618) {
      $619 = ($581>>>0)>=($607>>>0);
      $620 = ($581>>>0)<($$748$i>>>0);
      $or$cond50$i = $620 & $619;
      if ($or$cond50$i) {
       $621 = (($609) + ($$723947$i))|0;
       HEAP32[$608>>2] = $621;
       $622 = HEAP32[(565636)>>2]|0;
       $623 = ((($581)) + 8|0);
       $624 = $623;
       $625 = $624 & 7;
       $626 = ($625|0)==(0);
       $627 = (0 - ($624))|0;
       $628 = $627 & 7;
       $629 = $626 ? 0 : $628;
       $630 = (($581) + ($629)|0);
       $631 = (($$723947$i) - ($629))|0;
       $632 = (($622) + ($631))|0;
       HEAP32[(565648)>>2] = $630;
       HEAP32[(565636)>>2] = $632;
       $633 = $632 | 1;
       $634 = ((($630)) + 4|0);
       HEAP32[$634>>2] = $633;
       $635 = (($630) + ($632)|0);
       $636 = ((($635)) + 4|0);
       HEAP32[$636>>2] = 40;
       $637 = HEAP32[(566112)>>2]|0;
       HEAP32[(565652)>>2] = $637;
       break;
      }
     }
    }
    $638 = HEAP32[(565640)>>2]|0;
    $639 = ($$748$i>>>0)<($638>>>0);
    if ($639) {
     HEAP32[(565640)>>2] = $$748$i;
    }
    $640 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (566072);
    while(1) {
     $641 = HEAP32[$$124469$i>>2]|0;
     $642 = ($641|0)==($640|0);
     if ($642) {
      label = 153;
      break;
     }
     $643 = ((($$124469$i)) + 8|0);
     $644 = HEAP32[$643>>2]|0;
     $645 = ($644|0)==(0|0);
     if ($645) {
      break;
     } else {
      $$124469$i = $644;
     }
    }
    if ((label|0) == 153) {
     $646 = ((($$124469$i)) + 12|0);
     $647 = HEAP32[$646>>2]|0;
     $648 = $647 & 8;
     $649 = ($648|0)==(0);
     if ($649) {
      HEAP32[$$124469$i>>2] = $$748$i;
      $650 = ((($$124469$i)) + 4|0);
      $651 = HEAP32[$650>>2]|0;
      $652 = (($651) + ($$723947$i))|0;
      HEAP32[$650>>2] = $652;
      $653 = ((($$748$i)) + 8|0);
      $654 = $653;
      $655 = $654 & 7;
      $656 = ($655|0)==(0);
      $657 = (0 - ($654))|0;
      $658 = $657 & 7;
      $659 = $656 ? 0 : $658;
      $660 = (($$748$i) + ($659)|0);
      $661 = ((($640)) + 8|0);
      $662 = $661;
      $663 = $662 & 7;
      $664 = ($663|0)==(0);
      $665 = (0 - ($662))|0;
      $666 = $665 & 7;
      $667 = $664 ? 0 : $666;
      $668 = (($640) + ($667)|0);
      $669 = $668;
      $670 = $660;
      $671 = (($669) - ($670))|0;
      $672 = (($660) + ($$0192)|0);
      $673 = (($671) - ($$0192))|0;
      $674 = $$0192 | 3;
      $675 = ((($660)) + 4|0);
      HEAP32[$675>>2] = $674;
      $676 = ($668|0)==($581|0);
      do {
       if ($676) {
        $677 = HEAP32[(565636)>>2]|0;
        $678 = (($677) + ($673))|0;
        HEAP32[(565636)>>2] = $678;
        HEAP32[(565648)>>2] = $672;
        $679 = $678 | 1;
        $680 = ((($672)) + 4|0);
        HEAP32[$680>>2] = $679;
       } else {
        $681 = HEAP32[(565644)>>2]|0;
        $682 = ($668|0)==($681|0);
        if ($682) {
         $683 = HEAP32[(565632)>>2]|0;
         $684 = (($683) + ($673))|0;
         HEAP32[(565632)>>2] = $684;
         HEAP32[(565644)>>2] = $672;
         $685 = $684 | 1;
         $686 = ((($672)) + 4|0);
         HEAP32[$686>>2] = $685;
         $687 = (($672) + ($684)|0);
         HEAP32[$687>>2] = $684;
         break;
        }
        $688 = ((($668)) + 4|0);
        $689 = HEAP32[$688>>2]|0;
        $690 = $689 & 3;
        $691 = ($690|0)==(1);
        if ($691) {
         $692 = $689 & -8;
         $693 = $689 >>> 3;
         $694 = ($689>>>0)<(256);
         L237: do {
          if ($694) {
           $695 = ((($668)) + 8|0);
           $696 = HEAP32[$695>>2]|0;
           $697 = ((($668)) + 12|0);
           $698 = HEAP32[$697>>2]|0;
           $699 = ($698|0)==($696|0);
           if ($699) {
            $700 = 1 << $693;
            $701 = $700 ^ -1;
            $702 = HEAP32[141406]|0;
            $703 = $702 & $701;
            HEAP32[141406] = $703;
            break;
           } else {
            $704 = ((($696)) + 12|0);
            HEAP32[$704>>2] = $698;
            $705 = ((($698)) + 8|0);
            HEAP32[$705>>2] = $696;
            break;
           }
          } else {
           $706 = ((($668)) + 24|0);
           $707 = HEAP32[$706>>2]|0;
           $708 = ((($668)) + 12|0);
           $709 = HEAP32[$708>>2]|0;
           $710 = ($709|0)==($668|0);
           do {
            if ($710) {
             $715 = ((($668)) + 16|0);
             $716 = ((($715)) + 4|0);
             $717 = HEAP32[$716>>2]|0;
             $718 = ($717|0)==(0|0);
             if ($718) {
              $719 = HEAP32[$715>>2]|0;
              $720 = ($719|0)==(0|0);
              if ($720) {
               $$3$i$i = 0;
               break;
              } else {
               $$1264$i$i = $719;$$1266$i$i = $715;
              }
             } else {
              $$1264$i$i = $717;$$1266$i$i = $716;
             }
             while(1) {
              $721 = ((($$1264$i$i)) + 20|0);
              $722 = HEAP32[$721>>2]|0;
              $723 = ($722|0)==(0|0);
              if (!($723)) {
               $$1264$i$i = $722;$$1266$i$i = $721;
               continue;
              }
              $724 = ((($$1264$i$i)) + 16|0);
              $725 = HEAP32[$724>>2]|0;
              $726 = ($725|0)==(0|0);
              if ($726) {
               break;
              } else {
               $$1264$i$i = $725;$$1266$i$i = $724;
              }
             }
             HEAP32[$$1266$i$i>>2] = 0;
             $$3$i$i = $$1264$i$i;
            } else {
             $711 = ((($668)) + 8|0);
             $712 = HEAP32[$711>>2]|0;
             $713 = ((($712)) + 12|0);
             HEAP32[$713>>2] = $709;
             $714 = ((($709)) + 8|0);
             HEAP32[$714>>2] = $712;
             $$3$i$i = $709;
            }
           } while(0);
           $727 = ($707|0)==(0|0);
           if ($727) {
            break;
           }
           $728 = ((($668)) + 28|0);
           $729 = HEAP32[$728>>2]|0;
           $730 = (565928 + ($729<<2)|0);
           $731 = HEAP32[$730>>2]|0;
           $732 = ($668|0)==($731|0);
           do {
            if ($732) {
             HEAP32[$730>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $733 = 1 << $729;
             $734 = $733 ^ -1;
             $735 = HEAP32[(565628)>>2]|0;
             $736 = $735 & $734;
             HEAP32[(565628)>>2] = $736;
             break L237;
            } else {
             $737 = ((($707)) + 16|0);
             $738 = HEAP32[$737>>2]|0;
             $not$$i$i = ($738|0)!=($668|0);
             $$sink1$i$i = $not$$i$i&1;
             $739 = (((($707)) + 16|0) + ($$sink1$i$i<<2)|0);
             HEAP32[$739>>2] = $$3$i$i;
             $740 = ($$3$i$i|0)==(0|0);
             if ($740) {
              break L237;
             }
            }
           } while(0);
           $741 = ((($$3$i$i)) + 24|0);
           HEAP32[$741>>2] = $707;
           $742 = ((($668)) + 16|0);
           $743 = HEAP32[$742>>2]|0;
           $744 = ($743|0)==(0|0);
           if (!($744)) {
            $745 = ((($$3$i$i)) + 16|0);
            HEAP32[$745>>2] = $743;
            $746 = ((($743)) + 24|0);
            HEAP32[$746>>2] = $$3$i$i;
           }
           $747 = ((($742)) + 4|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = ($748|0)==(0|0);
           if ($749) {
            break;
           }
           $750 = ((($$3$i$i)) + 20|0);
           HEAP32[$750>>2] = $748;
           $751 = ((($748)) + 24|0);
           HEAP32[$751>>2] = $$3$i$i;
          }
         } while(0);
         $752 = (($668) + ($692)|0);
         $753 = (($692) + ($673))|0;
         $$0$i$i = $752;$$0260$i$i = $753;
        } else {
         $$0$i$i = $668;$$0260$i$i = $673;
        }
        $754 = ((($$0$i$i)) + 4|0);
        $755 = HEAP32[$754>>2]|0;
        $756 = $755 & -2;
        HEAP32[$754>>2] = $756;
        $757 = $$0260$i$i | 1;
        $758 = ((($672)) + 4|0);
        HEAP32[$758>>2] = $757;
        $759 = (($672) + ($$0260$i$i)|0);
        HEAP32[$759>>2] = $$0260$i$i;
        $760 = $$0260$i$i >>> 3;
        $761 = ($$0260$i$i>>>0)<(256);
        if ($761) {
         $762 = $760 << 1;
         $763 = (565664 + ($762<<2)|0);
         $764 = HEAP32[141406]|0;
         $765 = 1 << $760;
         $766 = $764 & $765;
         $767 = ($766|0)==(0);
         if ($767) {
          $768 = $764 | $765;
          HEAP32[141406] = $768;
          $$pre$i17$i = ((($763)) + 8|0);
          $$0268$i$i = $763;$$pre$phi$i18$iZ2D = $$pre$i17$i;
         } else {
          $769 = ((($763)) + 8|0);
          $770 = HEAP32[$769>>2]|0;
          $$0268$i$i = $770;$$pre$phi$i18$iZ2D = $769;
         }
         HEAP32[$$pre$phi$i18$iZ2D>>2] = $672;
         $771 = ((($$0268$i$i)) + 12|0);
         HEAP32[$771>>2] = $672;
         $772 = ((($672)) + 8|0);
         HEAP32[$772>>2] = $$0268$i$i;
         $773 = ((($672)) + 12|0);
         HEAP32[$773>>2] = $763;
         break;
        }
        $774 = $$0260$i$i >>> 8;
        $775 = ($774|0)==(0);
        do {
         if ($775) {
          $$0269$i$i = 0;
         } else {
          $776 = ($$0260$i$i>>>0)>(16777215);
          if ($776) {
           $$0269$i$i = 31;
           break;
          }
          $777 = (($774) + 1048320)|0;
          $778 = $777 >>> 16;
          $779 = $778 & 8;
          $780 = $774 << $779;
          $781 = (($780) + 520192)|0;
          $782 = $781 >>> 16;
          $783 = $782 & 4;
          $784 = $783 | $779;
          $785 = $780 << $783;
          $786 = (($785) + 245760)|0;
          $787 = $786 >>> 16;
          $788 = $787 & 2;
          $789 = $784 | $788;
          $790 = (14 - ($789))|0;
          $791 = $785 << $788;
          $792 = $791 >>> 15;
          $793 = (($790) + ($792))|0;
          $794 = $793 << 1;
          $795 = (($793) + 7)|0;
          $796 = $$0260$i$i >>> $795;
          $797 = $796 & 1;
          $798 = $797 | $794;
          $$0269$i$i = $798;
         }
        } while(0);
        $799 = (565928 + ($$0269$i$i<<2)|0);
        $800 = ((($672)) + 28|0);
        HEAP32[$800>>2] = $$0269$i$i;
        $801 = ((($672)) + 16|0);
        $802 = ((($801)) + 4|0);
        HEAP32[$802>>2] = 0;
        HEAP32[$801>>2] = 0;
        $803 = HEAP32[(565628)>>2]|0;
        $804 = 1 << $$0269$i$i;
        $805 = $803 & $804;
        $806 = ($805|0)==(0);
        if ($806) {
         $807 = $803 | $804;
         HEAP32[(565628)>>2] = $807;
         HEAP32[$799>>2] = $672;
         $808 = ((($672)) + 24|0);
         HEAP32[$808>>2] = $799;
         $809 = ((($672)) + 12|0);
         HEAP32[$809>>2] = $672;
         $810 = ((($672)) + 8|0);
         HEAP32[$810>>2] = $672;
         break;
        }
        $811 = HEAP32[$799>>2]|0;
        $812 = ($$0269$i$i|0)==(31);
        $813 = $$0269$i$i >>> 1;
        $814 = (25 - ($813))|0;
        $815 = $812 ? 0 : $814;
        $816 = $$0260$i$i << $815;
        $$0261$i$i = $816;$$0262$i$i = $811;
        while(1) {
         $817 = ((($$0262$i$i)) + 4|0);
         $818 = HEAP32[$817>>2]|0;
         $819 = $818 & -8;
         $820 = ($819|0)==($$0260$i$i|0);
         if ($820) {
          label = 194;
          break;
         }
         $821 = $$0261$i$i >>> 31;
         $822 = (((($$0262$i$i)) + 16|0) + ($821<<2)|0);
         $823 = $$0261$i$i << 1;
         $824 = HEAP32[$822>>2]|0;
         $825 = ($824|0)==(0|0);
         if ($825) {
          label = 193;
          break;
         } else {
          $$0261$i$i = $823;$$0262$i$i = $824;
         }
        }
        if ((label|0) == 193) {
         HEAP32[$822>>2] = $672;
         $826 = ((($672)) + 24|0);
         HEAP32[$826>>2] = $$0262$i$i;
         $827 = ((($672)) + 12|0);
         HEAP32[$827>>2] = $672;
         $828 = ((($672)) + 8|0);
         HEAP32[$828>>2] = $672;
         break;
        }
        else if ((label|0) == 194) {
         $829 = ((($$0262$i$i)) + 8|0);
         $830 = HEAP32[$829>>2]|0;
         $831 = ((($830)) + 12|0);
         HEAP32[$831>>2] = $672;
         HEAP32[$829>>2] = $672;
         $832 = ((($672)) + 8|0);
         HEAP32[$832>>2] = $830;
         $833 = ((($672)) + 12|0);
         HEAP32[$833>>2] = $$0262$i$i;
         $834 = ((($672)) + 24|0);
         HEAP32[$834>>2] = 0;
         break;
        }
       }
      } while(0);
      $959 = ((($660)) + 8|0);
      $$0 = $959;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (566072);
    while(1) {
     $835 = HEAP32[$$0$i$i$i>>2]|0;
     $836 = ($835>>>0)>($581>>>0);
     if (!($836)) {
      $837 = ((($$0$i$i$i)) + 4|0);
      $838 = HEAP32[$837>>2]|0;
      $839 = (($835) + ($838)|0);
      $840 = ($839>>>0)>($581>>>0);
      if ($840) {
       break;
      }
     }
     $841 = ((($$0$i$i$i)) + 8|0);
     $842 = HEAP32[$841>>2]|0;
     $$0$i$i$i = $842;
    }
    $843 = ((($839)) + -47|0);
    $844 = ((($843)) + 8|0);
    $845 = $844;
    $846 = $845 & 7;
    $847 = ($846|0)==(0);
    $848 = (0 - ($845))|0;
    $849 = $848 & 7;
    $850 = $847 ? 0 : $849;
    $851 = (($843) + ($850)|0);
    $852 = ((($581)) + 16|0);
    $853 = ($851>>>0)<($852>>>0);
    $854 = $853 ? $581 : $851;
    $855 = ((($854)) + 8|0);
    $856 = ((($854)) + 24|0);
    $857 = (($$723947$i) + -40)|0;
    $858 = ((($$748$i)) + 8|0);
    $859 = $858;
    $860 = $859 & 7;
    $861 = ($860|0)==(0);
    $862 = (0 - ($859))|0;
    $863 = $862 & 7;
    $864 = $861 ? 0 : $863;
    $865 = (($$748$i) + ($864)|0);
    $866 = (($857) - ($864))|0;
    HEAP32[(565648)>>2] = $865;
    HEAP32[(565636)>>2] = $866;
    $867 = $866 | 1;
    $868 = ((($865)) + 4|0);
    HEAP32[$868>>2] = $867;
    $869 = (($865) + ($866)|0);
    $870 = ((($869)) + 4|0);
    HEAP32[$870>>2] = 40;
    $871 = HEAP32[(566112)>>2]|0;
    HEAP32[(565652)>>2] = $871;
    $872 = ((($854)) + 4|0);
    HEAP32[$872>>2] = 27;
    ;HEAP32[$855>>2]=HEAP32[(566072)>>2]|0;HEAP32[$855+4>>2]=HEAP32[(566072)+4>>2]|0;HEAP32[$855+8>>2]=HEAP32[(566072)+8>>2]|0;HEAP32[$855+12>>2]=HEAP32[(566072)+12>>2]|0;
    HEAP32[(566072)>>2] = $$748$i;
    HEAP32[(566076)>>2] = $$723947$i;
    HEAP32[(566084)>>2] = 0;
    HEAP32[(566080)>>2] = $855;
    $874 = $856;
    while(1) {
     $873 = ((($874)) + 4|0);
     HEAP32[$873>>2] = 7;
     $875 = ((($874)) + 8|0);
     $876 = ($875>>>0)<($839>>>0);
     if ($876) {
      $874 = $873;
     } else {
      break;
     }
    }
    $877 = ($854|0)==($581|0);
    if (!($877)) {
     $878 = $854;
     $879 = $581;
     $880 = (($878) - ($879))|0;
     $881 = HEAP32[$872>>2]|0;
     $882 = $881 & -2;
     HEAP32[$872>>2] = $882;
     $883 = $880 | 1;
     $884 = ((($581)) + 4|0);
     HEAP32[$884>>2] = $883;
     HEAP32[$854>>2] = $880;
     $885 = $880 >>> 3;
     $886 = ($880>>>0)<(256);
     if ($886) {
      $887 = $885 << 1;
      $888 = (565664 + ($887<<2)|0);
      $889 = HEAP32[141406]|0;
      $890 = 1 << $885;
      $891 = $889 & $890;
      $892 = ($891|0)==(0);
      if ($892) {
       $893 = $889 | $890;
       HEAP32[141406] = $893;
       $$pre$i$i = ((($888)) + 8|0);
       $$0206$i$i = $888;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $894 = ((($888)) + 8|0);
       $895 = HEAP32[$894>>2]|0;
       $$0206$i$i = $895;$$pre$phi$i$iZ2D = $894;
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $581;
      $896 = ((($$0206$i$i)) + 12|0);
      HEAP32[$896>>2] = $581;
      $897 = ((($581)) + 8|0);
      HEAP32[$897>>2] = $$0206$i$i;
      $898 = ((($581)) + 12|0);
      HEAP32[$898>>2] = $888;
      break;
     }
     $899 = $880 >>> 8;
     $900 = ($899|0)==(0);
     if ($900) {
      $$0207$i$i = 0;
     } else {
      $901 = ($880>>>0)>(16777215);
      if ($901) {
       $$0207$i$i = 31;
      } else {
       $902 = (($899) + 1048320)|0;
       $903 = $902 >>> 16;
       $904 = $903 & 8;
       $905 = $899 << $904;
       $906 = (($905) + 520192)|0;
       $907 = $906 >>> 16;
       $908 = $907 & 4;
       $909 = $908 | $904;
       $910 = $905 << $908;
       $911 = (($910) + 245760)|0;
       $912 = $911 >>> 16;
       $913 = $912 & 2;
       $914 = $909 | $913;
       $915 = (14 - ($914))|0;
       $916 = $910 << $913;
       $917 = $916 >>> 15;
       $918 = (($915) + ($917))|0;
       $919 = $918 << 1;
       $920 = (($918) + 7)|0;
       $921 = $880 >>> $920;
       $922 = $921 & 1;
       $923 = $922 | $919;
       $$0207$i$i = $923;
      }
     }
     $924 = (565928 + ($$0207$i$i<<2)|0);
     $925 = ((($581)) + 28|0);
     HEAP32[$925>>2] = $$0207$i$i;
     $926 = ((($581)) + 20|0);
     HEAP32[$926>>2] = 0;
     HEAP32[$852>>2] = 0;
     $927 = HEAP32[(565628)>>2]|0;
     $928 = 1 << $$0207$i$i;
     $929 = $927 & $928;
     $930 = ($929|0)==(0);
     if ($930) {
      $931 = $927 | $928;
      HEAP32[(565628)>>2] = $931;
      HEAP32[$924>>2] = $581;
      $932 = ((($581)) + 24|0);
      HEAP32[$932>>2] = $924;
      $933 = ((($581)) + 12|0);
      HEAP32[$933>>2] = $581;
      $934 = ((($581)) + 8|0);
      HEAP32[$934>>2] = $581;
      break;
     }
     $935 = HEAP32[$924>>2]|0;
     $936 = ($$0207$i$i|0)==(31);
     $937 = $$0207$i$i >>> 1;
     $938 = (25 - ($937))|0;
     $939 = $936 ? 0 : $938;
     $940 = $880 << $939;
     $$0201$i$i = $940;$$0202$i$i = $935;
     while(1) {
      $941 = ((($$0202$i$i)) + 4|0);
      $942 = HEAP32[$941>>2]|0;
      $943 = $942 & -8;
      $944 = ($943|0)==($880|0);
      if ($944) {
       label = 216;
       break;
      }
      $945 = $$0201$i$i >>> 31;
      $946 = (((($$0202$i$i)) + 16|0) + ($945<<2)|0);
      $947 = $$0201$i$i << 1;
      $948 = HEAP32[$946>>2]|0;
      $949 = ($948|0)==(0|0);
      if ($949) {
       label = 215;
       break;
      } else {
       $$0201$i$i = $947;$$0202$i$i = $948;
      }
     }
     if ((label|0) == 215) {
      HEAP32[$946>>2] = $581;
      $950 = ((($581)) + 24|0);
      HEAP32[$950>>2] = $$0202$i$i;
      $951 = ((($581)) + 12|0);
      HEAP32[$951>>2] = $581;
      $952 = ((($581)) + 8|0);
      HEAP32[$952>>2] = $581;
      break;
     }
     else if ((label|0) == 216) {
      $953 = ((($$0202$i$i)) + 8|0);
      $954 = HEAP32[$953>>2]|0;
      $955 = ((($954)) + 12|0);
      HEAP32[$955>>2] = $581;
      HEAP32[$953>>2] = $581;
      $956 = ((($581)) + 8|0);
      HEAP32[$956>>2] = $954;
      $957 = ((($581)) + 12|0);
      HEAP32[$957>>2] = $$0202$i$i;
      $958 = ((($581)) + 24|0);
      HEAP32[$958>>2] = 0;
      break;
     }
    }
   }
  } while(0);
  $960 = HEAP32[(565636)>>2]|0;
  $961 = ($960>>>0)>($$0192>>>0);
  if ($961) {
   $962 = (($960) - ($$0192))|0;
   HEAP32[(565636)>>2] = $962;
   $963 = HEAP32[(565648)>>2]|0;
   $964 = (($963) + ($$0192)|0);
   HEAP32[(565648)>>2] = $964;
   $965 = $962 | 1;
   $966 = ((($964)) + 4|0);
   HEAP32[$966>>2] = $965;
   $967 = $$0192 | 3;
   $968 = ((($963)) + 4|0);
   HEAP32[$968>>2] = $967;
   $969 = ((($963)) + 8|0);
   $$0 = $969;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $970 = (___errno_location()|0);
 HEAP32[$970>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0195$i = 0, $$0195$in$i = 0, $$0348 = 0, $$0349 = 0, $$0361 = 0, $$0368 = 0, $$1 = 0, $$1347 = 0, $$1352 = 0, $$1355 = 0, $$1363 = 0, $$1367 = 0, $$2 = 0, $$3 = 0, $$3365 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond374 = 0, $cond375 = 0, $not$ = 0, $not$370 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(565640)>>2]|0;
 $4 = ((($0)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & -8;
 $7 = (($2) + ($6)|0);
 $8 = $5 & 1;
 $9 = ($8|0)==(0);
 do {
  if ($9) {
   $10 = HEAP32[$2>>2]|0;
   $11 = $5 & 3;
   $12 = ($11|0)==(0);
   if ($12) {
    return;
   }
   $13 = (0 - ($10))|0;
   $14 = (($2) + ($13)|0);
   $15 = (($10) + ($6))|0;
   $16 = ($14>>>0)<($3>>>0);
   if ($16) {
    return;
   }
   $17 = HEAP32[(565644)>>2]|0;
   $18 = ($14|0)==($17|0);
   if ($18) {
    $78 = ((($7)) + 4|0);
    $79 = HEAP32[$78>>2]|0;
    $80 = $79 & 3;
    $81 = ($80|0)==(3);
    if (!($81)) {
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    }
    $82 = (($14) + ($15)|0);
    $83 = ((($14)) + 4|0);
    $84 = $15 | 1;
    $85 = $79 & -2;
    HEAP32[(565632)>>2] = $15;
    HEAP32[$78>>2] = $85;
    HEAP32[$83>>2] = $84;
    HEAP32[$82>>2] = $15;
    return;
   }
   $19 = $10 >>> 3;
   $20 = ($10>>>0)<(256);
   if ($20) {
    $21 = ((($14)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ((($14)) + 12|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ($24|0)==($22|0);
    if ($25) {
     $26 = 1 << $19;
     $27 = $26 ^ -1;
     $28 = HEAP32[141406]|0;
     $29 = $28 & $27;
     HEAP32[141406] = $29;
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    } else {
     $30 = ((($22)) + 12|0);
     HEAP32[$30>>2] = $24;
     $31 = ((($24)) + 8|0);
     HEAP32[$31>>2] = $22;
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    }
   }
   $32 = ((($14)) + 24|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = ((($14)) + 12|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==($14|0);
   do {
    if ($36) {
     $41 = ((($14)) + 16|0);
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ($43|0)==(0|0);
     if ($44) {
      $45 = HEAP32[$41>>2]|0;
      $46 = ($45|0)==(0|0);
      if ($46) {
       $$3 = 0;
       break;
      } else {
       $$1352 = $45;$$1355 = $41;
      }
     } else {
      $$1352 = $43;$$1355 = $42;
     }
     while(1) {
      $47 = ((($$1352)) + 20|0);
      $48 = HEAP32[$47>>2]|0;
      $49 = ($48|0)==(0|0);
      if (!($49)) {
       $$1352 = $48;$$1355 = $47;
       continue;
      }
      $50 = ((($$1352)) + 16|0);
      $51 = HEAP32[$50>>2]|0;
      $52 = ($51|0)==(0|0);
      if ($52) {
       break;
      } else {
       $$1352 = $51;$$1355 = $50;
      }
     }
     HEAP32[$$1355>>2] = 0;
     $$3 = $$1352;
    } else {
     $37 = ((($14)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ((($38)) + 12|0);
     HEAP32[$39>>2] = $35;
     $40 = ((($35)) + 8|0);
     HEAP32[$40>>2] = $38;
     $$3 = $35;
    }
   } while(0);
   $53 = ($33|0)==(0|0);
   if ($53) {
    $$1 = $14;$$1347 = $15;$86 = $14;
   } else {
    $54 = ((($14)) + 28|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = (565928 + ($55<<2)|0);
    $57 = HEAP32[$56>>2]|0;
    $58 = ($14|0)==($57|0);
    if ($58) {
     HEAP32[$56>>2] = $$3;
     $cond374 = ($$3|0)==(0|0);
     if ($cond374) {
      $59 = 1 << $55;
      $60 = $59 ^ -1;
      $61 = HEAP32[(565628)>>2]|0;
      $62 = $61 & $60;
      HEAP32[(565628)>>2] = $62;
      $$1 = $14;$$1347 = $15;$86 = $14;
      break;
     }
    } else {
     $63 = ((($33)) + 16|0);
     $64 = HEAP32[$63>>2]|0;
     $not$370 = ($64|0)!=($14|0);
     $$sink3 = $not$370&1;
     $65 = (((($33)) + 16|0) + ($$sink3<<2)|0);
     HEAP32[$65>>2] = $$3;
     $66 = ($$3|0)==(0|0);
     if ($66) {
      $$1 = $14;$$1347 = $15;$86 = $14;
      break;
     }
    }
    $67 = ((($$3)) + 24|0);
    HEAP32[$67>>2] = $33;
    $68 = ((($14)) + 16|0);
    $69 = HEAP32[$68>>2]|0;
    $70 = ($69|0)==(0|0);
    if (!($70)) {
     $71 = ((($$3)) + 16|0);
     HEAP32[$71>>2] = $69;
     $72 = ((($69)) + 24|0);
     HEAP32[$72>>2] = $$3;
    }
    $73 = ((($68)) + 4|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = ($74|0)==(0|0);
    if ($75) {
     $$1 = $14;$$1347 = $15;$86 = $14;
    } else {
     $76 = ((($$3)) + 20|0);
     HEAP32[$76>>2] = $74;
     $77 = ((($74)) + 24|0);
     HEAP32[$77>>2] = $$3;
     $$1 = $14;$$1347 = $15;$86 = $14;
    }
   }
  } else {
   $$1 = $2;$$1347 = $6;$86 = $2;
  }
 } while(0);
 $87 = ($86>>>0)<($7>>>0);
 if (!($87)) {
  return;
 }
 $88 = ((($7)) + 4|0);
 $89 = HEAP32[$88>>2]|0;
 $90 = $89 & 1;
 $91 = ($90|0)==(0);
 if ($91) {
  return;
 }
 $92 = $89 & 2;
 $93 = ($92|0)==(0);
 if ($93) {
  $94 = HEAP32[(565648)>>2]|0;
  $95 = ($7|0)==($94|0);
  $96 = HEAP32[(565644)>>2]|0;
  if ($95) {
   $97 = HEAP32[(565636)>>2]|0;
   $98 = (($97) + ($$1347))|0;
   HEAP32[(565636)>>2] = $98;
   HEAP32[(565648)>>2] = $$1;
   $99 = $98 | 1;
   $100 = ((($$1)) + 4|0);
   HEAP32[$100>>2] = $99;
   $101 = ($$1|0)==($96|0);
   if (!($101)) {
    return;
   }
   HEAP32[(565644)>>2] = 0;
   HEAP32[(565632)>>2] = 0;
   return;
  }
  $102 = ($7|0)==($96|0);
  if ($102) {
   $103 = HEAP32[(565632)>>2]|0;
   $104 = (($103) + ($$1347))|0;
   HEAP32[(565632)>>2] = $104;
   HEAP32[(565644)>>2] = $86;
   $105 = $104 | 1;
   $106 = ((($$1)) + 4|0);
   HEAP32[$106>>2] = $105;
   $107 = (($86) + ($104)|0);
   HEAP32[$107>>2] = $104;
   return;
  }
  $108 = $89 & -8;
  $109 = (($108) + ($$1347))|0;
  $110 = $89 >>> 3;
  $111 = ($89>>>0)<(256);
  do {
   if ($111) {
    $112 = ((($7)) + 8|0);
    $113 = HEAP32[$112>>2]|0;
    $114 = ((($7)) + 12|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = ($115|0)==($113|0);
    if ($116) {
     $117 = 1 << $110;
     $118 = $117 ^ -1;
     $119 = HEAP32[141406]|0;
     $120 = $119 & $118;
     HEAP32[141406] = $120;
     break;
    } else {
     $121 = ((($113)) + 12|0);
     HEAP32[$121>>2] = $115;
     $122 = ((($115)) + 8|0);
     HEAP32[$122>>2] = $113;
     break;
    }
   } else {
    $123 = ((($7)) + 24|0);
    $124 = HEAP32[$123>>2]|0;
    $125 = ((($7)) + 12|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ($126|0)==($7|0);
    do {
     if ($127) {
      $132 = ((($7)) + 16|0);
      $133 = ((($132)) + 4|0);
      $134 = HEAP32[$133>>2]|0;
      $135 = ($134|0)==(0|0);
      if ($135) {
       $136 = HEAP32[$132>>2]|0;
       $137 = ($136|0)==(0|0);
       if ($137) {
        $$3365 = 0;
        break;
       } else {
        $$1363 = $136;$$1367 = $132;
       }
      } else {
       $$1363 = $134;$$1367 = $133;
      }
      while(1) {
       $138 = ((($$1363)) + 20|0);
       $139 = HEAP32[$138>>2]|0;
       $140 = ($139|0)==(0|0);
       if (!($140)) {
        $$1363 = $139;$$1367 = $138;
        continue;
       }
       $141 = ((($$1363)) + 16|0);
       $142 = HEAP32[$141>>2]|0;
       $143 = ($142|0)==(0|0);
       if ($143) {
        break;
       } else {
        $$1363 = $142;$$1367 = $141;
       }
      }
      HEAP32[$$1367>>2] = 0;
      $$3365 = $$1363;
     } else {
      $128 = ((($7)) + 8|0);
      $129 = HEAP32[$128>>2]|0;
      $130 = ((($129)) + 12|0);
      HEAP32[$130>>2] = $126;
      $131 = ((($126)) + 8|0);
      HEAP32[$131>>2] = $129;
      $$3365 = $126;
     }
    } while(0);
    $144 = ($124|0)==(0|0);
    if (!($144)) {
     $145 = ((($7)) + 28|0);
     $146 = HEAP32[$145>>2]|0;
     $147 = (565928 + ($146<<2)|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($7|0)==($148|0);
     if ($149) {
      HEAP32[$147>>2] = $$3365;
      $cond375 = ($$3365|0)==(0|0);
      if ($cond375) {
       $150 = 1 << $146;
       $151 = $150 ^ -1;
       $152 = HEAP32[(565628)>>2]|0;
       $153 = $152 & $151;
       HEAP32[(565628)>>2] = $153;
       break;
      }
     } else {
      $154 = ((($124)) + 16|0);
      $155 = HEAP32[$154>>2]|0;
      $not$ = ($155|0)!=($7|0);
      $$sink5 = $not$&1;
      $156 = (((($124)) + 16|0) + ($$sink5<<2)|0);
      HEAP32[$156>>2] = $$3365;
      $157 = ($$3365|0)==(0|0);
      if ($157) {
       break;
      }
     }
     $158 = ((($$3365)) + 24|0);
     HEAP32[$158>>2] = $124;
     $159 = ((($7)) + 16|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ($160|0)==(0|0);
     if (!($161)) {
      $162 = ((($$3365)) + 16|0);
      HEAP32[$162>>2] = $160;
      $163 = ((($160)) + 24|0);
      HEAP32[$163>>2] = $$3365;
     }
     $164 = ((($159)) + 4|0);
     $165 = HEAP32[$164>>2]|0;
     $166 = ($165|0)==(0|0);
     if (!($166)) {
      $167 = ((($$3365)) + 20|0);
      HEAP32[$167>>2] = $165;
      $168 = ((($165)) + 24|0);
      HEAP32[$168>>2] = $$3365;
     }
    }
   }
  } while(0);
  $169 = $109 | 1;
  $170 = ((($$1)) + 4|0);
  HEAP32[$170>>2] = $169;
  $171 = (($86) + ($109)|0);
  HEAP32[$171>>2] = $109;
  $172 = HEAP32[(565644)>>2]|0;
  $173 = ($$1|0)==($172|0);
  if ($173) {
   HEAP32[(565632)>>2] = $109;
   return;
  } else {
   $$2 = $109;
  }
 } else {
  $174 = $89 & -2;
  HEAP32[$88>>2] = $174;
  $175 = $$1347 | 1;
  $176 = ((($$1)) + 4|0);
  HEAP32[$176>>2] = $175;
  $177 = (($86) + ($$1347)|0);
  HEAP32[$177>>2] = $$1347;
  $$2 = $$1347;
 }
 $178 = $$2 >>> 3;
 $179 = ($$2>>>0)<(256);
 if ($179) {
  $180 = $178 << 1;
  $181 = (565664 + ($180<<2)|0);
  $182 = HEAP32[141406]|0;
  $183 = 1 << $178;
  $184 = $182 & $183;
  $185 = ($184|0)==(0);
  if ($185) {
   $186 = $182 | $183;
   HEAP32[141406] = $186;
   $$pre = ((($181)) + 8|0);
   $$0368 = $181;$$pre$phiZ2D = $$pre;
  } else {
   $187 = ((($181)) + 8|0);
   $188 = HEAP32[$187>>2]|0;
   $$0368 = $188;$$pre$phiZ2D = $187;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $189 = ((($$0368)) + 12|0);
  HEAP32[$189>>2] = $$1;
  $190 = ((($$1)) + 8|0);
  HEAP32[$190>>2] = $$0368;
  $191 = ((($$1)) + 12|0);
  HEAP32[$191>>2] = $181;
  return;
 }
 $192 = $$2 >>> 8;
 $193 = ($192|0)==(0);
 if ($193) {
  $$0361 = 0;
 } else {
  $194 = ($$2>>>0)>(16777215);
  if ($194) {
   $$0361 = 31;
  } else {
   $195 = (($192) + 1048320)|0;
   $196 = $195 >>> 16;
   $197 = $196 & 8;
   $198 = $192 << $197;
   $199 = (($198) + 520192)|0;
   $200 = $199 >>> 16;
   $201 = $200 & 4;
   $202 = $201 | $197;
   $203 = $198 << $201;
   $204 = (($203) + 245760)|0;
   $205 = $204 >>> 16;
   $206 = $205 & 2;
   $207 = $202 | $206;
   $208 = (14 - ($207))|0;
   $209 = $203 << $206;
   $210 = $209 >>> 15;
   $211 = (($208) + ($210))|0;
   $212 = $211 << 1;
   $213 = (($211) + 7)|0;
   $214 = $$2 >>> $213;
   $215 = $214 & 1;
   $216 = $215 | $212;
   $$0361 = $216;
  }
 }
 $217 = (565928 + ($$0361<<2)|0);
 $218 = ((($$1)) + 28|0);
 HEAP32[$218>>2] = $$0361;
 $219 = ((($$1)) + 16|0);
 $220 = ((($$1)) + 20|0);
 HEAP32[$220>>2] = 0;
 HEAP32[$219>>2] = 0;
 $221 = HEAP32[(565628)>>2]|0;
 $222 = 1 << $$0361;
 $223 = $221 & $222;
 $224 = ($223|0)==(0);
 do {
  if ($224) {
   $225 = $221 | $222;
   HEAP32[(565628)>>2] = $225;
   HEAP32[$217>>2] = $$1;
   $226 = ((($$1)) + 24|0);
   HEAP32[$226>>2] = $217;
   $227 = ((($$1)) + 12|0);
   HEAP32[$227>>2] = $$1;
   $228 = ((($$1)) + 8|0);
   HEAP32[$228>>2] = $$1;
  } else {
   $229 = HEAP32[$217>>2]|0;
   $230 = ($$0361|0)==(31);
   $231 = $$0361 >>> 1;
   $232 = (25 - ($231))|0;
   $233 = $230 ? 0 : $232;
   $234 = $$2 << $233;
   $$0348 = $234;$$0349 = $229;
   while(1) {
    $235 = ((($$0349)) + 4|0);
    $236 = HEAP32[$235>>2]|0;
    $237 = $236 & -8;
    $238 = ($237|0)==($$2|0);
    if ($238) {
     label = 73;
     break;
    }
    $239 = $$0348 >>> 31;
    $240 = (((($$0349)) + 16|0) + ($239<<2)|0);
    $241 = $$0348 << 1;
    $242 = HEAP32[$240>>2]|0;
    $243 = ($242|0)==(0|0);
    if ($243) {
     label = 72;
     break;
    } else {
     $$0348 = $241;$$0349 = $242;
    }
   }
   if ((label|0) == 72) {
    HEAP32[$240>>2] = $$1;
    $244 = ((($$1)) + 24|0);
    HEAP32[$244>>2] = $$0349;
    $245 = ((($$1)) + 12|0);
    HEAP32[$245>>2] = $$1;
    $246 = ((($$1)) + 8|0);
    HEAP32[$246>>2] = $$1;
    break;
   }
   else if ((label|0) == 73) {
    $247 = ((($$0349)) + 8|0);
    $248 = HEAP32[$247>>2]|0;
    $249 = ((($248)) + 12|0);
    HEAP32[$249>>2] = $$1;
    HEAP32[$247>>2] = $$1;
    $250 = ((($$1)) + 8|0);
    HEAP32[$250>>2] = $248;
    $251 = ((($$1)) + 12|0);
    HEAP32[$251>>2] = $$0349;
    $252 = ((($$1)) + 24|0);
    HEAP32[$252>>2] = 0;
    break;
   }
  }
 } while(0);
 $253 = HEAP32[(565656)>>2]|0;
 $254 = (($253) + -1)|0;
 HEAP32[(565656)>>2] = $254;
 $255 = ($254|0)==(0);
 if ($255) {
  $$0195$in$i = (566080);
 } else {
  return;
 }
 while(1) {
  $$0195$i = HEAP32[$$0195$in$i>>2]|0;
  $256 = ($$0195$i|0)==(0|0);
  $257 = ((($$0195$i)) + 8|0);
  if ($256) {
   break;
  } else {
   $$0195$in$i = $257;
  }
 }
 HEAP32[(565656)>>2] = -1;
 return;
}
function _emscripten_get_global_libc() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (566120|0);
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0;
 var $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$25 = $17;
   while(1) {
    $26 = ($25|0)<(0);
    if ($26) {
     break;
    }
    $34 = (($$04855) - ($25))|0;
    $35 = ((($$04954)) + 4|0);
    $36 = HEAP32[$35>>2]|0;
    $37 = ($25>>>0)>($36>>>0);
    $38 = ((($$04954)) + 8|0);
    $$150 = $37 ? $38 : $$04954;
    $39 = $37 << 31 >> 31;
    $$1 = (($39) + ($$04756))|0;
    $40 = $37 ? $36 : 0;
    $$0 = (($25) - ($40))|0;
    $41 = HEAP32[$$150>>2]|0;
    $42 = (($41) + ($$0)|0);
    HEAP32[$$150>>2] = $42;
    $43 = ((($$150)) + 4|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = (($44) - ($$0))|0;
    HEAP32[$43>>2] = $45;
    $46 = HEAP32[$13>>2]|0;
    $47 = $$150;
    HEAP32[$vararg_buffer3>>2] = $46;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $47;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $48 = (___syscall146(146,($vararg_buffer3|0))|0);
    $49 = (___syscall_ret($48)|0);
    $50 = ($34|0)==($49|0);
    if ($50) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $34;$$04954 = $$150;$25 = $49;
    }
   }
   $27 = ((($0)) + 16|0);
   HEAP32[$27>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $28 = HEAP32[$0>>2]|0;
   $29 = $28 | 32;
   HEAP32[$0>>2] = $29;
   $30 = ($$04756|0)==(2);
   if ($30) {
    $$051 = 0;
   } else {
    $31 = ((($$04954)) + 4|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = (($2) - ($32))|0;
    $$051 = $33;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  HEAP32[$4>>2] = $20;
  HEAP32[$7>>2] = $20;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___pthread_self_238()|0);
 $1 = ((($0)) + 64|0);
 return ($1|0);
}
function ___pthread_self_238() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function _pthread_self() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (23552|0);
}
function _dummy($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 2;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function _strncmp($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$01824 = 0, $$01926 = 0, $$01926$in = 0, $$020 = 0, $$025 = 0, $$lcssa = 0, $$lcssa22 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond21 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($2|0)==(0);
 if ($3) {
  $$020 = 0;
 } else {
  $4 = HEAP8[$0>>0]|0;
  $5 = $4&255;
  $6 = ($4<<24>>24)==(0);
  $7 = HEAP8[$1>>0]|0;
  $8 = $7&255;
  L3: do {
   if ($6) {
    $$lcssa = $8;$$lcssa22 = $5;
   } else {
    $$01824 = $0;$$01926$in = $2;$$025 = $1;$12 = $4;$22 = $8;$23 = $5;$9 = $7;
    while(1) {
     $$01926 = (($$01926$in) + -1)|0;
     $10 = ($9<<24>>24)!=(0);
     $11 = ($$01926|0)!=(0);
     $or$cond = $11 & $10;
     $13 = ($12<<24>>24)==($9<<24>>24);
     $or$cond21 = $13 & $or$cond;
     if (!($or$cond21)) {
      $$lcssa = $22;$$lcssa22 = $23;
      break L3;
     }
     $14 = ((($$01824)) + 1|0);
     $15 = ((($$025)) + 1|0);
     $16 = HEAP8[$14>>0]|0;
     $17 = $16&255;
     $18 = ($16<<24>>24)==(0);
     $19 = HEAP8[$15>>0]|0;
     $20 = $19&255;
     if ($18) {
      $$lcssa = $20;$$lcssa22 = $17;
      break;
     } else {
      $$01824 = $14;$$01926$in = $$01926;$$025 = $15;$12 = $16;$22 = $20;$23 = $17;$9 = $19;
     }
    }
   }
  } while(0);
  $21 = (($$lcssa22) - ($$lcssa))|0;
  $$020 = $21;
 }
 return ($$020|0);
}
function _memchr($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$035$lcssa = 0, $$035$lcssa65 = 0, $$03555 = 0, $$036$lcssa = 0, $$036$lcssa64 = 0, $$03654 = 0, $$046 = 0, $$137$lcssa = 0, $$13745 = 0, $$140 = 0, $$2 = 0, $$23839 = 0, $$3 = 0, $$lcssa = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0;
 var $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond53 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = $1 & 255;
 $4 = $0;
 $5 = $4 & 3;
 $6 = ($5|0)!=(0);
 $7 = ($2|0)!=(0);
 $or$cond53 = $7 & $6;
 L1: do {
  if ($or$cond53) {
   $8 = $1&255;
   $$03555 = $0;$$03654 = $2;
   while(1) {
    $9 = HEAP8[$$03555>>0]|0;
    $10 = ($9<<24>>24)==($8<<24>>24);
    if ($10) {
     $$035$lcssa65 = $$03555;$$036$lcssa64 = $$03654;
     label = 6;
     break L1;
    }
    $11 = ((($$03555)) + 1|0);
    $12 = (($$03654) + -1)|0;
    $13 = $11;
    $14 = $13 & 3;
    $15 = ($14|0)!=(0);
    $16 = ($12|0)!=(0);
    $or$cond = $16 & $15;
    if ($or$cond) {
     $$03555 = $11;$$03654 = $12;
    } else {
     $$035$lcssa = $11;$$036$lcssa = $12;$$lcssa = $16;
     label = 5;
     break;
    }
   }
  } else {
   $$035$lcssa = $0;$$036$lcssa = $2;$$lcssa = $7;
   label = 5;
  }
 } while(0);
 if ((label|0) == 5) {
  if ($$lcssa) {
   $$035$lcssa65 = $$035$lcssa;$$036$lcssa64 = $$036$lcssa;
   label = 6;
  } else {
   $$2 = $$035$lcssa;$$3 = 0;
  }
 }
 L8: do {
  if ((label|0) == 6) {
   $17 = HEAP8[$$035$lcssa65>>0]|0;
   $18 = $1&255;
   $19 = ($17<<24>>24)==($18<<24>>24);
   if ($19) {
    $$2 = $$035$lcssa65;$$3 = $$036$lcssa64;
   } else {
    $20 = Math_imul($3, 16843009)|0;
    $21 = ($$036$lcssa64>>>0)>(3);
    L11: do {
     if ($21) {
      $$046 = $$035$lcssa65;$$13745 = $$036$lcssa64;
      while(1) {
       $22 = HEAP32[$$046>>2]|0;
       $23 = $22 ^ $20;
       $24 = (($23) + -16843009)|0;
       $25 = $23 & -2139062144;
       $26 = $25 ^ -2139062144;
       $27 = $26 & $24;
       $28 = ($27|0)==(0);
       if (!($28)) {
        break;
       }
       $29 = ((($$046)) + 4|0);
       $30 = (($$13745) + -4)|0;
       $31 = ($30>>>0)>(3);
       if ($31) {
        $$046 = $29;$$13745 = $30;
       } else {
        $$0$lcssa = $29;$$137$lcssa = $30;
        label = 11;
        break L11;
       }
      }
      $$140 = $$046;$$23839 = $$13745;
     } else {
      $$0$lcssa = $$035$lcssa65;$$137$lcssa = $$036$lcssa64;
      label = 11;
     }
    } while(0);
    if ((label|0) == 11) {
     $32 = ($$137$lcssa|0)==(0);
     if ($32) {
      $$2 = $$0$lcssa;$$3 = 0;
      break;
     } else {
      $$140 = $$0$lcssa;$$23839 = $$137$lcssa;
     }
    }
    while(1) {
     $33 = HEAP8[$$140>>0]|0;
     $34 = ($33<<24>>24)==($18<<24>>24);
     if ($34) {
      $$2 = $$140;$$3 = $$23839;
      break L8;
     }
     $35 = ((($$140)) + 1|0);
     $36 = (($$23839) + -1)|0;
     $37 = ($36|0)==(0);
     if ($37) {
      $$2 = $35;$$3 = 0;
      break;
     } else {
      $$140 = $35;$$23839 = $36;
     }
    }
   }
  }
 } while(0);
 $38 = ($$3|0)!=(0);
 $39 = $38 ? $$2 : 0;
 return ($39|0);
}
function _strcmp($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = ($2<<24>>24)!=($3<<24>>24);
 $5 = ($2<<24>>24)==(0);
 $or$cond9 = $5 | $4;
 if ($or$cond9) {
  $$lcssa = $3;$$lcssa8 = $2;
 } else {
  $$011 = $1;$$0710 = $0;
  while(1) {
   $6 = ((($$0710)) + 1|0);
   $7 = ((($$011)) + 1|0);
   $8 = HEAP8[$6>>0]|0;
   $9 = HEAP8[$7>>0]|0;
   $10 = ($8<<24>>24)!=($9<<24>>24);
   $11 = ($8<<24>>24)==(0);
   $or$cond = $11 | $10;
   if ($or$cond) {
    $$lcssa = $9;$$lcssa8 = $8;
    break;
   } else {
    $$011 = $7;$$0710 = $6;
   }
  }
 }
 $12 = $$lcssa8&255;
 $13 = $$lcssa&255;
 $14 = (($12) - ($13))|0;
 return ($14|0);
}
function _vfprintf($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0 = 0, $$1 = 0, $$1$ = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $vacopy_currentptr = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 224|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(224|0);
 $3 = sp + 120|0;
 $4 = sp + 80|0;
 $5 = sp;
 $6 = sp + 136|0;
 dest=$4; stop=dest+40|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
 $vacopy_currentptr = HEAP32[$2>>2]|0;
 HEAP32[$3>>2] = $vacopy_currentptr;
 $7 = (_printf_core(0,$1,$3,$5,$4)|0);
 $8 = ($7|0)<(0);
 if ($8) {
  $$0 = -1;
 } else {
  $9 = ((($0)) + 76|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = ($10|0)>(-1);
  if ($11) {
   $12 = (___lockfile($0)|0);
   $39 = $12;
  } else {
   $39 = 0;
  }
  $13 = HEAP32[$0>>2]|0;
  $14 = $13 & 32;
  $15 = ((($0)) + 74|0);
  $16 = HEAP8[$15>>0]|0;
  $17 = ($16<<24>>24)<(1);
  if ($17) {
   $18 = $13 & -33;
   HEAP32[$0>>2] = $18;
  }
  $19 = ((($0)) + 48|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(0);
  if ($21) {
   $23 = ((($0)) + 44|0);
   $24 = HEAP32[$23>>2]|0;
   HEAP32[$23>>2] = $6;
   $25 = ((($0)) + 28|0);
   HEAP32[$25>>2] = $6;
   $26 = ((($0)) + 20|0);
   HEAP32[$26>>2] = $6;
   HEAP32[$19>>2] = 80;
   $27 = ((($6)) + 80|0);
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = $27;
   $29 = (_printf_core($0,$1,$3,$5,$4)|0);
   $30 = ($24|0)==(0|0);
   if ($30) {
    $$1 = $29;
   } else {
    $31 = ((($0)) + 36|0);
    $32 = HEAP32[$31>>2]|0;
    (FUNCTION_TABLE_iiii[$32 & 7]($0,0,0)|0);
    $33 = HEAP32[$26>>2]|0;
    $34 = ($33|0)==(0|0);
    $$ = $34 ? -1 : $29;
    HEAP32[$23>>2] = $24;
    HEAP32[$19>>2] = 0;
    HEAP32[$28>>2] = 0;
    HEAP32[$25>>2] = 0;
    HEAP32[$26>>2] = 0;
    $$1 = $$;
   }
  } else {
   $22 = (_printf_core($0,$1,$3,$5,$4)|0);
   $$1 = $22;
  }
  $35 = HEAP32[$0>>2]|0;
  $36 = $35 & 32;
  $37 = ($36|0)==(0);
  $$1$ = $37 ? $$1 : -1;
  $38 = $35 | $14;
  HEAP32[$0>>2] = $38;
  $40 = ($39|0)==(0);
  if (!($40)) {
   ___unlockfile($0);
  }
  $$0 = $$1$;
 }
 STACKTOP = sp;return ($$0|0);
}
function _printf_core($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$$ = 0, $$$0259 = 0, $$$0262 = 0, $$$0269 = 0, $$$4266 = 0, $$$5 = 0, $$0 = 0, $$0228 = 0, $$0228$ = 0, $$0229322 = 0, $$0232 = 0, $$0235 = 0, $$0237 = 0, $$0240$lcssa = 0, $$0240$lcssa357 = 0, $$0240321 = 0, $$0243 = 0, $$0247 = 0, $$0249$lcssa = 0;
 var $$0249306 = 0, $$0252 = 0, $$0253 = 0, $$0254 = 0, $$0254$$0254$ = 0, $$0259 = 0, $$0262$lcssa = 0, $$0262311 = 0, $$0269 = 0, $$0269$phi = 0, $$1 = 0, $$1230333 = 0, $$1233 = 0, $$1236 = 0, $$1238 = 0, $$1241332 = 0, $$1244320 = 0, $$1248 = 0, $$1250 = 0, $$1255 = 0;
 var $$1260 = 0, $$1263 = 0, $$1263$ = 0, $$1270 = 0, $$2 = 0, $$2234 = 0, $$2239 = 0, $$2242305 = 0, $$2245 = 0, $$2251 = 0, $$2256 = 0, $$2256$ = 0, $$2256$$$2256 = 0, $$2261 = 0, $$2271 = 0, $$284$ = 0, $$289 = 0, $$290 = 0, $$3257 = 0, $$3265 = 0;
 var $$3272 = 0, $$3303 = 0, $$377 = 0, $$4258355 = 0, $$4266 = 0, $$5 = 0, $$6268 = 0, $$lcssa295 = 0, $$pre = 0, $$pre346 = 0, $$pre347 = 0, $$pre347$pre = 0, $$pre349 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0;
 var $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0;
 var $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0;
 var $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0;
 var $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0;
 var $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0;
 var $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0;
 var $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0;
 var $306 = 0.0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0;
 var $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var $arglist_current = 0, $arglist_current2 = 0, $arglist_next = 0, $arglist_next3 = 0, $expanded = 0, $expanded10 = 0, $expanded11 = 0, $expanded13 = 0, $expanded14 = 0, $expanded15 = 0, $expanded4 = 0, $expanded6 = 0, $expanded7 = 0, $expanded8 = 0, $isdigit = 0, $isdigit275 = 0, $isdigit277 = 0, $isdigittmp = 0, $isdigittmp$ = 0, $isdigittmp274 = 0;
 var $isdigittmp276 = 0, $narrow = 0, $or$cond = 0, $or$cond281 = 0, $or$cond283 = 0, $or$cond286 = 0, $storemerge = 0, $storemerge273310 = 0, $storemerge278 = 0, $trunc = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $5 = sp + 16|0;
 $6 = sp;
 $7 = sp + 24|0;
 $8 = sp + 8|0;
 $9 = sp + 20|0;
 HEAP32[$5>>2] = $1;
 $10 = ($0|0)!=(0|0);
 $11 = ((($7)) + 40|0);
 $12 = $11;
 $13 = ((($7)) + 39|0);
 $14 = ((($8)) + 4|0);
 $$0243 = 0;$$0247 = 0;$$0269 = 0;$21 = $1;
 L1: while(1) {
  $15 = ($$0247|0)>(-1);
  do {
   if ($15) {
    $16 = (2147483647 - ($$0247))|0;
    $17 = ($$0243|0)>($16|0);
    if ($17) {
     $18 = (___errno_location()|0);
     HEAP32[$18>>2] = 75;
     $$1248 = -1;
     break;
    } else {
     $19 = (($$0243) + ($$0247))|0;
     $$1248 = $19;
     break;
    }
   } else {
    $$1248 = $$0247;
   }
  } while(0);
  $20 = HEAP8[$21>>0]|0;
  $22 = ($20<<24>>24)==(0);
  if ($22) {
   label = 87;
   break;
  } else {
   $23 = $20;$25 = $21;
  }
  L9: while(1) {
   switch ($23<<24>>24) {
   case 37:  {
    $$0249306 = $25;$27 = $25;
    label = 9;
    break L9;
    break;
   }
   case 0:  {
    $$0249$lcssa = $25;$39 = $25;
    break L9;
    break;
   }
   default: {
   }
   }
   $24 = ((($25)) + 1|0);
   HEAP32[$5>>2] = $24;
   $$pre = HEAP8[$24>>0]|0;
   $23 = $$pre;$25 = $24;
  }
  L12: do {
   if ((label|0) == 9) {
    while(1) {
     label = 0;
     $26 = ((($27)) + 1|0);
     $28 = HEAP8[$26>>0]|0;
     $29 = ($28<<24>>24)==(37);
     if (!($29)) {
      $$0249$lcssa = $$0249306;$39 = $27;
      break L12;
     }
     $30 = ((($$0249306)) + 1|0);
     $31 = ((($27)) + 2|0);
     HEAP32[$5>>2] = $31;
     $32 = HEAP8[$31>>0]|0;
     $33 = ($32<<24>>24)==(37);
     if ($33) {
      $$0249306 = $30;$27 = $31;
      label = 9;
     } else {
      $$0249$lcssa = $30;$39 = $31;
      break;
     }
    }
   }
  } while(0);
  $34 = $$0249$lcssa;
  $35 = $21;
  $36 = (($34) - ($35))|0;
  if ($10) {
   _out_442($0,$21,$36);
  }
  $37 = ($36|0)==(0);
  if (!($37)) {
   $$0269$phi = $$0269;$$0243 = $36;$$0247 = $$1248;$21 = $39;$$0269 = $$0269$phi;
   continue;
  }
  $38 = ((($39)) + 1|0);
  $40 = HEAP8[$38>>0]|0;
  $41 = $40 << 24 >> 24;
  $isdigittmp = (($41) + -48)|0;
  $isdigit = ($isdigittmp>>>0)<(10);
  if ($isdigit) {
   $42 = ((($39)) + 2|0);
   $43 = HEAP8[$42>>0]|0;
   $44 = ($43<<24>>24)==(36);
   $45 = ((($39)) + 3|0);
   $$377 = $44 ? $45 : $38;
   $$$0269 = $44 ? 1 : $$0269;
   $isdigittmp$ = $44 ? $isdigittmp : -1;
   $$0253 = $isdigittmp$;$$1270 = $$$0269;$storemerge = $$377;
  } else {
   $$0253 = -1;$$1270 = $$0269;$storemerge = $38;
  }
  HEAP32[$5>>2] = $storemerge;
  $46 = HEAP8[$storemerge>>0]|0;
  $47 = $46 << 24 >> 24;
  $48 = (($47) + -32)|0;
  $49 = ($48>>>0)<(32);
  L24: do {
   if ($49) {
    $$0262311 = 0;$329 = $46;$51 = $48;$storemerge273310 = $storemerge;
    while(1) {
     $50 = 1 << $51;
     $52 = $50 & 75913;
     $53 = ($52|0)==(0);
     if ($53) {
      $$0262$lcssa = $$0262311;$$lcssa295 = $329;$62 = $storemerge273310;
      break L24;
     }
     $54 = $50 | $$0262311;
     $55 = ((($storemerge273310)) + 1|0);
     HEAP32[$5>>2] = $55;
     $56 = HEAP8[$55>>0]|0;
     $57 = $56 << 24 >> 24;
     $58 = (($57) + -32)|0;
     $59 = ($58>>>0)<(32);
     if ($59) {
      $$0262311 = $54;$329 = $56;$51 = $58;$storemerge273310 = $55;
     } else {
      $$0262$lcssa = $54;$$lcssa295 = $56;$62 = $55;
      break;
     }
    }
   } else {
    $$0262$lcssa = 0;$$lcssa295 = $46;$62 = $storemerge;
   }
  } while(0);
  $60 = ($$lcssa295<<24>>24)==(42);
  if ($60) {
   $61 = ((($62)) + 1|0);
   $63 = HEAP8[$61>>0]|0;
   $64 = $63 << 24 >> 24;
   $isdigittmp276 = (($64) + -48)|0;
   $isdigit277 = ($isdigittmp276>>>0)<(10);
   if ($isdigit277) {
    $65 = ((($62)) + 2|0);
    $66 = HEAP8[$65>>0]|0;
    $67 = ($66<<24>>24)==(36);
    if ($67) {
     $68 = (($4) + ($isdigittmp276<<2)|0);
     HEAP32[$68>>2] = 10;
     $69 = HEAP8[$61>>0]|0;
     $70 = $69 << 24 >> 24;
     $71 = (($70) + -48)|0;
     $72 = (($3) + ($71<<3)|0);
     $73 = $72;
     $74 = $73;
     $75 = HEAP32[$74>>2]|0;
     $76 = (($73) + 4)|0;
     $77 = $76;
     $78 = HEAP32[$77>>2]|0;
     $79 = ((($62)) + 3|0);
     $$0259 = $75;$$2271 = 1;$storemerge278 = $79;
    } else {
     label = 23;
    }
   } else {
    label = 23;
   }
   if ((label|0) == 23) {
    label = 0;
    $80 = ($$1270|0)==(0);
    if (!($80)) {
     $$0 = -1;
     break;
    }
    if ($10) {
     $arglist_current = HEAP32[$2>>2]|0;
     $81 = $arglist_current;
     $82 = ((0) + 4|0);
     $expanded4 = $82;
     $expanded = (($expanded4) - 1)|0;
     $83 = (($81) + ($expanded))|0;
     $84 = ((0) + 4|0);
     $expanded8 = $84;
     $expanded7 = (($expanded8) - 1)|0;
     $expanded6 = $expanded7 ^ -1;
     $85 = $83 & $expanded6;
     $86 = $85;
     $87 = HEAP32[$86>>2]|0;
     $arglist_next = ((($86)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     $$0259 = $87;$$2271 = 0;$storemerge278 = $61;
    } else {
     $$0259 = 0;$$2271 = 0;$storemerge278 = $61;
    }
   }
   HEAP32[$5>>2] = $storemerge278;
   $88 = ($$0259|0)<(0);
   $89 = $$0262$lcssa | 8192;
   $90 = (0 - ($$0259))|0;
   $$$0262 = $88 ? $89 : $$0262$lcssa;
   $$$0259 = $88 ? $90 : $$0259;
   $$1260 = $$$0259;$$1263 = $$$0262;$$3272 = $$2271;$94 = $storemerge278;
  } else {
   $91 = (_getint_443($5)|0);
   $92 = ($91|0)<(0);
   if ($92) {
    $$0 = -1;
    break;
   }
   $$pre346 = HEAP32[$5>>2]|0;
   $$1260 = $91;$$1263 = $$0262$lcssa;$$3272 = $$1270;$94 = $$pre346;
  }
  $93 = HEAP8[$94>>0]|0;
  $95 = ($93<<24>>24)==(46);
  do {
   if ($95) {
    $96 = ((($94)) + 1|0);
    $97 = HEAP8[$96>>0]|0;
    $98 = ($97<<24>>24)==(42);
    if (!($98)) {
     $125 = ((($94)) + 1|0);
     HEAP32[$5>>2] = $125;
     $126 = (_getint_443($5)|0);
     $$pre347$pre = HEAP32[$5>>2]|0;
     $$0254 = $126;$$pre347 = $$pre347$pre;
     break;
    }
    $99 = ((($94)) + 2|0);
    $100 = HEAP8[$99>>0]|0;
    $101 = $100 << 24 >> 24;
    $isdigittmp274 = (($101) + -48)|0;
    $isdigit275 = ($isdigittmp274>>>0)<(10);
    if ($isdigit275) {
     $102 = ((($94)) + 3|0);
     $103 = HEAP8[$102>>0]|0;
     $104 = ($103<<24>>24)==(36);
     if ($104) {
      $105 = (($4) + ($isdigittmp274<<2)|0);
      HEAP32[$105>>2] = 10;
      $106 = HEAP8[$99>>0]|0;
      $107 = $106 << 24 >> 24;
      $108 = (($107) + -48)|0;
      $109 = (($3) + ($108<<3)|0);
      $110 = $109;
      $111 = $110;
      $112 = HEAP32[$111>>2]|0;
      $113 = (($110) + 4)|0;
      $114 = $113;
      $115 = HEAP32[$114>>2]|0;
      $116 = ((($94)) + 4|0);
      HEAP32[$5>>2] = $116;
      $$0254 = $112;$$pre347 = $116;
      break;
     }
    }
    $117 = ($$3272|0)==(0);
    if (!($117)) {
     $$0 = -1;
     break L1;
    }
    if ($10) {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $118 = $arglist_current2;
     $119 = ((0) + 4|0);
     $expanded11 = $119;
     $expanded10 = (($expanded11) - 1)|0;
     $120 = (($118) + ($expanded10))|0;
     $121 = ((0) + 4|0);
     $expanded15 = $121;
     $expanded14 = (($expanded15) - 1)|0;
     $expanded13 = $expanded14 ^ -1;
     $122 = $120 & $expanded13;
     $123 = $122;
     $124 = HEAP32[$123>>2]|0;
     $arglist_next3 = ((($123)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $330 = $124;
    } else {
     $330 = 0;
    }
    HEAP32[$5>>2] = $99;
    $$0254 = $330;$$pre347 = $99;
   } else {
    $$0254 = -1;$$pre347 = $94;
   }
  } while(0);
  $$0252 = 0;$128 = $$pre347;
  while(1) {
   $127 = HEAP8[$128>>0]|0;
   $129 = $127 << 24 >> 24;
   $130 = (($129) + -65)|0;
   $131 = ($130>>>0)>(57);
   if ($131) {
    $$0 = -1;
    break L1;
   }
   $132 = ((($128)) + 1|0);
   HEAP32[$5>>2] = $132;
   $133 = HEAP8[$128>>0]|0;
   $134 = $133 << 24 >> 24;
   $135 = (($134) + -65)|0;
   $136 = ((38897 + (($$0252*58)|0)|0) + ($135)|0);
   $137 = HEAP8[$136>>0]|0;
   $138 = $137&255;
   $139 = (($138) + -1)|0;
   $140 = ($139>>>0)<(8);
   if ($140) {
    $$0252 = $138;$128 = $132;
   } else {
    break;
   }
  }
  $141 = ($137<<24>>24)==(0);
  if ($141) {
   $$0 = -1;
   break;
  }
  $142 = ($137<<24>>24)==(19);
  $143 = ($$0253|0)>(-1);
  do {
   if ($142) {
    if ($143) {
     $$0 = -1;
     break L1;
    } else {
     label = 49;
    }
   } else {
    if ($143) {
     $144 = (($4) + ($$0253<<2)|0);
     HEAP32[$144>>2] = $138;
     $145 = (($3) + ($$0253<<3)|0);
     $146 = $145;
     $147 = $146;
     $148 = HEAP32[$147>>2]|0;
     $149 = (($146) + 4)|0;
     $150 = $149;
     $151 = HEAP32[$150>>2]|0;
     $152 = $6;
     $153 = $152;
     HEAP32[$153>>2] = $148;
     $154 = (($152) + 4)|0;
     $155 = $154;
     HEAP32[$155>>2] = $151;
     label = 49;
     break;
    }
    if (!($10)) {
     $$0 = 0;
     break L1;
    }
    _pop_arg_445($6,$138,$2);
   }
  } while(0);
  if ((label|0) == 49) {
   label = 0;
   if (!($10)) {
    $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
    continue;
   }
  }
  $156 = HEAP8[$128>>0]|0;
  $157 = $156 << 24 >> 24;
  $158 = ($$0252|0)!=(0);
  $159 = $157 & 15;
  $160 = ($159|0)==(3);
  $or$cond281 = $158 & $160;
  $161 = $157 & -33;
  $$0235 = $or$cond281 ? $161 : $157;
  $162 = $$1263 & 8192;
  $163 = ($162|0)==(0);
  $164 = $$1263 & -65537;
  $$1263$ = $163 ? $$1263 : $164;
  L71: do {
   switch ($$0235|0) {
   case 110:  {
    $trunc = $$0252&255;
    switch ($trunc<<24>>24) {
    case 0:  {
     $171 = HEAP32[$6>>2]|0;
     HEAP32[$171>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 1:  {
     $172 = HEAP32[$6>>2]|0;
     HEAP32[$172>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 2:  {
     $173 = ($$1248|0)<(0);
     $174 = $173 << 31 >> 31;
     $175 = HEAP32[$6>>2]|0;
     $176 = $175;
     $177 = $176;
     HEAP32[$177>>2] = $$1248;
     $178 = (($176) + 4)|0;
     $179 = $178;
     HEAP32[$179>>2] = $174;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 3:  {
     $180 = $$1248&65535;
     $181 = HEAP32[$6>>2]|0;
     HEAP16[$181>>1] = $180;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 4:  {
     $182 = $$1248&255;
     $183 = HEAP32[$6>>2]|0;
     HEAP8[$183>>0] = $182;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 6:  {
     $184 = HEAP32[$6>>2]|0;
     HEAP32[$184>>2] = $$1248;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    case 7:  {
     $185 = ($$1248|0)<(0);
     $186 = $185 << 31 >> 31;
     $187 = HEAP32[$6>>2]|0;
     $188 = $187;
     $189 = $188;
     HEAP32[$189>>2] = $$1248;
     $190 = (($188) + 4)|0;
     $191 = $190;
     HEAP32[$191>>2] = $186;
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
     break;
    }
    default: {
     $$0243 = 0;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
     continue L1;
    }
    }
    break;
   }
   case 112:  {
    $192 = ($$0254>>>0)>(8);
    $193 = $192 ? $$0254 : 8;
    $194 = $$1263$ | 8;
    $$1236 = 120;$$1255 = $193;$$3265 = $194;
    label = 61;
    break;
   }
   case 88: case 120:  {
    $$1236 = $$0235;$$1255 = $$0254;$$3265 = $$1263$;
    label = 61;
    break;
   }
   case 111:  {
    $210 = $6;
    $211 = $210;
    $212 = HEAP32[$211>>2]|0;
    $213 = (($210) + 4)|0;
    $214 = $213;
    $215 = HEAP32[$214>>2]|0;
    $216 = (_fmt_o($212,$215,$11)|0);
    $217 = $$1263$ & 8;
    $218 = ($217|0)==(0);
    $219 = $216;
    $220 = (($12) - ($219))|0;
    $221 = ($$0254|0)>($220|0);
    $222 = (($220) + 1)|0;
    $223 = $218 | $221;
    $$0254$$0254$ = $223 ? $$0254 : $222;
    $$0228 = $216;$$1233 = 0;$$1238 = 39361;$$2256 = $$0254$$0254$;$$4266 = $$1263$;$247 = $212;$249 = $215;
    label = 67;
    break;
   }
   case 105: case 100:  {
    $224 = $6;
    $225 = $224;
    $226 = HEAP32[$225>>2]|0;
    $227 = (($224) + 4)|0;
    $228 = $227;
    $229 = HEAP32[$228>>2]|0;
    $230 = ($229|0)<(0);
    if ($230) {
     $231 = (_i64Subtract(0,0,($226|0),($229|0))|0);
     $232 = tempRet0;
     $233 = $6;
     $234 = $233;
     HEAP32[$234>>2] = $231;
     $235 = (($233) + 4)|0;
     $236 = $235;
     HEAP32[$236>>2] = $232;
     $$0232 = 1;$$0237 = 39361;$242 = $231;$243 = $232;
     label = 66;
     break L71;
    } else {
     $237 = $$1263$ & 2048;
     $238 = ($237|0)==(0);
     $239 = $$1263$ & 1;
     $240 = ($239|0)==(0);
     $$ = $240 ? 39361 : (39363);
     $$$ = $238 ? $$ : (39362);
     $241 = $$1263$ & 2049;
     $narrow = ($241|0)!=(0);
     $$284$ = $narrow&1;
     $$0232 = $$284$;$$0237 = $$$;$242 = $226;$243 = $229;
     label = 66;
     break L71;
    }
    break;
   }
   case 117:  {
    $165 = $6;
    $166 = $165;
    $167 = HEAP32[$166>>2]|0;
    $168 = (($165) + 4)|0;
    $169 = $168;
    $170 = HEAP32[$169>>2]|0;
    $$0232 = 0;$$0237 = 39361;$242 = $167;$243 = $170;
    label = 66;
    break;
   }
   case 99:  {
    $259 = $6;
    $260 = $259;
    $261 = HEAP32[$260>>2]|0;
    $262 = (($259) + 4)|0;
    $263 = $262;
    $264 = HEAP32[$263>>2]|0;
    $265 = $261&255;
    HEAP8[$13>>0] = $265;
    $$2 = $13;$$2234 = 0;$$2239 = 39361;$$2251 = $11;$$5 = 1;$$6268 = $164;
    break;
   }
   case 109:  {
    $266 = (___errno_location()|0);
    $267 = HEAP32[$266>>2]|0;
    $268 = (_strerror($267)|0);
    $$1 = $268;
    label = 71;
    break;
   }
   case 115:  {
    $269 = HEAP32[$6>>2]|0;
    $270 = ($269|0)!=(0|0);
    $271 = $270 ? $269 : 39371;
    $$1 = $271;
    label = 71;
    break;
   }
   case 67:  {
    $278 = $6;
    $279 = $278;
    $280 = HEAP32[$279>>2]|0;
    $281 = (($278) + 4)|0;
    $282 = $281;
    $283 = HEAP32[$282>>2]|0;
    HEAP32[$8>>2] = $280;
    HEAP32[$14>>2] = 0;
    HEAP32[$6>>2] = $8;
    $$4258355 = -1;$331 = $8;
    label = 75;
    break;
   }
   case 83:  {
    $$pre349 = HEAP32[$6>>2]|0;
    $284 = ($$0254|0)==(0);
    if ($284) {
     _pad_448($0,32,$$1260,0,$$1263$);
     $$0240$lcssa357 = 0;
     label = 84;
    } else {
     $$4258355 = $$0254;$331 = $$pre349;
     label = 75;
    }
    break;
   }
   case 65: case 71: case 70: case 69: case 97: case 103: case 102: case 101:  {
    $306 = +HEAPF64[$6>>3];
    $307 = (_fmt_fp($0,$306,$$1260,$$0254,$$1263$,$$0235)|0);
    $$0243 = $307;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
    continue L1;
    break;
   }
   default: {
    $$2 = $21;$$2234 = 0;$$2239 = 39361;$$2251 = $11;$$5 = $$0254;$$6268 = $$1263$;
   }
   }
  } while(0);
  L95: do {
   if ((label|0) == 61) {
    label = 0;
    $195 = $6;
    $196 = $195;
    $197 = HEAP32[$196>>2]|0;
    $198 = (($195) + 4)|0;
    $199 = $198;
    $200 = HEAP32[$199>>2]|0;
    $201 = $$1236 & 32;
    $202 = (_fmt_x($197,$200,$11,$201)|0);
    $203 = ($197|0)==(0);
    $204 = ($200|0)==(0);
    $205 = $203 & $204;
    $206 = $$3265 & 8;
    $207 = ($206|0)==(0);
    $or$cond283 = $207 | $205;
    $208 = $$1236 >> 4;
    $209 = (39361 + ($208)|0);
    $$289 = $or$cond283 ? 39361 : $209;
    $$290 = $or$cond283 ? 0 : 2;
    $$0228 = $202;$$1233 = $$290;$$1238 = $$289;$$2256 = $$1255;$$4266 = $$3265;$247 = $197;$249 = $200;
    label = 67;
   }
   else if ((label|0) == 66) {
    label = 0;
    $244 = (_fmt_u($242,$243,$11)|0);
    $$0228 = $244;$$1233 = $$0232;$$1238 = $$0237;$$2256 = $$0254;$$4266 = $$1263$;$247 = $242;$249 = $243;
    label = 67;
   }
   else if ((label|0) == 71) {
    label = 0;
    $272 = (_memchr($$1,0,$$0254)|0);
    $273 = ($272|0)==(0|0);
    $274 = $272;
    $275 = $$1;
    $276 = (($274) - ($275))|0;
    $277 = (($$1) + ($$0254)|0);
    $$3257 = $273 ? $$0254 : $276;
    $$1250 = $273 ? $277 : $272;
    $$2 = $$1;$$2234 = 0;$$2239 = 39361;$$2251 = $$1250;$$5 = $$3257;$$6268 = $164;
   }
   else if ((label|0) == 75) {
    label = 0;
    $$0229322 = $331;$$0240321 = 0;$$1244320 = 0;
    while(1) {
     $285 = HEAP32[$$0229322>>2]|0;
     $286 = ($285|0)==(0);
     if ($286) {
      $$0240$lcssa = $$0240321;$$2245 = $$1244320;
      break;
     }
     $287 = (_wctomb($9,$285)|0);
     $288 = ($287|0)<(0);
     $289 = (($$4258355) - ($$0240321))|0;
     $290 = ($287>>>0)>($289>>>0);
     $or$cond286 = $288 | $290;
     if ($or$cond286) {
      $$0240$lcssa = $$0240321;$$2245 = $287;
      break;
     }
     $291 = ((($$0229322)) + 4|0);
     $292 = (($287) + ($$0240321))|0;
     $293 = ($$4258355>>>0)>($292>>>0);
     if ($293) {
      $$0229322 = $291;$$0240321 = $292;$$1244320 = $287;
     } else {
      $$0240$lcssa = $292;$$2245 = $287;
      break;
     }
    }
    $294 = ($$2245|0)<(0);
    if ($294) {
     $$0 = -1;
     break L1;
    }
    _pad_448($0,32,$$1260,$$0240$lcssa,$$1263$);
    $295 = ($$0240$lcssa|0)==(0);
    if ($295) {
     $$0240$lcssa357 = 0;
     label = 84;
    } else {
     $$1230333 = $331;$$1241332 = 0;
     while(1) {
      $296 = HEAP32[$$1230333>>2]|0;
      $297 = ($296|0)==(0);
      if ($297) {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break L95;
      }
      $298 = (_wctomb($9,$296)|0);
      $299 = (($298) + ($$1241332))|0;
      $300 = ($299|0)>($$0240$lcssa|0);
      if ($300) {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break L95;
      }
      $301 = ((($$1230333)) + 4|0);
      _out_442($0,$9,$298);
      $302 = ($299>>>0)<($$0240$lcssa>>>0);
      if ($302) {
       $$1230333 = $301;$$1241332 = $299;
      } else {
       $$0240$lcssa357 = $$0240$lcssa;
       label = 84;
       break;
      }
     }
    }
   }
  } while(0);
  if ((label|0) == 67) {
   label = 0;
   $245 = ($$2256|0)>(-1);
   $246 = $$4266 & -65537;
   $$$4266 = $245 ? $246 : $$4266;
   $248 = ($247|0)!=(0);
   $250 = ($249|0)!=(0);
   $251 = $248 | $250;
   $252 = ($$2256|0)!=(0);
   $or$cond = $252 | $251;
   $253 = $$0228;
   $254 = (($12) - ($253))|0;
   $255 = $251 ^ 1;
   $256 = $255&1;
   $257 = (($256) + ($254))|0;
   $258 = ($$2256|0)>($257|0);
   $$2256$ = $258 ? $$2256 : $257;
   $$2256$$$2256 = $or$cond ? $$2256$ : $$2256;
   $$0228$ = $or$cond ? $$0228 : $11;
   $$2 = $$0228$;$$2234 = $$1233;$$2239 = $$1238;$$2251 = $11;$$5 = $$2256$$$2256;$$6268 = $$$4266;
  }
  else if ((label|0) == 84) {
   label = 0;
   $303 = $$1263$ ^ 8192;
   _pad_448($0,32,$$1260,$$0240$lcssa357,$303);
   $304 = ($$1260|0)>($$0240$lcssa357|0);
   $305 = $304 ? $$1260 : $$0240$lcssa357;
   $$0243 = $305;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
   continue;
  }
  $308 = $$2251;
  $309 = $$2;
  $310 = (($308) - ($309))|0;
  $311 = ($$5|0)<($310|0);
  $$$5 = $311 ? $310 : $$5;
  $312 = (($$$5) + ($$2234))|0;
  $313 = ($$1260|0)<($312|0);
  $$2261 = $313 ? $312 : $$1260;
  _pad_448($0,32,$$2261,$312,$$6268);
  _out_442($0,$$2239,$$2234);
  $314 = $$6268 ^ 65536;
  _pad_448($0,48,$$2261,$312,$314);
  _pad_448($0,48,$$$5,$310,0);
  _out_442($0,$$2,$310);
  $315 = $$6268 ^ 8192;
  _pad_448($0,32,$$2261,$312,$315);
  $$0243 = $$2261;$$0247 = $$1248;$$0269 = $$3272;$21 = $132;
 }
 L114: do {
  if ((label|0) == 87) {
   $316 = ($0|0)==(0|0);
   if ($316) {
    $317 = ($$0269|0)==(0);
    if ($317) {
     $$0 = 0;
    } else {
     $$2242305 = 1;
     while(1) {
      $318 = (($4) + ($$2242305<<2)|0);
      $319 = HEAP32[$318>>2]|0;
      $320 = ($319|0)==(0);
      if ($320) {
       $$3303 = $$2242305;
       break;
      }
      $321 = (($3) + ($$2242305<<3)|0);
      _pop_arg_445($321,$319,$2);
      $322 = (($$2242305) + 1)|0;
      $323 = ($322|0)<(10);
      if ($323) {
       $$2242305 = $322;
      } else {
       $$0 = 1;
       break L114;
      }
     }
     while(1) {
      $326 = (($4) + ($$3303<<2)|0);
      $327 = HEAP32[$326>>2]|0;
      $328 = ($327|0)==(0);
      $324 = (($$3303) + 1)|0;
      if (!($328)) {
       $$0 = -1;
       break L114;
      }
      $325 = ($324|0)<(10);
      if ($325) {
       $$3303 = $324;
      } else {
       $$0 = 1;
       break;
      }
     }
    }
   } else {
    $$0 = $$1248;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _out_442($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = $3 & 32;
 $5 = ($4|0)==(0);
 if ($5) {
  (___fwritex($1,$2,$0)|0);
 }
 return;
}
function _getint_443($0) {
 $0 = $0|0;
 var $$0$lcssa = 0, $$06 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $isdigit = 0, $isdigit5 = 0, $isdigittmp = 0, $isdigittmp4 = 0, $isdigittmp7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $isdigittmp4 = (($3) + -48)|0;
 $isdigit5 = ($isdigittmp4>>>0)<(10);
 if ($isdigit5) {
  $$06 = 0;$7 = $1;$isdigittmp7 = $isdigittmp4;
  while(1) {
   $4 = ($$06*10)|0;
   $5 = (($isdigittmp7) + ($4))|0;
   $6 = ((($7)) + 1|0);
   HEAP32[$0>>2] = $6;
   $8 = HEAP8[$6>>0]|0;
   $9 = $8 << 24 >> 24;
   $isdigittmp = (($9) + -48)|0;
   $isdigit = ($isdigittmp>>>0)<(10);
   if ($isdigit) {
    $$06 = $5;$7 = $6;$isdigittmp7 = $isdigittmp;
   } else {
    $$0$lcssa = $5;
    break;
   }
  }
 } else {
  $$0$lcssa = 0;
 }
 return ($$0$lcssa|0);
}
function _pop_arg_445($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$mask = 0, $$mask31 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $arglist_current = 0, $arglist_current11 = 0, $arglist_current14 = 0, $arglist_current17 = 0;
 var $arglist_current2 = 0, $arglist_current20 = 0, $arglist_current23 = 0, $arglist_current26 = 0, $arglist_current5 = 0, $arglist_current8 = 0, $arglist_next = 0, $arglist_next12 = 0, $arglist_next15 = 0, $arglist_next18 = 0, $arglist_next21 = 0, $arglist_next24 = 0, $arglist_next27 = 0, $arglist_next3 = 0, $arglist_next6 = 0, $arglist_next9 = 0, $expanded = 0, $expanded28 = 0, $expanded30 = 0, $expanded31 = 0;
 var $expanded32 = 0, $expanded34 = 0, $expanded35 = 0, $expanded37 = 0, $expanded38 = 0, $expanded39 = 0, $expanded41 = 0, $expanded42 = 0, $expanded44 = 0, $expanded45 = 0, $expanded46 = 0, $expanded48 = 0, $expanded49 = 0, $expanded51 = 0, $expanded52 = 0, $expanded53 = 0, $expanded55 = 0, $expanded56 = 0, $expanded58 = 0, $expanded59 = 0;
 var $expanded60 = 0, $expanded62 = 0, $expanded63 = 0, $expanded65 = 0, $expanded66 = 0, $expanded67 = 0, $expanded69 = 0, $expanded70 = 0, $expanded72 = 0, $expanded73 = 0, $expanded74 = 0, $expanded76 = 0, $expanded77 = 0, $expanded79 = 0, $expanded80 = 0, $expanded81 = 0, $expanded83 = 0, $expanded84 = 0, $expanded86 = 0, $expanded87 = 0;
 var $expanded88 = 0, $expanded90 = 0, $expanded91 = 0, $expanded93 = 0, $expanded94 = 0, $expanded95 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(20);
 L1: do {
  if (!($3)) {
   do {
    switch ($1|0) {
    case 9:  {
     $arglist_current = HEAP32[$2>>2]|0;
     $4 = $arglist_current;
     $5 = ((0) + 4|0);
     $expanded28 = $5;
     $expanded = (($expanded28) - 1)|0;
     $6 = (($4) + ($expanded))|0;
     $7 = ((0) + 4|0);
     $expanded32 = $7;
     $expanded31 = (($expanded32) - 1)|0;
     $expanded30 = $expanded31 ^ -1;
     $8 = $6 & $expanded30;
     $9 = $8;
     $10 = HEAP32[$9>>2]|0;
     $arglist_next = ((($9)) + 4|0);
     HEAP32[$2>>2] = $arglist_next;
     HEAP32[$0>>2] = $10;
     break L1;
     break;
    }
    case 10:  {
     $arglist_current2 = HEAP32[$2>>2]|0;
     $11 = $arglist_current2;
     $12 = ((0) + 4|0);
     $expanded35 = $12;
     $expanded34 = (($expanded35) - 1)|0;
     $13 = (($11) + ($expanded34))|0;
     $14 = ((0) + 4|0);
     $expanded39 = $14;
     $expanded38 = (($expanded39) - 1)|0;
     $expanded37 = $expanded38 ^ -1;
     $15 = $13 & $expanded37;
     $16 = $15;
     $17 = HEAP32[$16>>2]|0;
     $arglist_next3 = ((($16)) + 4|0);
     HEAP32[$2>>2] = $arglist_next3;
     $18 = ($17|0)<(0);
     $19 = $18 << 31 >> 31;
     $20 = $0;
     $21 = $20;
     HEAP32[$21>>2] = $17;
     $22 = (($20) + 4)|0;
     $23 = $22;
     HEAP32[$23>>2] = $19;
     break L1;
     break;
    }
    case 11:  {
     $arglist_current5 = HEAP32[$2>>2]|0;
     $24 = $arglist_current5;
     $25 = ((0) + 4|0);
     $expanded42 = $25;
     $expanded41 = (($expanded42) - 1)|0;
     $26 = (($24) + ($expanded41))|0;
     $27 = ((0) + 4|0);
     $expanded46 = $27;
     $expanded45 = (($expanded46) - 1)|0;
     $expanded44 = $expanded45 ^ -1;
     $28 = $26 & $expanded44;
     $29 = $28;
     $30 = HEAP32[$29>>2]|0;
     $arglist_next6 = ((($29)) + 4|0);
     HEAP32[$2>>2] = $arglist_next6;
     $31 = $0;
     $32 = $31;
     HEAP32[$32>>2] = $30;
     $33 = (($31) + 4)|0;
     $34 = $33;
     HEAP32[$34>>2] = 0;
     break L1;
     break;
    }
    case 12:  {
     $arglist_current8 = HEAP32[$2>>2]|0;
     $35 = $arglist_current8;
     $36 = ((0) + 8|0);
     $expanded49 = $36;
     $expanded48 = (($expanded49) - 1)|0;
     $37 = (($35) + ($expanded48))|0;
     $38 = ((0) + 8|0);
     $expanded53 = $38;
     $expanded52 = (($expanded53) - 1)|0;
     $expanded51 = $expanded52 ^ -1;
     $39 = $37 & $expanded51;
     $40 = $39;
     $41 = $40;
     $42 = $41;
     $43 = HEAP32[$42>>2]|0;
     $44 = (($41) + 4)|0;
     $45 = $44;
     $46 = HEAP32[$45>>2]|0;
     $arglist_next9 = ((($40)) + 8|0);
     HEAP32[$2>>2] = $arglist_next9;
     $47 = $0;
     $48 = $47;
     HEAP32[$48>>2] = $43;
     $49 = (($47) + 4)|0;
     $50 = $49;
     HEAP32[$50>>2] = $46;
     break L1;
     break;
    }
    case 13:  {
     $arglist_current11 = HEAP32[$2>>2]|0;
     $51 = $arglist_current11;
     $52 = ((0) + 4|0);
     $expanded56 = $52;
     $expanded55 = (($expanded56) - 1)|0;
     $53 = (($51) + ($expanded55))|0;
     $54 = ((0) + 4|0);
     $expanded60 = $54;
     $expanded59 = (($expanded60) - 1)|0;
     $expanded58 = $expanded59 ^ -1;
     $55 = $53 & $expanded58;
     $56 = $55;
     $57 = HEAP32[$56>>2]|0;
     $arglist_next12 = ((($56)) + 4|0);
     HEAP32[$2>>2] = $arglist_next12;
     $58 = $57&65535;
     $59 = $58 << 16 >> 16;
     $60 = ($59|0)<(0);
     $61 = $60 << 31 >> 31;
     $62 = $0;
     $63 = $62;
     HEAP32[$63>>2] = $59;
     $64 = (($62) + 4)|0;
     $65 = $64;
     HEAP32[$65>>2] = $61;
     break L1;
     break;
    }
    case 14:  {
     $arglist_current14 = HEAP32[$2>>2]|0;
     $66 = $arglist_current14;
     $67 = ((0) + 4|0);
     $expanded63 = $67;
     $expanded62 = (($expanded63) - 1)|0;
     $68 = (($66) + ($expanded62))|0;
     $69 = ((0) + 4|0);
     $expanded67 = $69;
     $expanded66 = (($expanded67) - 1)|0;
     $expanded65 = $expanded66 ^ -1;
     $70 = $68 & $expanded65;
     $71 = $70;
     $72 = HEAP32[$71>>2]|0;
     $arglist_next15 = ((($71)) + 4|0);
     HEAP32[$2>>2] = $arglist_next15;
     $$mask31 = $72 & 65535;
     $73 = $0;
     $74 = $73;
     HEAP32[$74>>2] = $$mask31;
     $75 = (($73) + 4)|0;
     $76 = $75;
     HEAP32[$76>>2] = 0;
     break L1;
     break;
    }
    case 15:  {
     $arglist_current17 = HEAP32[$2>>2]|0;
     $77 = $arglist_current17;
     $78 = ((0) + 4|0);
     $expanded70 = $78;
     $expanded69 = (($expanded70) - 1)|0;
     $79 = (($77) + ($expanded69))|0;
     $80 = ((0) + 4|0);
     $expanded74 = $80;
     $expanded73 = (($expanded74) - 1)|0;
     $expanded72 = $expanded73 ^ -1;
     $81 = $79 & $expanded72;
     $82 = $81;
     $83 = HEAP32[$82>>2]|0;
     $arglist_next18 = ((($82)) + 4|0);
     HEAP32[$2>>2] = $arglist_next18;
     $84 = $83&255;
     $85 = $84 << 24 >> 24;
     $86 = ($85|0)<(0);
     $87 = $86 << 31 >> 31;
     $88 = $0;
     $89 = $88;
     HEAP32[$89>>2] = $85;
     $90 = (($88) + 4)|0;
     $91 = $90;
     HEAP32[$91>>2] = $87;
     break L1;
     break;
    }
    case 16:  {
     $arglist_current20 = HEAP32[$2>>2]|0;
     $92 = $arglist_current20;
     $93 = ((0) + 4|0);
     $expanded77 = $93;
     $expanded76 = (($expanded77) - 1)|0;
     $94 = (($92) + ($expanded76))|0;
     $95 = ((0) + 4|0);
     $expanded81 = $95;
     $expanded80 = (($expanded81) - 1)|0;
     $expanded79 = $expanded80 ^ -1;
     $96 = $94 & $expanded79;
     $97 = $96;
     $98 = HEAP32[$97>>2]|0;
     $arglist_next21 = ((($97)) + 4|0);
     HEAP32[$2>>2] = $arglist_next21;
     $$mask = $98 & 255;
     $99 = $0;
     $100 = $99;
     HEAP32[$100>>2] = $$mask;
     $101 = (($99) + 4)|0;
     $102 = $101;
     HEAP32[$102>>2] = 0;
     break L1;
     break;
    }
    case 17:  {
     $arglist_current23 = HEAP32[$2>>2]|0;
     $103 = $arglist_current23;
     $104 = ((0) + 8|0);
     $expanded84 = $104;
     $expanded83 = (($expanded84) - 1)|0;
     $105 = (($103) + ($expanded83))|0;
     $106 = ((0) + 8|0);
     $expanded88 = $106;
     $expanded87 = (($expanded88) - 1)|0;
     $expanded86 = $expanded87 ^ -1;
     $107 = $105 & $expanded86;
     $108 = $107;
     $109 = +HEAPF64[$108>>3];
     $arglist_next24 = ((($108)) + 8|0);
     HEAP32[$2>>2] = $arglist_next24;
     HEAPF64[$0>>3] = $109;
     break L1;
     break;
    }
    case 18:  {
     $arglist_current26 = HEAP32[$2>>2]|0;
     $110 = $arglist_current26;
     $111 = ((0) + 8|0);
     $expanded91 = $111;
     $expanded90 = (($expanded91) - 1)|0;
     $112 = (($110) + ($expanded90))|0;
     $113 = ((0) + 8|0);
     $expanded95 = $113;
     $expanded94 = (($expanded95) - 1)|0;
     $expanded93 = $expanded94 ^ -1;
     $114 = $112 & $expanded93;
     $115 = $114;
     $116 = +HEAPF64[$115>>3];
     $arglist_next27 = ((($115)) + 8|0);
     HEAP32[$2>>2] = $arglist_next27;
     HEAPF64[$0>>3] = $116;
     break L1;
     break;
    }
    default: {
     break L1;
    }
    }
   } while(0);
  }
 } while(0);
 return;
}
function _fmt_x($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$05$lcssa = 0, $$056 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $4 = ($0|0)==(0);
 $5 = ($1|0)==(0);
 $6 = $4 & $5;
 if ($6) {
  $$05$lcssa = $2;
 } else {
  $$056 = $2;$15 = $1;$8 = $0;
  while(1) {
   $7 = $8 & 15;
   $9 = (39413 + ($7)|0);
   $10 = HEAP8[$9>>0]|0;
   $11 = $10&255;
   $12 = $11 | $3;
   $13 = $12&255;
   $14 = ((($$056)) + -1|0);
   HEAP8[$14>>0] = $13;
   $16 = (_bitshift64Lshr(($8|0),($15|0),4)|0);
   $17 = tempRet0;
   $18 = ($16|0)==(0);
   $19 = ($17|0)==(0);
   $20 = $18 & $19;
   if ($20) {
    $$05$lcssa = $14;
    break;
   } else {
    $$056 = $14;$15 = $17;$8 = $16;
   }
  }
 }
 return ($$05$lcssa|0);
}
function _fmt_o($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$lcssa = 0, $$06 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0);
 $4 = ($1|0)==(0);
 $5 = $3 & $4;
 if ($5) {
  $$0$lcssa = $2;
 } else {
  $$06 = $2;$11 = $1;$7 = $0;
  while(1) {
   $6 = $7&255;
   $8 = $6 & 7;
   $9 = $8 | 48;
   $10 = ((($$06)) + -1|0);
   HEAP8[$10>>0] = $9;
   $12 = (_bitshift64Lshr(($7|0),($11|0),3)|0);
   $13 = tempRet0;
   $14 = ($12|0)==(0);
   $15 = ($13|0)==(0);
   $16 = $14 & $15;
   if ($16) {
    $$0$lcssa = $10;
    break;
   } else {
    $$06 = $10;$11 = $13;$7 = $12;
   }
  }
 }
 return ($$0$lcssa|0);
}
function _fmt_u($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$010$lcssa$off0 = 0, $$012 = 0, $$09$lcssa = 0, $$0914 = 0, $$1$lcssa = 0, $$111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1>>>0)>(0);
 $4 = ($0>>>0)>(4294967295);
 $5 = ($1|0)==(0);
 $6 = $5 & $4;
 $7 = $3 | $6;
 if ($7) {
  $$0914 = $2;$8 = $0;$9 = $1;
  while(1) {
   $10 = (___uremdi3(($8|0),($9|0),10,0)|0);
   $11 = tempRet0;
   $12 = $10&255;
   $13 = $12 | 48;
   $14 = ((($$0914)) + -1|0);
   HEAP8[$14>>0] = $13;
   $15 = (___udivdi3(($8|0),($9|0),10,0)|0);
   $16 = tempRet0;
   $17 = ($9>>>0)>(9);
   $18 = ($8>>>0)>(4294967295);
   $19 = ($9|0)==(9);
   $20 = $19 & $18;
   $21 = $17 | $20;
   if ($21) {
    $$0914 = $14;$8 = $15;$9 = $16;
   } else {
    break;
   }
  }
  $$010$lcssa$off0 = $15;$$09$lcssa = $14;
 } else {
  $$010$lcssa$off0 = $0;$$09$lcssa = $2;
 }
 $22 = ($$010$lcssa$off0|0)==(0);
 if ($22) {
  $$1$lcssa = $$09$lcssa;
 } else {
  $$012 = $$010$lcssa$off0;$$111 = $$09$lcssa;
  while(1) {
   $23 = (($$012>>>0) % 10)&-1;
   $24 = $23 | 48;
   $25 = $24&255;
   $26 = ((($$111)) + -1|0);
   HEAP8[$26>>0] = $25;
   $27 = (($$012>>>0) / 10)&-1;
   $28 = ($$012>>>0)<(10);
   if ($28) {
    $$1$lcssa = $26;
    break;
   } else {
    $$012 = $27;$$111 = $26;
   }
  }
 }
 return ($$1$lcssa|0);
}
function _strerror($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___pthread_self_241()|0);
 $2 = ((($1)) + 188|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = (___strerror_l($0,$3)|0);
 return ($4|0);
}
function _pad_448($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$011 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(256|0);
 $5 = sp;
 $6 = $4 & 73728;
 $7 = ($6|0)==(0);
 $8 = ($2|0)>($3|0);
 $or$cond = $8 & $7;
 if ($or$cond) {
  $9 = (($2) - ($3))|0;
  $10 = ($9>>>0)<(256);
  $11 = $10 ? $9 : 256;
  _memset(($5|0),($1|0),($11|0))|0;
  $12 = ($9>>>0)>(255);
  if ($12) {
   $13 = (($2) - ($3))|0;
   $$011 = $9;
   while(1) {
    _out_442($0,$5,256);
    $14 = (($$011) + -256)|0;
    $15 = ($14>>>0)>(255);
    if ($15) {
     $$011 = $14;
    } else {
     break;
    }
   }
   $16 = $13 & 255;
   $$0$lcssa = $16;
  } else {
   $$0$lcssa = $9;
  }
  _out_442($0,$5,$$0$lcssa);
 }
 STACKTOP = sp;return;
}
function _wctomb($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = (_wcrtomb($0,$1,0)|0);
  $$0 = $3;
 }
 return ($$0|0);
}
function _fmt_fp($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$ = 0, $$$ = 0, $$$$559 = 0.0, $$$3484 = 0, $$$3484691 = 0, $$$3484692 = 0, $$$3501 = 0, $$$4502 = 0, $$$542 = 0.0, $$$559 = 0.0, $$0 = 0, $$0463$lcssa = 0, $$0463584 = 0, $$0464594 = 0, $$0471 = 0.0, $$0479 = 0, $$0487642 = 0, $$0488 = 0, $$0488653 = 0, $$0488655 = 0;
 var $$0496$$9 = 0, $$0497654 = 0, $$0498 = 0, $$0509582 = 0.0, $$0510 = 0, $$0511 = 0, $$0514637 = 0, $$0520 = 0, $$0521 = 0, $$0521$ = 0, $$0523 = 0, $$0525 = 0, $$0527 = 0, $$0527629 = 0, $$0527631 = 0, $$0530636 = 0, $$1465 = 0, $$1467 = 0.0, $$1469 = 0.0, $$1472 = 0.0;
 var $$1480 = 0, $$1482$lcssa = 0, $$1482661 = 0, $$1489641 = 0, $$1499$lcssa = 0, $$1499660 = 0, $$1508583 = 0, $$1512$lcssa = 0, $$1512607 = 0, $$1515 = 0, $$1524 = 0, $$1526 = 0, $$1528614 = 0, $$1531$lcssa = 0, $$1531630 = 0, $$1598 = 0, $$2 = 0, $$2473 = 0.0, $$2476 = 0, $$2476$$547 = 0;
 var $$2476$$549 = 0, $$2483$ph = 0, $$2500 = 0, $$2513 = 0, $$2516618 = 0, $$2529 = 0, $$2532617 = 0, $$3 = 0.0, $$3477 = 0, $$3484$lcssa = 0, $$3484648 = 0, $$3501$lcssa = 0, $$3501647 = 0, $$3533613 = 0, $$4 = 0.0, $$4478$lcssa = 0, $$4478590 = 0, $$4492 = 0, $$4502 = 0, $$4518 = 0;
 var $$5$lcssa = 0, $$534$ = 0, $$539 = 0, $$539$ = 0, $$542 = 0.0, $$546 = 0, $$548 = 0, $$5486$lcssa = 0, $$5486623 = 0, $$5493597 = 0, $$5519$ph = 0, $$555 = 0, $$556 = 0, $$559 = 0.0, $$5602 = 0, $$6 = 0, $$6494589 = 0, $$7495601 = 0, $$7505 = 0, $$7505$ = 0;
 var $$7505$ph = 0, $$8 = 0, $$9$ph = 0, $$lcssa673 = 0, $$neg = 0, $$neg567 = 0, $$pn = 0, $$pn566 = 0, $$pr = 0, $$pr564 = 0, $$pre = 0, $$pre$phi690Z2D = 0, $$pre689 = 0, $$sink545$lcssa = 0, $$sink545622 = 0, $$sink562 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0;
 var $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0.0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0.0, $117 = 0.0, $118 = 0.0, $119 = 0, $12 = 0, $120 = 0;
 var $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0;
 var $14 = 0.0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0;
 var $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0;
 var $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0;
 var $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0;
 var $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0.0, $229 = 0.0, $23 = 0;
 var $230 = 0, $231 = 0.0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0;
 var $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0;
 var $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0;
 var $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0;
 var $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0;
 var $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0;
 var $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0.0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0;
 var $358 = 0, $359 = 0, $36 = 0.0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0;
 var $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $51 = 0.0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0;
 var $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $exitcond = 0;
 var $narrow = 0, $not$ = 0, $notlhs = 0, $notrhs = 0, $or$cond = 0, $or$cond3$not = 0, $or$cond537 = 0, $or$cond541 = 0, $or$cond544 = 0, $or$cond554 = 0, $or$cond6 = 0, $scevgep684 = 0, $scevgep684685 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 560|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(560|0);
 $6 = sp + 8|0;
 $7 = sp;
 $8 = sp + 524|0;
 $9 = $8;
 $10 = sp + 512|0;
 HEAP32[$7>>2] = 0;
 $11 = ((($10)) + 12|0);
 (___DOUBLE_BITS_449($1)|0);
 $12 = tempRet0;
 $13 = ($12|0)<(0);
 if ($13) {
  $14 = -$1;
  $$0471 = $14;$$0520 = 1;$$0521 = 39378;
 } else {
  $15 = $4 & 2048;
  $16 = ($15|0)==(0);
  $17 = $4 & 1;
  $18 = ($17|0)==(0);
  $$ = $18 ? (39379) : (39384);
  $$$ = $16 ? $$ : (39381);
  $19 = $4 & 2049;
  $narrow = ($19|0)!=(0);
  $$534$ = $narrow&1;
  $$0471 = $1;$$0520 = $$534$;$$0521 = $$$;
 }
 (___DOUBLE_BITS_449($$0471)|0);
 $20 = tempRet0;
 $21 = $20 & 2146435072;
 $22 = ($21>>>0)<(2146435072);
 $23 = (0)<(0);
 $24 = ($21|0)==(2146435072);
 $25 = $24 & $23;
 $26 = $22 | $25;
 do {
  if ($26) {
   $35 = (+_frexpl($$0471,$7));
   $36 = $35 * 2.0;
   $37 = $36 != 0.0;
   if ($37) {
    $38 = HEAP32[$7>>2]|0;
    $39 = (($38) + -1)|0;
    HEAP32[$7>>2] = $39;
   }
   $40 = $5 | 32;
   $41 = ($40|0)==(97);
   if ($41) {
    $42 = $5 & 32;
    $43 = ($42|0)==(0);
    $44 = ((($$0521)) + 9|0);
    $$0521$ = $43 ? $$0521 : $44;
    $45 = $$0520 | 2;
    $46 = ($3>>>0)>(11);
    $47 = (12 - ($3))|0;
    $48 = ($47|0)==(0);
    $49 = $46 | $48;
    do {
     if ($49) {
      $$1472 = $36;
     } else {
      $$0509582 = 8.0;$$1508583 = $47;
      while(1) {
       $50 = (($$1508583) + -1)|0;
       $51 = $$0509582 * 16.0;
       $52 = ($50|0)==(0);
       if ($52) {
        break;
       } else {
        $$0509582 = $51;$$1508583 = $50;
       }
      }
      $53 = HEAP8[$$0521$>>0]|0;
      $54 = ($53<<24>>24)==(45);
      if ($54) {
       $55 = -$36;
       $56 = $55 - $51;
       $57 = $51 + $56;
       $58 = -$57;
       $$1472 = $58;
       break;
      } else {
       $59 = $36 + $51;
       $60 = $59 - $51;
       $$1472 = $60;
       break;
      }
     }
    } while(0);
    $61 = HEAP32[$7>>2]|0;
    $62 = ($61|0)<(0);
    $63 = (0 - ($61))|0;
    $64 = $62 ? $63 : $61;
    $65 = ($64|0)<(0);
    $66 = $65 << 31 >> 31;
    $67 = (_fmt_u($64,$66,$11)|0);
    $68 = ($67|0)==($11|0);
    if ($68) {
     $69 = ((($10)) + 11|0);
     HEAP8[$69>>0] = 48;
     $$0511 = $69;
    } else {
     $$0511 = $67;
    }
    $70 = $61 >> 31;
    $71 = $70 & 2;
    $72 = (($71) + 43)|0;
    $73 = $72&255;
    $74 = ((($$0511)) + -1|0);
    HEAP8[$74>>0] = $73;
    $75 = (($5) + 15)|0;
    $76 = $75&255;
    $77 = ((($$0511)) + -2|0);
    HEAP8[$77>>0] = $76;
    $notrhs = ($3|0)<(1);
    $78 = $4 & 8;
    $79 = ($78|0)==(0);
    $$0523 = $8;$$2473 = $$1472;
    while(1) {
     $80 = (~~(($$2473)));
     $81 = (39413 + ($80)|0);
     $82 = HEAP8[$81>>0]|0;
     $83 = $82&255;
     $84 = $83 | $42;
     $85 = $84&255;
     $86 = ((($$0523)) + 1|0);
     HEAP8[$$0523>>0] = $85;
     $87 = (+($80|0));
     $88 = $$2473 - $87;
     $89 = $88 * 16.0;
     $90 = $86;
     $91 = (($90) - ($9))|0;
     $92 = ($91|0)==(1);
     if ($92) {
      $notlhs = $89 == 0.0;
      $or$cond3$not = $notrhs & $notlhs;
      $or$cond = $79 & $or$cond3$not;
      if ($or$cond) {
       $$1524 = $86;
      } else {
       $93 = ((($$0523)) + 2|0);
       HEAP8[$86>>0] = 46;
       $$1524 = $93;
      }
     } else {
      $$1524 = $86;
     }
     $94 = $89 != 0.0;
     if ($94) {
      $$0523 = $$1524;$$2473 = $89;
     } else {
      break;
     }
    }
    $95 = ($3|0)!=(0);
    $96 = $77;
    $97 = $11;
    $98 = $$1524;
    $99 = (($98) - ($9))|0;
    $100 = (($97) - ($96))|0;
    $101 = (($99) + -2)|0;
    $102 = ($101|0)<($3|0);
    $or$cond537 = $95 & $102;
    $103 = (($3) + 2)|0;
    $$pn = $or$cond537 ? $103 : $99;
    $$0525 = (($100) + ($45))|0;
    $104 = (($$0525) + ($$pn))|0;
    _pad_448($0,32,$2,$104,$4);
    _out_442($0,$$0521$,$45);
    $105 = $4 ^ 65536;
    _pad_448($0,48,$2,$104,$105);
    _out_442($0,$8,$99);
    $106 = (($$pn) - ($99))|0;
    _pad_448($0,48,$106,0,0);
    _out_442($0,$77,$100);
    $107 = $4 ^ 8192;
    _pad_448($0,32,$2,$104,$107);
    $$sink562 = $104;
    break;
   }
   $108 = ($3|0)<(0);
   $$539 = $108 ? 6 : $3;
   if ($37) {
    $109 = $36 * 268435456.0;
    $110 = HEAP32[$7>>2]|0;
    $111 = (($110) + -28)|0;
    HEAP32[$7>>2] = $111;
    $$3 = $109;$$pr = $111;
   } else {
    $$pre = HEAP32[$7>>2]|0;
    $$3 = $36;$$pr = $$pre;
   }
   $112 = ($$pr|0)<(0);
   $113 = ((($6)) + 288|0);
   $$556 = $112 ? $6 : $113;
   $$0498 = $$556;$$4 = $$3;
   while(1) {
    $114 = (~~(($$4))>>>0);
    HEAP32[$$0498>>2] = $114;
    $115 = ((($$0498)) + 4|0);
    $116 = (+($114>>>0));
    $117 = $$4 - $116;
    $118 = $117 * 1.0E+9;
    $119 = $118 != 0.0;
    if ($119) {
     $$0498 = $115;$$4 = $118;
    } else {
     break;
    }
   }
   $120 = ($$pr|0)>(0);
   if ($120) {
    $$1482661 = $$556;$$1499660 = $115;$121 = $$pr;
    while(1) {
     $122 = ($121|0)<(29);
     $123 = $122 ? $121 : 29;
     $$0488653 = ((($$1499660)) + -4|0);
     $124 = ($$0488653>>>0)<($$1482661>>>0);
     if ($124) {
      $$2483$ph = $$1482661;
     } else {
      $$0488655 = $$0488653;$$0497654 = 0;
      while(1) {
       $125 = HEAP32[$$0488655>>2]|0;
       $126 = (_bitshift64Shl(($125|0),0,($123|0))|0);
       $127 = tempRet0;
       $128 = (_i64Add(($126|0),($127|0),($$0497654|0),0)|0);
       $129 = tempRet0;
       $130 = (___uremdi3(($128|0),($129|0),1000000000,0)|0);
       $131 = tempRet0;
       HEAP32[$$0488655>>2] = $130;
       $132 = (___udivdi3(($128|0),($129|0),1000000000,0)|0);
       $133 = tempRet0;
       $$0488 = ((($$0488655)) + -4|0);
       $134 = ($$0488>>>0)<($$1482661>>>0);
       if ($134) {
        break;
       } else {
        $$0488655 = $$0488;$$0497654 = $132;
       }
      }
      $135 = ($132|0)==(0);
      if ($135) {
       $$2483$ph = $$1482661;
      } else {
       $136 = ((($$1482661)) + -4|0);
       HEAP32[$136>>2] = $132;
       $$2483$ph = $136;
      }
     }
     $$2500 = $$1499660;
     while(1) {
      $137 = ($$2500>>>0)>($$2483$ph>>>0);
      if (!($137)) {
       break;
      }
      $138 = ((($$2500)) + -4|0);
      $139 = HEAP32[$138>>2]|0;
      $140 = ($139|0)==(0);
      if ($140) {
       $$2500 = $138;
      } else {
       break;
      }
     }
     $141 = HEAP32[$7>>2]|0;
     $142 = (($141) - ($123))|0;
     HEAP32[$7>>2] = $142;
     $143 = ($142|0)>(0);
     if ($143) {
      $$1482661 = $$2483$ph;$$1499660 = $$2500;$121 = $142;
     } else {
      $$1482$lcssa = $$2483$ph;$$1499$lcssa = $$2500;$$pr564 = $142;
      break;
     }
    }
   } else {
    $$1482$lcssa = $$556;$$1499$lcssa = $115;$$pr564 = $$pr;
   }
   $144 = ($$pr564|0)<(0);
   if ($144) {
    $145 = (($$539) + 25)|0;
    $146 = (($145|0) / 9)&-1;
    $147 = (($146) + 1)|0;
    $148 = ($40|0)==(102);
    $$3484648 = $$1482$lcssa;$$3501647 = $$1499$lcssa;$150 = $$pr564;
    while(1) {
     $149 = (0 - ($150))|0;
     $151 = ($149|0)<(9);
     $152 = $151 ? $149 : 9;
     $153 = ($$3484648>>>0)<($$3501647>>>0);
     if ($153) {
      $157 = 1 << $152;
      $158 = (($157) + -1)|0;
      $159 = 1000000000 >>> $152;
      $$0487642 = 0;$$1489641 = $$3484648;
      while(1) {
       $160 = HEAP32[$$1489641>>2]|0;
       $161 = $160 & $158;
       $162 = $160 >>> $152;
       $163 = (($162) + ($$0487642))|0;
       HEAP32[$$1489641>>2] = $163;
       $164 = Math_imul($161, $159)|0;
       $165 = ((($$1489641)) + 4|0);
       $166 = ($165>>>0)<($$3501647>>>0);
       if ($166) {
        $$0487642 = $164;$$1489641 = $165;
       } else {
        break;
       }
      }
      $167 = HEAP32[$$3484648>>2]|0;
      $168 = ($167|0)==(0);
      $169 = ((($$3484648)) + 4|0);
      $$$3484 = $168 ? $169 : $$3484648;
      $170 = ($164|0)==(0);
      if ($170) {
       $$$3484692 = $$$3484;$$4502 = $$3501647;
      } else {
       $171 = ((($$3501647)) + 4|0);
       HEAP32[$$3501647>>2] = $164;
       $$$3484692 = $$$3484;$$4502 = $171;
      }
     } else {
      $154 = HEAP32[$$3484648>>2]|0;
      $155 = ($154|0)==(0);
      $156 = ((($$3484648)) + 4|0);
      $$$3484691 = $155 ? $156 : $$3484648;
      $$$3484692 = $$$3484691;$$4502 = $$3501647;
     }
     $172 = $148 ? $$556 : $$$3484692;
     $173 = $$4502;
     $174 = $172;
     $175 = (($173) - ($174))|0;
     $176 = $175 >> 2;
     $177 = ($176|0)>($147|0);
     $178 = (($172) + ($147<<2)|0);
     $$$4502 = $177 ? $178 : $$4502;
     $179 = HEAP32[$7>>2]|0;
     $180 = (($179) + ($152))|0;
     HEAP32[$7>>2] = $180;
     $181 = ($180|0)<(0);
     if ($181) {
      $$3484648 = $$$3484692;$$3501647 = $$$4502;$150 = $180;
     } else {
      $$3484$lcssa = $$$3484692;$$3501$lcssa = $$$4502;
      break;
     }
    }
   } else {
    $$3484$lcssa = $$1482$lcssa;$$3501$lcssa = $$1499$lcssa;
   }
   $182 = ($$3484$lcssa>>>0)<($$3501$lcssa>>>0);
   $183 = $$556;
   if ($182) {
    $184 = $$3484$lcssa;
    $185 = (($183) - ($184))|0;
    $186 = $185 >> 2;
    $187 = ($186*9)|0;
    $188 = HEAP32[$$3484$lcssa>>2]|0;
    $189 = ($188>>>0)<(10);
    if ($189) {
     $$1515 = $187;
    } else {
     $$0514637 = $187;$$0530636 = 10;
     while(1) {
      $190 = ($$0530636*10)|0;
      $191 = (($$0514637) + 1)|0;
      $192 = ($188>>>0)<($190>>>0);
      if ($192) {
       $$1515 = $191;
       break;
      } else {
       $$0514637 = $191;$$0530636 = $190;
      }
     }
    }
   } else {
    $$1515 = 0;
   }
   $193 = ($40|0)!=(102);
   $194 = $193 ? $$1515 : 0;
   $195 = (($$539) - ($194))|0;
   $196 = ($40|0)==(103);
   $197 = ($$539|0)!=(0);
   $198 = $197 & $196;
   $$neg = $198 << 31 >> 31;
   $199 = (($195) + ($$neg))|0;
   $200 = $$3501$lcssa;
   $201 = (($200) - ($183))|0;
   $202 = $201 >> 2;
   $203 = ($202*9)|0;
   $204 = (($203) + -9)|0;
   $205 = ($199|0)<($204|0);
   if ($205) {
    $206 = ((($$556)) + 4|0);
    $207 = (($199) + 9216)|0;
    $208 = (($207|0) / 9)&-1;
    $209 = (($208) + -1024)|0;
    $210 = (($206) + ($209<<2)|0);
    $211 = (($207|0) % 9)&-1;
    $$0527629 = (($211) + 1)|0;
    $212 = ($$0527629|0)<(9);
    if ($212) {
     $$0527631 = $$0527629;$$1531630 = 10;
     while(1) {
      $213 = ($$1531630*10)|0;
      $$0527 = (($$0527631) + 1)|0;
      $exitcond = ($$0527|0)==(9);
      if ($exitcond) {
       $$1531$lcssa = $213;
       break;
      } else {
       $$0527631 = $$0527;$$1531630 = $213;
      }
     }
    } else {
     $$1531$lcssa = 10;
    }
    $214 = HEAP32[$210>>2]|0;
    $215 = (($214>>>0) % ($$1531$lcssa>>>0))&-1;
    $216 = ($215|0)==(0);
    $217 = ((($210)) + 4|0);
    $218 = ($217|0)==($$3501$lcssa|0);
    $or$cond541 = $218 & $216;
    if ($or$cond541) {
     $$4492 = $210;$$4518 = $$1515;$$8 = $$3484$lcssa;
    } else {
     $219 = (($214>>>0) / ($$1531$lcssa>>>0))&-1;
     $220 = $219 & 1;
     $221 = ($220|0)==(0);
     $$542 = $221 ? 9007199254740992.0 : 9007199254740994.0;
     $222 = (($$1531$lcssa|0) / 2)&-1;
     $223 = ($215>>>0)<($222>>>0);
     $224 = ($215|0)==($222|0);
     $or$cond544 = $218 & $224;
     $$559 = $or$cond544 ? 1.0 : 1.5;
     $$$559 = $223 ? 0.5 : $$559;
     $225 = ($$0520|0)==(0);
     if ($225) {
      $$1467 = $$$559;$$1469 = $$542;
     } else {
      $226 = HEAP8[$$0521>>0]|0;
      $227 = ($226<<24>>24)==(45);
      $228 = -$$542;
      $229 = -$$$559;
      $$$542 = $227 ? $228 : $$542;
      $$$$559 = $227 ? $229 : $$$559;
      $$1467 = $$$$559;$$1469 = $$$542;
     }
     $230 = (($214) - ($215))|0;
     HEAP32[$210>>2] = $230;
     $231 = $$1469 + $$1467;
     $232 = $231 != $$1469;
     if ($232) {
      $233 = (($230) + ($$1531$lcssa))|0;
      HEAP32[$210>>2] = $233;
      $234 = ($233>>>0)>(999999999);
      if ($234) {
       $$5486623 = $$3484$lcssa;$$sink545622 = $210;
       while(1) {
        $235 = ((($$sink545622)) + -4|0);
        HEAP32[$$sink545622>>2] = 0;
        $236 = ($235>>>0)<($$5486623>>>0);
        if ($236) {
         $237 = ((($$5486623)) + -4|0);
         HEAP32[$237>>2] = 0;
         $$6 = $237;
        } else {
         $$6 = $$5486623;
        }
        $238 = HEAP32[$235>>2]|0;
        $239 = (($238) + 1)|0;
        HEAP32[$235>>2] = $239;
        $240 = ($239>>>0)>(999999999);
        if ($240) {
         $$5486623 = $$6;$$sink545622 = $235;
        } else {
         $$5486$lcssa = $$6;$$sink545$lcssa = $235;
         break;
        }
       }
      } else {
       $$5486$lcssa = $$3484$lcssa;$$sink545$lcssa = $210;
      }
      $241 = $$5486$lcssa;
      $242 = (($183) - ($241))|0;
      $243 = $242 >> 2;
      $244 = ($243*9)|0;
      $245 = HEAP32[$$5486$lcssa>>2]|0;
      $246 = ($245>>>0)<(10);
      if ($246) {
       $$4492 = $$sink545$lcssa;$$4518 = $244;$$8 = $$5486$lcssa;
      } else {
       $$2516618 = $244;$$2532617 = 10;
       while(1) {
        $247 = ($$2532617*10)|0;
        $248 = (($$2516618) + 1)|0;
        $249 = ($245>>>0)<($247>>>0);
        if ($249) {
         $$4492 = $$sink545$lcssa;$$4518 = $248;$$8 = $$5486$lcssa;
         break;
        } else {
         $$2516618 = $248;$$2532617 = $247;
        }
       }
      }
     } else {
      $$4492 = $210;$$4518 = $$1515;$$8 = $$3484$lcssa;
     }
    }
    $250 = ((($$4492)) + 4|0);
    $251 = ($$3501$lcssa>>>0)>($250>>>0);
    $$$3501 = $251 ? $250 : $$3501$lcssa;
    $$5519$ph = $$4518;$$7505$ph = $$$3501;$$9$ph = $$8;
   } else {
    $$5519$ph = $$1515;$$7505$ph = $$3501$lcssa;$$9$ph = $$3484$lcssa;
   }
   $$7505 = $$7505$ph;
   while(1) {
    $252 = ($$7505>>>0)>($$9$ph>>>0);
    if (!($252)) {
     $$lcssa673 = 0;
     break;
    }
    $253 = ((($$7505)) + -4|0);
    $254 = HEAP32[$253>>2]|0;
    $255 = ($254|0)==(0);
    if ($255) {
     $$7505 = $253;
    } else {
     $$lcssa673 = 1;
     break;
    }
   }
   $256 = (0 - ($$5519$ph))|0;
   do {
    if ($196) {
     $not$ = $197 ^ 1;
     $257 = $not$&1;
     $$539$ = (($257) + ($$539))|0;
     $258 = ($$539$|0)>($$5519$ph|0);
     $259 = ($$5519$ph|0)>(-5);
     $or$cond6 = $258 & $259;
     if ($or$cond6) {
      $260 = (($5) + -1)|0;
      $$neg567 = (($$539$) + -1)|0;
      $261 = (($$neg567) - ($$5519$ph))|0;
      $$0479 = $260;$$2476 = $261;
     } else {
      $262 = (($5) + -2)|0;
      $263 = (($$539$) + -1)|0;
      $$0479 = $262;$$2476 = $263;
     }
     $264 = $4 & 8;
     $265 = ($264|0)==(0);
     if ($265) {
      if ($$lcssa673) {
       $266 = ((($$7505)) + -4|0);
       $267 = HEAP32[$266>>2]|0;
       $268 = ($267|0)==(0);
       if ($268) {
        $$2529 = 9;
       } else {
        $269 = (($267>>>0) % 10)&-1;
        $270 = ($269|0)==(0);
        if ($270) {
         $$1528614 = 0;$$3533613 = 10;
         while(1) {
          $271 = ($$3533613*10)|0;
          $272 = (($$1528614) + 1)|0;
          $273 = (($267>>>0) % ($271>>>0))&-1;
          $274 = ($273|0)==(0);
          if ($274) {
           $$1528614 = $272;$$3533613 = $271;
          } else {
           $$2529 = $272;
           break;
          }
         }
        } else {
         $$2529 = 0;
        }
       }
      } else {
       $$2529 = 9;
      }
      $275 = $$0479 | 32;
      $276 = ($275|0)==(102);
      $277 = $$7505;
      $278 = (($277) - ($183))|0;
      $279 = $278 >> 2;
      $280 = ($279*9)|0;
      $281 = (($280) + -9)|0;
      if ($276) {
       $282 = (($281) - ($$2529))|0;
       $283 = ($282|0)>(0);
       $$546 = $283 ? $282 : 0;
       $284 = ($$2476|0)<($$546|0);
       $$2476$$547 = $284 ? $$2476 : $$546;
       $$1480 = $$0479;$$3477 = $$2476$$547;$$pre$phi690Z2D = 0;
       break;
      } else {
       $285 = (($281) + ($$5519$ph))|0;
       $286 = (($285) - ($$2529))|0;
       $287 = ($286|0)>(0);
       $$548 = $287 ? $286 : 0;
       $288 = ($$2476|0)<($$548|0);
       $$2476$$549 = $288 ? $$2476 : $$548;
       $$1480 = $$0479;$$3477 = $$2476$$549;$$pre$phi690Z2D = 0;
       break;
      }
     } else {
      $$1480 = $$0479;$$3477 = $$2476;$$pre$phi690Z2D = $264;
     }
    } else {
     $$pre689 = $4 & 8;
     $$1480 = $5;$$3477 = $$539;$$pre$phi690Z2D = $$pre689;
    }
   } while(0);
   $289 = $$3477 | $$pre$phi690Z2D;
   $290 = ($289|0)!=(0);
   $291 = $290&1;
   $292 = $$1480 | 32;
   $293 = ($292|0)==(102);
   if ($293) {
    $294 = ($$5519$ph|0)>(0);
    $295 = $294 ? $$5519$ph : 0;
    $$2513 = 0;$$pn566 = $295;
   } else {
    $296 = ($$5519$ph|0)<(0);
    $297 = $296 ? $256 : $$5519$ph;
    $298 = ($297|0)<(0);
    $299 = $298 << 31 >> 31;
    $300 = (_fmt_u($297,$299,$11)|0);
    $301 = $11;
    $302 = $300;
    $303 = (($301) - ($302))|0;
    $304 = ($303|0)<(2);
    if ($304) {
     $$1512607 = $300;
     while(1) {
      $305 = ((($$1512607)) + -1|0);
      HEAP8[$305>>0] = 48;
      $306 = $305;
      $307 = (($301) - ($306))|0;
      $308 = ($307|0)<(2);
      if ($308) {
       $$1512607 = $305;
      } else {
       $$1512$lcssa = $305;
       break;
      }
     }
    } else {
     $$1512$lcssa = $300;
    }
    $309 = $$5519$ph >> 31;
    $310 = $309 & 2;
    $311 = (($310) + 43)|0;
    $312 = $311&255;
    $313 = ((($$1512$lcssa)) + -1|0);
    HEAP8[$313>>0] = $312;
    $314 = $$1480&255;
    $315 = ((($$1512$lcssa)) + -2|0);
    HEAP8[$315>>0] = $314;
    $316 = $315;
    $317 = (($301) - ($316))|0;
    $$2513 = $315;$$pn566 = $317;
   }
   $318 = (($$0520) + 1)|0;
   $319 = (($318) + ($$3477))|0;
   $$1526 = (($319) + ($291))|0;
   $320 = (($$1526) + ($$pn566))|0;
   _pad_448($0,32,$2,$320,$4);
   _out_442($0,$$0521,$$0520);
   $321 = $4 ^ 65536;
   _pad_448($0,48,$2,$320,$321);
   if ($293) {
    $322 = ($$9$ph>>>0)>($$556>>>0);
    $$0496$$9 = $322 ? $$556 : $$9$ph;
    $323 = ((($8)) + 9|0);
    $324 = $323;
    $325 = ((($8)) + 8|0);
    $$5493597 = $$0496$$9;
    while(1) {
     $326 = HEAP32[$$5493597>>2]|0;
     $327 = (_fmt_u($326,0,$323)|0);
     $328 = ($$5493597|0)==($$0496$$9|0);
     if ($328) {
      $334 = ($327|0)==($323|0);
      if ($334) {
       HEAP8[$325>>0] = 48;
       $$1465 = $325;
      } else {
       $$1465 = $327;
      }
     } else {
      $329 = ($327>>>0)>($8>>>0);
      if ($329) {
       $330 = $327;
       $331 = (($330) - ($9))|0;
       _memset(($8|0),48,($331|0))|0;
       $$0464594 = $327;
       while(1) {
        $332 = ((($$0464594)) + -1|0);
        $333 = ($332>>>0)>($8>>>0);
        if ($333) {
         $$0464594 = $332;
        } else {
         $$1465 = $332;
         break;
        }
       }
      } else {
       $$1465 = $327;
      }
     }
     $335 = $$1465;
     $336 = (($324) - ($335))|0;
     _out_442($0,$$1465,$336);
     $337 = ((($$5493597)) + 4|0);
     $338 = ($337>>>0)>($$556>>>0);
     if ($338) {
      break;
     } else {
      $$5493597 = $337;
     }
    }
    $339 = ($289|0)==(0);
    if (!($339)) {
     _out_442($0,39429,1);
    }
    $340 = ($337>>>0)<($$7505>>>0);
    $341 = ($$3477|0)>(0);
    $342 = $340 & $341;
    if ($342) {
     $$4478590 = $$3477;$$6494589 = $337;
     while(1) {
      $343 = HEAP32[$$6494589>>2]|0;
      $344 = (_fmt_u($343,0,$323)|0);
      $345 = ($344>>>0)>($8>>>0);
      if ($345) {
       $346 = $344;
       $347 = (($346) - ($9))|0;
       _memset(($8|0),48,($347|0))|0;
       $$0463584 = $344;
       while(1) {
        $348 = ((($$0463584)) + -1|0);
        $349 = ($348>>>0)>($8>>>0);
        if ($349) {
         $$0463584 = $348;
        } else {
         $$0463$lcssa = $348;
         break;
        }
       }
      } else {
       $$0463$lcssa = $344;
      }
      $350 = ($$4478590|0)<(9);
      $351 = $350 ? $$4478590 : 9;
      _out_442($0,$$0463$lcssa,$351);
      $352 = ((($$6494589)) + 4|0);
      $353 = (($$4478590) + -9)|0;
      $354 = ($352>>>0)<($$7505>>>0);
      $355 = ($$4478590|0)>(9);
      $356 = $354 & $355;
      if ($356) {
       $$4478590 = $353;$$6494589 = $352;
      } else {
       $$4478$lcssa = $353;
       break;
      }
     }
    } else {
     $$4478$lcssa = $$3477;
    }
    $357 = (($$4478$lcssa) + 9)|0;
    _pad_448($0,48,$357,9,0);
   } else {
    $358 = ((($$9$ph)) + 4|0);
    $$7505$ = $$lcssa673 ? $$7505 : $358;
    $359 = ($$3477|0)>(-1);
    if ($359) {
     $360 = ((($8)) + 9|0);
     $361 = ($$pre$phi690Z2D|0)==(0);
     $362 = $360;
     $363 = (0 - ($9))|0;
     $364 = ((($8)) + 8|0);
     $$5602 = $$3477;$$7495601 = $$9$ph;
     while(1) {
      $365 = HEAP32[$$7495601>>2]|0;
      $366 = (_fmt_u($365,0,$360)|0);
      $367 = ($366|0)==($360|0);
      if ($367) {
       HEAP8[$364>>0] = 48;
       $$0 = $364;
      } else {
       $$0 = $366;
      }
      $368 = ($$7495601|0)==($$9$ph|0);
      do {
       if ($368) {
        $372 = ((($$0)) + 1|0);
        _out_442($0,$$0,1);
        $373 = ($$5602|0)<(1);
        $or$cond554 = $361 & $373;
        if ($or$cond554) {
         $$2 = $372;
         break;
        }
        _out_442($0,39429,1);
        $$2 = $372;
       } else {
        $369 = ($$0>>>0)>($8>>>0);
        if (!($369)) {
         $$2 = $$0;
         break;
        }
        $scevgep684 = (($$0) + ($363)|0);
        $scevgep684685 = $scevgep684;
        _memset(($8|0),48,($scevgep684685|0))|0;
        $$1598 = $$0;
        while(1) {
         $370 = ((($$1598)) + -1|0);
         $371 = ($370>>>0)>($8>>>0);
         if ($371) {
          $$1598 = $370;
         } else {
          $$2 = $370;
          break;
         }
        }
       }
      } while(0);
      $374 = $$2;
      $375 = (($362) - ($374))|0;
      $376 = ($$5602|0)>($375|0);
      $377 = $376 ? $375 : $$5602;
      _out_442($0,$$2,$377);
      $378 = (($$5602) - ($375))|0;
      $379 = ((($$7495601)) + 4|0);
      $380 = ($379>>>0)<($$7505$>>>0);
      $381 = ($378|0)>(-1);
      $382 = $380 & $381;
      if ($382) {
       $$5602 = $378;$$7495601 = $379;
      } else {
       $$5$lcssa = $378;
       break;
      }
     }
    } else {
     $$5$lcssa = $$3477;
    }
    $383 = (($$5$lcssa) + 18)|0;
    _pad_448($0,48,$383,18,0);
    $384 = $11;
    $385 = $$2513;
    $386 = (($384) - ($385))|0;
    _out_442($0,$$2513,$386);
   }
   $387 = $4 ^ 8192;
   _pad_448($0,32,$2,$320,$387);
   $$sink562 = $320;
  } else {
   $27 = $5 & 32;
   $28 = ($27|0)!=(0);
   $29 = $28 ? 39397 : 39401;
   $30 = ($$0471 != $$0471) | (0.0 != 0.0);
   $31 = $28 ? 39405 : 39409;
   $$0510 = $30 ? $31 : $29;
   $32 = (($$0520) + 3)|0;
   $33 = $4 & -65537;
   _pad_448($0,32,$2,$32,$33);
   _out_442($0,$$0521,$$0520);
   _out_442($0,$$0510,3);
   $34 = $4 ^ 8192;
   _pad_448($0,32,$2,$32,$34);
   $$sink562 = $32;
  }
 } while(0);
 $388 = ($$sink562|0)<($2|0);
 $$555 = $388 ? $2 : $$sink562;
 STACKTOP = sp;return ($$555|0);
}
function ___DOUBLE_BITS_449($0) {
 $0 = +$0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$1 = HEAP32[tempDoublePtr>>2]|0;
 $2 = HEAP32[tempDoublePtr+4>>2]|0;
 tempRet0 = ($2);
 return ($1|0);
}
function _frexpl($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (+_frexp($0,$1));
 return (+$2);
}
function _frexp($0,$1) {
 $0 = +$0;
 $1 = $1|0;
 var $$0 = 0.0, $$016 = 0.0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0.0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0.0, $storemerge = 0, $trunc$clear = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 HEAPF64[tempDoublePtr>>3] = $0;$2 = HEAP32[tempDoublePtr>>2]|0;
 $3 = HEAP32[tempDoublePtr+4>>2]|0;
 $4 = (_bitshift64Lshr(($2|0),($3|0),52)|0);
 $5 = tempRet0;
 $6 = $4&65535;
 $trunc$clear = $6 & 2047;
 switch ($trunc$clear<<16>>16) {
 case 0:  {
  $7 = $0 != 0.0;
  if ($7) {
   $8 = $0 * 1.8446744073709552E+19;
   $9 = (+_frexp($8,$1));
   $10 = HEAP32[$1>>2]|0;
   $11 = (($10) + -64)|0;
   $$016 = $9;$storemerge = $11;
  } else {
   $$016 = $0;$storemerge = 0;
  }
  HEAP32[$1>>2] = $storemerge;
  $$0 = $$016;
  break;
 }
 case 2047:  {
  $$0 = $0;
  break;
 }
 default: {
  $12 = $4 & 2047;
  $13 = (($12) + -1022)|0;
  HEAP32[$1>>2] = $13;
  $14 = $3 & -2146435073;
  $15 = $14 | 1071644672;
  HEAP32[tempDoublePtr>>2] = $2;HEAP32[tempDoublePtr+4>>2] = $15;$16 = +HEAPF64[tempDoublePtr>>3];
  $$0 = $16;
 }
 }
 return (+$$0);
}
function _wcrtomb($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==(0|0);
 do {
  if ($3) {
   $$0 = 1;
  } else {
   $4 = ($1>>>0)<(128);
   if ($4) {
    $5 = $1&255;
    HEAP8[$0>>0] = $5;
    $$0 = 1;
    break;
   }
   $6 = (___pthread_self_96()|0);
   $7 = ((($6)) + 188|0);
   $8 = HEAP32[$7>>2]|0;
   $9 = HEAP32[$8>>2]|0;
   $not$ = ($9|0)==(0|0);
   if ($not$) {
    $10 = $1 & -128;
    $11 = ($10|0)==(57216);
    if ($11) {
     $13 = $1&255;
     HEAP8[$0>>0] = $13;
     $$0 = 1;
     break;
    } else {
     $12 = (___errno_location()|0);
     HEAP32[$12>>2] = 84;
     $$0 = -1;
     break;
    }
   }
   $14 = ($1>>>0)<(2048);
   if ($14) {
    $15 = $1 >>> 6;
    $16 = $15 | 192;
    $17 = $16&255;
    $18 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $17;
    $19 = $1 & 63;
    $20 = $19 | 128;
    $21 = $20&255;
    HEAP8[$18>>0] = $21;
    $$0 = 2;
    break;
   }
   $22 = ($1>>>0)<(55296);
   $23 = $1 & -8192;
   $24 = ($23|0)==(57344);
   $or$cond = $22 | $24;
   if ($or$cond) {
    $25 = $1 >>> 12;
    $26 = $25 | 224;
    $27 = $26&255;
    $28 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $27;
    $29 = $1 >>> 6;
    $30 = $29 & 63;
    $31 = $30 | 128;
    $32 = $31&255;
    $33 = ((($0)) + 2|0);
    HEAP8[$28>>0] = $32;
    $34 = $1 & 63;
    $35 = $34 | 128;
    $36 = $35&255;
    HEAP8[$33>>0] = $36;
    $$0 = 3;
    break;
   }
   $37 = (($1) + -65536)|0;
   $38 = ($37>>>0)<(1048576);
   if ($38) {
    $39 = $1 >>> 18;
    $40 = $39 | 240;
    $41 = $40&255;
    $42 = ((($0)) + 1|0);
    HEAP8[$0>>0] = $41;
    $43 = $1 >>> 12;
    $44 = $43 & 63;
    $45 = $44 | 128;
    $46 = $45&255;
    $47 = ((($0)) + 2|0);
    HEAP8[$42>>0] = $46;
    $48 = $1 >>> 6;
    $49 = $48 & 63;
    $50 = $49 | 128;
    $51 = $50&255;
    $52 = ((($0)) + 3|0);
    HEAP8[$47>>0] = $51;
    $53 = $1 & 63;
    $54 = $53 | 128;
    $55 = $54&255;
    HEAP8[$52>>0] = $55;
    $$0 = 4;
    break;
   } else {
    $56 = (___errno_location()|0);
    HEAP32[$56>>2] = 84;
    $$0 = -1;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___pthread_self_96() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___pthread_self_241() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___strerror_l($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$012$lcssa = 0, $$01214 = 0, $$016 = 0, $$113 = 0, $$115 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $$016 = 0;
 while(1) {
  $3 = (39431 + ($$016)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = ($5|0)==($0|0);
  if ($6) {
   label = 2;
   break;
  }
  $7 = (($$016) + 1)|0;
  $8 = ($7|0)==(87);
  if ($8) {
   $$01214 = 39519;$$115 = 87;
   label = 5;
   break;
  } else {
   $$016 = $7;
  }
 }
 if ((label|0) == 2) {
  $2 = ($$016|0)==(0);
  if ($2) {
   $$012$lcssa = 39519;
  } else {
   $$01214 = 39519;$$115 = $$016;
   label = 5;
  }
 }
 if ((label|0) == 5) {
  while(1) {
   label = 0;
   $$113 = $$01214;
   while(1) {
    $9 = HEAP8[$$113>>0]|0;
    $10 = ($9<<24>>24)==(0);
    $11 = ((($$113)) + 1|0);
    if ($10) {
     break;
    } else {
     $$113 = $11;
    }
   }
   $12 = (($$115) + -1)|0;
   $13 = ($12|0)==(0);
   if ($13) {
    $$012$lcssa = $11;
    break;
   } else {
    $$01214 = $11;$$115 = $12;
    label = 5;
   }
  }
 }
 $14 = ((($1)) + 20|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (___lctrans($$012$lcssa,$15)|0);
 return ($16|0);
}
function ___lctrans($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (___lctrans_impl($0,$1)|0);
 return ($2|0);
}
function ___lctrans_impl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = HEAP32[$1>>2]|0;
  $4 = ((($1)) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = (___mo_lookup($3,$5,$0)|0);
  $$0 = $6;
 }
 $7 = ($$0|0)!=(0|0);
 $8 = $7 ? $$0 : $0;
 return ($8|0);
}
function ___mo_lookup($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$090 = 0, $$094 = 0, $$191 = 0, $$195 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond102 = 0, $or$cond104 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = (($3) + 1794895138)|0;
 $5 = ((($0)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (_swapc($6,$4)|0);
 $8 = ((($0)) + 12|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (_swapc($9,$4)|0);
 $11 = ((($0)) + 16|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = (_swapc($12,$4)|0);
 $14 = $1 >>> 2;
 $15 = ($7>>>0)<($14>>>0);
 L1: do {
  if ($15) {
   $16 = $7 << 2;
   $17 = (($1) - ($16))|0;
   $18 = ($10>>>0)<($17>>>0);
   $19 = ($13>>>0)<($17>>>0);
   $or$cond = $18 & $19;
   if ($or$cond) {
    $20 = $13 | $10;
    $21 = $20 & 3;
    $22 = ($21|0)==(0);
    if ($22) {
     $23 = $10 >>> 2;
     $24 = $13 >>> 2;
     $$090 = 0;$$094 = $7;
     while(1) {
      $25 = $$094 >>> 1;
      $26 = (($$090) + ($25))|0;
      $27 = $26 << 1;
      $28 = (($27) + ($23))|0;
      $29 = (($0) + ($28<<2)|0);
      $30 = HEAP32[$29>>2]|0;
      $31 = (_swapc($30,$4)|0);
      $32 = (($28) + 1)|0;
      $33 = (($0) + ($32<<2)|0);
      $34 = HEAP32[$33>>2]|0;
      $35 = (_swapc($34,$4)|0);
      $36 = ($35>>>0)<($1>>>0);
      $37 = (($1) - ($35))|0;
      $38 = ($31>>>0)<($37>>>0);
      $or$cond102 = $36 & $38;
      if (!($or$cond102)) {
       $$4 = 0;
       break L1;
      }
      $39 = (($35) + ($31))|0;
      $40 = (($0) + ($39)|0);
      $41 = HEAP8[$40>>0]|0;
      $42 = ($41<<24>>24)==(0);
      if (!($42)) {
       $$4 = 0;
       break L1;
      }
      $43 = (($0) + ($35)|0);
      $44 = (_strcmp($2,$43)|0);
      $45 = ($44|0)==(0);
      if ($45) {
       break;
      }
      $62 = ($$094|0)==(1);
      $63 = ($44|0)<(0);
      $64 = (($$094) - ($25))|0;
      $$195 = $63 ? $25 : $64;
      $$191 = $63 ? $$090 : $26;
      if ($62) {
       $$4 = 0;
       break L1;
      } else {
       $$090 = $$191;$$094 = $$195;
      }
     }
     $46 = (($27) + ($24))|0;
     $47 = (($0) + ($46<<2)|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = (_swapc($48,$4)|0);
     $50 = (($46) + 1)|0;
     $51 = (($0) + ($50<<2)|0);
     $52 = HEAP32[$51>>2]|0;
     $53 = (_swapc($52,$4)|0);
     $54 = ($53>>>0)<($1>>>0);
     $55 = (($1) - ($53))|0;
     $56 = ($49>>>0)<($55>>>0);
     $or$cond104 = $54 & $56;
     if ($or$cond104) {
      $57 = (($0) + ($53)|0);
      $58 = (($53) + ($49))|0;
      $59 = (($0) + ($58)|0);
      $60 = HEAP8[$59>>0]|0;
      $61 = ($60<<24>>24)==(0);
      $$ = $61 ? $57 : 0;
      $$4 = $$;
     } else {
      $$4 = 0;
     }
    } else {
     $$4 = 0;
    }
   } else {
    $$4 = 0;
   }
  } else {
   $$4 = 0;
  }
 } while(0);
 return ($$4|0);
}
function _swapc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0);
 $3 = (_llvm_bswap_i32(($0|0))|0);
 $$ = $2 ? $0 : $3;
 return ($$|0);
}
function ___fwritex($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$038 = 0, $$042 = 0, $$1 = 0, $$139 = 0, $$141 = 0, $$143 = 0, $$pre = 0, $$pre47 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($2)) + 16|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)==(0|0);
 if ($5) {
  $7 = (___towrite($2)|0);
  $8 = ($7|0)==(0);
  if ($8) {
   $$pre = HEAP32[$3>>2]|0;
   $12 = $$pre;
   label = 5;
  } else {
   $$1 = 0;
  }
 } else {
  $6 = $4;
  $12 = $6;
  label = 5;
 }
 L5: do {
  if ((label|0) == 5) {
   $9 = ((($2)) + 20|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = (($12) - ($10))|0;
   $13 = ($11>>>0)<($1>>>0);
   $14 = $10;
   if ($13) {
    $15 = ((($2)) + 36|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = (FUNCTION_TABLE_iiii[$16 & 7]($2,$0,$1)|0);
    $$1 = $17;
    break;
   }
   $18 = ((($2)) + 75|0);
   $19 = HEAP8[$18>>0]|0;
   $20 = ($19<<24>>24)>(-1);
   L10: do {
    if ($20) {
     $$038 = $1;
     while(1) {
      $21 = ($$038|0)==(0);
      if ($21) {
       $$139 = 0;$$141 = $0;$$143 = $1;$31 = $14;
       break L10;
      }
      $22 = (($$038) + -1)|0;
      $23 = (($0) + ($22)|0);
      $24 = HEAP8[$23>>0]|0;
      $25 = ($24<<24>>24)==(10);
      if ($25) {
       break;
      } else {
       $$038 = $22;
      }
     }
     $26 = ((($2)) + 36|0);
     $27 = HEAP32[$26>>2]|0;
     $28 = (FUNCTION_TABLE_iiii[$27 & 7]($2,$0,$$038)|0);
     $29 = ($28>>>0)<($$038>>>0);
     if ($29) {
      $$1 = $28;
      break L5;
     }
     $30 = (($0) + ($$038)|0);
     $$042 = (($1) - ($$038))|0;
     $$pre47 = HEAP32[$9>>2]|0;
     $$139 = $$038;$$141 = $30;$$143 = $$042;$31 = $$pre47;
    } else {
     $$139 = 0;$$141 = $0;$$143 = $1;$31 = $14;
    }
   } while(0);
   _memcpy(($31|0),($$141|0),($$143|0))|0;
   $32 = HEAP32[$9>>2]|0;
   $33 = (($32) + ($$143)|0);
   HEAP32[$9>>2] = $33;
   $34 = (($$139) + ($$143))|0;
   $$1 = $34;
  }
 } while(0);
 return ($$1|0);
}
function ___towrite($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 74|0);
 $2 = HEAP8[$1>>0]|0;
 $3 = $2 << 24 >> 24;
 $4 = (($3) + 255)|0;
 $5 = $4 | $3;
 $6 = $5&255;
 HEAP8[$1>>0] = $6;
 $7 = HEAP32[$0>>2]|0;
 $8 = $7 & 8;
 $9 = ($8|0)==(0);
 if ($9) {
  $11 = ((($0)) + 8|0);
  HEAP32[$11>>2] = 0;
  $12 = ((($0)) + 4|0);
  HEAP32[$12>>2] = 0;
  $13 = ((($0)) + 44|0);
  $14 = HEAP32[$13>>2]|0;
  $15 = ((($0)) + 28|0);
  HEAP32[$15>>2] = $14;
  $16 = ((($0)) + 20|0);
  HEAP32[$16>>2] = $14;
  $17 = ((($0)) + 48|0);
  $18 = HEAP32[$17>>2]|0;
  $19 = (($14) + ($18)|0);
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = $19;
  $$0 = 0;
 } else {
  $10 = $7 | 32;
  HEAP32[$0>>2] = $10;
  $$0 = -1;
 }
 return ($$0|0);
}
function _strlen($0) {
 $0 = $0|0;
 var $$0 = 0, $$015$lcssa = 0, $$01519 = 0, $$1$lcssa = 0, $$pn = 0, $$pre = 0, $$sink = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1 & 3;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$015$lcssa = $0;
   label = 4;
  } else {
   $$01519 = $0;$23 = $1;
   while(1) {
    $4 = HEAP8[$$01519>>0]|0;
    $5 = ($4<<24>>24)==(0);
    if ($5) {
     $$sink = $23;
     break L1;
    }
    $6 = ((($$01519)) + 1|0);
    $7 = $6;
    $8 = $7 & 3;
    $9 = ($8|0)==(0);
    if ($9) {
     $$015$lcssa = $6;
     label = 4;
     break;
    } else {
     $$01519 = $6;$23 = $7;
    }
   }
  }
 } while(0);
 if ((label|0) == 4) {
  $$0 = $$015$lcssa;
  while(1) {
   $10 = HEAP32[$$0>>2]|0;
   $11 = (($10) + -16843009)|0;
   $12 = $10 & -2139062144;
   $13 = $12 ^ -2139062144;
   $14 = $13 & $11;
   $15 = ($14|0)==(0);
   $16 = ((($$0)) + 4|0);
   if ($15) {
    $$0 = $16;
   } else {
    break;
   }
  }
  $17 = $10&255;
  $18 = ($17<<24>>24)==(0);
  if ($18) {
   $$1$lcssa = $$0;
  } else {
   $$pn = $$0;
   while(1) {
    $19 = ((($$pn)) + 1|0);
    $$pre = HEAP8[$19>>0]|0;
    $20 = ($$pre<<24>>24)==(0);
    if ($20) {
     $$1$lcssa = $19;
     break;
    } else {
     $$pn = $19;
    }
   }
  }
  $21 = $$1$lcssa;
  $$sink = $21;
 }
 $22 = (($$sink) - ($1))|0;
 return ($22|0);
}
function _strchr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (___strchrnul($0,$1)|0);
 $3 = HEAP8[$2>>0]|0;
 $4 = $1&255;
 $5 = ($3<<24>>24)==($4<<24>>24);
 $6 = $5 ? $2 : 0;
 return ($6|0);
}
function ___strchrnul($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$029$lcssa = 0, $$02936 = 0, $$030$lcssa = 0, $$03039 = 0, $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond33 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 & 255;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $8 = (_strlen($0)|0);
   $9 = (($0) + ($8)|0);
   $$0 = $9;
  } else {
   $4 = $0;
   $5 = $4 & 3;
   $6 = ($5|0)==(0);
   if ($6) {
    $$030$lcssa = $0;
   } else {
    $7 = $1&255;
    $$03039 = $0;
    while(1) {
     $10 = HEAP8[$$03039>>0]|0;
     $11 = ($10<<24>>24)==(0);
     $12 = ($10<<24>>24)==($7<<24>>24);
     $or$cond = $11 | $12;
     if ($or$cond) {
      $$0 = $$03039;
      break L1;
     }
     $13 = ((($$03039)) + 1|0);
     $14 = $13;
     $15 = $14 & 3;
     $16 = ($15|0)==(0);
     if ($16) {
      $$030$lcssa = $13;
      break;
     } else {
      $$03039 = $13;
     }
    }
   }
   $17 = Math_imul($2, 16843009)|0;
   $18 = HEAP32[$$030$lcssa>>2]|0;
   $19 = (($18) + -16843009)|0;
   $20 = $18 & -2139062144;
   $21 = $20 ^ -2139062144;
   $22 = $21 & $19;
   $23 = ($22|0)==(0);
   L10: do {
    if ($23) {
     $$02936 = $$030$lcssa;$25 = $18;
     while(1) {
      $24 = $25 ^ $17;
      $26 = (($24) + -16843009)|0;
      $27 = $24 & -2139062144;
      $28 = $27 ^ -2139062144;
      $29 = $28 & $26;
      $30 = ($29|0)==(0);
      if (!($30)) {
       $$029$lcssa = $$02936;
       break L10;
      }
      $31 = ((($$02936)) + 4|0);
      $32 = HEAP32[$31>>2]|0;
      $33 = (($32) + -16843009)|0;
      $34 = $32 & -2139062144;
      $35 = $34 ^ -2139062144;
      $36 = $35 & $33;
      $37 = ($36|0)==(0);
      if ($37) {
       $$02936 = $31;$25 = $32;
      } else {
       $$029$lcssa = $31;
       break;
      }
     }
    } else {
     $$029$lcssa = $$030$lcssa;
    }
   } while(0);
   $38 = $1&255;
   $$1 = $$029$lcssa;
   while(1) {
    $39 = HEAP8[$$1>>0]|0;
    $40 = ($39<<24>>24)==(0);
    $41 = ($39<<24>>24)==($38<<24>>24);
    $or$cond33 = $40 | $41;
    $42 = ((($$1)) + 1|0);
    if ($or$cond33) {
     $$0 = $$1;
     break;
    } else {
     $$1 = $42;
    }
   }
  }
 } while(0);
 return ($$0|0);
}
function _tolower($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_isupper($0)|0);
 $2 = ($1|0)==(0);
 $3 = $0 | 32;
 $$0 = $2 ? $0 : $3;
 return ($$0|0);
}
function _isupper($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + -65)|0;
 $2 = ($1>>>0)<(26);
 $3 = $2&1;
 return ($3|0);
}
function _strcpy($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 (___stpcpy($0,$1)|0);
 return ($0|0);
}
function ___stpcpy($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$lcssa = 0, $$025$lcssa = 0, $$02536 = 0, $$026$lcssa = 0, $$02642 = 0, $$027$lcssa = 0, $$02741 = 0, $$029 = 0, $$037 = 0, $$1$ph = 0, $$128$ph = 0, $$12834 = 0, $$135 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0;
 var $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1;
 $3 = $0;
 $4 = $2 ^ $3;
 $5 = $4 & 3;
 $6 = ($5|0)==(0);
 L1: do {
  if ($6) {
   $7 = $2 & 3;
   $8 = ($7|0)==(0);
   if ($8) {
    $$026$lcssa = $1;$$027$lcssa = $0;
   } else {
    $$02642 = $1;$$02741 = $0;
    while(1) {
     $9 = HEAP8[$$02642>>0]|0;
     HEAP8[$$02741>>0] = $9;
     $10 = ($9<<24>>24)==(0);
     if ($10) {
      $$029 = $$02741;
      break L1;
     }
     $11 = ((($$02642)) + 1|0);
     $12 = ((($$02741)) + 1|0);
     $13 = $11;
     $14 = $13 & 3;
     $15 = ($14|0)==(0);
     if ($15) {
      $$026$lcssa = $11;$$027$lcssa = $12;
      break;
     } else {
      $$02642 = $11;$$02741 = $12;
     }
    }
   }
   $16 = HEAP32[$$026$lcssa>>2]|0;
   $17 = (($16) + -16843009)|0;
   $18 = $16 & -2139062144;
   $19 = $18 ^ -2139062144;
   $20 = $19 & $17;
   $21 = ($20|0)==(0);
   if ($21) {
    $$02536 = $$027$lcssa;$$037 = $$026$lcssa;$24 = $16;
    while(1) {
     $22 = ((($$037)) + 4|0);
     $23 = ((($$02536)) + 4|0);
     HEAP32[$$02536>>2] = $24;
     $25 = HEAP32[$22>>2]|0;
     $26 = (($25) + -16843009)|0;
     $27 = $25 & -2139062144;
     $28 = $27 ^ -2139062144;
     $29 = $28 & $26;
     $30 = ($29|0)==(0);
     if ($30) {
      $$02536 = $23;$$037 = $22;$24 = $25;
     } else {
      $$0$lcssa = $22;$$025$lcssa = $23;
      break;
     }
    }
   } else {
    $$0$lcssa = $$026$lcssa;$$025$lcssa = $$027$lcssa;
   }
   $$1$ph = $$0$lcssa;$$128$ph = $$025$lcssa;
   label = 8;
  } else {
   $$1$ph = $1;$$128$ph = $0;
   label = 8;
  }
 } while(0);
 if ((label|0) == 8) {
  $31 = HEAP8[$$1$ph>>0]|0;
  HEAP8[$$128$ph>>0] = $31;
  $32 = ($31<<24>>24)==(0);
  if ($32) {
   $$029 = $$128$ph;
  } else {
   $$12834 = $$128$ph;$$135 = $$1$ph;
   while(1) {
    $33 = ((($$135)) + 1|0);
    $34 = ((($$12834)) + 1|0);
    $35 = HEAP8[$33>>0]|0;
    HEAP8[$34>>0] = $35;
    $36 = ($35<<24>>24)==(0);
    if ($36) {
     $$029 = $34;
     break;
    } else {
     $$12834 = $34;$$135 = $33;
    }
   }
  }
 }
 return ($$029|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((566184|0));
 return (566192|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((566184|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[5981]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[5981]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $25 = $17;
     } else {
      $25 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $26 = ($25|0)==(0);
     if (!($26)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 7]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 7]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function _fprintf($0,$1,$varargs) {
 $0 = $0|0;
 $1 = $1|0;
 $varargs = $varargs|0;
 var $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = sp;
 HEAP32[$2>>2] = $varargs;
 $3 = (_vfprintf($0,$1,$2)|0);
 STACKTOP = sp;return ($3|0);
}
function _qsort($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $$067$lcssa = 0, $$06772 = 0, $$068$lcssa = 0, $$06871 = 0, $$1 = 0, $$169 = 0, $$2 = 0, $$pre$pre = 0, $$pre76 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $15$phi = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(208|0);
 $4 = sp + 8|0;
 $5 = sp;
 $6 = Math_imul($2, $1)|0;
 $7 = $5;
 $8 = $7;
 HEAP32[$8>>2] = 1;
 $9 = (($7) + 4)|0;
 $10 = $9;
 HEAP32[$10>>2] = 0;
 $11 = ($6|0)==(0);
 L1: do {
  if (!($11)) {
   $12 = (0 - ($2))|0;
   $13 = ((($4)) + 4|0);
   HEAP32[$13>>2] = $2;
   HEAP32[$4>>2] = $2;
   $$0 = 2;$15 = $2;$17 = $2;
   while(1) {
    $14 = (($15) + ($2))|0;
    $16 = (($14) + ($17))|0;
    $18 = (($4) + ($$0<<2)|0);
    HEAP32[$18>>2] = $16;
    $19 = ($16>>>0)<($6>>>0);
    $20 = (($$0) + 1)|0;
    if ($19) {
     $15$phi = $17;$$0 = $20;$17 = $16;$15 = $15$phi;
    } else {
     break;
    }
   }
   $21 = (($0) + ($6)|0);
   $22 = (($21) + ($12)|0);
   $23 = ($22>>>0)>($0>>>0);
   if ($23) {
    $24 = $22;
    $$06772 = 1;$$06871 = $0;$26 = 1;
    while(1) {
     $25 = $26 & 3;
     $27 = ($25|0)==(3);
     do {
      if ($27) {
       _sift($$06871,$2,$3,$$06772,$4);
       _shr($5,2);
       $28 = (($$06772) + 2)|0;
       $$1 = $28;
      } else {
       $29 = (($$06772) + -1)|0;
       $30 = (($4) + ($29<<2)|0);
       $31 = HEAP32[$30>>2]|0;
       $32 = $$06871;
       $33 = (($24) - ($32))|0;
       $34 = ($31>>>0)<($33>>>0);
       if ($34) {
        _sift($$06871,$2,$3,$$06772,$4);
       } else {
        _trinkle($$06871,$2,$3,$5,$$06772,0,$4);
       }
       $35 = ($$06772|0)==(1);
       if ($35) {
        _shl($5,1);
        $$1 = 0;
        break;
       } else {
        _shl($5,$29);
        $$1 = 1;
        break;
       }
      }
     } while(0);
     $36 = HEAP32[$5>>2]|0;
     $37 = $36 | 1;
     HEAP32[$5>>2] = $37;
     $38 = (($$06871) + ($2)|0);
     $39 = ($38>>>0)<($22>>>0);
     if ($39) {
      $$06772 = $$1;$$06871 = $38;$26 = $37;
     } else {
      $$067$lcssa = $$1;$$068$lcssa = $38;$61 = $37;
      break;
     }
    }
   } else {
    $$067$lcssa = 1;$$068$lcssa = $0;$61 = 1;
   }
   _trinkle($$068$lcssa,$2,$3,$5,$$067$lcssa,0,$4);
   $40 = ((($5)) + 4|0);
   $$169 = $$068$lcssa;$$2 = $$067$lcssa;$42 = $61;
   while(1) {
    $41 = ($$2|0)==(1);
    $43 = ($42|0)==(1);
    $or$cond = $41 & $43;
    if ($or$cond) {
     $44 = HEAP32[$40>>2]|0;
     $45 = ($44|0)==(0);
     if ($45) {
      break L1;
     }
    } else {
     $46 = ($$2|0)<(2);
     if (!($46)) {
      _shl($5,2);
      $49 = (($$2) + -2)|0;
      $50 = HEAP32[$5>>2]|0;
      $51 = $50 ^ 7;
      HEAP32[$5>>2] = $51;
      _shr($5,1);
      $52 = (($4) + ($49<<2)|0);
      $53 = HEAP32[$52>>2]|0;
      $54 = (0 - ($53))|0;
      $55 = (($$169) + ($54)|0);
      $56 = (($55) + ($12)|0);
      $57 = (($$2) + -1)|0;
      _trinkle($56,$2,$3,$5,$57,1,$4);
      _shl($5,1);
      $58 = HEAP32[$5>>2]|0;
      $59 = $58 | 1;
      HEAP32[$5>>2] = $59;
      $60 = (($$169) + ($12)|0);
      _trinkle($60,$2,$3,$5,$49,1,$4);
      $$169 = $60;$$2 = $49;$42 = $59;
      continue;
     }
    }
    $47 = (_pntz($5)|0);
    _shr($5,$47);
    $48 = (($47) + ($$2))|0;
    $$pre$pre = HEAP32[$5>>2]|0;
    $$pre76 = (($$169) + ($12)|0);
    $$169 = $$pre76;$$2 = $48;$42 = $$pre$pre;
   }
  }
 } while(0);
 STACKTOP = sp;return;
}
function _sift($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$029$be = 0, $$02932 = 0, $$030$be = 0, $$03031 = 0, $$033 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(240|0);
 $5 = sp;
 HEAP32[$5>>2] = $0;
 $6 = ($3|0)>(1);
 L1: do {
  if ($6) {
   $7 = (0 - ($1))|0;
   $$02932 = $0;$$03031 = $3;$$033 = 1;$14 = $0;
   while(1) {
    $8 = (($$02932) + ($7)|0);
    $9 = (($$03031) + -2)|0;
    $10 = (($4) + ($9<<2)|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = (0 - ($11))|0;
    $13 = (($8) + ($12)|0);
    $15 = (FUNCTION_TABLE_iii[$2 & 7]($14,$13)|0);
    $16 = ($15|0)>(-1);
    if ($16) {
     $17 = (FUNCTION_TABLE_iii[$2 & 7]($14,$8)|0);
     $18 = ($17|0)>(-1);
     if ($18) {
      $$0$lcssa = $$033;
      break L1;
     }
    }
    $19 = (FUNCTION_TABLE_iii[$2 & 7]($13,$8)|0);
    $20 = ($19|0)>(-1);
    $21 = (($$033) + 1)|0;
    $22 = (($5) + ($$033<<2)|0);
    if ($20) {
     HEAP32[$22>>2] = $13;
     $23 = (($$03031) + -1)|0;
     $$029$be = $13;$$030$be = $23;
    } else {
     HEAP32[$22>>2] = $8;
     $$029$be = $8;$$030$be = $9;
    }
    $24 = ($$030$be|0)>(1);
    if (!($24)) {
     $$0$lcssa = $21;
     break L1;
    }
    $$pre = HEAP32[$5>>2]|0;
    $$02932 = $$029$be;$$03031 = $$030$be;$$033 = $21;$14 = $$pre;
   }
  } else {
   $$0$lcssa = 1;
  }
 } while(0);
 _cycle($1,$5,$$0$lcssa);
 STACKTOP = sp;return;
}
function _shr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$pre = 0, $$pre11 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1>>>0)>(31);
 $3 = ((($0)) + 4|0);
 if ($2) {
  $4 = (($1) + -32)|0;
  $5 = HEAP32[$3>>2]|0;
  HEAP32[$0>>2] = $5;
  HEAP32[$3>>2] = 0;
  $$0 = $4;$10 = 0;$7 = $5;
 } else {
  $$pre = HEAP32[$0>>2]|0;
  $$pre11 = HEAP32[$3>>2]|0;
  $$0 = $1;$10 = $$pre11;$7 = $$pre;
 }
 $6 = $7 >>> $$0;
 $8 = (32 - ($$0))|0;
 $9 = $10 << $8;
 $11 = $9 | $6;
 HEAP32[$0>>2] = $11;
 $12 = $10 >>> $$0;
 HEAP32[$3>>2] = $12;
 return;
}
function _trinkle($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $$0$lcssa = 0, $$045$lcssa = 0, $$04551 = 0, $$0455780 = 0, $$046$lcssa = 0, $$04653 = 0, $$0465681 = 0, $$047$lcssa = 0, $$0475582 = 0, $$049 = 0, $$05879 = 0, $$05879$phi = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $phitmp = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(240|0);
 $7 = sp + 232|0;
 $8 = sp;
 $9 = HEAP32[$3>>2]|0;
 HEAP32[$7>>2] = $9;
 $10 = ((($3)) + 4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($7)) + 4|0);
 HEAP32[$12>>2] = $11;
 HEAP32[$8>>2] = $0;
 $13 = ($9|0)!=(1);
 $14 = ($11|0)!=(0);
 $15 = $13 | $14;
 L1: do {
  if ($15) {
   $16 = (0 - ($1))|0;
   $17 = (($6) + ($4<<2)|0);
   $18 = HEAP32[$17>>2]|0;
   $19 = (0 - ($18))|0;
   $20 = (($0) + ($19)|0);
   $21 = (FUNCTION_TABLE_iii[$2 & 7]($20,$0)|0);
   $22 = ($21|0)<(1);
   if ($22) {
    $$0$lcssa = $0;$$045$lcssa = 1;$$046$lcssa = $4;$$047$lcssa = $5;
    label = 9;
   } else {
    $phitmp = ($5|0)==(0);
    $$0455780 = 1;$$0465681 = $4;$$0475582 = $phitmp;$$05879 = $0;$28 = $20;
    while(1) {
     $23 = ($$0465681|0)>(1);
     $or$cond = $$0475582 & $23;
     if ($or$cond) {
      $24 = (($$05879) + ($16)|0);
      $25 = (($$0465681) + -2)|0;
      $26 = (($6) + ($25<<2)|0);
      $27 = HEAP32[$26>>2]|0;
      $29 = (FUNCTION_TABLE_iii[$2 & 7]($24,$28)|0);
      $30 = ($29|0)>(-1);
      if ($30) {
       $$04551 = $$0455780;$$04653 = $$0465681;$$049 = $$05879;
       label = 10;
       break L1;
      }
      $31 = (0 - ($27))|0;
      $32 = (($24) + ($31)|0);
      $33 = (FUNCTION_TABLE_iii[$2 & 7]($32,$28)|0);
      $34 = ($33|0)>(-1);
      if ($34) {
       $$04551 = $$0455780;$$04653 = $$0465681;$$049 = $$05879;
       label = 10;
       break L1;
      }
     }
     $35 = (($$0455780) + 1)|0;
     $36 = (($8) + ($$0455780<<2)|0);
     HEAP32[$36>>2] = $28;
     $37 = (_pntz($7)|0);
     _shr($7,$37);
     $38 = (($37) + ($$0465681))|0;
     $39 = HEAP32[$7>>2]|0;
     $40 = ($39|0)!=(1);
     $41 = HEAP32[$12>>2]|0;
     $42 = ($41|0)!=(0);
     $43 = $40 | $42;
     if (!($43)) {
      $$04551 = $35;$$04653 = $38;$$049 = $28;
      label = 10;
      break L1;
     }
     $$pre = HEAP32[$8>>2]|0;
     $44 = (($6) + ($38<<2)|0);
     $45 = HEAP32[$44>>2]|0;
     $46 = (0 - ($45))|0;
     $47 = (($28) + ($46)|0);
     $48 = (FUNCTION_TABLE_iii[$2 & 7]($47,$$pre)|0);
     $49 = ($48|0)<(1);
     if ($49) {
      $$0$lcssa = $28;$$045$lcssa = $35;$$046$lcssa = $38;$$047$lcssa = 0;
      label = 9;
      break;
     } else {
      $$05879$phi = $28;$$0455780 = $35;$$0465681 = $38;$$0475582 = 1;$28 = $47;$$05879 = $$05879$phi;
     }
    }
   }
  } else {
   $$0$lcssa = $0;$$045$lcssa = 1;$$046$lcssa = $4;$$047$lcssa = $5;
   label = 9;
  }
 } while(0);
 if ((label|0) == 9) {
  $50 = ($$047$lcssa|0)==(0);
  if ($50) {
   $$04551 = $$045$lcssa;$$04653 = $$046$lcssa;$$049 = $$0$lcssa;
   label = 10;
  }
 }
 if ((label|0) == 10) {
  _cycle($1,$8,$$04551);
  _sift($$049,$1,$2,$$04653,$6);
 }
 STACKTOP = sp;return;
}
function _shl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$pre = 0, $$pre11 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1>>>0)>(31);
 $3 = ((($0)) + 4|0);
 if ($2) {
  $4 = (($1) + -32)|0;
  $5 = HEAP32[$0>>2]|0;
  HEAP32[$3>>2] = $5;
  HEAP32[$0>>2] = 0;
  $$0 = $4;$10 = 0;$7 = $5;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $$pre11 = HEAP32[$0>>2]|0;
  $$0 = $1;$10 = $$pre11;$7 = $$pre;
 }
 $6 = $7 << $$0;
 $8 = (32 - ($$0))|0;
 $9 = $10 >>> $8;
 $11 = $9 | $6;
 HEAP32[$3>>2] = $11;
 $12 = $10 << $$0;
 HEAP32[$0>>2] = $12;
 return;
}
function _pntz($0) {
 $0 = $0|0;
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = (($1) + -1)|0;
 $3 = (_a_ctz_l_797($2)|0);
 $4 = ($3|0)==(0);
 if ($4) {
  $5 = ((($0)) + 4|0);
  $6 = HEAP32[$5>>2]|0;
  $7 = (_a_ctz_l_797($6)|0);
  $8 = (($7) + 32)|0;
  $9 = ($7|0)==(0);
  $$ = $9 ? 0 : $8;
  return ($$|0);
 } else {
  return ($3|0);
 }
 return (0)|0;
}
function _a_ctz_l_797($0) {
 $0 = $0|0;
 var $$068 = 0, $$07 = 0, $$09 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 if ($1) {
  $$07 = 32;
 } else {
  $2 = $0 & 1;
  $3 = ($2|0)==(0);
  if ($3) {
   $$068 = $0;$$09 = 0;
   while(1) {
    $4 = (($$09) + 1)|0;
    $5 = $$068 >>> 1;
    $6 = $5 & 1;
    $7 = ($6|0)==(0);
    if ($7) {
     $$068 = $5;$$09 = $4;
    } else {
     $$07 = $4;
     break;
    }
   }
  } else {
   $$07 = 0;
  }
 }
 return ($$07|0);
}
function _cycle($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$02527 = 0, $$026 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(256|0);
 $3 = sp;
 $4 = ($2|0)<(2);
 L1: do {
  if (!($4)) {
   $5 = (($1) + ($2<<2)|0);
   HEAP32[$5>>2] = $3;
   $6 = ($0|0)==(0);
   if (!($6)) {
    $$02527 = $0;$10 = $3;
    while(1) {
     $7 = ($$02527>>>0)<(256);
     $8 = $7 ? $$02527 : 256;
     $9 = HEAP32[$1>>2]|0;
     _memcpy(($10|0),($9|0),($8|0))|0;
     $$026 = 0;
     while(1) {
      $11 = (($1) + ($$026<<2)|0);
      $12 = HEAP32[$11>>2]|0;
      $13 = (($$026) + 1)|0;
      $14 = (($1) + ($13<<2)|0);
      $15 = HEAP32[$14>>2]|0;
      _memcpy(($12|0),($15|0),($8|0))|0;
      $16 = HEAP32[$11>>2]|0;
      $17 = (($16) + ($8)|0);
      HEAP32[$11>>2] = $17;
      $exitcond = ($13|0)==($2|0);
      if ($exitcond) {
       break;
      } else {
       $$026 = $13;
      }
     }
     $18 = (($$02527) - ($8))|0;
     $19 = ($18|0)==(0);
     if ($19) {
      break L1;
     }
     $$pre = HEAP32[$5>>2]|0;
     $$02527 = $18;$10 = $$pre;
    }
   }
  }
 } while(0);
 STACKTOP = sp;return;
}
function _printf($0,$varargs) {
 $0 = $0|0;
 $varargs = $varargs|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 HEAP32[$1>>2] = $varargs;
 $2 = HEAP32[5949]|0;
 $3 = (_vfprintf($2,$0,$1)|0);
 STACKTOP = sp;return ($3|0);
}
function runPostSets() {
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _llvm_cttz_i32(x) {
    x = x|0;
    var ret = 0;
    ret = ((HEAP8[(((cttz_i8)+(x & 0xff))>>0)])|0);
    if ((ret|0) < 8) return ret|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 8)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 8)|0;
    ret = ((HEAP8[(((cttz_i8)+((x >> 16)&0xff))>>0)])|0);
    if ((ret|0) < 8) return (ret + 16)|0;
    return (((HEAP8[(((cttz_i8)+(x >>> 24))>>0)])|0) + 24)|0;
}
function ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    $rem = $rem | 0;
    var $n_sroa_0_0_extract_trunc = 0, $n_sroa_1_4_extract_shift$0 = 0, $n_sroa_1_4_extract_trunc = 0, $d_sroa_0_0_extract_trunc = 0, $d_sroa_1_4_extract_shift$0 = 0, $d_sroa_1_4_extract_trunc = 0, $4 = 0, $17 = 0, $37 = 0, $49 = 0, $51 = 0, $57 = 0, $58 = 0, $66 = 0, $78 = 0, $86 = 0, $88 = 0, $89 = 0, $91 = 0, $92 = 0, $95 = 0, $105 = 0, $117 = 0, $119 = 0, $125 = 0, $126 = 0, $130 = 0, $q_sroa_1_1_ph = 0, $q_sroa_0_1_ph = 0, $r_sroa_1_1_ph = 0, $r_sroa_0_1_ph = 0, $sr_1_ph = 0, $d_sroa_0_0_insert_insert99$0 = 0, $d_sroa_0_0_insert_insert99$1 = 0, $137$0 = 0, $137$1 = 0, $carry_0203 = 0, $sr_1202 = 0, $r_sroa_0_1201 = 0, $r_sroa_1_1200 = 0, $q_sroa_0_1199 = 0, $q_sroa_1_1198 = 0, $147 = 0, $149 = 0, $r_sroa_0_0_insert_insert42$0 = 0, $r_sroa_0_0_insert_insert42$1 = 0, $150$1 = 0, $151$0 = 0, $152 = 0, $154$0 = 0, $r_sroa_0_0_extract_trunc = 0, $r_sroa_1_4_extract_trunc = 0, $155 = 0, $carry_0_lcssa$0 = 0, $carry_0_lcssa$1 = 0, $r_sroa_0_1_lcssa = 0, $r_sroa_1_1_lcssa = 0, $q_sroa_0_1_lcssa = 0, $q_sroa_1_1_lcssa = 0, $q_sroa_0_0_insert_ext75$0 = 0, $q_sroa_0_0_insert_ext75$1 = 0, $q_sroa_0_0_insert_insert77$1 = 0, $_0$0 = 0, $_0$1 = 0;
    $n_sroa_0_0_extract_trunc = $a$0;
    $n_sroa_1_4_extract_shift$0 = $a$1;
    $n_sroa_1_4_extract_trunc = $n_sroa_1_4_extract_shift$0;
    $d_sroa_0_0_extract_trunc = $b$0;
    $d_sroa_1_4_extract_shift$0 = $b$1;
    $d_sroa_1_4_extract_trunc = $d_sroa_1_4_extract_shift$0;
    if (($n_sroa_1_4_extract_trunc | 0) == 0) {
      $4 = ($rem | 0) != 0;
      if (($d_sroa_1_4_extract_trunc | 0) == 0) {
        if ($4) {
          HEAP32[$rem >> 2] = ($n_sroa_0_0_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
          HEAP32[$rem + 4 >> 2] = 0;
        }
        $_0$1 = 0;
        $_0$0 = ($n_sroa_0_0_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$4) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      }
    }
    $17 = ($d_sroa_1_4_extract_trunc | 0) == 0;
    do {
      if (($d_sroa_0_0_extract_trunc | 0) == 0) {
        if ($17) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_0_0_extract_trunc >>> 0);
            HEAP32[$rem + 4 >> 2] = 0;
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_0_0_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        if (($n_sroa_0_0_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0;
            HEAP32[$rem + 4 >> 2] = ($n_sroa_1_4_extract_trunc >>> 0) % ($d_sroa_1_4_extract_trunc >>> 0);
          }
          $_0$1 = 0;
          $_0$0 = ($n_sroa_1_4_extract_trunc >>> 0) / ($d_sroa_1_4_extract_trunc >>> 0) >>> 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $37 = $d_sroa_1_4_extract_trunc - 1 | 0;
        if (($37 & $d_sroa_1_4_extract_trunc | 0) == 0) {
          if (($rem | 0) != 0) {
            HEAP32[$rem >> 2] = 0 | $a$0 & -1;
            HEAP32[$rem + 4 >> 2] = $37 & $n_sroa_1_4_extract_trunc | $a$1 & 0;
          }
          $_0$1 = 0;
          $_0$0 = $n_sroa_1_4_extract_trunc >>> ((_llvm_cttz_i32($d_sroa_1_4_extract_trunc | 0) | 0) >>> 0);
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $49 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
        $51 = $49 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
        if ($51 >>> 0 <= 30) {
          $57 = $51 + 1 | 0;
          $58 = 31 - $51 | 0;
          $sr_1_ph = $57;
          $r_sroa_0_1_ph = $n_sroa_1_4_extract_trunc << $58 | $n_sroa_0_0_extract_trunc >>> ($57 >>> 0);
          $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($57 >>> 0);
          $q_sroa_0_1_ph = 0;
          $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $58;
          break;
        }
        if (($rem | 0) == 0) {
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        HEAP32[$rem >> 2] = 0 | $a$0 & -1;
        HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
        $_0$1 = 0;
        $_0$0 = 0;
        return (tempRet0 = $_0$1, $_0$0) | 0;
      } else {
        if (!$17) {
          $117 = Math_clz32($d_sroa_1_4_extract_trunc | 0) | 0;
          $119 = $117 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          if ($119 >>> 0 <= 31) {
            $125 = $119 + 1 | 0;
            $126 = 31 - $119 | 0;
            $130 = $119 - 31 >> 31;
            $sr_1_ph = $125;
            $r_sroa_0_1_ph = $n_sroa_0_0_extract_trunc >>> ($125 >>> 0) & $130 | $n_sroa_1_4_extract_trunc << $126;
            $r_sroa_1_1_ph = $n_sroa_1_4_extract_trunc >>> ($125 >>> 0) & $130;
            $q_sroa_0_1_ph = 0;
            $q_sroa_1_1_ph = $n_sroa_0_0_extract_trunc << $126;
            break;
          }
          if (($rem | 0) == 0) {
            $_0$1 = 0;
            $_0$0 = 0;
            return (tempRet0 = $_0$1, $_0$0) | 0;
          }
          HEAP32[$rem >> 2] = 0 | $a$0 & -1;
          HEAP32[$rem + 4 >> 2] = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$1 = 0;
          $_0$0 = 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
        $66 = $d_sroa_0_0_extract_trunc - 1 | 0;
        if (($66 & $d_sroa_0_0_extract_trunc | 0) != 0) {
          $86 = (Math_clz32($d_sroa_0_0_extract_trunc | 0) | 0) + 33 | 0;
          $88 = $86 - (Math_clz32($n_sroa_1_4_extract_trunc | 0) | 0) | 0;
          $89 = 64 - $88 | 0;
          $91 = 32 - $88 | 0;
          $92 = $91 >> 31;
          $95 = $88 - 32 | 0;
          $105 = $95 >> 31;
          $sr_1_ph = $88;
          $r_sroa_0_1_ph = $91 - 1 >> 31 & $n_sroa_1_4_extract_trunc >>> ($95 >>> 0) | ($n_sroa_1_4_extract_trunc << $91 | $n_sroa_0_0_extract_trunc >>> ($88 >>> 0)) & $105;
          $r_sroa_1_1_ph = $105 & $n_sroa_1_4_extract_trunc >>> ($88 >>> 0);
          $q_sroa_0_1_ph = $n_sroa_0_0_extract_trunc << $89 & $92;
          $q_sroa_1_1_ph = ($n_sroa_1_4_extract_trunc << $89 | $n_sroa_0_0_extract_trunc >>> ($95 >>> 0)) & $92 | $n_sroa_0_0_extract_trunc << $91 & $88 - 33 >> 31;
          break;
        }
        if (($rem | 0) != 0) {
          HEAP32[$rem >> 2] = $66 & $n_sroa_0_0_extract_trunc;
          HEAP32[$rem + 4 >> 2] = 0;
        }
        if (($d_sroa_0_0_extract_trunc | 0) == 1) {
          $_0$1 = $n_sroa_1_4_extract_shift$0 | $a$1 & 0;
          $_0$0 = 0 | $a$0 & -1;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        } else {
          $78 = _llvm_cttz_i32($d_sroa_0_0_extract_trunc | 0) | 0;
          $_0$1 = 0 | $n_sroa_1_4_extract_trunc >>> ($78 >>> 0);
          $_0$0 = $n_sroa_1_4_extract_trunc << 32 - $78 | $n_sroa_0_0_extract_trunc >>> ($78 >>> 0) | 0;
          return (tempRet0 = $_0$1, $_0$0) | 0;
        }
      }
    } while (0);
    if (($sr_1_ph | 0) == 0) {
      $q_sroa_1_1_lcssa = $q_sroa_1_1_ph;
      $q_sroa_0_1_lcssa = $q_sroa_0_1_ph;
      $r_sroa_1_1_lcssa = $r_sroa_1_1_ph;
      $r_sroa_0_1_lcssa = $r_sroa_0_1_ph;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = 0;
    } else {
      $d_sroa_0_0_insert_insert99$0 = 0 | $b$0 & -1;
      $d_sroa_0_0_insert_insert99$1 = $d_sroa_1_4_extract_shift$0 | $b$1 & 0;
      $137$0 = _i64Add($d_sroa_0_0_insert_insert99$0 | 0, $d_sroa_0_0_insert_insert99$1 | 0, -1, -1) | 0;
      $137$1 = tempRet0;
      $q_sroa_1_1198 = $q_sroa_1_1_ph;
      $q_sroa_0_1199 = $q_sroa_0_1_ph;
      $r_sroa_1_1200 = $r_sroa_1_1_ph;
      $r_sroa_0_1201 = $r_sroa_0_1_ph;
      $sr_1202 = $sr_1_ph;
      $carry_0203 = 0;
      while (1) {
        $147 = $q_sroa_0_1199 >>> 31 | $q_sroa_1_1198 << 1;
        $149 = $carry_0203 | $q_sroa_0_1199 << 1;
        $r_sroa_0_0_insert_insert42$0 = 0 | ($r_sroa_0_1201 << 1 | $q_sroa_1_1198 >>> 31);
        $r_sroa_0_0_insert_insert42$1 = $r_sroa_0_1201 >>> 31 | $r_sroa_1_1200 << 1 | 0;
        _i64Subtract($137$0 | 0, $137$1 | 0, $r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0) | 0;
        $150$1 = tempRet0;
        $151$0 = $150$1 >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1;
        $152 = $151$0 & 1;
        $154$0 = _i64Subtract($r_sroa_0_0_insert_insert42$0 | 0, $r_sroa_0_0_insert_insert42$1 | 0, $151$0 & $d_sroa_0_0_insert_insert99$0 | 0, ((($150$1 | 0) < 0 ? -1 : 0) >> 31 | (($150$1 | 0) < 0 ? -1 : 0) << 1) & $d_sroa_0_0_insert_insert99$1 | 0) | 0;
        $r_sroa_0_0_extract_trunc = $154$0;
        $r_sroa_1_4_extract_trunc = tempRet0;
        $155 = $sr_1202 - 1 | 0;
        if (($155 | 0) == 0) {
          break;
        } else {
          $q_sroa_1_1198 = $147;
          $q_sroa_0_1199 = $149;
          $r_sroa_1_1200 = $r_sroa_1_4_extract_trunc;
          $r_sroa_0_1201 = $r_sroa_0_0_extract_trunc;
          $sr_1202 = $155;
          $carry_0203 = $152;
        }
      }
      $q_sroa_1_1_lcssa = $147;
      $q_sroa_0_1_lcssa = $149;
      $r_sroa_1_1_lcssa = $r_sroa_1_4_extract_trunc;
      $r_sroa_0_1_lcssa = $r_sroa_0_0_extract_trunc;
      $carry_0_lcssa$1 = 0;
      $carry_0_lcssa$0 = $152;
    }
    $q_sroa_0_0_insert_ext75$0 = $q_sroa_0_1_lcssa;
    $q_sroa_0_0_insert_ext75$1 = 0;
    $q_sroa_0_0_insert_insert77$1 = $q_sroa_1_1_lcssa | $q_sroa_0_0_insert_ext75$1;
    if (($rem | 0) != 0) {
      HEAP32[$rem >> 2] = 0 | $r_sroa_0_1_lcssa;
      HEAP32[$rem + 4 >> 2] = $r_sroa_1_1_lcssa | 0;
    }
    $_0$1 = (0 | $q_sroa_0_0_insert_ext75$0) >>> 31 | $q_sroa_0_0_insert_insert77$1 << 1 | ($q_sroa_0_0_insert_ext75$1 << 1 | $q_sroa_0_0_insert_ext75$0 >>> 31) & 0 | $carry_0_lcssa$1;
    $_0$0 = ($q_sroa_0_0_insert_ext75$0 << 1 | 0 >>> 31) & -2 | $carry_0_lcssa$0;
    return (tempRet0 = $_0$1, $_0$0) | 0;
}
function ___udivdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $1$0 = 0;
    $1$0 = ___udivmoddi4($a$0, $a$1, $b$0, $b$1, 0) | 0;
    return $1$0 | 0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}
function ___uremdi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $rem = 0, __stackBase__ = 0;
    __stackBase__ = STACKTOP;
    STACKTOP = STACKTOP + 16 | 0;
    $rem = __stackBase__ | 0;
    ___udivmoddi4($a$0, $a$1, $b$0, $b$1, $rem) | 0;
    STACKTOP = __stackBase__;
    return (tempRet0 = HEAP32[$rem + 4 >> 2] | 0, HEAP32[$rem >> 2] | 0) | 0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _llvm_bswap_i32(x) {
    x = x|0;
    return (((x&0xff)<<24) | (((x>>8)&0xff)<<16) | (((x>>16)&0xff)<<8) | (x>>>24))|0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}


function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&7](a1|0,a2|0)|0;
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}
function b2(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(2);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdio_write,___stdio_seek,___stdout_write,b1,b1,b1];
var FUNCTION_TABLE_iii = [b2,b2,b2,b2,b2,_compare_lujvo,b2,b2];

  return { _llvm_bswap_i32: _llvm_bswap_i32, _main: _main, _i64Subtract: _i64Subtract, ___udivdi3: ___udivdi3, setThrew: setThrew, _bitshift64Lshr: _bitshift64Lshr, _bitshift64Shl: _bitshift64Shl, _fflush: _fflush, ___errno_location: ___errno_location, _memset: _memset, _sbrk: _sbrk, _memcpy: _memcpy, stackAlloc: stackAlloc, ___uremdi3: ___uremdi3, getTempRet0: getTempRet0, setTempRet0: setTempRet0, _i64Add: _i64Add, dynCall_iiii: dynCall_iiii, _emscripten_get_global_libc: _emscripten_get_global_libc, dynCall_ii: dynCall_ii, stackSave: stackSave, _free: _free, runPostSets: runPostSets, establishStackSpace: establishStackSpace, stackRestore: stackRestore, _malloc: _malloc, dynCall_iii: dynCall_iii };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real__llvm_bswap_i32 = asm["_llvm_bswap_i32"]; asm["_llvm_bswap_i32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__llvm_bswap_i32.apply(null, arguments);
};

var real__main = asm["_main"]; asm["_main"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__main.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real____udivdi3 = asm["___udivdi3"]; asm["___udivdi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____udivdi3.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Shl.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____uremdi3 = asm["___uremdi3"]; asm["___uremdi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____uremdi3.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Subtract.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Add.apply(null, arguments);
};

var real__emscripten_get_global_libc = asm["_emscripten_get_global_libc"]; asm["_emscripten_get_global_libc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__emscripten_get_global_libc.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};
var _llvm_bswap_i32 = Module["_llvm_bswap_i32"] = asm["_llvm_bswap_i32"];
var _main = Module["_main"] = asm["_main"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var ___udivdi3 = Module["___udivdi3"] = asm["___udivdi3"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___uremdi3 = Module["___uremdi3"] = asm["___uremdi3"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var _free = Module["_free"] = asm["_free"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
;
Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];
Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];


// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;






/**
 * @constructor
 * @extends {Error}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      Module.printErr('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



