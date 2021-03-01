/**
 * the tool for genetion of plugin definitions source code
 *
 * @author Yuki Takei <yuki@weseek.co.jp>
 */
import fs from 'graceful-fs';
import normalize from 'normalize-path';
import swig from 'swig-templates';

import PluginUtils from '../src/server/plugins/plugin-utils';
import loggerFactory from '../src/utils/logger';
import { resolveFromRoot } from '../src/utils/project-dir-utils';

const logger = loggerFactory('growi:bin:generate-plugin-definitions-source');


const pluginUtils = new PluginUtils();

const TEMPLATE = resolveFromRoot('bin/templates/plugin-definitions.js.swig');
const OUT = resolveFromRoot('tmp/plugins/plugin-definitions.js');

// list plugin names
let pluginNames: string[] = pluginUtils.listPluginNames();
logger.info('Detected plugins: ', pluginNames);

// add from PLUGIN_NAMES_TOBE_LOADED when development
if (process.env.NODE_ENV === 'development'
    && process.env.PLUGIN_NAMES_TOBE_LOADED !== undefined
    && process.env.PLUGIN_NAMES_TOBE_LOADED.length > 0) {
  const pluginNamesDev = process.env.PLUGIN_NAMES_TOBE_LOADED.split(',');

  logger.info('Detected plugins from PLUGIN_NAMES_TOBE_LOADED: ', pluginNamesDev);

  // merge and remove duplicates
  if (pluginNamesDev.length > 0) {
    pluginNames = pluginNames.concat(pluginNamesDev);
    pluginNames = Array.from(new Set(pluginNames));
  }
}


// get definitions
const definitions = pluginNames
  .map((name) => {
    return pluginUtils.generatePluginDefinition(name, true);
  })
  .map((definition) => {
    if (definition == null) {
      return null;
    }

    // convert backslash to slash
    definition.entries = definition.entries.map((entryPath) => {
      return normalize(entryPath);
    });
    return definition;
  })
  .filter(definition => definition != null);

const compiledTemplate = swig.compileFile(TEMPLATE);
const code = compiledTemplate({ definitions });

// write
fs.writeFileSync(OUT, code);
