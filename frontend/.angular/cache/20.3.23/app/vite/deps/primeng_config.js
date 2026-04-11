import {
  CommonModule
} from "./chunk-G47W2SAE.js";
import {
  Component,
  DOCUMENT,
  Directive,
  Injectable,
  InjectionToken,
  Input,
  NgModule,
  PLATFORM_ID,
  Subject,
  TemplateRef,
  effect,
  inject,
  makeEnvironmentProviders,
  provideAppInitializer,
  setClassMetadata,
  signal,
  untracked,
  ɵɵdefineComponent,
  ɵɵdefineDirective,
  ɵɵdefineInjectable,
  ɵɵdefineInjector,
  ɵɵdefineNgModule,
  ɵɵdirectiveInject,
  ɵɵgetInheritedFactory,
  ɵɵprojection,
  ɵɵprojectionDef
} from "./chunk-RK3CMTTK.js";
import {
  __spreadValues
} from "./chunk-WDMUDEB6.js";

// node_modules/@primeuix/utils/dist/dom/index.mjs
function c(t) {
  return typeof Element != "undefined" ? t instanceof Element : t !== null && typeof t == "object" && t.nodeType === 1 && typeof t.nodeName == "string";
}
function A(t, e = {}) {
  if (c(t)) {
    let o = (n, r) => {
      var l2, d;
      let i2 = (l2 = t == null ? void 0 : t.$attrs) != null && l2[n] ? [(d = t == null ? void 0 : t.$attrs) == null ? void 0 : d[n]] : [];
      return [r].flat().reduce((s3, a2) => {
        if (a2 != null) {
          let u = typeof a2;
          if (u === "string" || u === "number") s3.push(a2);
          else if (u === "object") {
            let p2 = Array.isArray(a2) ? o(n, a2) : Object.entries(a2).map(([f, g2]) => n === "style" && (g2 || g2 === 0) ? `${f.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}:${g2}` : g2 ? f : void 0);
            s3 = p2.length ? s3.concat(p2.filter((f) => !!f)) : s3;
          }
        }
        return s3;
      }, i2);
    };
    Object.entries(e).forEach(([n, r]) => {
      if (r != null) {
        let i2 = n.match(/^on(.+)/);
        i2 ? t.addEventListener(i2[1].toLowerCase(), r) : n === "p-bind" || n === "pBind" ? A(t, r) : (r = n === "class" ? [...new Set(o("class", r))].join(" ").trim() : n === "style" ? o("style", r).join(";").trim() : r, (t.$attrs = t.$attrs || {}) && (t.$attrs[n] = r), t.setAttribute(n, r));
      }
    });
  }
}
function _t(t, e = "", o) {
  c(t) && o !== null && o !== void 0 && t.setAttribute(e, o);
}

// node_modules/@primeuix/utils/dist/eventbus/index.mjs
function s() {
  let r = /* @__PURE__ */ new Map();
  return { on(e, t) {
    let n = r.get(e);
    return n ? n.push(t) : n = [t], r.set(e, n), this;
  }, off(e, t) {
    let n = r.get(e);
    return n && n.splice(n.indexOf(t) >>> 0, 1), this;
  }, emit(e, t) {
    let n = r.get(e);
    n && n.forEach((i2) => {
      i2(t);
    });
  }, clear() {
    r.clear();
  } };
}

// node_modules/@primeuix/utils/dist/object/index.mjs
function l(e) {
  return e == null || e === "" || Array.isArray(e) && e.length === 0 || !(e instanceof Date) && typeof e == "object" && Object.keys(e).length === 0;
}
function b(e, t, n = /* @__PURE__ */ new WeakSet()) {
  if (e === t) return true;
  if (!e || !t || typeof e != "object" || typeof t != "object" || n.has(e) || n.has(t)) return false;
  n.add(e).add(t);
  let o = Array.isArray(e), r = Array.isArray(t), u, f, T;
  if (o && r) {
    if (f = e.length, f != t.length) return false;
    for (u = f; u-- !== 0; ) if (!b(e[u], t[u], n)) return false;
    return true;
  }
  if (o != r) return false;
  let S2 = e instanceof Date, A2 = t instanceof Date;
  if (S2 != A2) return false;
  if (S2 && A2) return e.getTime() == t.getTime();
  let I = e instanceof RegExp, L = t instanceof RegExp;
  if (I != L) return false;
  if (I && L) return e.toString() == t.toString();
  let R = Object.keys(e);
  if (f = R.length, f !== Object.keys(t).length) return false;
  for (u = f; u-- !== 0; ) if (!Object.prototype.hasOwnProperty.call(t, R[u])) return false;
  for (u = f; u-- !== 0; ) if (T = R[u], !b(e[T], t[T], n)) return false;
  return true;
}
function y(e, t) {
  return b(e, t);
}
function c2(e) {
  return typeof e == "function" && "call" in e && "apply" in e;
}
function s2(e) {
  return !l(e);
}
function p(e, t) {
  if (!e || !t) return null;
  try {
    let n = e[t];
    if (s2(n)) return n;
  } catch (n) {
  }
  if (Object.keys(e).length) {
    if (c2(t)) return t(e);
    if (t.indexOf(".") === -1) return e[t];
    {
      let n = t.split("."), o = e;
      for (let r = 0, u = n.length; r < u; ++r) {
        if (o == null) return null;
        o = o[n[r]];
      }
      return o;
    }
  }
  return null;
}
function k(e, t, n) {
  return n ? p(e, n) === p(t, n) : y(e, t);
}
function i(e, t = true) {
  return e instanceof Object && e.constructor === Object && (t || Object.keys(e).length !== 0);
}
function m(e, ...t) {
  return c2(e) ? e(...t) : e;
}
function a(e, t = true) {
  return typeof e == "string" && (t || e !== "");
}
function z(e) {
  return s2(e) && !isNaN(e);
}
function G(e, t) {
  if (t) {
    let n = t.test(e);
    return t.lastIndex = 0, n;
  }
  return false;
}
function Y(e) {
  return e && e.replace(/\/\*(?:(?!\*\/)[\s\S])*\*\/|[\r\n\t]+/g, "").replace(/ {2,}/g, " ").replace(/ ([{:}]) /g, "$1").replace(/([;,]) /g, "$1").replace(/ !/g, "!").replace(/: /g, ":").trim();
}
function X(e) {
  if (e && /[\xC0-\xFF\u0100-\u017E]/.test(e)) {
    let n = { A: /[\xC0-\xC5\u0100\u0102\u0104]/g, AE: /[\xC6]/g, C: /[\xC7\u0106\u0108\u010A\u010C]/g, D: /[\xD0\u010E\u0110]/g, E: /[\xC8-\xCB\u0112\u0114\u0116\u0118\u011A]/g, G: /[\u011C\u011E\u0120\u0122]/g, H: /[\u0124\u0126]/g, I: /[\xCC-\xCF\u0128\u012A\u012C\u012E\u0130]/g, IJ: /[\u0132]/g, J: /[\u0134]/g, K: /[\u0136]/g, L: /[\u0139\u013B\u013D\u013F\u0141]/g, N: /[\xD1\u0143\u0145\u0147\u014A]/g, O: /[\xD2-\xD6\xD8\u014C\u014E\u0150]/g, OE: /[\u0152]/g, R: /[\u0154\u0156\u0158]/g, S: /[\u015A\u015C\u015E\u0160]/g, T: /[\u0162\u0164\u0166]/g, U: /[\xD9-\xDC\u0168\u016A\u016C\u016E\u0170\u0172]/g, W: /[\u0174]/g, Y: /[\xDD\u0176\u0178]/g, Z: /[\u0179\u017B\u017D]/g, a: /[\xE0-\xE5\u0101\u0103\u0105]/g, ae: /[\xE6]/g, c: /[\xE7\u0107\u0109\u010B\u010D]/g, d: /[\u010F\u0111]/g, e: /[\xE8-\xEB\u0113\u0115\u0117\u0119\u011B]/g, g: /[\u011D\u011F\u0121\u0123]/g, i: /[\xEC-\xEF\u0129\u012B\u012D\u012F\u0131]/g, ij: /[\u0133]/g, j: /[\u0135]/g, k: /[\u0137,\u0138]/g, l: /[\u013A\u013C\u013E\u0140\u0142]/g, n: /[\xF1\u0144\u0146\u0148\u014B]/g, p: /[\xFE]/g, o: /[\xF2-\xF6\xF8\u014D\u014F\u0151]/g, oe: /[\u0153]/g, r: /[\u0155\u0157\u0159]/g, s: /[\u015B\u015D\u015F\u0161]/g, t: /[\u0163\u0165\u0167]/g, u: /[\xF9-\xFC\u0169\u016B\u016D\u016F\u0171\u0173]/g, w: /[\u0175]/g, y: /[\xFD\xFF\u0177]/g, z: /[\u017A\u017C\u017E]/g };
    for (let o in n) e = e.replace(n[o], o);
  }
  return e;
}
function re(e) {
  return a(e) ? e.replace(/(_)/g, "-").replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() : e;
}

