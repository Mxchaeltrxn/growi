import { Container } from 'unstated';

import axios from 'axios';
import urljoin from 'url-join';

import InterceptorManager from '@commons/service/interceptor-manager';

import emojiStrategy from '../util/emojione/emoji_strategy_shrinked.json';
import GrowiRenderer from '../util/GrowiRenderer';

import Apiv1ErrorHandler from '../util/apiv1ErrorHandler';

import {
  DetachCodeBlockInterceptor,
  RestoreCodeBlockInterceptor,
} from '../util/interceptor/detach-code-blocks';

import {
  DrawioInterceptor,
} from '../util/interceptor/drawio-interceptor';

import i18nFactory from '../util/i18n';
import apiv3ErrorHandler from '../util/apiv3ErrorHandler';

/**
 * Service container related to options for Application
 * @extends {Container} unstated Container
 */
export default class AppContainer extends Container {

  constructor() {
    super();

    const { localStorage } = window;

    this.state = {
      editorMode: null,
      isDeviceSmallerThanMd: null,
      preferDarkModeByMediaQuery: false,
      preferDarkModeByUser: localStorage.preferDarkModeByUser === 'true',
      preferDrawerModeByUser: localStorage.preferDrawerModeByUser === 'true',
      preferDrawerModeOnEditByUser: // default: true
        localStorage.preferDrawerModeOnEditByUser == null || localStorage.preferDrawerModeOnEditByUser === 'true',
      isDrawerMode: null,
      isDrawerOpened: false,

      isPageCreateModalShown: false,

      recentlyUpdatedPages: [],
    };

    const body = document.querySelector('body');

    this.isAdmin = body.dataset.isAdmin === 'true';
    this.csrfToken = body.dataset.csrftoken;
    this.isPluginEnabled = body.dataset.pluginEnabled === 'true';
    this.isLoggedin = document.querySelector('body.nologin') == null;

    this.config = JSON.parse(document.getElementById('growi-context-hydrate').textContent || '{}');

    const currentUserElem = document.getElementById('growi-current-user');
    if (currentUserElem != null) {
      this.currentUser = JSON.parse(currentUserElem.textContent);
    }

    const userAgent = window.navigator.userAgent.toLowerCase();
    this.isMobile = /iphone|ipad|android/.test(userAgent);

    this.isDocSaved = true;

    this.originRenderer = new GrowiRenderer(this);

    this.interceptorManager = new InterceptorManager();
    this.interceptorManager.addInterceptor(new DetachCodeBlockInterceptor(this), 10); // process as soon as possible
    this.interceptorManager.addInterceptor(new DrawioInterceptor(this), 20);
    this.interceptorManager.addInterceptor(new RestoreCodeBlockInterceptor(this), 900); // process as late as possible

    const userlang = body.dataset.userlang;
    this.i18n = i18nFactory(userlang);

    this.users = [];
    this.userByName = {};
    this.userById = {};
    this.recoverData();

    if (this.isLoggedin) {
      this.fetchUsers();
    }

    this.containerInstances = {};
    this.componentInstances = {};
    this.rendererInstances = {};

    this.fetchUsers = this.fetchUsers.bind(this);
    this.apiGet = this.apiGet.bind(this);
    this.apiPost = this.apiPost.bind(this);
    this.apiDelete = this.apiDelete.bind(this);
    this.apiRequest = this.apiRequest.bind(this);

    this.apiv3Root = '/_api/v3';
    this.apiv3 = {
      get: this.apiv3Get.bind(this),
      post: this.apiv3Post.bind(this),
      put: this.apiv3Put.bind(this),
      delete: this.apiv3Delete.bind(this),
    };

    this.openPageCreateModal = this.openPageCreateModal.bind(this);
    this.closePageCreateModal = this.closePageCreateModal.bind(this);
  }

  /**
   * Workaround for the mangling in production build to break constructor.name
   */
  static getClassName() {
    return 'AppContainer';
  }

