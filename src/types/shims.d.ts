/** Version de package.json, injectée par Vite (vite.config.ts). */
declare const __APP_VERSION__: string;

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<{}, {}, any>;
  export default component;
}

declare module '@intlify/unplugin-vue-i18n/messages' {
  import type { LocaleMessages, VueMessageType } from 'vue-i18n';

  const messages: LocaleMessages<VueMessageType>;
  export default messages;
}

declare module 'vue-shadow-dom' {
  import type { Plugin } from 'vue';

  const plugin: Plugin;
  export default plugin;
}