// node_modules/@primeuix/utils/dist/zindex/index.mjs
function g() {
  let r = [], i2 = (e, n, t = 999) => {
    let s3 = u(e, n, t), o = s3.value + (s3.key === e ? 0 : t) + 1;
    return r.push({ key: e, value: o }), o;
  }, d = (e) => {
    r = r.filter((n) => n.value !== e);
  }, a2 = (e, n) => u(e, n).value, u = (e, n, t = 0) => [...r].reverse().find((s3) => n ? true : s3.key === e) || { key: e, value: t }, l2 = (e) => e && parseInt(e.style.zIndex, 10) || 0;
  return { get: l2, set: (e, n, t) => {
    n && (n.style.zIndex = String(i2(e, true, t)));
  }, clear: (e) => {
    e && (d(l2(e)), e.style.zIndex = "");
  }, getCurrent: (e) => a2(e, true) };
}
var x = g();

// node_modules/primeng/fesm2022/primeng-api.mjs
var _c0 = ["*"];
var ConfirmEventType;
(function(ConfirmEventType2) {
  ConfirmEventType2[ConfirmEventType2["ACCEPT"] = 0] = "ACCEPT";
  ConfirmEventType2[ConfirmEventType2["REJECT"] = 1] = "REJECT";
  ConfirmEventType2[ConfirmEventType2["CANCEL"] = 2] = "CANCEL";
})(ConfirmEventType || (ConfirmEventType = {}));
var ConfirmationService = class _ConfirmationService {
  requireConfirmationSource = new Subject();
  acceptConfirmationSource = new Subject();
  requireConfirmation$ = this.requireConfirmationSource.asObservable();
  accept = this.acceptConfirmationSource.asObservable();
  /**
   * Callback to invoke on confirm.
   * @param {Confirmation} confirmation - Represents a confirmation dialog configuration.
   * @group Method
   */
  confirm(confirmation) {
    this.requireConfirmationSource.next(confirmation);
    return this;
  }
  /**
   * Closes the dialog.
   * @group Method
   */
  close() {
    this.requireConfirmationSource.next(null);
    return this;
  }
  /**
   * Accepts the dialog.
   * @group Method
   */
  onAccept() {
    this.acceptConfirmationSource.next(null);
  }
  static ɵfac = function ConfirmationService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ConfirmationService)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _ConfirmationService,
    factory: _ConfirmationService.ɵfac
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ConfirmationService, [{
    type: Injectable
  }], null, null);
})();
var ContextMenuService = class _ContextMenuService {
  activeItemKeyChange = new Subject();
  activeItemKeyChange$ = this.activeItemKeyChange.asObservable();
  activeItemKey;
  changeKey(key) {
    this.activeItemKey = key;
    this.activeItemKeyChange.next(this.activeItemKey);
  }
  reset() {
    this.activeItemKey = null;
    this.activeItemKeyChange.next(this.activeItemKey);
  }
  static ɵfac = function ContextMenuService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ContextMenuService)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _ContextMenuService,
    factory: _ContextMenuService.ɵfac
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ContextMenuService, [{
    type: Injectable
  }], null, null);
})();
var FilterMatchMode = class {
  static STARTS_WITH = "startsWith";
  static CONTAINS = "contains";
  static NOT_CONTAINS = "notContains";
  static ENDS_WITH = "endsWith";
  static EQUALS = "equals";
  static NOT_EQUALS = "notEquals";
  static IN = "in";
  static LESS_THAN = "lt";
  static LESS_THAN_OR_EQUAL_TO = "lte";
  static GREATER_THAN = "gt";
  static GREATER_THAN_OR_EQUAL_TO = "gte";
  static BETWEEN = "between";
  static IS = "is";
  static IS_NOT = "isNot";
  static BEFORE = "before";
  static AFTER = "after";
  static DATE_IS = "dateIs";
  static DATE_IS_NOT = "dateIsNot";
  static DATE_BEFORE = "dateBefore";
  static DATE_AFTER = "dateAfter";
};
var FilterService = class _FilterService {
  filter(value, fields, filterValue, filterMatchMode, filterLocale) {
    let filteredItems = [];
    if (value) {
      for (let item of value) {
        for (let field of fields) {
          let fieldValue = p(item, field);
          if (this.filters[filterMatchMode](fieldValue, filterValue, filterLocale)) {
            filteredItems.push(item);
            break;
          }
        }
      }
    }
    return filteredItems;
  }
  filters = {
    startsWith: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null || filter.trim() === "") {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      let filterValue = X(filter.toString()).toLocaleLowerCase(filterLocale);
      let stringValue = X(value.toString()).toLocaleLowerCase(filterLocale);
      return stringValue.slice(0, filterValue.length) === filterValue;
    },
    contains: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null || typeof filter === "string" && filter.trim() === "") {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      let filterValue = X(filter.toString()).toLocaleLowerCase(filterLocale);
      let stringValue = X(value.toString()).toLocaleLowerCase(filterLocale);
      return stringValue.indexOf(filterValue) !== -1;
    },
    notContains: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null || typeof filter === "string" && filter.trim() === "") {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      let filterValue = X(filter.toString()).toLocaleLowerCase(filterLocale);
      let stringValue = X(value.toString()).toLocaleLowerCase(filterLocale);
      return stringValue.indexOf(filterValue) === -1;
    },
    endsWith: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null || filter.trim() === "") {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      let filterValue = X(filter.toString()).toLocaleLowerCase(filterLocale);
      let stringValue = X(value.toString()).toLocaleLowerCase(filterLocale);
      return stringValue.indexOf(filterValue, stringValue.length - filterValue.length) !== -1;
    },
    equals: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null || typeof filter === "string" && filter.trim() === "") {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      if (value.getTime && filter.getTime) return value.getTime() === filter.getTime();
      else if (value == filter) return true;
      else return X(value.toString()).toLocaleLowerCase(filterLocale) == X(filter.toString()).toLocaleLowerCase(filterLocale);
    },
    notEquals: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null || typeof filter === "string" && filter.trim() === "") {
        return false;
      }
      if (value === void 0 || value === null) {
        return true;
      }
      if (value.getTime && filter.getTime) return value.getTime() !== filter.getTime();
      else if (value == filter) return false;
      else return X(value.toString()).toLocaleLowerCase(filterLocale) != X(filter.toString()).toLocaleLowerCase(filterLocale);
    },
    in: (value, filter) => {
      if (filter === void 0 || filter === null || filter.length === 0) {
        return true;
      }
      for (let i2 = 0; i2 < filter.length; i2++) {
        if (k(value, filter[i2])) {
          return true;
        }
      }
      return false;
    },
    between: (value, filter) => {
      if (filter == null || filter[0] == null || filter[1] == null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      if (value.getTime) return filter[0].getTime() <= value.getTime() && value.getTime() <= filter[1].getTime();
      else return filter[0] <= value && value <= filter[1];
    },
    lt: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      if (value.getTime && filter.getTime) return value.getTime() < filter.getTime();
      else return value < filter;
    },
    lte: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      if (value.getTime && filter.getTime) return value.getTime() <= filter.getTime();
      else return value <= filter;
    },
    gt: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      if (value.getTime && filter.getTime) return value.getTime() > filter.getTime();
      else return value > filter;
    },
    gte: (value, filter, filterLocale) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      if (value.getTime && filter.getTime) return value.getTime() >= filter.getTime();
      else return value >= filter;
    },
    is: (value, filter, filterLocale) => {
      return this.filters.equals(value, filter, filterLocale);
    },
    isNot: (value, filter, filterLocale) => {
      return this.filters.notEquals(value, filter, filterLocale);
    },
    before: (value, filter, filterLocale) => {
      return this.filters.lt(value, filter, filterLocale);
    },
    after: (value, filter, filterLocale) => {
      return this.filters.gt(value, filter, filterLocale);
    },
    dateIs: (value, filter) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      return value.toDateString() === filter.toDateString();
    },
    dateIsNot: (value, filter) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      return value.toDateString() !== filter.toDateString();
    },
    dateBefore: (value, filter) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      return value.getTime() < filter.getTime();
    },
    dateAfter: (value, filter) => {
      if (filter === void 0 || filter === null) {
        return true;
      }
      if (value === void 0 || value === null) {
        return false;
      }
      value.setHours(0, 0, 0, 0);
      return value.getTime() > filter.getTime();
    }
  };
  register(rule, fn) {
    this.filters[rule] = fn;
  }
  static ɵfac = function FilterService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _FilterService)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _FilterService,
    factory: _FilterService.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(FilterService, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();
var MessageService = class _MessageService {
  messageSource = new Subject();
  clearSource = new Subject();
  messageObserver = this.messageSource.asObservable();
  clearObserver = this.clearSource.asObservable();
  /**
   * Inserts single message.
   * @param {ToastMessageOptions} message - Message to be added.
   * @group Method
   */
  add(message) {
    if (message) {
      this.messageSource.next(message);
    }
  }
  /**
   * Inserts new messages.
   * @param {Message[]} messages - Messages to be added.
   * @group Method
   */
  addAll(messages) {
    if (messages && messages.length) {
      this.messageSource.next(messages);
    }
  }
  /**
   * Clears the message with the given key.
   * @param {string} key - Key of the message to be cleared.
   * @group Method
   */
  clear(key) {
    this.clearSource.next(key || null);
  }
  static ɵfac = function MessageService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _MessageService)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _MessageService,
    factory: _MessageService.ɵfac
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(MessageService, [{
    type: Injectable
  }], null, null);
})();
var OverlayService = class _OverlayService {
  clickSource = new Subject();
  clickObservable = this.clickSource.asObservable();
  add(event) {
    if (event) {
      this.clickSource.next(event);
    }
  }
  static ɵfac = function OverlayService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _OverlayService)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _OverlayService,
    factory: _OverlayService.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(OverlayService, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();
var Header = class _Header {
  static ɵfac = function Header_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _Header)();
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _Header,
    selectors: [["p-header"]],
    standalone: false,
    ngContentSelectors: _c0,
    decls: 1,
    vars: 0,
    template: function Header_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵprojectionDef();
        ɵɵprojection(0);
      }
    },
    encapsulation: 2
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(Header, [{
    type: Component,
    args: [{
      selector: "p-header",
      template: "<ng-content></ng-content>",
      standalone: false
    }]
  }], null, null);
})();
var Footer = class _Footer {
  static ɵfac = function Footer_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _Footer)();
  };
  static ɵcmp = ɵɵdefineComponent({
    type: _Footer,
    selectors: [["p-footer"]],
    standalone: false,
    ngContentSelectors: _c0,
    decls: 1,
    vars: 0,
    template: function Footer_Template(rf, ctx) {
      if (rf & 1) {
        ɵɵprojectionDef();
        ɵɵprojection(0);
      }
    },
    encapsulation: 2
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(Footer, [{
    type: Component,
    args: [{
      selector: "p-footer",
      template: "<ng-content></ng-content>",
      standalone: false
    }]
  }], null, null);
})();
var PrimeTemplate = class _PrimeTemplate {
  template;
  type;
  name;
  constructor(template) {
    this.template = template;
  }
  getType() {
    return this.name;
  }
  static ɵfac = function PrimeTemplate_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _PrimeTemplate)(ɵɵdirectiveInject(TemplateRef));
  };
  static ɵdir = ɵɵdefineDirective({
    type: _PrimeTemplate,
    selectors: [["", "pTemplate", ""]],
    inputs: {
      type: "type",
      name: [0, "pTemplate", "name"]
    }
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PrimeTemplate, [{
    type: Directive,
    args: [{
      selector: "[pTemplate]",
      standalone: true
    }]
  }], () => [{
    type: TemplateRef
  }], {
    type: [{
      type: Input
    }],
    name: [{
      type: Input,
      args: ["pTemplate"]
    }]
  });
})();
var SharedModule = class _SharedModule {
  static ɵfac = function SharedModule_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _SharedModule)();
  };
  static ɵmod = ɵɵdefineNgModule({
    type: _SharedModule,
    declarations: [Header, Footer],
    imports: [CommonModule, PrimeTemplate],
    exports: [Header, Footer, PrimeTemplate]
  });
  static ɵinj = ɵɵdefineInjector({
    imports: [CommonModule]
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(SharedModule, [{
    type: NgModule,
    args: [{
      imports: [CommonModule, PrimeTemplate],
      exports: [Header, Footer, PrimeTemplate],
      declarations: [Header, Footer]
    }]
  }], null, null);
})();
var TreeDragDropService = class _TreeDragDropService {
  dragStartSource = new Subject();
  dragStopSource = new Subject();
  dragStart$ = this.dragStartSource.asObservable();
  dragStop$ = this.dragStopSource.asObservable();
  startDrag(event) {
    this.dragStartSource.next(event);
  }
  stopDrag(event) {
    this.dragStopSource.next(event);
  }
  static ɵfac = function TreeDragDropService_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _TreeDragDropService)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _TreeDragDropService,
    factory: _TreeDragDropService.ɵfac
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(TreeDragDropService, [{
    type: Injectable
  }], null, null);
})();

