/**
 * Messages propres à cybertools, ajoutés au worker de CyberChef.
 *
 * Le format de recette « pretty » de CyberChef — celui de ses liens de partage,
 * `From_Base64('A-Za-z0-9+/=',true)To_Hex('Space',0)` — a sa propre grammaire
 * (échappements, intertitres, drapeaux /disabled). Plutôt que d'en recopier le
 * parseur, on sert leur implémentation, déjà présente dans le worker : la
 * compatibilité avec cyberchef.org est garantie par construction.
 *
 * Préfixe « cybertools: » : ChefWorker.js ignore les actions qu'il ne connaît
 * pas, et nous ignorons les siennes.
 */
import Utils from "../../vendor/cyberchef/src/core/Utils.mjs";

const handlers = {
    "cybertools:pretty-recipe": ({ recipe }) => Utils.generatePrettyRecipe(recipe),
    "cybertools:parse-recipe": ({ text }) => Utils.parseRecipeConfig(text),
};

self.addEventListener("message", ({ data: message }) => {
    const handler = handlers[message.action];
    if (!handler) return;

    const { id } = message.data;
    try {
        self.postMessage({ action: "cybertools:reply", data: { id, value: handler(message.data) } });
    }
    catch (error) {
        self.postMessage({ action: "cybertools:reply", data: { id, error: error.message || String(error) } });
    }
});
