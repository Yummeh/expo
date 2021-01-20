import { AutolinkingPlatform, AutolinkingSearchConfig, AutolinkingSearchResults } from './types';
/**
 * Resolves autolinking search paths. If none is provided, it accumulates all node_modules when
 * going up through the path components. This makes workspaces work out-of-the-box without any configs.
 */
export declare function resolveSearchPathsAsync(searchPaths: string[] | null, cwd: string): Promise<string[]>;
export declare function findPackageJsonPathAsync(): Promise<string | null>;
/**
 * Looks up for workspace's `node_modules` paths.
 */
export declare function findDefaultPathsAsync(cwd: string): Promise<string[]>;
/**
 * Searches for modules to link based on given config.
 */
export declare function findModulesAsync(platform: AutolinkingPlatform, providedConfig: AutolinkingSearchConfig): Promise<AutolinkingSearchResults>;
/**
 * Merges autolinking options from different sources (the later the higher priority)
 * - options defined in package.json's `expoModules` field
 * - platform-specific options from the above (e.g. `expoModules.ios`)
 * - options provided to the CLI command
 */
export declare function mergeLinkingOptionsAsync(platform: AutolinkingPlatform, providedConfig: AutolinkingSearchConfig): Promise<AutolinkingSearchConfig>;
/**
 * Verifies the search results and then returns logs string, but doesn't print it yet.
 * Right now it only checks whether there are no duplicates.
 */
export declare function verifySearchResults(searchResults: AutolinkingSearchResults): string;
/**
 * Resolves search results to a list of platform-specific configuration.
 */
export declare function resolveModulesAsync(platform: string, searchResults: AutolinkingSearchResults): Promise<any[]>;
