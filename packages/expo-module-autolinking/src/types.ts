export type AutolinkingPlatform = 'ios' | 'android';

export type AutolinkingSearchConfig = {
  searchPaths: string[];
  ignorePaths?: string[] | null;
  exclude?: string[] | null;
};

export type ModuleRevision = {
  path: string;
  version: string;
};

export type AutolinkingSearchResult = ModuleRevision & {
  ios?: null | {
    podspecPath: string;
  };
  android?: null | {
    path: string;
  };
  duplicates: ModuleRevision[];
};

export type AutolinkingSearchResults = {
  [moduleName: string]: AutolinkingSearchResult;
};
