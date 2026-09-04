/**
 * Comprehensive Chrome MV3 & Browser DOM Mock Environment for Shorts Shield.
 * Provides global mocks for chrome extension APIs, DOM elements, and browser globals.
 */

class MockStorageArea {
  constructor(areaName = 'local', onChangeCallback = null) {
    this.name = areaName;
    this.store = new Map();
    this.onChangeCallback = onChangeCallback;
  }

  get(keys, callback) {
    let result = {};
    if (keys === null || keys === undefined) {
      for (const [k, v] of this.store.entries()) {
        result[k] = JSON.parse(JSON.stringify(v));
      }
    } else if (typeof keys === 'string') {
      if (this.store.has(keys)) {
        result[keys] = JSON.parse(JSON.stringify(this.store.get(keys)));
      }
    } else if (Array.isArray(keys)) {
      for (const k of keys) {
        if (this.store.has(k)) {
          result[k] = JSON.parse(JSON.stringify(this.store.get(k)));
        }
      }
    } else if (typeof keys === 'object') {
      for (const k of Object.keys(keys)) {
        if (this.store.has(k)) {
          result[k] = JSON.parse(JSON.stringify(this.store.get(k)));
        } else {
          result[k] = keys[k];
        }
      }
    }

    if (typeof callback === 'function') {
      callback(result);
    }
    return Promise.resolve(result);
  }

  set(items, callback) {
    if (items && typeof items === 'object') {
      const changes = {};
      for (const [k, v] of Object.entries(items)) {
        const oldValue = this.store.has(k) ? JSON.parse(JSON.stringify(this.store.get(k))) : undefined;
        const newValue = JSON.parse(JSON.stringify(v));
        this.store.set(k, newValue);
        changes[k] = { oldValue, newValue };
      }
      if (this.onChangeCallback && Object.keys(changes).length > 0) {
        this.onChangeCallback(changes, this.name);
      }
    }
    if (typeof callback === 'function') {
      callback();
    }
    return Promise.resolve();
  }

  remove(keys, callback) {
    const keyList = Array.isArray(keys) ? keys : [keys];
    const changes = {};
    for (const k of keyList) {
      if (this.store.has(k)) {
        const oldValue = JSON.parse(JSON.stringify(this.store.get(k)));
        this.store.delete(k);
        changes[k] = { oldValue, newValue: undefined };
      }
    }
    if (this.onChangeCallback && Object.keys(changes).length > 0) {
      this.onChangeCallback(changes, this.name);
    }
    if (typeof callback === 'function') {
      callback();
    }
    return Promise.resolve();
  }

  clear(callback) {
    const changes = {};
    for (const [k, v] of this.store.entries()) {
      changes[k] = { oldValue: JSON.parse(JSON.stringify(v)), newValue: undefined };
    }
    this.store.clear();
    if (this.onChangeCallback && Object.keys(changes).length > 0) {
      this.onChangeCallback(changes, this.name);
    }
    if (typeof callback === 'function') {
      callback();
    }
    return Promise.resolve();
  }
}

class MockClassList {
  constructor(element) {
    this.element = element;
    this._classes = new Set();
  }

  add(...classNames) {
    classNames.forEach(c => this._classes.add(c));
    this.element.className = Array.from(this._classes).join(' ');
  }

  remove(...classNames) {
    classNames.forEach(c => this._classes.delete(c));
    this.element.className = Array.from(this._classes).join(' ');
  }

  contains(className) {
    return this._classes.has(className);
  }

  toggle(className, force) {
    if (force === true) {
      this.add(className);
      return true;
    } else if (force === false) {
      this.remove(className);
      return false;
    }
    if (this.contains(className)) {
      this.remove(className);
      return false;
    } else {
      this.add(className);
      return true;
    }
  }

  _syncFromClassName(className) {
    this._classes.clear();
    if (className) {
      className.split(/\s+/).filter(Boolean).forEach(c => this._classes.add(c));
    }
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.id = '';
    this._className = '';
    this.classList = new MockClassList(this);
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.parentElement = null;
    this.style = {
      setProperty: (prop, val) => { this.style[prop] = val; },
      removeProperty: (prop) => { delete this.style[prop]; }
    };
    this.attributes = {};
    this._textContent = '';
    this.innerHTML = '';
    this.outerHTML = '';
    this.value = '';
    this.checked = false;
    this.paused = true;
    this.dataset = {};
    this.eventListeners = new Map();
  }

