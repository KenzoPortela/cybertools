<!--
  Surcharge de vendor/it-tools/src/tools/user-agent-parser/user-agent-result-cards.vue
  @upstream-sha256 a335cf33e257f751a012038b7e4982c001151c9876d8e98034261cbf49cb6008

  Seule différence avec l'original : les pastilles passent de type="success" à
  type="primary". Chez IT-Tools, les deux couleurs sont le même vert, et ce
  « success » n'est qu'un accent ; avec notre palette il virerait au vert et
  trancherait avec le reste de l'interface.

  Deux ajustements techniques, sans effet sur le rendu :
  - l'import de types est réécrit en `@/` : un chemin relatif partirait d'ici ;
  - `UAParser` est importé par défaut et non nommément. Les types de
    ua-parser-js exposent (via `export =`) un espace de noms qui contient une
    classe du même nom : l'import nommé récupère la classe, `UAParser.IResult`
    se résout alors par l'espace de noms global, et notre tsconfig, plus strict
    que le leur (noUnusedLocals), signale l'import comme inutilisé.
-->
<script setup lang="ts">
import type UAParser from 'ua-parser-js';
import type { UserAgentResultSection } from '@/tools/user-agent-parser/user-agent-parser.types';

const props = defineProps<{
  userAgentInfo?: UAParser.IResult
  sections: UserAgentResultSection[]
}>();
const { userAgentInfo, sections } = toRefs(props);
</script>

<template>
  <div>
    <n-grid :x-gap="12" :y-gap="8" cols="1 s:2" responsive="screen">
      <n-gi v-for="{ heading, icon, content } in sections" :key="heading">
        <c-card h-full>
          <div flex items-center gap-3>
            <n-icon size="30" :component="icon" :depth="3" />
            <span text-lg>{{ heading }}</span>
          </div>

          <div mt-5 flex gap-2>
            <span v-for="{ label, getValue } in content" :key="label">
              <c-tooltip v-if="getValue(userAgentInfo)" :tooltip="label">
                <n-tag type="primary" size="large" round :bordered="false">
                  {{ getValue(userAgentInfo) }}
                </n-tag>
              </c-tooltip>
            </span>
          </div>
          <div flex flex-col>
            <span v-for="{ label, getValue, undefinedFallback } in content" :key="label">
              <span v-if="getValue(userAgentInfo) === undefined" op-70>{{ undefinedFallback }}</span>
            </span>
          </div>
        </c-card>
      </n-gi>
    </n-grid>
  </div>
</template>
