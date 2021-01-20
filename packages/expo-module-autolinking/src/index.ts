import chalk from 'chalk';
import Table from 'cli-table3';
import glob from 'fast-glob';
import findUp from 'find-up';
import fs from 'fs';
import os from 'os';
import path from 'path';

import {
  AutolinkingPlatform,
  AutolinkingSearchConfig,
  AutolinkingSearchResults,
  ModuleRevision,
} from './types';

/**
 * Resolves autolinking search paths. If none is provided, it accumulates all node_modules when
 * going up through the path components. This makes workspaces work out-of-the-box without any configs.
 */
export async function resolveSearchPathsAsync(
  searchPaths: string[] | null,
  cwd: string
): Promise<string[]> {
  return searchPaths && searchPaths.length > 0
    ? searchPaths.map(searchPath => path.resolve(cwd, searchPath))
    : await findDefaultPathsAsync(cwd);
}

export async function findPackageJsonPathAsync(): Promise<string | null> {
  return (await findUp('package.json', { cwd: process.cwd() })) ?? null;
}
/**
 * Looks up for workspace's `node_modules` paths.
 */
export async function findDefaultPathsAsync(cwd: string): Promise<string[]> {
  const paths = [];
  let dir = cwd;
  let pkgJsonPath: string | undefined;

  while ((pkgJsonPath = await findUp('package.json', { cwd: dir }))) {
    dir = path.dirname(path.dirname(pkgJsonPath));
    paths.push(path.join(pkgJsonPath, '..', 'node_modules'));
  }
  return paths;
}

/**
 * Searches for modules to link based on given config.
 */
export async function findModulesAsync(
  platform: AutolinkingPlatform,
  providedConfig: AutolinkingSearchConfig
): Promise<AutolinkingSearchResults> {
  const config = await mergeLinkingOptionsAsync(platform, providedConfig);
  const modulesRevisions: Record<string, ModuleRevision[]> = {};
  const results: AutolinkingSearchResults = {};

  for (const searchPath of config.searchPaths) {
    const paths = await glob('**/unimodule.json', {
      cwd: searchPath,
    });

    for (const moduleConfigPath of paths) {
      const modulePath = fs.realpathSync(path.join(searchPath, path.dirname(moduleConfigPath)));
      // const modulePath = path.join(searchPath, path.dirname(moduleConfigPath));
      const moduleConfig = require(path.join(modulePath, 'unimodule.json'));
      const { name, version } = require(path.join(modulePath, 'package.json'));

      if (config.exclude?.includes(name) || !moduleConfig.platforms?.includes(platform)) {
        continue;
      }

      const moduleRevision: ModuleRevision = {
        path: modulePath,
        version,
      };
      if (!modulesRevisions[name]) {
        modulesRevisions[name] = [moduleRevision];
      } else if (modulesRevisions[name].every(revision => revision.path !== modulePath)) {
        modulesRevisions[name].push(moduleRevision);
      }
    }
  }

  // Resolve revisions to the main one (first found) and duplicates.
  Object.entries(modulesRevisions).reduce((acc, [moduleName, revisions]) => {
    const mainRevision = revisions.shift();

    if (mainRevision) {
      acc[moduleName] = {
        ...mainRevision,
        duplicates: revisions,
      };
    }
    return acc;
  }, results);

  return results;
}

/**
 * Merges autolinking options from different sources (the later the higher priority)
 * - options defined in package.json's `expoModules` field
 * - platform-specific options from the above (e.g. `expoModules.ios`)
 * - options provided to the CLI command
 */
export async function mergeLinkingOptionsAsync(
  platform: AutolinkingPlatform,
  providedConfig: AutolinkingSearchConfig
): Promise<AutolinkingSearchConfig> {
  const packageJsonPath = await findPackageJsonPathAsync();
  const packageJson = packageJsonPath ? require(packageJsonPath) : {};
  const baseConfig = packageJson['expoModules'] ?? packageJson['react-native-unimodules'];
  const platformConfig = baseConfig?.[platform];

  const configs: Partial<AutolinkingSearchConfig>[] = [providedConfig, platformConfig, baseConfig];

  function pickMergedValue<T extends keyof AutolinkingSearchConfig>(
    key: T
  ): AutolinkingSearchConfig[T] | null {
    for (const obj of configs) {
      if (obj?.[key]) {
        return obj[key] as AutolinkingSearchConfig[T] | null;
      }
    }
    return null;
  }

  return {
    searchPaths: await resolveSearchPathsAsync(pickMergedValue('searchPaths'), process.cwd()),
    ignorePaths: pickMergedValue('ignorePaths'),
    exclude: pickMergedValue('exclude'),
  };
}

/**
 * Verifies the search results and then returns logs string, but doesn't print it yet.
 * Right now it only checks whether there are no duplicates.
 */
export function verifySearchResults(searchResults: AutolinkingSearchResults): string {
  const cwd = process.cwd();
  const relativePath: (module: ModuleRevision) => string = m => path.relative(cwd, m.path);
  const tables: Table.Table[] = [];

  for (const moduleName in searchResults) {
    const moduleResult = searchResults[moduleName];

    if (moduleResult.duplicates.length > 0) {
      const table = new Table();
      const duplicates = moduleResult.duplicates;
      const paths = [
        chalk.magenta(relativePath(moduleResult)),
        ...duplicates.map(duplicate => chalk.gray(relativePath(duplicate))),
      ];
      const versions = [
        chalk.cyan(moduleResult.version),
        ...duplicates.map(duplicate => chalk.gray(duplicate.version)),
      ];

      table.push(
        [{ colSpan: 2, content: `📦 ${chalk.green(moduleName)} found at multiple directories` }],
        [paths.join(os.EOL), versions.join(os.EOL)]
      );
      tables.push(table);
    }
  }
  if (tables.length > 0) {
    return [
      ...tables.map(table => table.toString()),
      chalk.yellow(
        `⚠️  Found ${tables.length} duplicated modules, but only the greatest versions will be autolinked.`
      ),
      chalk.yellow(
        '⚠️  Make sure to get rid of unnecessary versions as it may introduce side effects, especially on the JavaScript side.'
      ),
    ].join(os.EOL);
  }
  return '';
}

/**
 * Resolves search results to a list of platform-specific configuration.
 */
export async function resolveModulesAsync(
  platform: string,
  searchResults: AutolinkingSearchResults
): Promise<any[]> {
  const platformLinking = require(`./resolvers/${platform}`);

  return (
    await Promise.all(
      Object.entries(searchResults).map(([moduleName, revision]) =>
        platformLinking.resolveModuleAsync(moduleName, revision)
      )
    )
  ).filter(Boolean);
}
