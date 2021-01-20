export declare type AutolinkingPlatform = 'ios' | 'android';
export declare type AutolinkingSearchConfig = {
    searchPaths: string[];
    ignorePaths?: string[] | null;
    exclude?: string[] | null;
};
export declare type ModuleRevision = {
    path: string;
    version: string;
};
export declare type AutolinkingSearchResult = ModuleRevision & {
    ios?: null | {
        podspecPath: string;
    };
    android?: null | {
        path: string;
    };
    duplicates: ModuleRevision[];
};
export declare type AutolinkingSearchResults = {
    [moduleName: string]: AutolinkingSearchResult;
};
