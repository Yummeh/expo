"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveModulesAsync = exports.verifySearchResults = exports.mergeLinkingOptionsAsync = exports.findModulesAsync = exports.findDefaultPathsAsync = exports.findPackageJsonPathAsync = exports.resolveSearchPathsAsync = void 0;
const chalk_1 = __importDefault(require("chalk"));
const cli_table3_1 = __importDefault(require("cli-table3"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const find_up_1 = __importDefault(require("find-up"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
/**
 * Resolves autolinking search paths. If none is provided, it accumulates all node_modules when
 * going up through the path components. This makes workspaces work out-of-the-box without any configs.
 */
async function resolveSearchPathsAsync(searchPaths, cwd) {
    return searchPaths && searchPaths.length > 0
        ? searchPaths.map(searchPath => path_1.default.resolve(cwd, searchPath))
        : await findDefaultPathsAsync(cwd);
}
exports.resolveSearchPathsAsync = resolveSearchPathsAsync;
async function findPackageJsonPathAsync() {
    return (await find_up_1.default('package.json', { cwd: process.cwd() })) ?? null;
}
exports.findPackageJsonPathAsync = findPackageJsonPathAsync;
/**
 * Looks up for workspace's `node_modules` paths.
 */
async function findDefaultPathsAsync(cwd) {
    const paths = [];
    let dir = cwd;
    let pkgJsonPath;
    while ((pkgJsonPath = await find_up_1.default('package.json', { cwd: dir }))) {
        dir = path_1.default.dirname(path_1.default.dirname(pkgJsonPath));
        paths.push(path_1.default.join(pkgJsonPath, '..', 'node_modules'));
    }
    return paths;
}
exports.findDefaultPathsAsync = findDefaultPathsAsync;
/**
 * Searches for modules to link based on given config.
 */
async function findModulesAsync(platform, providedConfig) {
    const config = await mergeLinkingOptionsAsync(platform, providedConfig);
    const modulesRevisions = {};
    const results = {};
    for (const searchPath of config.searchPaths) {
        const paths = await fast_glob_1.default('**/unimodule.json', {
            cwd: searchPath,
        });
        for (const moduleConfigPath of paths) {
            const modulePath = fs_1.default.realpathSync(path_1.default.join(searchPath, path_1.default.dirname(moduleConfigPath)));
            // const modulePath = path.join(searchPath, path.dirname(moduleConfigPath));
            const moduleConfig = require(path_1.default.join(modulePath, 'unimodule.json'));
            const { name, version } = require(path_1.default.join(modulePath, 'package.json'));
            if (config.exclude?.includes(name) || !moduleConfig.platforms?.includes(platform)) {
                continue;
            }
            const moduleRevision = {
                path: modulePath,
                version,
            };
            if (!modulesRevisions[name]) {
                modulesRevisions[name] = [moduleRevision];
            }
            else if (modulesRevisions[name].every(revision => revision.path !== modulePath)) {
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
exports.findModulesAsync = findModulesAsync;
/**
 * Merges autolinking options from different sources (the later the higher priority)
 * - options defined in package.json's `expoModules` field
 * - platform-specific options from the above (e.g. `expoModules.ios`)
 * - options provided to the CLI command
 */
async function mergeLinkingOptionsAsync(platform, providedConfig) {
    const packageJsonPath = await findPackageJsonPathAsync();
    const packageJson = packageJsonPath ? require(packageJsonPath) : {};
    const baseConfig = packageJson['expoModules'] ?? packageJson['react-native-unimodules'];
    const platformConfig = baseConfig?.[platform];
    const configs = [providedConfig, platformConfig, baseConfig];
    function pickMergedValue(key) {
        for (const obj of configs) {
            if (obj?.[key]) {
                return obj[key];
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
exports.mergeLinkingOptionsAsync = mergeLinkingOptionsAsync;
/**
 * Verifies the search results and then returns logs string, but doesn't print it yet.
 * Right now it only checks whether there are no duplicates.
 */
function verifySearchResults(searchResults) {
    const cwd = process.cwd();
    const relativePath = m => path_1.default.relative(cwd, m.path);
    const tables = [];
    for (const moduleName in searchResults) {
        const moduleResult = searchResults[moduleName];
        if (moduleResult.duplicates.length > 0) {
            const table = new cli_table3_1.default();
            const duplicates = moduleResult.duplicates;
            const paths = [
                chalk_1.default.magenta(relativePath(moduleResult)),
                ...duplicates.map(duplicate => chalk_1.default.gray(relativePath(duplicate))),
            ];
            const versions = [
                chalk_1.default.cyan(moduleResult.version),
                ...duplicates.map(duplicate => chalk_1.default.gray(duplicate.version)),
            ];
            table.push([{ colSpan: 2, content: `📦 ${chalk_1.default.green(moduleName)} found at multiple directories` }], [paths.join(os_1.default.EOL), versions.join(os_1.default.EOL)]);
            tables.push(table);
        }
    }
    if (tables.length > 0) {
        return [
            ...tables.map(table => table.toString()),
            chalk_1.default.yellow(`⚠️  Found ${tables.length} duplicated modules, but only the greatest versions will be autolinked.`),
            chalk_1.default.yellow('⚠️  Make sure to get rid of unnecessary versions as it may introduce side effects, especially on the JavaScript side.'),
        ].join(os_1.default.EOL);
    }
    return '';
}
exports.verifySearchResults = verifySearchResults;
/**
 * Resolves search results to a list of platform-specific configuration.
 */
async function resolveModulesAsync(platform, searchResults) {
    const platformLinking = require(`./resolvers/${platform}`);
    return (await Promise.all(Object.entries(searchResults).map(([moduleName, revision]) => platformLinking.resolveModuleAsync(moduleName, revision)))).filter(Boolean);
}
exports.resolveModulesAsync = resolveModulesAsync;
//# sourceMappingURL=index.js.map