  play() {
    this.paused = false;
    this.dispatchEvent('play');
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
    this.dispatchEvent('pause');
  }

  click() {
    this.dispatchEvent('click');
  }

  get textContent() {
    if (this._textContent) return this._textContent;
    if (this._innerHTML) return this._innerHTML.replace(/<[^>]*>/g, ' ');
    let text = '';
    for (const child of this.children) {
      text += ' ' + (child.textContent || '');
    }
    return text.trim();
  }

  set textContent(val) {
    this._textContent = val;
  }

  get innerHTML() {
    return this._innerHTML || '';
  }

  set innerHTML(val) {
    this._innerHTML = val || '';
    this.children = [];
    if (!val || typeof val !== 'string') return;

    const VOID_TAGS = new Set([
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
    ]);

    const cleanHtml = val.replace(/<!--[\s\S]*?-->/g, '');
    const tagRegex = /<(\/)?([a-z0-9-]+)([^>]*)>/gi;
    const stack = [this];
    let lastIndex = 0;
    let match;

    while ((match = tagRegex.exec(cleanHtml)) !== null) {
      const textBetween = cleanHtml.slice(lastIndex, match.index).trim();
      if (textBetween && stack.length > 0) {
        const top = stack[stack.length - 1];
        if (top !== this) {
          top.textContent = (top.textContent ? top.textContent + ' ' : '') + textBetween;
        }
      }
      lastIndex = tagRegex.lastIndex;

      const isClosing = Boolean(match[1]);
      const tagName = match[2].toLowerCase();
      const attrsStr = match[3] || '';
      const isSelfClosing = attrsStr.trim().endsWith('/') || VOID_TAGS.has(tagName);

      if (isClosing) {
        for (let i = stack.length - 1; i > 0; i--) {
          if (stack[i].tagName.toLowerCase() === tagName) {
            stack.length = i;
            break;
          }
        }
      } else {
        const child = new MockElement(tagName);
        const attrRegex = /([a-z0-9_:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/gi;
        let attrMatch;
        while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
          const attrName = attrMatch[1];
          if (attrName === '/' || attrName === '') continue;
          const attrVal = attrMatch[2] !== undefined ? attrMatch[2] : (attrMatch[3] !== undefined ? attrMatch[3] : (attrMatch[4] !== undefined ? attrMatch[4] : ''));
          child.setAttribute(attrName, attrVal);
          if (attrName.toLowerCase() === 'checked') child.checked = true;
          if (attrName.toLowerCase() === 'value') child.value = attrVal;
        }

        const parent = stack[stack.length - 1];
        if (parent) {
          parent.appendChild(child);
        }

        if (!isSelfClosing) {
          stack.push(child);
        }
      }
    }
  }

  get className() {
    return this._className;
  }

  set className(val) {
    this._className = val || '';
    this.classList._syncFromClassName(this._className);
  }

  setAttribute(name, value) {
    const valStr = String(value);
    this.attributes[name] = valStr;
    if (name === 'id') this.id = valStr;
    if (name === 'class') this.className = valStr;
    if (name === 'style') {
      const declarations = valStr.split(';').map(s => s.trim()).filter(Boolean);
      for (const decl of declarations) {
        const colonIdx = decl.indexOf(':');
        if (colonIdx !== -1) {
          const prop = decl.slice(0, colonIdx).trim().replace(/-([a-z])/g, (_, l) => l.toUpperCase());
          const val = decl.slice(colonIdx + 1).trim();
          this.style[prop] = val;
        }
      }
    }
    if (name.startsWith('data-')) {
      const camelKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      this.dataset[camelKey] = valStr;
    }
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name) ? this.attributes[name] : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === 'id') this.id = '';
    if (name === 'class') this.className = '';
    if (name.startsWith('data-')) {
      const camelKey = name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      delete this.dataset[camelKey];
    }
  }

  hasAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name);
  }

  appendChild(child) {
    if (!child) return child;
    child.parentNode = this;
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  prepend(...children) {
    for (let i = children.length - 1; i >= 0; i--) {
      const child = children[i];
      if (!child) continue;
      child.parentNode = this;
      child.parentElement = this;
      this.children.unshift(child);
    }
  }

  removeChild(child) {
    const idx = this.children.indexOf(child);
    if (idx !== -1) {
      child.parentNode = null;
      child.parentElement = null;
      this.children.splice(idx, 1);
    }
    return child;
  }

  insertBefore(newChild, refChild) {
    const idx = this.children.indexOf(refChild);
    if (idx !== -1) {
      newChild.parentNode = this;
      newChild.parentElement = this;
      this.children.splice(idx, 0, newChild);
    } else {
      this.appendChild(newChild);
    }
    return newChild;
  }

  replaceChild(newChild, oldChild) {
    const idx = this.children.indexOf(oldChild);
    if (idx !== -1) {
      oldChild.parentNode = null;
      oldChild.parentElement = null;
      newChild.parentNode = this;
      newChild.parentElement = this;
      this.children[idx] = newChild;
    }
    return oldChild;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  after(...nodes) {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        node.parentNode = this.parentNode;
        node.parentElement = this.parentNode;
        this.parentNode.children.splice(idx + 1 + i, 0, node);
      }
    }
  }

  before(...nodes) {
    if (!this.parentNode) return;
    const idx = this.parentNode.children.indexOf(this);
    if (idx !== -1) {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (!node) continue;
        node.parentNode = this.parentNode;
        node.parentElement = this.parentNode;
        this.parentNode.children.splice(idx + i, 0, node);
      }
    }
  }

  get nextSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.children.indexOf(this);
    return (idx !== -1 && idx + 1 < this.parentNode.children.length) ? this.parentNode.children[idx + 1] : null;
  }

  get previousSibling() {
    if (!this.parentNode) return null;
    const idx = this.parentNode.children.indexOf(this);
    return (idx > 0) ? this.parentNode.children[idx - 1] : null;
  }

  addEventListener(event, handler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event).push(handler);
  }

  removeEventListener(event, handler) {
    if (this.eventListeners.has(event)) {
      const list = this.eventListeners.get(event);
      const idx = list.indexOf(handler);
      if (idx !== -1) list.splice(idx, 1);
    }
  }

  dispatchEvent(event) {
    const evtType = typeof event === 'string' ? event : event.type;
    const evtObj = typeof event === 'string'
      ? { type: event, target: this, preventDefault: () => {}, stopPropagation: () => {}, stopImmediatePropagation: () => {} }
      : { target: this, preventDefault: () => {}, stopPropagation: () => {}, stopImmediatePropagation: () => {}, ...event };
    if (this.eventListeners.has(evtType)) {
      this.eventListeners.get(evtType).forEach(fn => fn(evtObj));
    }
    return true;
  }

  focus() {
    this.dispatchEvent('focus');
  }

  blur() {
    this.dispatchEvent('blur');
  }

  select() {
    this.dispatchEvent('select');
  }

  querySelector(selector) {
    const results = this.querySelectorAll(selector);
    return results.length > 0 ? results[0] : null;
  }

  querySelectorAll(selector) {
    const matches = [];
    const walk = (node) => {
      for (const child of node.children) {
        if (matchesSelector(child, selector)) {
          matches.push(child);
        }
        walk(child);
      }
    };
    walk(this);
    return matches;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (matchesSelector(curr, selector)) return curr;
      curr = curr.parentElement;
    }
    return null;
  }

  contains(node) {
    if (!node) return false;
    let curr = node;
    while (curr) {
      if (curr === this) return true;
      curr = curr.parentNode || curr.parentElement;
    }
    return false;
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  get childElementCount() {
    return this.children.length;
  }

  getBoundingClientRect() {
    if (this._rect) return this._rect;
    return { top: 100, left: 200, bottom: 136, right: 290, width: 90, height: 36, x: 200, y: 100 };
  }
}