// node_modules/@primeuix/styled/dist/index.mjs
var rt = Object.defineProperty;
var st = Object.defineProperties;
var nt = Object.getOwnPropertyDescriptors;
var F2 = Object.getOwnPropertySymbols;
var xe = Object.prototype.hasOwnProperty;
var be = Object.prototype.propertyIsEnumerable;
var _e = (e, t, r) => t in e ? rt(e, t, { enumerable: true, configurable: true, writable: true, value: r }) : e[t] = r;
var h = (e, t) => {
  for (var r in t || (t = {})) xe.call(t, r) && _e(e, r, t[r]);
  if (F2) for (var r of F2(t)) be.call(t, r) && _e(e, r, t[r]);
  return e;
};
var $ = (e, t) => st(e, nt(t));
var v = (e, t) => {
  var r = {};
  for (var s3 in e) xe.call(e, s3) && t.indexOf(s3) < 0 && (r[s3] = e[s3]);
  if (e != null && F2) for (var s3 of F2(e)) t.indexOf(s3) < 0 && be.call(e, s3) && (r[s3] = e[s3]);
  return r;
};
var at = s();
var N = at;
var k2 = /{([^}]*)}/g;
var ne = /(\d+\s+[\+\-\*\/]\s+\d+)/g;
var ie = /var\([^)]+\)/g;
function oe(e) {
  return a(e) ? e.replace(/[A-Z]/g, (t, r) => r === 0 ? t : "." + t.toLowerCase()).toLowerCase() : e;
}
function ve(e) {
  return i(e) && e.hasOwnProperty("$value") && e.hasOwnProperty("$type") ? e.$value : e;
}
function dt(e) {
  return e.replaceAll(/ /g, "").replace(/[^\w]/g, "-");
}
function Q(e = "", t = "") {
  return dt(`${a(e, false) && a(t, false) ? `${e}-` : e}${t}`);
}
function ae(e = "", t = "") {
  return `--${Q(e, t)}`;
}
function ht(e = "") {
  let t = (e.match(/{/g) || []).length, r = (e.match(/}/g) || []).length;
  return (t + r) % 2 !== 0;
}
function Y2(e, t = "", r = "", s3 = [], i2) {
  if (a(e)) {
    let a2 = e.trim();
    if (ht(a2)) return;
    if (G(a2, k2)) {
      let n = a2.replaceAll(k2, (l2) => {
        let c3 = l2.replace(/{|}/g, "").split(".").filter((m2) => !s3.some((d) => G(m2, d)));
        return `var(${ae(r, re(c3.join("-")))}${s2(i2) ? `, ${i2}` : ""})`;
      });
      return G(n.replace(ie, "0"), ne) ? `calc(${n})` : n;
    }
    return a2;
  } else if (z(e)) return e;
}
function Re(e, t, r) {
  a(t, false) && e.push(`${t}:${r};`);
}
function C2(e, t) {
  return e ? `${e}{${t}}` : "";
}
function le(e, t) {
  if (e.indexOf("dt(") === -1) return e;
  function r(n, l2) {
    let o = [], c3 = 0, m2 = "", d = null, u = 0;
    for (; c3 <= n.length; ) {
      let g2 = n[c3];
      if ((g2 === '"' || g2 === "'" || g2 === "`") && n[c3 - 1] !== "\\" && (d = d === g2 ? null : g2), !d && (g2 === "(" && u++, g2 === ")" && u--, (g2 === "," || c3 === n.length) && u === 0)) {
        let f = m2.trim();
        f.startsWith("dt(") ? o.push(le(f, l2)) : o.push(s3(f)), m2 = "", c3++;
        continue;
      }
      g2 !== void 0 && (m2 += g2), c3++;
    }
    return o;
  }
  function s3(n) {
    let l2 = n[0];
    if ((l2 === '"' || l2 === "'" || l2 === "`") && n[n.length - 1] === l2) return n.slice(1, -1);
    let o = Number(n);
    return isNaN(o) ? n : o;
  }
  let i2 = [], a2 = [];
  for (let n = 0; n < e.length; n++) if (e[n] === "d" && e.slice(n, n + 3) === "dt(") a2.push(n), n += 2;
  else if (e[n] === ")" && a2.length > 0) {
    let l2 = a2.pop();
    a2.length === 0 && i2.push([l2, n]);
  }
  if (!i2.length) return e;
  for (let n = i2.length - 1; n >= 0; n--) {
    let [l2, o] = i2[n], c3 = e.slice(l2 + 3, o), m2 = r(c3, t), d = t(...m2);
    e = e.slice(0, l2) + d + e.slice(o + 1);
  }
  return e;
}
var E = (...e) => ue(S.getTheme(), ...e);
var ue = (e = {}, t, r, s3) => {
  if (t) {
    let { variable: i2, options: a2 } = S.defaults || {}, { prefix: n, transform: l2 } = (e == null ? void 0 : e.options) || a2 || {}, o = G(t, k2) ? t : `{${t}}`;
    return s3 === "value" || l(s3) && l2 === "strict" ? S.getTokenValue(t) : Y2(o, void 0, n, [i2.excludedKeyRegex], r);
  }
  return "";
};
function ar(e, ...t) {
  if (e instanceof Array) {
    let r = e.reduce((s3, i2, a2) => {
      var n;
      return s3 + i2 + ((n = m(t[a2], { dt: E })) != null ? n : "");
    }, "");
    return le(r, E);
  }
  return m(e, { dt: E });
}
function de(e, t = {}) {
  let r = S.defaults.variable, { prefix: s3 = r.prefix, selector: i2 = r.selector, excludedKeyRegex: a2 = r.excludedKeyRegex } = t, n = [], l2 = [], o = [{ node: e, path: s3 }];
  for (; o.length; ) {
    let { node: m2, path: d } = o.pop();
    for (let u in m2) {
      let g2 = m2[u], f = ve(g2), p2 = G(u, a2) ? Q(d) : Q(d, re(u));
      if (i(f)) o.push({ node: f, path: p2 });
      else {
        let y2 = ae(p2), R = Y2(f, p2, s3, [a2]);
        Re(l2, y2, R);
        let T = p2;
        s3 && T.startsWith(s3 + "-") && (T = T.slice(s3.length + 1)), n.push(T.replace(/-/g, "."));
      }
    }
  }
  let c3 = l2.join("");
  return { value: l2, tokens: n, declarations: c3, css: C2(i2, c3) };
}
var b2 = { regex: { rules: { class: { pattern: /^\.([a-zA-Z][\w-]*)$/, resolve(e) {
  return { type: "class", selector: e, matched: this.pattern.test(e.trim()) };
} }, attr: { pattern: /^\[(.*)\]$/, resolve(e) {
  return { type: "attr", selector: `:root${e},:host${e}`, matched: this.pattern.test(e.trim()) };
} }, media: { pattern: /^@media (.*)$/, resolve(e) {
  return { type: "media", selector: e, matched: this.pattern.test(e.trim()) };
} }, system: { pattern: /^system$/, resolve(e) {
  return { type: "system", selector: "@media (prefers-color-scheme: dark)", matched: this.pattern.test(e.trim()) };
} }, custom: { resolve(e) {
  return { type: "custom", selector: e, matched: true };
} } }, resolve(e) {
  let t = Object.keys(this.rules).filter((r) => r !== "custom").map((r) => this.rules[r]);
  return [e].flat().map((r) => {
    var s3;
    return (s3 = t.map((i2) => i2.resolve(r)).find((i2) => i2.matched)) != null ? s3 : this.rules.custom.resolve(r);
  });
} }, _toVariables(e, t) {
  return de(e, { prefix: t == null ? void 0 : t.prefix });
}, getCommon({ name: e = "", theme: t = {}, params: r, set: s3, defaults: i2 }) {
  var R, T, j, O, M, z2, V;
  let { preset: a2, options: n } = t, l2, o, c3, m2, d, u, g2;
  if (s2(a2) && n.transform !== "strict") {
    let { primitive: L, semantic: te, extend: re2 } = a2, f = te || {}, { colorScheme: K } = f, A2 = v(f, ["colorScheme"]), x2 = re2 || {}, { colorScheme: X2 } = x2, G2 = v(x2, ["colorScheme"]), p2 = K || {}, { dark: U } = p2, B = v(p2, ["dark"]), y2 = X2 || {}, { dark: I } = y2, H2 = v(y2, ["dark"]), W = s2(L) ? this._toVariables({ primitive: L }, n) : {}, q2 = s2(A2) ? this._toVariables({ semantic: A2 }, n) : {}, Z = s2(B) ? this._toVariables({ light: B }, n) : {}, pe = s2(U) ? this._toVariables({ dark: U }, n) : {}, fe = s2(G2) ? this._toVariables({ semantic: G2 }, n) : {}, ye = s2(H2) ? this._toVariables({ light: H2 }, n) : {}, Se = s2(I) ? this._toVariables({ dark: I }, n) : {}, [Me, ze] = [(R = W.declarations) != null ? R : "", W.tokens], [Ke, Xe] = [(T = q2.declarations) != null ? T : "", q2.tokens || []], [Ge, Ue] = [(j = Z.declarations) != null ? j : "", Z.tokens || []], [Be, Ie] = [(O = pe.declarations) != null ? O : "", pe.tokens || []], [He, We] = [(M = fe.declarations) != null ? M : "", fe.tokens || []], [qe, Ze] = [(z2 = ye.declarations) != null ? z2 : "", ye.tokens || []], [Fe, Je] = [(V = Se.declarations) != null ? V : "", Se.tokens || []];
    l2 = this.transformCSS(e, Me, "light", "variable", n, s3, i2), o = ze;
    let Qe = this.transformCSS(e, `${Ke}${Ge}`, "light", "variable", n, s3, i2), Ye = this.transformCSS(e, `${Be}`, "dark", "variable", n, s3, i2);
    c3 = `${Qe}${Ye}`, m2 = [.../* @__PURE__ */ new Set([...Xe, ...Ue, ...Ie])];
    let et = this.transformCSS(e, `${He}${qe}color-scheme:light`, "light", "variable", n, s3, i2), tt = this.transformCSS(e, `${Fe}color-scheme:dark`, "dark", "variable", n, s3, i2);
    d = `${et}${tt}`, u = [.../* @__PURE__ */ new Set([...We, ...Ze, ...Je])], g2 = m(a2.css, { dt: E });
  }
  return { primitive: { css: l2, tokens: o }, semantic: { css: c3, tokens: m2 }, global: { css: d, tokens: u }, style: g2 };
}, getPreset({ name: e = "", preset: t = {}, options: r, params: s3, set: i2, defaults: a2, selector: n }) {
  var f, x2, p2;
  let l2, o, c3;
  if (s2(t) && r.transform !== "strict") {
    let y2 = e.replace("-directive", ""), m2 = t, { colorScheme: R, extend: T, css: j } = m2, O = v(m2, ["colorScheme", "extend", "css"]), d = T || {}, { colorScheme: M } = d, z2 = v(d, ["colorScheme"]), u = R || {}, { dark: V } = u, L = v(u, ["dark"]), g2 = M || {}, { dark: te } = g2, re2 = v(g2, ["dark"]), K = s2(O) ? this._toVariables({ [y2]: h(h({}, O), z2) }, r) : {}, A2 = s2(L) ? this._toVariables({ [y2]: h(h({}, L), re2) }, r) : {}, X2 = s2(V) ? this._toVariables({ [y2]: h(h({}, V), te) }, r) : {}, [G2, U] = [(f = K.declarations) != null ? f : "", K.tokens || []], [B, I] = [(x2 = A2.declarations) != null ? x2 : "", A2.tokens || []], [H2, W] = [(p2 = X2.declarations) != null ? p2 : "", X2.tokens || []], q2 = this.transformCSS(y2, `${G2}${B}`, "light", "variable", r, i2, a2, n), Z = this.transformCSS(y2, H2, "dark", "variable", r, i2, a2, n);
    l2 = `${q2}${Z}`, o = [.../* @__PURE__ */ new Set([...U, ...I, ...W])], c3 = m(j, { dt: E });
  }
  return { css: l2, tokens: o, style: c3 };
}, getPresetC({ name: e = "", theme: t = {}, params: r, set: s3, defaults: i2 }) {
  var o;
  let { preset: a2, options: n } = t, l2 = (o = a2 == null ? void 0 : a2.components) == null ? void 0 : o[e];
  return this.getPreset({ name: e, preset: l2, options: n, params: r, set: s3, defaults: i2 });
}, getPresetD({ name: e = "", theme: t = {}, params: r, set: s3, defaults: i2 }) {
  var c3, m2;
  let a2 = e.replace("-directive", ""), { preset: n, options: l2 } = t, o = ((c3 = n == null ? void 0 : n.components) == null ? void 0 : c3[a2]) || ((m2 = n == null ? void 0 : n.directives) == null ? void 0 : m2[a2]);
  return this.getPreset({ name: a2, preset: o, options: l2, params: r, set: s3, defaults: i2 });
}, applyDarkColorScheme(e) {
  return !(e.darkModeSelector === "none" || e.darkModeSelector === false);
}, getColorSchemeOption(e, t) {
  var r;
  return this.applyDarkColorScheme(e) ? this.regex.resolve(e.darkModeSelector === true ? t.options.darkModeSelector : (r = e.darkModeSelector) != null ? r : t.options.darkModeSelector) : [];
}, getLayerOrder(e, t = {}, r, s3) {
  let { cssLayer: i2 } = t;
  return i2 ? `@layer ${m(i2.order || i2.name || "primeui", r)}` : "";
}, getCommonStyleSheet({ name: e = "", theme: t = {}, params: r, props: s3 = {}, set: i2, defaults: a2 }) {
  let n = this.getCommon({ name: e, theme: t, params: r, set: i2, defaults: a2 }), l2 = Object.entries(s3).reduce((o, [c3, m2]) => o.push(`${c3}="${m2}"`) && o, []).join(" ");
  return Object.entries(n || {}).reduce((o, [c3, m2]) => {
    if (i(m2) && Object.hasOwn(m2, "css")) {
      let d = Y(m2.css), u = `${c3}-variables`;
      o.push(`<style type="text/css" data-primevue-style-id="${u}" ${l2}>${d}</style>`);
    }
    return o;
  }, []).join("");
}, getStyleSheet({ name: e = "", theme: t = {}, params: r, props: s3 = {}, set: i2, defaults: a2 }) {
  var c3;
  let n = { name: e, theme: t, params: r, set: i2, defaults: a2 }, l2 = (c3 = e.includes("-directive") ? this.getPresetD(n) : this.getPresetC(n)) == null ? void 0 : c3.css, o = Object.entries(s3).reduce((m2, [d, u]) => m2.push(`${d}="${u}"`) && m2, []).join(" ");
  return l2 ? `<style type="text/css" data-primevue-style-id="${e}-variables" ${o}>${Y(l2)}</style>` : "";
}, createTokens(e = {}, t, r = "", s3 = "", i2 = {}) {
  let a2 = function(l2, o = {}, c3 = []) {
    if (c3.includes(this.path)) return console.warn(`Circular reference detected at ${this.path}`), { colorScheme: l2, path: this.path, paths: o, value: void 0 };
    c3.push(this.path), o.name = this.path, o.binding || (o.binding = {});
    let m2 = this.value;
    if (typeof this.value == "string" && k2.test(this.value)) {
      let u = this.value.trim().replace(k2, (g2) => {
        var y2;
        let f = g2.slice(1, -1), x2 = this.tokens[f];
        if (!x2) return console.warn(`Token not found for path: ${f}`), "__UNRESOLVED__";
        let p2 = x2.computed(l2, o, c3);
        return Array.isArray(p2) && p2.length === 2 ? `light-dark(${p2[0].value},${p2[1].value})` : (y2 = p2 == null ? void 0 : p2.value) != null ? y2 : "__UNRESOLVED__";
      });
      m2 = ne.test(u.replace(ie, "0")) ? `calc(${u})` : u;
    }
    return l(o.binding) && delete o.binding, c3.pop(), { colorScheme: l2, path: this.path, paths: o, value: m2.includes("__UNRESOLVED__") ? void 0 : m2 };
  }, n = (l2, o, c3) => {
    Object.entries(l2).forEach(([m2, d]) => {
      let u = G(m2, t.variable.excludedKeyRegex) ? o : o ? `${o}.${oe(m2)}` : oe(m2), g2 = c3 ? `${c3}.${m2}` : m2;
      i(d) ? n(d, u, g2) : (i2[u] || (i2[u] = { paths: [], computed: (f, x2 = {}, p2 = []) => {
        if (i2[u].paths.length === 1) return i2[u].paths[0].computed(i2[u].paths[0].scheme, x2.binding, p2);
        if (f && f !== "none") for (let y2 = 0; y2 < i2[u].paths.length; y2++) {
          let R = i2[u].paths[y2];
          if (R.scheme === f) return R.computed(f, x2.binding, p2);
        }
        return i2[u].paths.map((y2) => y2.computed(y2.scheme, x2[y2.scheme], p2));
      } }), i2[u].paths.push({ path: g2, value: d, scheme: g2.includes("colorScheme.light") ? "light" : g2.includes("colorScheme.dark") ? "dark" : "none", computed: a2, tokens: i2 }));
    });
  };
  return n(e, r, s3), i2;
}, getTokenValue(e, t, r) {
  var l2;
  let i2 = ((o) => o.split(".").filter((m2) => !G(m2.toLowerCase(), r.variable.excludedKeyRegex)).join("."))(t), a2 = t.includes("colorScheme.light") ? "light" : t.includes("colorScheme.dark") ? "dark" : void 0, n = [(l2 = e[i2]) == null ? void 0 : l2.computed(a2)].flat().filter((o) => o);
  return n.length === 1 ? n[0].value : n.reduce((o = {}, c3) => {
    let u = c3, { colorScheme: m2 } = u, d = v(u, ["colorScheme"]);
    return o[m2] = d, o;
  }, void 0);
}, getSelectorRule(e, t, r, s3) {
  return r === "class" || r === "attr" ? C2(s2(t) ? `${e}${t},${e} ${t}` : e, s3) : C2(e, C2(t != null ? t : ":root,:host", s3));
}, transformCSS(e, t, r, s3, i2 = {}, a2, n, l2) {
  if (s2(t)) {
    let { cssLayer: o } = i2;
    if (s3 !== "style") {
      let c3 = this.getColorSchemeOption(i2, n);
      t = r === "dark" ? c3.reduce((m2, { type: d, selector: u }) => (s2(u) && (m2 += u.includes("[CSS]") ? u.replace("[CSS]", t) : this.getSelectorRule(u, l2, d, t)), m2), "") : C2(l2 != null ? l2 : ":root,:host", t);
    }
    if (o) {
      let c3 = { name: "primeui", order: "primeui" };
      i(o) && (c3.name = m(o.name, { name: e, type: s3 })), s2(c3.name) && (t = C2(`@layer ${c3.name}`, t), a2 == null || a2.layerNames(c3.name));
    }
    return t;
  }
  return "";
} };
var S = { defaults: { variable: { prefix: "p", selector: ":root,:host", excludedKeyRegex: /^(primitive|semantic|components|directives|variables|colorscheme|light|dark|common|root|states|extend|css)$/gi }, options: { prefix: "p", darkModeSelector: "system", cssLayer: false } }, _theme: void 0, _layerNames: /* @__PURE__ */ new Set(), _loadedStyleNames: /* @__PURE__ */ new Set(), _loadingStyles: /* @__PURE__ */ new Set(), _tokens: {}, update(e = {}) {
  let { theme: t } = e;
  t && (this._theme = $(h({}, t), { options: h(h({}, this.defaults.options), t.options) }), this._tokens = b2.createTokens(this.preset, this.defaults), this.clearLoadedStyleNames());
}, get theme() {
  return this._theme;
}, get preset() {
  var e;
  return ((e = this.theme) == null ? void 0 : e.preset) || {};
}, get options() {
  var e;
  return ((e = this.theme) == null ? void 0 : e.options) || {};
}, get tokens() {
  return this._tokens;
}, getTheme() {
  return this.theme;
}, setTheme(e) {
  this.update({ theme: e }), N.emit("theme:change", e);
}, getPreset() {
  return this.preset;
}, setPreset(e) {
  this._theme = $(h({}, this.theme), { preset: e }), this._tokens = b2.createTokens(e, this.defaults), this.clearLoadedStyleNames(), N.emit("preset:change", e), N.emit("theme:change", this.theme);
}, getOptions() {
  return this.options;
}, setOptions(e) {
  this._theme = $(h({}, this.theme), { options: e }), this.clearLoadedStyleNames(), N.emit("options:change", e), N.emit("theme:change", this.theme);
}, getLayerNames() {
  return [...this._layerNames];
}, setLayerNames(e) {
  this._layerNames.add(e);
}, getLoadedStyleNames() {
  return this._loadedStyleNames;
}, isStyleNameLoaded(e) {
  return this._loadedStyleNames.has(e);
}, setLoadedStyleName(e) {
  this._loadedStyleNames.add(e);
}, deleteLoadedStyleName(e) {
  this._loadedStyleNames.delete(e);
}, clearLoadedStyleNames() {
  this._loadedStyleNames.clear();
}, getTokenValue(e) {
  return b2.getTokenValue(this.tokens, e, this.defaults);
}, getCommon(e = "", t) {
  return b2.getCommon({ name: e, theme: this.theme, params: t, defaults: this.defaults, set: { layerNames: this.setLayerNames.bind(this) } });
}, getComponent(e = "", t) {
  let r = { name: e, theme: this.theme, params: t, defaults: this.defaults, set: { layerNames: this.setLayerNames.bind(this) } };
  return b2.getPresetC(r);
}, getDirective(e = "", t) {
  let r = { name: e, theme: this.theme, params: t, defaults: this.defaults, set: { layerNames: this.setLayerNames.bind(this) } };
  return b2.getPresetD(r);
}, getCustomPreset(e = "", t, r, s3) {
  let i2 = { name: e, preset: t, options: this.options, selector: r, params: s3, defaults: this.defaults, set: { layerNames: this.setLayerNames.bind(this) } };
  return b2.getPreset(i2);
}, getLayerOrderCSS(e = "") {
  return b2.getLayerOrder(e, this.options, { names: this.getLayerNames() }, this.defaults);
}, transformCSS(e = "", t, r = "style", s3) {
  return b2.transformCSS(e, t, s3, r, this.options, { layerNames: this.setLayerNames.bind(this) }, this.defaults);
}, getCommonStyleSheet(e = "", t, r = {}) {
  return b2.getCommonStyleSheet({ name: e, theme: this.theme, params: t, props: r, defaults: this.defaults, set: { layerNames: this.setLayerNames.bind(this) } });
}, getStyleSheet(e, t, r = {}) {
  return b2.getStyleSheet({ name: e, theme: this.theme, params: t, props: r, defaults: this.defaults, set: { layerNames: this.setLayerNames.bind(this) } });
}, onStyleMounted(e) {
  this._loadingStyles.add(e);
}, onStyleUpdated(e) {
  this._loadingStyles.add(e);
}, onStyleLoaded(e, { name: t }) {
  this._loadingStyles.size && (this._loadingStyles.delete(t), N.emit(`theme:${t}:load`, e), !this._loadingStyles.size && N.emit("theme:load"));
} };

