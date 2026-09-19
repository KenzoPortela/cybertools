/**
 * États intermédiaires d'un outil chargé à la demande : chargement et échec.
 * Composants minimaux en fonction de rendu, passés à defineAsyncComponent.
 */
import { NButton, NSpin } from 'naive-ui';
import { defineComponent, h } from 'vue';
import { i18n } from '~/app/i18n';

export const ToolLoading = defineComponent({
  name: 'ToolLoading',
  setup: () => () =>
    h('div', { class: 'tool-state', role: 'status', 'aria-live': 'polite' }, [
      h(NSpin, { size: 'medium' }),
      h('span', i18n.global.t('app.tool.loading')),
    ]),
});

export const ToolLoadError = defineComponent({
  name: 'ToolLoadError',
  props: { error: { type: Error, default: undefined } },
  setup: props => () =>
    h('div', { class: 'tool-state', role: 'alert' }, [
      h('strong', i18n.global.t('app.tool.loadError')),
      props.error ? h('code', { class: 'tool-state-detail' }, props.error.message) : null,
      h(NButton, { size: 'small', onClick: () => window.location.reload() }, () => i18n.global.t('app.tool.reload')),
    ]),
});