function matchesSelector(element, selector) {
  if (!selector || typeof selector !== 'string') return false;
  const sel = selector.trim();
  if (sel.includes(',')) {
    return sel.split(',').some(s => matchesSelector(element, s.trim()));
  }
  const selWithoutAttrs = sel.replace(/\[[^\]]+\]/g, '');
  if (selWithoutAttrs.includes(' ')) {
    const parts = sel.split(/\s+(?=(?:[^\[\]]*\[[^\[\]]*\])*[^\[\]]*$)/);
    const lastToken = parts.pop();
    if (!matchesSelector(element, lastToken)) return false;
    let curr = element.parentElement;
    for (let i = parts.length - 1; i >= 0; i--) {
      const ancestorToken = parts[i];
      let found = false;
      while (curr) {
        if (matchesSelector(curr, ancestorToken)) {
          found = true;
          curr = curr.parentElement;
          break;
        }
        curr = curr.parentElement;
      }
      if (!found) return false;
    }
    return true;
  }
  if (sel.startsWith('#')) {
    return element.id === sel.slice(1);
  }
  if (sel.includes('#')) {
    const [tag, id] = sel.split('#');
    return (tag === '' || element.tagName === tag.toUpperCase()) && element.id === id;
  }
  if (sel.startsWith('.')) {
    return element.classList.contains(sel.slice(1));
  }
  if (sel.startsWith('[') && sel.endsWith(']')) {
    const attrExpr = sel.slice(1, -1);
    if (attrExpr.includes('*=')) {
      const [attrName, attrVal] = attrExpr.split('*=').map(s => s.trim().replace(/^["']|["']$/g, ''));
      const actual = element.getAttribute(attrName);
      return actual ? actual.includes(attrVal) : false;
    }
    if (attrExpr.includes('=')) {
      const [attrName, attrVal] = attrExpr.split('=').map(s => s.trim().replace(/^["']|["']$/g, ''));
      return element.getAttribute(attrName) === attrVal;
    }
    return element.hasAttribute(attrExpr);
  }
  if (sel.includes('[')) {
    const tag = sel.slice(0, sel.indexOf('[')).trim();
    const attrPart = sel.slice(sel.indexOf('[')).trim();
    return (tag === '' || element.tagName === tag.toUpperCase()) && matchesSelector(element, attrPart);
  }
  if (sel.includes('.')) {
    const [tag, className] = sel.split('.');
    return (tag === '' || element.tagName === tag.toUpperCase()) && element.classList.contains(className);
  }
  return element.tagName === sel.toUpperCase();
}

class MockLocalStorage {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
  }

  setItem(key, val) {
    this.store.set(String(key), String(val));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }

  clear() {
    this.store.clear();
  }

  key(index) {
    const keys = Array.from(this.store.keys());
    return keys[index] !== undefined ? keys[index] : null;
  }

  get length() {
    return this.store.size;
  }
}

class MockMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.observing = false;
    this.target = null;
  }

  observe(target, options) {
    this.observing = true;
    this.target = target;
    this.options = options;
  }

  disconnect() {
    this.observing = false;
    this.target = null;
  }

  takeRecords() {
    return [];
  }

  triggerMutation(mutations = []) {
    if (this.observing && typeof this.callback === 'function') {
      this.callback(mutations, this);
    }
  }
}

class MockDOMParser {
  parseFromString(str, type) {
    const doc = createMockDocument();
    doc.body.innerHTML = str;
    return doc;
  }
}

function createMockDocument() {
  const body = new MockElement('body');
  const head = new MockElement('head');
  const html = new MockElement('html');
  html.appendChild(head);
  html.appendChild(body);

  const listeners = new Map();

  const doc = {
    body,
    head,
    documentElement: html,
    createElement: (tag) => new MockElement(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: text }),
    getElementById: (id) => {
      if (body.id === id) return body;
      const walk = (node) => {
        for (const child of node.children) {
          if (child.id === id) return child;
          const found = walk(child);
          if (found) return found;
        }
        return null;
      };
      return walk(body) || walk(head);
    },
    contains: (node) => {
      if (!node) return false;
      return html.contains(node) || body.contains(node);
    },
    querySelector: (selector) => {
      if (matchesSelector(body, selector)) return body;
      return body.querySelector(selector) || head.querySelector(selector);
    },
    querySelectorAll: (selector) => {
      let results = [];
      if (matchesSelector(body, selector)) results.push(body);
      results = results.concat(body.querySelectorAll(selector));
      results = results.concat(head.querySelectorAll(selector));
      return results;
    },
    addEventListener: (event, handler) => {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(handler);
    },
    removeEventListener: (event, handler) => {
      if (listeners.has(event)) {
        const list = listeners.get(event);
        const idx = list.indexOf(handler);
        if (idx !== -1) list.splice(idx, 1);
      }
    },
    dispatchEvent: (event) => {
      const evtType = typeof event === 'string' ? event : event.type;
      const evtObj = typeof event === 'string' ? { type: event, target: doc } : { target: doc, ...event };
      if (listeners.has(evtType)) {
        listeners.get(evtType).forEach(fn => fn(evtObj));
      }
      return true;
    }
  };

  return doc;
}

function setupMockEnv() {
  const storageChangeListeners = [];
  const triggerStorageChanged = (changes, areaName) => {
    storageChangeListeners.forEach(listener => {
      try { listener(changes, areaName); } catch (e) {}
    });
  };

  const localArea = new MockStorageArea('local', triggerStorageChanged);
  const syncArea = new MockStorageArea('sync', triggerStorageChanged);
  const sessionArea = new MockStorageArea('session', triggerStorageChanged);

  const messageListeners = [];
  const tabQueryListeners = [];

  const chromeMock = {
    storage: {
      local: localArea,
      sync: syncArea,
      session: sessionArea,
      onChanged: {
        addListener: (fn) => {
          if (typeof fn === 'function' && !storageChangeListeners.includes(fn)) {
            storageChangeListeners.push(fn);
          }
        },
        removeListener: (fn) => {
          const idx = storageChangeListeners.indexOf(fn);
          if (idx !== -1) storageChangeListeners.splice(idx, 1);
        },
        hasListener: (fn) => storageChangeListeners.includes(fn)
      }
    },
    runtime: {
      id: 'mock-shorts-shield-extension-id',
      lastError: null,
      sendMessage: (message, callback) => {
        let handerResults = [];
        messageListeners.forEach(listener => {
          listener(message, { tab: { id: 1 } }, (response) => {
            if (response !== undefined) {
              handerResults.push(response);
            }
          });
        });
        const result = handerResults.find(r => r && r.success !== undefined) || handerResults[0] || { status: 'ok' };
        if (typeof callback === 'function') {
          callback(result);
        }
        return Promise.resolve(result);
      },
      onMessage: {
        addListener: (fn) => messageListeners.push(fn),
        removeListener: (fn) => {
          const idx = messageListeners.indexOf(fn);
          if (idx !== -1) messageListeners.splice(idx, 1);
        },
        hasListener: (fn) => messageListeners.includes(fn)
      },
      getURL: (path) => `chrome-extension://mock-shorts-shield-extension-id/${path}`,
      getManifest: () => ({ name: 'Shorts Shield', version: '1.0.0', manifest_version: 3 })
    },
    tabs: {
      onUpdated: {
        addListener: () => {},
        removeListener: () => {}
      },
      onRemoved: {
        addListener: () => {},
        removeListener: () => {}
      },
      query: (queryInfo, callback) => {
        const mockTabs = [{ id: 1, url: 'https://www.youtube.com/', active: true }];
        if (typeof callback === 'function') callback(mockTabs);
        return Promise.resolve(mockTabs);
      },
      sendMessage: (tabId, message, callback) => {
        if (typeof callback === 'function') callback({ status: 'received' });
        return Promise.resolve({ status: 'received' });
      },
      create: (props, callback) => {
        const tab = { id: 2, ...props };
        if (typeof callback === 'function') callback(tab);
        return Promise.resolve(tab);
      },
      remove: (tabId, callback) => {
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
      update: (tabId, props, callback) => {
        const tab = { id: tabId, ...props };
        if (typeof callback === 'function') callback(tab);
        return Promise.resolve(tab);
      },
      reload: (tabId, reloadProperties, callback) => {
        if (typeof reloadProperties === 'function') {
          callback = reloadProperties;
        }
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      }
    },
    webNavigation: {
      onBeforeNavigate: {
        addListener: () => {},
        removeListener: () => {}
      },
      onHistoryStateUpdated: {
        addListener: () => {},
        removeListener: () => {}
      }
    },
    scripting: {
      executeScript: (details, callback) => {
        if (typeof callback === 'function') callback([{ result: true }]);
        return Promise.resolve([{ result: true }]);
      },
      insertCSS: (details, callback) => {
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      },
      removeCSS: (details, callback) => {
        if (typeof callback === 'function') callback();
        return Promise.resolve();
      }
    }
  };

  const docMock = createMockDocument();
  const localStorageMock = new MockLocalStorage();
  const locationMock = {
    _href: 'https://www.youtube.com/',
    pathname: '/',
    host: 'www.youtube.com',
    hostname: 'www.youtube.com',
    protocol: 'https:',
    origin: 'https://www.youtube.com',
    search: '',
    get href() {
      return this._href;
    },
    set href(val) {
      this._href = val || 'https://www.youtube.com/';
      try {
        if (this._href.startsWith('http://') || this._href.startsWith('https://')) {
          const u = new URL(this._href);
          this.pathname = u.pathname;
          this.search = u.search;
          this.host = u.host;
          this.hostname = u.hostname;
          this.protocol = u.protocol;
          this.origin = u.origin;
        } else if (this._href.startsWith('/')) {
          const u = new URL(this._href, 'https://www.youtube.com');
          this.pathname = u.pathname;
          this.search = u.search;
        } else {
          this.pathname = '/' + this._href;
          this.search = '';
        }
      } catch (e) {}
    },
    assign: function(url) { this.href = url; },
    replace: function(url) { this.href = url; },
    reload: function() {}
  };

  const historyMock = {
    state: null,
    replaceState: function(state, title, url) { this.state = state; if (url && global.location) global.location.href = url; },
    pushState: function(state, title, url) { this.state = state; if (url && global.location) global.location.href = url; },
    back: function() {},
    forward: function() {}
  };

  global.chrome = chromeMock;
  global.document = docMock;
  global.localStorage = localStorageMock;
  global.location = locationMock;
  global.history = historyMock;
  global.DOMParser = MockDOMParser;
  global.MutationObserver = MockMutationObserver;
  global.importScripts = (...scripts) => {};
  global.window = global;

  if (typeof global.PointerEvent === 'undefined') {
    global.PointerEvent = class PointerEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.bubbles = Boolean(init.bubbles);
        this.cancelable = Boolean(init.cancelable);
        this.composed = Boolean(init.composed);
        this.view = init.view;
      }
    };
  }

  if (typeof global.MouseEvent === 'undefined') {
    global.MouseEvent = class MouseEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.bubbles = Boolean(init.bubbles);
        this.cancelable = Boolean(init.cancelable);
        this.composed = Boolean(init.composed);
        this.view = init.view;
      }
    };
  }

  if (typeof global.CustomEvent === 'undefined') {
    global.CustomEvent = class CustomEvent {
      constructor(type, init = {}) {
        this.type = type;
        this.detail = init.detail || null;
        this.bubbles = Boolean(init.bubbles);
        this.cancelable = Boolean(init.cancelable);
        this.composed = Boolean(init.composed);
      }
    };
  }
  if (typeof global.window !== 'undefined' && typeof global.window.CustomEvent === 'undefined') {
    global.window.CustomEvent = global.CustomEvent;
  }

  const windowListeners = new Map();
  global.addEventListener = (event, handler) => {
    if (!windowListeners.has(event)) windowListeners.set(event, []);
    windowListeners.get(event).push(handler);
  };
  global.removeEventListener = (event, handler) => {
    if (windowListeners.has(event)) {
      const list = windowListeners.get(event);
      const idx = list.indexOf(handler);
      if (idx !== -1) list.splice(idx, 1);
    }
  };
  global.dispatchEvent = (event) => {
    const evtType = typeof event === 'string' ? event : (event ? event.type : '');
    const evtObj = (typeof event === 'object' && event !== null) ? event : { type: event, target: global };
    if (windowListeners.has(evtType)) {
      windowListeners.get(evtType).forEach(fn => fn(evtObj));
    }
    return true;
  };
  if (typeof global.window !== 'undefined') {
    global.window.addEventListener = global.addEventListener;
    global.window.removeEventListener = global.removeEventListener;
    global.window.dispatchEvent = global.dispatchEvent;
  }

  if (typeof global.window.location === 'undefined') {
    global.window.location = locationMock;
  }
  if (typeof global.window.document === 'undefined') {
    global.window.document = docMock;
  }

  return {
    chrome: chromeMock,
    window: global.window,
    document: docMock,
    localStorage: localStorageMock,
    location: locationMock,
    localArea,
    syncArea,
    sessionArea
  };
}

module.exports = {
  setupMockEnv,
  MockStorageArea,
  MockElement,
  MockLocalStorage,
  MockMutationObserver,
  MockDOMParser,
  createMockDocument
};
