/**
 * Injection du kit isométrique dans une page.
 *
 * Le kit (iso-kit.mjs) est un module destiné au navigateur : on le lit, on lui retire ses
 * `export ` et on l'insère tel quel dans le <script> de la page. La page reste ainsi
 * autonome, sans requête ni serveur de modules.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ICI = dirname(fileURLToPath(import.meta.url));

export function kitScript() {
  return readFileSync(join(ICI, "iso-kit.mjs"), "utf8").replace(/^export /gm, "");
}