// node_modules/@primeuix/styles/dist/base/index.mjs
var style = "\n    *,\n    ::before,\n    ::after {\n        box-sizing: border-box;\n    }\n\n    /* Non vue overlay animations */\n    .p-connected-overlay {\n        opacity: 0;\n        transform: scaleY(0.8);\n        transition:\n            transform 0.12s cubic-bezier(0, 0, 0.2, 1),\n            opacity 0.12s cubic-bezier(0, 0, 0.2, 1);\n    }\n\n    .p-connected-overlay-visible {\n        opacity: 1;\n        transform: scaleY(1);\n    }\n\n    .p-connected-overlay-hidden {\n        opacity: 0;\n        transform: scaleY(1);\n        transition: opacity 0.1s linear;\n    }\n\n    /* Vue based overlay animations */\n    .p-connected-overlay-enter-from {\n        opacity: 0;\n        transform: scaleY(0.8);\n    }\n\n    .p-connected-overlay-leave-to {\n        opacity: 0;\n    }\n\n    .p-connected-overlay-enter-active {\n        transition:\n            transform 0.12s cubic-bezier(0, 0, 0.2, 1),\n            opacity 0.12s cubic-bezier(0, 0, 0.2, 1);\n    }\n\n    .p-connected-overlay-leave-active {\n        transition: opacity 0.1s linear;\n    }\n\n    /* Toggleable Content */\n    .p-toggleable-content-enter-from,\n    .p-toggleable-content-leave-to {\n        max-height: 0;\n    }\n\n    .p-toggleable-content-enter-to,\n    .p-toggleable-content-leave-from {\n        max-height: 1000px;\n    }\n\n    .p-toggleable-content-leave-active {\n        overflow: hidden;\n        transition: max-height 0.45s cubic-bezier(0, 1, 0, 1);\n    }\n\n    .p-toggleable-content-enter-active {\n        overflow: hidden;\n        transition: max-height 1s ease-in-out;\n    }\n\n    .p-disabled,\n    .p-disabled * {\n        cursor: default;\n        pointer-events: none;\n        user-select: none;\n    }\n\n    .p-disabled,\n    .p-component:disabled {\n        opacity: dt('disabled.opacity');\n    }\n\n    .pi {\n        font-size: dt('icon.size');\n    }\n\n    .p-icon {\n        width: dt('icon.size');\n        height: dt('icon.size');\n    }\n\n    .p-overlay-mask {\n        background: dt('mask.background');\n        color: dt('mask.color');\n        position: fixed;\n        top: 0;\n        left: 0;\n        width: 100%;\n        height: 100%;\n    }\n\n    .p-overlay-mask-enter {\n        animation: p-overlay-mask-enter-animation dt('mask.transition.duration') forwards;\n    }\n\n    .p-overlay-mask-leave {\n        animation: p-overlay-mask-leave-animation dt('mask.transition.duration') forwards;\n    }\n\n    @keyframes p-overlay-mask-enter-animation {\n        from {\n            background: transparent;\n        }\n        to {\n            background: dt('mask.background');\n        }\n    }\n    @keyframes p-overlay-mask-leave-animation {\n        from {\n            background: dt('mask.background');\n        }\n        to {\n            background: transparent;\n        }\n    }\n";

