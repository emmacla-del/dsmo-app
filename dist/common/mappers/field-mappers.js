"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAPPERS = void 0;
exports.MAPPERS = {
    legalStatus(v) {
        if (!v)
            return 0;
        if (v.includes('unipersonnelle'))
            return 1;
        if (v.includes('SARL'))
            return 2;
        if (v.includes('SA'))
            return 3;
        if (v.includes('Autres'))
            return 4;
        return 0;
    },
    area(v) {
        if (!v)
            return 0;
        if (v.includes('Urbain'))
            return 1;
        if (v.includes('Rural'))
            return 2;
        return 0;
    },
    sector(v) {
        if (!v)
            return 0;
        if (v.includes('Primaire'))
            return 1;
        if (v.includes('Secondaire'))
            return 2;
        if (v.includes('Tertiaire'))
            return 3;
        return 0;
    },
    size(v) {
        if (!v)
            return 0;
        if (v.includes('TPE'))
            return 1;
        if (v.includes('GE'))
            return 4;
        if (v.includes('ME'))
            return 3;
        if (v.includes('PE'))
            return 2;
        return 0;
    },
    cooperativeType(v) {
        if (!v)
            return 0;
        if (v.includes('comptabilité simplifiée'))
            return 1;
        if (v.includes("conseil d'administration"))
            return 2;
        if (v.includes('Autre'))
            return 3;
        return 0;
    },
    ctdType(v) {
        if (!v)
            return 0;
        if (v.includes('Commune'))
            return 2;
        if (v.includes('Région'))
            return 1;
        return 0;
    },
    councilType(v) {
        if (!v)
            return 0;
        if (v.includes('Arrondissement'))
            return 1;
        if (v.includes('Urbaine'))
            return 2;
        return 0;
    },
};
//# sourceMappingURL=field-mappers.js.map