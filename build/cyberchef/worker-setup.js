/**
 * Préparation de l'environnement du worker, avant le chargement du moteur.
 *
 * Module séparé, importé en premier par worker-entry.js : les imports ES sont
 * évalués dans l'ordre, et ChefWorker.js lit `self.log` et `self.docURL` dès son
 * chargement.
 */
import log from "loglevel";

// ChefWorker.js emploie un `log` global, que la configuration webpack de
// CyberChef fournit d'ordinaire via ProvidePlugin dans leur propre entrée.
self.log = log;
log.setLevel("warn", false);

// Les modules d'opérations autres que « Default » sont chargés à la demande
// par importScripts(`${self.docURL}/modules/<Module>.js`). CyberChef transmet
// cette URL par message ; ici on la déduit de l'emplacement du worker.
self.docURL = self.location.href.replace(/\/[^/]*$/, "");
