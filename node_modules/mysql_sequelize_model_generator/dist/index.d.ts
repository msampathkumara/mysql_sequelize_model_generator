import { Options } from 'sequelize';
export default class MysqlSequelizeModelGenerator {
    private sequelize;
    private associations;
    constructor(config: Options | undefined);
    private getDatabaseTables;
    generateAll(outputDir: string): Promise<void>;
    private generateInitModelsFile;
    private getTableColumns;
    private generateModelFile;
    private generateColumnDefinition;
    private toPascalCase;
    private toCamelCase;
    private mapDataType;
    private mapTypeToTS;
    private determineAssociationType;
    private isJoinTable;
    private isColumnUnique;
    private hasForeignKey;
    private getTableAssociations;
    private getOtherForeignKey;
    private getThroughModelName;
    private getAssociationReturnType;
    private optionsToString;
    private getAssociationPropertyName;
}
