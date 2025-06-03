// Enhanced ModelGenerator class
import {Options, Sequelize} from 'sequelize';
import fs from 'fs';
import path from 'path';

interface ColumnDefinition {
    type: string;
    allowNull: boolean;
    primaryKey?: boolean;
    autoIncrement?: boolean;
    defaultValue?: any;
}

export default class MysqlSequelizeModelGenerator {
    private sequelize: Sequelize;
    private associations: Record<string, Array<{
        type: 'hasMany' | 'belongsTo' | 'hasOne' | 'belongsToMany';
        target: string;
        options: Record<string, any>;
    }>> = {};

    constructor(config: Options | undefined) {
        this.sequelize = new Sequelize({
            ...config,
            logging: false,
            dialect: 'mysql',
        });
    }

    private async getDatabaseTables(): Promise<string[]> {
        const [results] = await this.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${this.sequelize.config.database}'
    `);
        return (results as any[]).map(r => r.TABLE_NAME || r.table_name);
    }

    async generate(outputDir: string) {
        const tables = await this.getDatabaseTables();
        const modelNames: string[] = [];

        // First pass: Generate all model files
        for (const table of tables) {
            const modelName = this.toPascalCase(table);
            const modelContent = await this.generateModelFile(table, tables);
            fs.writeFileSync(path.join(outputDir, `${modelName}.model.ts`), modelContent);
            modelNames.push(modelName);
        }

        // Second pass: Generate init-models with all associations
        this.generateInitModelsFile(modelNames, outputDir);
    }

    private generateInitModelsFile(modelNames: string[], outputDir: string) {
        const imports = modelNames.map(name =>
            `import   ${name}   from './${name}.model';`
        ).join('\n');

        const associationConfigs = Object.entries(this.associations)
            .map(([model, relations]) =>
                relations.map(rel =>
                    `${model}.${rel.type}(${rel.target}, ${JSON.stringify(rel.options)});`
                ).join('\n  ')
            ).join('\n  ');

        const content = `// auto build by tools/generate-models.ts

import { Sequelize } from 'sequelize-typescript';
${imports}

export async function initModels(sequelize: Sequelize) {


  sequelize.addModels([\n${modelNames.map(m => `    ${m}`).join(',\n')}\n  ]);
  
  await sequelize.authenticate();
  await sequelize.sync();
  
  // Configure associations
  ${associationConfigs}
  
  return {
${modelNames.map(m => `    ${m}`).join(',\n')}
  };
}

export type Models = ReturnType<typeof initModels>;
`;

        fs.writeFileSync(path.join(outputDir, 'init-models.ts'), content);
    }

    private async getTableColumns(tableName: string): Promise<Array<{
        name: string;
        definition: ColumnDefinition;
    }>> {
        const [results] = await this.sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_key, extra, column_default
      FROM information_schema.columns
      WHERE table_schema = '${this.sequelize.config.database}'
      AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);

        console.log(tableName);

        return (results as any[]).map(row => ({
            name: this.toCamelCase(row.column_name || row.COLUMN_NAME),
            definition: {
                type: row.data_type || row.DATA_TYPE,
                allowNull: (row.is_nullable || row.IS_NULLABLE) === 'YES',
                primaryKey: (row.column_key || row.COLUMN_KEY) === 'PRI',
                autoIncrement: (row.extra || row.EXTRA) === 'auto_increment',
                defaultValue: (row.is_nullable && row.column_default == 'NULL') ? null : `Sequelize.literal( ${JSON.stringify(row.column_default)})` || (row.COLUMN_DEFAULT)
            }
        }));
    }

    private async generateModelFile(tableName: string, allTables: string[]): Promise<string> {
        const columns = await this.getTableColumns(tableName);
        const associations = await this.getTableAssociations(tableName, allTables);

        // Store associations for init-models with proper typing
        const modelName = this.toPascalCase(tableName);
        this.associations[modelName] = associations.configs.map(assoc => ({
            type: assoc.type as 'hasMany' | 'belongsTo' | 'hasOne' | 'belongsToMany',
            target: assoc.target,
            options: assoc.options
        }));

        return `
import { Table, Column, Model, DataType,BelongsTo } from 'sequelize-typescript';
import {Sequelize} from "sequelize-typescript";
         ${associations.imports.map((clas) => `import ${clas} from './${clas}.model';`)} 
         

@Table({ tableName: '${tableName}', timestamps: true })
export default  class ${modelName} extends Model {
${columns.map(col => this.generateColumnDefinition(col)).join('\n')}
${associations.decorators}
}`;
    }

    private generateColumnDefinition(col: {
        name: string;
        definition: ColumnDefinition;
    }): string {
        const decoratorOptions = [
            `type: DataType.${this.mapDataType(col.definition.type)}`,
            `allowNull: ${col.definition.allowNull}`,
            col.definition.primaryKey && 'primaryKey: true',
            col.definition.autoIncrement && 'autoIncrement: true',
            // col.definition.defaultValue !== undefined && `defaultValue: ${JSON.stringify(col.definition.defaultValue)}`,
            col.definition.allowNull &&  col.definition.defaultValue !== undefined && `defaultValue: ${(col.definition.defaultValue)}`,
        ].filter(Boolean).join(',\n    ');

        return `  @Column({\n    ${decoratorOptions}\n  })\n declare ${col.name}: ${this.mapTypeToTS(col.definition.type)};`;
    }


    private toPascalCase(str: string): string {
        return str
            .replace(/[_-]/g, ' ')                         // Replace underscores and hyphens with spaces
            .replace(/([a-z])([A-Z])/g, '$1 $2')           // Add space before camelCase capitals
            .split(' ')                                    // Split by spaces
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }

    private toCamelCase(str: string): string {
        const words = str
            .replace(/[_-]/g, ' ')                         // Convert _ and - to space
            .replace(/([a-z])([A-Z])/g, '$1 $2')           // Add space between lowercase and capital letters (for camel or Pascal case)
            .toLowerCase()
            .split(' ');

        return words[0] + words.slice(1)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }


    private mapDataType(dbType: string): string {
        const typeMap: Record<string, string> = {
            'int': 'INTEGER',
            'integer': 'INTEGER',
            'varchar': 'STRING',
            'char': 'STRING',
            'text': 'TEXT',
            'date': 'DATEONLY',
            'datetime': 'DATE',
            'timestamp': 'DATE',
            'time': 'TIME',
            'float': 'FLOAT',
            'double': 'DOUBLE',
            'decimal': 'DECIMAL',
            'boolean': 'BOOLEAN',
            'tinyint': 'BOOLEAN',
            'json': 'JSON',
            'jsonb': 'JSONB',
            'uuid': 'UUID'
        };

        // Handle type with length (e.g., varchar(255))
        const baseType = dbType.replace(/\(.+\)/, '').toLowerCase();
        return typeMap[baseType] || 'STRING';
    }

    private mapTypeToTS(dbType: string): string {
        const typeMap: Record<string, string> = {
            'int': 'number',
            'integer': 'number',
            'float': 'number',
            'double': 'number',
            'decimal': 'number',
            'boolean': 'boolean',
            'tinyint': 'boolean',
            'date': 'Date',
            'datetime': 'Date',
            'timestamp': 'Date',
            'time': 'string',
            'json': 'object',
            'jsonb': 'object',
            'uuid': 'string'
        };

        const baseType = dbType.replace(/\(.+\)/, '').toLowerCase();
        return typeMap[baseType] || 'string';
    }

    private async determineAssociationType(
        sourceTable: string,
        fk: any,
        allTables: string[]
    ): Promise<'hasMany' | 'belongsTo' | 'hasOne' | 'belongsToMany'> {
        // 1. Check for many-to-many (join tables)
        const isJoinTable = await this.isJoinTable(sourceTable, allTables);
        if (isJoinTable) return 'belongsToMany';

        // 2. Check if foreign key is unique (one-to-one)
        const isUnique = await this.isColumnUnique(sourceTable, fk.sourceColumn);
        if (isUnique) return 'hasOne';

        // 3. Check if target table has foreign key back to source (bi-directional)
        const isBidirectional = await this.hasForeignKey(fk.targetTable, sourceTable);

        // 4. Default to belongsTo for many-to-one or hasMany for one-to-many
        return isBidirectional ? 'hasMany' : 'belongsTo';
    }

// Helper methods:

    private async isJoinTable(tableName: string, allTables: string[]): Promise<boolean> {
        // A join table typically has:
        // - Exactly two foreign keys
        // - No primary columns other than the FKs
        const [columns] = await this.sequelize.query(`
    SELECT column_name, column_key 
    FROM information_schema.columns
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
  `);

        const foreignKeys = (columns as any[]).filter(c => c.COLUMN_KEY === 'MUL');
        const primaryKeys = (columns as any[]).filter(c => c.COLUMN_KEY === 'PRI');

        return foreignKeys.length === 2 && primaryKeys.length <= 2;
    }

    private async isColumnUnique(tableName: string, columnName: string): Promise<boolean> {
        const [results] = await this.sequelize.query(`
    SELECT is_nullable, column_key 
    FROM information_schema.columns
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
    AND column_name = '${columnName}'
  `);

        const columnInfo = (results as any[])[0];
        return columnInfo?.COLUMN_KEY === 'UNI' || columnInfo?.COLUMN_KEY === 'PRI';
    }

    private async hasForeignKey(tableName: string, targetTable: string): Promise<boolean> {
        const [results] = await this.sequelize.query(`
    SELECT COUNT(*) as count
    FROM information_schema.key_column_usage
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
    AND referenced_table_name = '${targetTable}'
  `);

        return (results as any[])[0].count > 0;
    }

    private async getTableAssociations(
        tableName: string,
        allTables: string[]
    ): Promise<{
        imports: string[];
        decorators: string;
        configs: Array<{
            type: 'hasMany' | 'belongsTo' | 'hasOne' | 'belongsToMany';
            target: string;
            options: Record<string, any>;
        }>;
    }> {
        const [foreignKeys] = await this.sequelize.query(`
    SELECT 
      referenced_table_name as targetTable,
      column_name as sourceColumn,
      referenced_column_name as targetColumn,
      constraint_name as constraintName
    FROM information_schema.key_column_usage
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
    AND referenced_table_name IS NOT NULL
  `);

        const modelName = this.toPascalCase(tableName);
        const associations = await Promise.all(
            (foreignKeys as any[]).map(async fk => {
                const targetModel = this.toPascalCase(fk.targetTable);
                const associationType = await this.determineAssociationType(
                    tableName,
                    fk,
                    allTables
                );

                return {
                    type: associationType,
                    target: targetModel,
                    options: {
                        foreignKey: fk.sourceColumn,
                        ...(associationType === 'belongsToMany' ? {
                            through: this.getThroughModelName(tableName, fk.targetTable),
                            otherKey: await this.getOtherForeignKey(tableName)
                        } : {})
                    }
                };
            })
        );


        return {
            imports: [...new Set(associations.map(a => a.target))],
            decorators: associations.map(assoc =>
                `  @${this.toPascalCase(assoc.type)}(() => ${assoc.target}${this.optionsToString(assoc.options)})\n` +
                ` declare ${assoc.options.foreignKey}${this.toPascalCase(this.getAssociationPropertyName(assoc))}: ` +
                `${this.getAssociationReturnType(assoc)};`
            ).join('\n'),
            configs: associations
        };
    }

    private async getOtherForeignKey(tableName: string): Promise<string> {
        const [results] = await this.sequelize.query(`
    SELECT column_name
    FROM information_schema.key_column_usage
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
    AND referenced_table_name IS NOT NULL
    LIMIT 1, 1
  `);
        return (results as any[])[0]?.column_name;
    }

    private getThroughModelName(sourceTable: string, targetTable: string): string {
        const tables = [sourceTable, targetTable].sort();
        return `${tables[0]}_${tables[1]}`;
    }

    private getAssociationReturnType(assoc: {
        type: string;
        target: string;
    }): string {
        return assoc.type === 'hasMany' || assoc.type === 'belongsToMany'
            ? `${assoc.target}[]`
            : assoc.target;
    }

    private optionsToString(options: Record<string, any>): string {
        if (!options || Object.keys(options).length === 0) return '';

        // console.log(`options ${options.foreignKey}`)
        // return `, "${options.foreignKey}"`

        return `, {${JSON.stringify(options).slice(1, -1)}}`;
    }

    private getAssociationPropertyName(assoc: {
        type: string;
        target: string;
    }): string {
        const baseName = this.toCamelCase(assoc.target);
        return assoc.type === 'hasMany' || assoc.type === 'belongsToMany'
            ? `${baseName}s`
            : baseName;
    }
}