// node_modules/primeng/fesm2022/primeng-usestyle.mjs
var _id = 0;
var UseStyle = class _UseStyle {
  document = inject(DOCUMENT);
  use(css2, options = {}) {
    let isLoaded = false;
    let cssRef = css2;
    let styleRef = null;
    const {
      immediate = true,
      manual = false,
      name = `style_${++_id}`,
      id = void 0,
      media = void 0,
      nonce = void 0,
      first = false,
      props = {}
    } = options;
    if (!this.document) return;
    styleRef = this.document.querySelector(`style[data-primeng-style-id="${name}"]`) || id && this.document.getElementById(id) || this.document.createElement("style");
    if (styleRef) {
      if (!styleRef.isConnected) {
        cssRef = css2;
        const HEAD = this.document.head;
        _t(styleRef, "nonce", nonce);
        first && HEAD.firstChild ? HEAD.insertBefore(styleRef, HEAD.firstChild) : HEAD.appendChild(styleRef);
        A(styleRef, {
          type: "text/css",
          media,
          nonce,
          "data-primeng-style-id": name
        });
      }
      if (styleRef.textContent !== cssRef) {
        styleRef.textContent = cssRef;
      }
    }
    return {
      id,
      name,
      el: styleRef,
      css: cssRef
    };
  }
  static ɵfac = function UseStyle_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _UseStyle)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _UseStyle,
    factory: _UseStyle.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(UseStyle, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();

// node_modules/primeng/fesm2022/primeng-base.mjs
var css = (
  /*css*/
  `
.p-hidden-accessible {
    border: 0;
    clip: rect(0 0 0 0);
    height: 1px;
    margin: -1px;
    overflow: hidden;
    padding: 0;
    position: absolute;
    width: 1px;
}

.p-hidden-accessible input,
.p-hidden-accessible select {
    transform: scale(0);
}

.p-overflow-hidden {
    overflow: hidden;
    padding-right: dt('scrollbar.width');
}
`
);
var BaseStyle = class _BaseStyle {
  name = "base";
  useStyle = inject(UseStyle);
  css = void 0;
  style = void 0;
  classes = {};
  inlineStyles = {};
  load = (style2, options = {}, transform = (cs) => cs) => {
    const computedStyle = transform(ar`${m(style2, {
      dt: E
    })}`);
    return computedStyle ? this.useStyle.use(Y(computedStyle), __spreadValues({
      name: this.name
    }, options)) : {};
  };
  loadCSS = (options = {}) => {
    return this.load(this.css, options);
  };
  loadStyle = (options = {}, style2 = "") => {
    return this.load(this.style, options, (computedStyle = "") => S.transformCSS(options.name || this.name, `${computedStyle}${ar`${style2}`}`));
  };
  loadBaseCSS = (options = {}) => {
    return this.load(css, options);
  };
  loadBaseStyle = (options = {}, style$1 = "") => {
    return this.load(style, options, (computedStyle = "") => S.transformCSS(options.name || this.name, `${computedStyle}${ar`${style$1}`}`));
  };
  getCommonTheme = (params) => {
    return S.getCommon(this.name, params);
  };
  getComponentTheme = (params) => {
    return S.getComponent(this.name, params);
  };
  getPresetTheme = (preset, selector, params) => {
    return S.getCustomPreset(this.name, preset, selector, params);
  };
  getLayerOrderThemeCSS = () => {
    return S.getLayerOrderCSS(this.name);
  };
  getStyleSheet = (extendedCSS = "", props = {}) => {
    if (this.css) {
      const _css = m(this.css, {
        dt: E
      });
      const _style = Y(ar`${_css}${extendedCSS}`);
      const _props = Object.entries(props).reduce((acc, [k3, v2]) => acc.push(`${k3}="${v2}"`) && acc, []).join(" ");
      return `<style type="text/css" data-primeng-style-id="${this.name}" ${_props}>${_style}</style>`;
    }
    return "";
  };
  getCommonThemeStyleSheet = (params, props = {}) => {
    return S.getCommonStyleSheet(this.name, params, props);
  };
  getThemeStyleSheet = (params, props = {}) => {
    let css2 = [S.getStyleSheet(this.name, params, props)];
    if (this.style) {
      const name = this.name === "base" ? "global-style" : `${this.name}-style`;
      const _css = ar`${m(this.style, {
        dt: E
      })}`;
      const _style = Y(S.transformCSS(name, _css));
      const _props = Object.entries(props).reduce((acc, [k3, v2]) => acc.push(`${k3}="${v2}"`) && acc, []).join(" ");
      css2.push(`<style type="text/css" data-primeng-style-id="${name}" ${_props}>${_style}</style>`);
    }
    return css2.join("");
  };
  static ɵfac = function BaseStyle_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _BaseStyle)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _BaseStyle,
    factory: _BaseStyle.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(BaseStyle, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();

// node_modules/primeng/fesm2022/primeng-config.mjs
var ThemeProvider = class _ThemeProvider {
  // @todo define type for theme
  theme = signal(void 0, ...ngDevMode ? [{
    debugName: "theme"
  }] : []);
  csp = signal({
    nonce: void 0
  }, ...ngDevMode ? [{
    debugName: "csp"
  }] : []);
  isThemeChanged = false;
  document = inject(DOCUMENT);
  baseStyle = inject(BaseStyle);
  constructor() {
    effect(() => {
      N.on("theme:change", (newTheme) => {
        untracked(() => {
          this.isThemeChanged = true;
          this.theme.set(newTheme);
        });
      });
    });
    effect(() => {
      const themeValue = this.theme();
      if (this.document && themeValue) {
        if (!this.isThemeChanged) {
          this.onThemeChange(themeValue);
        }
        this.isThemeChanged = false;
      }
    });
  }
  ngOnDestroy() {
    S.clearLoadedStyleNames();
    N.clear();
  }
  onThemeChange(value) {
    S.setTheme(value);
    if (this.document) {
      this.loadCommonTheme();
    }
  }
  loadCommonTheme() {
    if (this.theme() === "none") return;
    if (!S.isStyleNameLoaded("common")) {
      const {
        primitive,
        semantic,
        global,
        style: style2
      } = this.baseStyle.getCommonTheme?.() || {};
      const styleOptions = {
        nonce: this.csp?.()?.nonce
      };
      this.baseStyle.load(primitive?.css, __spreadValues({
        name: "primitive-variables"
      }, styleOptions));
      this.baseStyle.load(semantic?.css, __spreadValues({
        name: "semantic-variables"
      }, styleOptions));
      this.baseStyle.load(global?.css, __spreadValues({
        name: "global-variables"
      }, styleOptions));
      this.baseStyle.loadBaseStyle(__spreadValues({
        name: "global-style"
      }, styleOptions), style2);
      S.setLoadedStyleName("common");
    }
  }
  setThemeConfig(config) {
    const {
      theme,
      csp
    } = config || {};
    if (theme) this.theme.set(theme);
    if (csp) this.csp.set(csp);
  }
  static ɵfac = function ThemeProvider_Factory(__ngFactoryType__) {
    return new (__ngFactoryType__ || _ThemeProvider)();
  };
  static ɵprov = ɵɵdefineInjectable({
    token: _ThemeProvider,
    factory: _ThemeProvider.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(ThemeProvider, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], () => [], null);
})();
var PrimeNG = class _PrimeNG extends ThemeProvider {
  ripple = signal(false, ...ngDevMode ? [{
    debugName: "ripple"
  }] : []);
  platformId = inject(PLATFORM_ID);
  /**
   * @deprecated Since v20. Use `inputVariant` instead.
   */
  inputStyle = signal(null, ...ngDevMode ? [{
    debugName: "inputStyle"
  }] : []);
  inputVariant = signal(null, ...ngDevMode ? [{
    debugName: "inputVariant"
  }] : []);
  overlayAppendTo = signal("self", ...ngDevMode ? [{
    debugName: "overlayAppendTo"
  }] : []);
  overlayOptions = {};
  csp = signal({
    nonce: void 0
  }, ...ngDevMode ? [{
    debugName: "csp"
  }] : []);
  /**
   * Indicates whether the component should be rendered without styles.
   *
   * @experimental
   * This property is not yet implemented. It will be available in a future release.
   */
  unstyled = signal(void 0, ...ngDevMode ? [{
    debugName: "unstyled"
  }] : []);
  pt = signal(void 0, ...ngDevMode ? [{
    debugName: "pt"
  }] : []);
  ptOptions = signal(void 0, ...ngDevMode ? [{
    debugName: "ptOptions"
  }] : []);
  filterMatchModeOptions = {
    text: [FilterMatchMode.STARTS_WITH, FilterMatchMode.CONTAINS, FilterMatchMode.NOT_CONTAINS, FilterMatchMode.ENDS_WITH, FilterMatchMode.EQUALS, FilterMatchMode.NOT_EQUALS],
    numeric: [FilterMatchMode.EQUALS, FilterMatchMode.NOT_EQUALS, FilterMatchMode.LESS_THAN, FilterMatchMode.LESS_THAN_OR_EQUAL_TO, FilterMatchMode.GREATER_THAN, FilterMatchMode.GREATER_THAN_OR_EQUAL_TO],
    date: [FilterMatchMode.DATE_IS, FilterMatchMode.DATE_IS_NOT, FilterMatchMode.DATE_BEFORE, FilterMatchMode.DATE_AFTER]
  };
  translation = {
    startsWith: "Starts with",
    contains: "Contains",
    notContains: "Not contains",
    endsWith: "Ends with",
    equals: "Equals",
    notEquals: "Not equals",
    noFilter: "No Filter",
    lt: "Less than",
    lte: "Less than or equal to",
    gt: "Greater than",
    gte: "Greater than or equal to",
    is: "Is",
    isNot: "Is not",
    before: "Before",
    after: "After",
    dateIs: "Date is",
    dateIsNot: "Date is not",
    dateBefore: "Date is before",
    dateAfter: "Date is after",
    clear: "Clear",
    apply: "Apply",
    matchAll: "Match All",
    matchAny: "Match Any",
    addRule: "Add Rule",
    removeRule: "Remove Rule",
    accept: "Yes",
    reject: "No",
    choose: "Choose",
    completed: "Completed",
    upload: "Upload",
    cancel: "Cancel",
    pending: "Pending",
    fileSizeTypes: ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"],
    dayNames: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    dayNamesShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    dayNamesMin: ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"],
    monthNames: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    monthNamesShort: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    chooseYear: "Choose Year",
    chooseMonth: "Choose Month",
    chooseDate: "Choose Date",
    prevDecade: "Previous Decade",
    nextDecade: "Next Decade",
    prevYear: "Previous Year",
    nextYear: "Next Year",
    prevMonth: "Previous Month",
    nextMonth: "Next Month",
    prevHour: "Previous Hour",
    nextHour: "Next Hour",
    prevMinute: "Previous Minute",
    nextMinute: "Next Minute",
    prevSecond: "Previous Second",
    nextSecond: "Next Second",
    am: "am",
    pm: "pm",
    dateFormat: "mm/dd/yy",
    firstDayOfWeek: 0,
    today: "Today",
    weekHeader: "Wk",
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
    passwordPrompt: "Enter a password",
    emptyMessage: "No results found",
    searchMessage: "Search results are available",
    selectionMessage: "{0} items selected",
    emptySelectionMessage: "No selected item",
    emptySearchMessage: "No results found",
    emptyFilterMessage: "No results found",
    fileChosenMessage: "Files",
    noFileChosenMessage: "No file chosen",
    aria: {
      trueLabel: "True",
      falseLabel: "False",
      nullLabel: "Not Selected",
      star: "1 star",
      stars: "{star} stars",
      selectAll: "All items selected",
      unselectAll: "All items unselected",
      close: "Close",
      previous: "Previous",
      next: "Next",
      navigation: "Navigation",
      scrollTop: "Scroll Top",
      moveTop: "Move Top",
      moveUp: "Move Up",
      moveDown: "Move Down",
      moveBottom: "Move Bottom",
      moveToTarget: "Move to Target",
      moveToSource: "Move to Source",
      moveAllToTarget: "Move All to Target",
      moveAllToSource: "Move All to Source",
      pageLabel: "{page}",
      firstPageLabel: "First Page",
      lastPageLabel: "Last Page",
      nextPageLabel: "Next Page",
      prevPageLabel: "Previous Page",
      rowsPerPageLabel: "Rows per page",
      previousPageLabel: "Previous Page",
      jumpToPageDropdownLabel: "Jump to Page Dropdown",
      jumpToPageInputLabel: "Jump to Page Input",
      selectRow: "Row Selected",
      unselectRow: "Row Unselected",
      expandRow: "Row Expanded",
      collapseRow: "Row Collapsed",
      showFilterMenu: "Show Filter Menu",
      hideFilterMenu: "Hide Filter Menu",
      filterOperator: "Filter Operator",
      filterConstraint: "Filter Constraint",
      editRow: "Row Edit",
      saveEdit: "Save Edit",
      cancelEdit: "Cancel Edit",
      listView: "List View",
      gridView: "Grid View",
      slide: "Slide",
      slideNumber: "{slideNumber}",
      zoomImage: "Zoom Image",
      zoomIn: "Zoom In",
      zoomOut: "Zoom Out",
      rotateRight: "Rotate Right",
      rotateLeft: "Rotate Left",
      listLabel: "Option List",
      selectColor: "Select a color",
      removeLabel: "Remove",
      browseFiles: "Browse Files",
      maximizeLabel: "Maximize",
      minimizeLabel: "Minimize"
    }
  };
  zIndex = {
    modal: 1100,
    overlay: 1e3,
    menu: 1e3,
    tooltip: 1100
  };
  translationSource = new Subject();
  translationObserver = this.translationSource.asObservable();
  getTranslation(key) {
    return this.translation[key];
  }
  setTranslation(value) {
    this.translation = __spreadValues(__spreadValues({}, this.translation), value);
    this.translationSource.next(this.translation);
  }
  setConfig(config) {
    const {
      csp,
      ripple,
      inputStyle,
      inputVariant,
      theme,
      overlayOptions,
      translation,
      filterMatchModeOptions,
      overlayAppendTo,
      zIndex,
      ptOptions,
      pt,
      unstyled
    } = config || {};
    if (csp) this.csp.set(csp);
    if (overlayAppendTo) this.overlayAppendTo.set(overlayAppendTo);
    if (ripple) this.ripple.set(ripple);
    if (inputStyle) this.inputStyle.set(inputStyle);
    if (inputVariant) this.inputVariant.set(inputVariant);
    if (overlayOptions) this.overlayOptions = overlayOptions;
    if (translation) this.setTranslation(translation);
    if (filterMatchModeOptions) this.filterMatchModeOptions = filterMatchModeOptions;
    if (zIndex) this.zIndex = zIndex;
    if (pt) this.pt.set(pt);
    if (ptOptions) this.ptOptions.set(ptOptions);
    if (unstyled) this.unstyled.set(unstyled);
    if (theme) this.setThemeConfig({
      theme,
      csp
    });
  }
  static ɵfac = /* @__PURE__ */ (() => {
    let ɵPrimeNG_BaseFactory;
    return function PrimeNG_Factory(__ngFactoryType__) {
      return (ɵPrimeNG_BaseFactory || (ɵPrimeNG_BaseFactory = ɵɵgetInheritedFactory(_PrimeNG)))(__ngFactoryType__ || _PrimeNG);
    };
  })();
  static ɵprov = ɵɵdefineInjectable({
    token: _PrimeNG,
    factory: _PrimeNG.ɵfac,
    providedIn: "root"
  });
};
(() => {
  (typeof ngDevMode === "undefined" || ngDevMode) && setClassMetadata(PrimeNG, [{
    type: Injectable,
    args: [{
      providedIn: "root"
    }]
  }], null, null);
})();
var PRIME_NG_CONFIG = new InjectionToken("PRIME_NG_CONFIG");
function providePrimeNG(...features) {
  const providers = features?.map((feature) => ({
    provide: PRIME_NG_CONFIG,
    useValue: feature,
    multi: false
  }));
  const initializer = provideAppInitializer(() => {
    const PrimeNGConfig = inject(PrimeNG);
    features?.forEach((feature) => PrimeNGConfig.setConfig(feature));
    return;
  });
  return makeEnvironmentProviders([...providers, initializer]);
}
export {
  PRIME_NG_CONFIG,
  PrimeNG,
  ThemeProvider,
  providePrimeNG
};
//# sourceMappingURL=primeng_config.js.map
