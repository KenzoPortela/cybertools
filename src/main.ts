// En premier : le compteur de requêtes externes doit observer le plus tôt possible.
import '~/app/network-watch';

import { createHead } from '@vueuse/head';
import { create as createNaive } from 'naive-ui';
import { createPinia } from 'pinia';
import { createApp } from 'vue';
import shadow from 'vue-shadow-dom';

import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import 'virtual:uno.css';
import '~/app/styles/global.css';
import '~/app/monaco-environment';

import App from '~/app/App.vue';
import { i18n } from '~/app/i18n';
import { router } from '~/app/router';

const app = createApp(App);

// Pinia en premier : le store de style d'IT-Tools est lu dès le rendu de App.vue.
app.use(createPinia());
app.use(createHead());
app.use(i18n);
app.use(router);
app.use(createNaive());
// Requis par quelques outils d'IT-Tools qui isolent leur rendu dans un shadow DOM.
app.use(shadow);

app.mount('#app');