  init() {
    this.initDeviceSize();
    this.initColorScheme();
    this.initPlugins();
  }

  initDeviceSize() {
    const mdOrAvobeHandler = async(mql) => {
      let isDeviceSmallerThanMd;

      // sm -> md
      if (mql.matches) {
        isDeviceSmallerThanMd = false;
      }
      // md -> sm
      else {
        isDeviceSmallerThanMd = true;
      }

      this.setState({ isDeviceSmallerThanMd });
      this.updateDrawerMode({ ...this.state, isDeviceSmallerThanMd }); // generate newest state object
    };

    this.addBreakpointListener('md', mdOrAvobeHandler, true);
  }

  async initColorScheme() {
    const switchStateByMediaQuery = async(mql) => {
      const preferDarkMode = mql.matches;
      await this.setState({ preferDarkModeByMediaQuery: preferDarkMode });

      this.applyColorScheme();
    };

    const mqlForDarkMode = window.matchMedia('(prefers-color-scheme: dark)');
    // add event listener
    mqlForDarkMode.addListener(switchStateByMediaQuery);

    // initialize: check media query
    switchStateByMediaQuery(mqlForDarkMode);
  }

  initPlugins() {
    if (this.isPluginEnabled) {
      const growiPlugin = window.growiPlugin;
      growiPlugin.installAll(this, this.originRenderer);
    }
  }

  injectToWindow() {
    window.appContainer = this;

    const originRenderer = this.getOriginRenderer();
    window.growiRenderer = originRenderer;

    // backward compatibility
    window.crowi = this;
    window.crowiRenderer = originRenderer;
    window.crowiPlugin = window.growiPlugin;
  }

  get currentUserId() {
    if (this.currentUser == null) {
      return null;
    }
    return this.currentUser._id;
  }

  get currentUsername() {
    if (this.currentUser == null) {
      return null;
    }
    return this.currentUser.username;
  }

  /**
   * @return {Object} window.Crowi (js/legacy/crowi.js)
   */
  getCrowiForJquery() {
    return window.Crowi;
  }

  getConfig() {
    return this.config;
  }

  /**
   * Register unstated container instance
   * @param {object} instance unstated container instance
   */
  registerContainer(instance) {
    if (instance == null) {
      throw new Error('The specified instance must not be null');
    }

    const className = instance.constructor.getClassName();

    if (this.containerInstances[className] != null) {
      throw new Error('The specified instance couldn\'t register because the same type object has already been registered');
    }

    this.containerInstances[className] = instance;
  }

  /**
   * Get registered unstated container instance
   * !! THIS METHOD SHOULD ONLY BE USED FROM unstated CONTAINERS !!
   * !! From component instances, inject containers with `import { Subscribe } from 'unstated'` !!
   *
   * @param {string} className
   */
  getContainer(className) {
    return this.containerInstances[className];
  }

  /**
   * Register React component instance
   * @param {string} id
   * @param {object} instance React component instance
   */
  registerComponentInstance(id, instance) {
    if (instance == null) {
      throw new Error('The specified instance must not be null');
    }

    if (this.componentInstances[id] != null) {
      throw new Error('The specified instance couldn\'t register because the same id has already been registered');
    }

    this.componentInstances[id] = instance;
  }

  /**
   * Get registered React component instance
   * @param {string} id
   */
  getComponentInstance(id) {
    return this.componentInstances[id];
  }

  /**
   *
   * @param {string} breakpoint id of breakpoint
   * @param {function} handler event handler for media query
   * @param {boolean} invokeOnInit invoke handler after the initialization if true
   */
  addBreakpointListener(breakpoint, handler, invokeOnInit = false) {
    document.addEventListener('DOMContentLoaded', () => {
      // get the value of '--breakpoint-*'
      const breakpointPixel = parseInt(window.getComputedStyle(document.documentElement).getPropertyValue(`--breakpoint-${breakpoint}`), 10);

      const mediaQuery = window.matchMedia(`(min-width: ${breakpointPixel}px)`);

      // add event listener
      mediaQuery.addListener(handler);
      // initialize
      if (invokeOnInit) {
        handler(mediaQuery);
      }
    });
  }

  getOriginRenderer() {
    return this.originRenderer;
  }

  /**
   * factory method
   */
  getRenderer(mode) {
    if (this.rendererInstances[mode] != null) {
      return this.rendererInstances[mode];
    }

    const renderer = new GrowiRenderer(this, this.originRenderer);
    // setup
    renderer.initMarkdownItConfigurers(mode);
    renderer.setup(mode);
    // register
    this.rendererInstances[mode] = renderer;

    return renderer;
  }

  getEmojiStrategy() {
    return emojiStrategy;
  }

  recoverData() {
    const keys = [
      'userByName',
      'userById',
      'users',
    ];

    keys.forEach((key) => {
      const keyContent = window.localStorage[key];
      if (keyContent) {
        try {
          this[key] = JSON.parse(keyContent);
        }
        catch (e) {
          window.localStorage.removeItem(key);
        }
      }
    });
  }

  async retrieveRecentlyUpdated() {
    const { data } = await this.apiv3Get('/pages/recent');
    this.setState({ recentlyUpdatedPages: data.pages });
  }

  fetchUsers() {
    const interval = 1000 * 60 * 15; // 15min
    const currentTime = new Date();
    if (window.localStorage.lastFetched && interval > currentTime - new Date(window.localStorage.lastFetched)) {
      return;
    }

    this.apiGet('/users.list', {})
      .then((data) => {
        this.users = data.users;
        window.localStorage.users = JSON.stringify(data.users);

        const userByName = {};
        const userById = {};
        for (let i = 0; i < data.users.length; i++) {
          const user = data.users[i];
          userByName[user.username] = user;
          userById[user._id] = user;
        }
        this.userByName = userByName;
        window.localStorage.userByName = JSON.stringify(userByName);

        this.userById = userById;
        window.localStorage.userById = JSON.stringify(userById);

        window.localStorage.lastFetched = new Date();
      })
      .catch((err) => {
        window.localStorage.removeItem('lastFetched');
      // ignore errors
      });
  }

  findUserById(userId) {
    if (this.userById && this.userById[userId]) {
      return this.userById[userId];
    }

    return null;
  }

  findUserByIds(userIds) {
    const users = [];
    for (const userId of userIds) {
      const user = this.findUserById(userId);
      if (user) {
        users.push(user);
      }
    }

    return users;
  }

  toggleDrawer() {
    const { isDrawerOpened } = this.state;
    this.setState({ isDrawerOpened: !isDrawerOpened });
  }

  launchHandsontableModal(componentKind, beginLineNumber, endLineNumber) {
    let targetComponent;
    switch (componentKind) {
      case 'page':
        targetComponent = this.getComponentInstance('Page');
        break;
    }
    targetComponent.launchHandsontableModal(beginLineNumber, endLineNumber);
  }

  launchDrawioModal(componentKind, beginLineNumber, endLineNumber) {
    let targetComponent;
    switch (componentKind) {
      case 'page':
        targetComponent = this.getComponentInstance('Page');
        break;
    }
    targetComponent.launchDrawioModal(beginLineNumber, endLineNumber);
  }

  /**
   * Set Sidebar mode preference by user
   * @param {boolean} preferDockMode
   */
  async setDrawerModePreference(bool) {
    this.setState({ preferDrawerModeByUser: bool });
    this.updateDrawerMode({ ...this.state, preferDrawerModeByUser: bool }); // generate newest state object

    // store settings to localStorage
    const { localStorage } = window;
    localStorage.preferDrawerModeByUser = bool;
  }

  /**
   * Set Sidebar mode preference by user
   * @param {boolean} preferDockMode
   */
  async setDrawerModePreferenceOnEdit(bool) {
    this.setState({ preferDrawerModeOnEditByUser: bool });
    this.updateDrawerMode({ ...this.state, preferDrawerModeOnEditByUser: bool }); // generate newest state object

    // store settings to localStorage
    const { localStorage } = window;
    localStorage.preferDrawerModeOnEditByUser = bool;
  }

  updateDrawerMode(newState) {
    const {
      editorMode, isDeviceSmallerThanMd, preferDrawerModeByUser, preferDrawerModeOnEditByUser,
    } = newState;

    // get preference on view or edit
    const preferDrawerMode = editorMode != null ? preferDrawerModeOnEditByUser : preferDrawerModeByUser;

    const isDrawerMode = isDeviceSmallerThanMd || preferDrawerMode;
    const isDrawerOpened = false; // close Drawer anyway

    this.setState({ isDrawerMode, isDrawerOpened });
  }

  /**
   * Set color scheme preference by user
   * @param {boolean} isDarkMode
   */
  async setColorSchemePreference(isDarkMode) {
    await this.setState({ preferDarkModeByUser: isDarkMode });

    // store settings to localStorage
    const { localStorage } = window;
    if (isDarkMode == null) {
      delete localStorage.removeItem('preferDarkModeByUser');
    }
    else {
      localStorage.preferDarkModeByUser = isDarkMode;
    }

    this.applyColorScheme();
  }

  /**
   * Apply color scheme as 'dark' attribute of <html></html>
   */
  applyColorScheme() {
    const { preferDarkModeByMediaQuery, preferDarkModeByUser } = this.state;

    let isDarkMode = preferDarkModeByMediaQuery;
    if (preferDarkModeByUser != null) {
      isDarkMode = preferDarkModeByUser;
    }

    // switch to dark mode
    if (isDarkMode) {
      document.documentElement.removeAttribute('light');
      document.documentElement.setAttribute('dark', 'true');
    }
    // switch to light mode
    else {
      document.documentElement.setAttribute('light', 'true');
      document.documentElement.removeAttribute('dark');
    }
  }

  async apiGet(path, params) {
    return this.apiRequest('get', path, { params });
  }

  async apiPost(path, params) {
    if (!params._csrf) {
      params._csrf = this.csrfToken;
    }

    return this.apiRequest('post', path, params);
  }

  async apiDelete(path, params) {
    if (!params._csrf) {
      params._csrf = this.csrfToken;
    }

    return this.apiRequest('delete', path, { data: params });
  }

  async apiRequest(method, path, params) {
    const res = await axios[method](`/_api${path}`, params);
    if (res.data.ok) {
      return res.data;
    }

    // Return error code if code is exist
    if (res.data.code != null) {
      const error = new Apiv1ErrorHandler(res.data.error, res.data.code);
      throw error;
    }

    throw new Error(res.data.error);
  }

  async apiv3Request(method, path, params) {
    try {
      const res = await axios[method](urljoin(this.apiv3Root, path), params);
      return res.data;
    }
    catch (err) {
      const errors = apiv3ErrorHandler(err);
      throw errors;
    }
  }

  async apiv3Get(path, params) {
    return this.apiv3Request('get', path, { params });
  }

  async apiv3Post(path, params = {}) {
    if (!params._csrf) {
      params._csrf = this.csrfToken;
    }

    return this.apiv3Request('post', path, params);
  }

  async apiv3Put(path, params = {}) {
    if (!params._csrf) {
      params._csrf = this.csrfToken;
    }

    return this.apiv3Request('put', path, params);
  }

  async apiv3Delete(path, params = {}) {
    if (!params._csrf) {
      params._csrf = this.csrfToken;
    }

    return this.apiv3Request('delete', path, { params });
  }

  openPageCreateModal() {
    this.setState({ isPageCreateModalShown: true });
  }

  closePageCreateModal() {
    this.setState({ isPageCreateModalShown: false });
  }

}
