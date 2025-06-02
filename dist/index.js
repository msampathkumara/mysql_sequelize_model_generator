"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Enhanced ModelGenerator class
const sequelize_1 = require("sequelize");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class MysqlSequelizeModelGenerator {
    constructor(config) {
        this.associations = {};
        this.sequelize = new sequelize_1.Sequelize(Object.assign(Object.assign({}, config), { logging: false }));
    }
    getDatabaseTables() {
        return __awaiter(this, void 0, void 0, function* () {
            const [results] = yield this.sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = '${this.sequelize.config.database}'
    `);
            return results.map(r => r.TABLE_NAME || r.table_name);
        });
    }
    generateAll(outputDir) {
        return __awaiter(this, void 0, void 0, function* () {
            const tables = yield this.getDatabaseTables();
            const modelNames = [];
            // First pass: Generate all model files
            for (const table of tables) {
                const modelName = this.toPascalCase(table);
                const modelContent = yield this.generateModelFile(table, tables);
                fs_1.default.writeFileSync(path_1.default.join(outputDir, `${modelName}.model.ts`), modelContent);
                modelNames.push(modelName);
            }
            // Second pass: Generate init-models with all associations
            this.generateInitModelsFile(modelNames, outputDir);
        });
    }
    generateInitModelsFile(modelNames, outputDir) {
        const imports = modelNames.map(name => `import   ${name}   from './${name}.model';`).join('\n');
        const associationConfigs = Object.entries(this.associations)
            .map(([model, relations]) => relations.map(rel => `${model}.${rel.type}(${rel.target}, ${JSON.stringify(rel.options)});`).join('\n  ')).join('\n  ');
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
        fs_1.default.writeFileSync(path_1.default.join(outputDir, 'init-models.ts'), content);
    }
    getTableColumns(tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            const [results] = yield this.sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_key, extra, column_default
      FROM information_schema.columns
      WHERE table_schema = '${this.sequelize.config.database}'
      AND table_name = '${tableName}'
      ORDER BY ordinal_position
    `);
            return results.map(row => ({
                name: this.toCamelCase(row.column_name || row.COLUMN_NAME),
                definition: {
                    type: row.data_type || row.DATA_TYPE,
                    allowNull: (row.is_nullable || row.IS_NULLABLE) === 'YES',
                    primaryKey: (row.column_key || row.COLUMN_KEY) === 'PRI',
                    autoIncrement: (row.extra || row.EXTRA) === 'auto_increment',
                    defaultValue: row.column_default || row.COLUMN_DEFAULT
                }
            }));
        });
    }
    generateModelFile(tableName, allTables) {
        return __awaiter(this, void 0, void 0, function* () {
            const columns = yield this.getTableColumns(tableName);
            const associations = yield this.getTableAssociations(tableName, allTables);
            // Store associations for init-models with proper typing
            const modelName = this.toPascalCase(tableName);
            this.associations[modelName] = associations.configs.map(assoc => ({
                type: assoc.type,
                target: assoc.target,
                options: assoc.options
            }));
            return `
import { Table, Column, Model, DataType,BelongsTo } from 'sequelize-typescript';
         ${associations.imports.map((clas) => `import ${clas} from './${clas}.model';`)} 
         

@Table({ tableName: '${tableName}', timestamps: true })
export default  class ${modelName} extends Model {
${columns.map(col => this.generateColumnDefinition(col)).join('\n')}
${associations.decorators}
}`;
        });
    }
    generateColumnDefinition(col) {
        const decoratorOptions = [
            `type: DataType.${this.mapDataType(col.definition.type)}`,
            `allowNull: ${col.definition.allowNull}`,
            col.definition.primaryKey && 'primaryKey: true',
            col.definition.autoIncrement && 'autoIncrement: true',
            col.definition.defaultValue !== undefined && `defaultValue: ${JSON.stringify(col.definition.defaultValue)}`,
        ].filter(Boolean).join(',\n    ');
        return `  @Column({\n    ${decoratorOptions}\n  })\n declare ${col.name}: ${this.mapTypeToTS(col.definition.type)};`;
    }
    toPascalCase(str) {
        return str
            .replace(/[_-]/g, ' ') // Replace underscores and hyphens with spaces
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before camelCase capitals
            .split(' ') // Split by spaces
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join('');
    }
    toCamelCase(str) {
        const words = str
            .replace(/[_-]/g, ' ') // Convert _ and - to space
            .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between lowercase and capital letters (for camel or Pascal case)
            .toLowerCase()
            .split(' ');
        return words[0] + words.slice(1)
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join('');
    }
    mapDataType(dbType) {
        const typeMap = {
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
    mapTypeToTS(dbType) {
        const typeMap = {
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
    determineAssociationType(sourceTable, fk, allTables) {
        return __awaiter(this, void 0, void 0, function* () {
            // 1. Check for many-to-many (join tables)
            const isJoinTable = yield this.isJoinTable(sourceTable, allTables);
            if (isJoinTable)
                return 'belongsToMany';
            // 2. Check if foreign key is unique (one-to-one)
            const isUnique = yield this.isColumnUnique(sourceTable, fk.sourceColumn);
            if (isUnique)
                return 'hasOne';
            // 3. Check if target table has foreign key back to source (bi-directional)
            const isBidirectional = yield this.hasForeignKey(fk.targetTable, sourceTable);
            // 4. Default to belongsTo for many-to-one or hasMany for one-to-many
            return isBidirectional ? 'hasMany' : 'belongsTo';
        });
    }
    // Helper methods:
    isJoinTable(tableName, allTables) {
        return __awaiter(this, void 0, void 0, function* () {
            // A join table typically has:
            // - Exactly two foreign keys
            // - No primary columns other than the FKs
            const [columns] = yield this.sequelize.query(`
    SELECT column_name, column_key 
    FROM information_schema.columns
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
  `);
            const foreignKeys = columns.filter(c => c.COLUMN_KEY === 'MUL');
            const primaryKeys = columns.filter(c => c.COLUMN_KEY === 'PRI');
            return foreignKeys.length === 2 && primaryKeys.length <= 2;
        });
    }
    isColumnUnique(tableName, columnName) {
        return __awaiter(this, void 0, void 0, function* () {
            const [results] = yield this.sequelize.query(`
    SELECT is_nullable, column_key 
    FROM information_schema.columns
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
    AND column_name = '${columnName}'
  `);
            const columnInfo = results[0];
            return (columnInfo === null || columnInfo === void 0 ? void 0 : columnInfo.COLUMN_KEY) === 'UNI' || (columnInfo === null || columnInfo === void 0 ? void 0 : columnInfo.COLUMN_KEY) === 'PRI';
        });
    }
    hasForeignKey(tableName, targetTable) {
        return __awaiter(this, void 0, void 0, function* () {
            const [results] = yield this.sequelize.query(`
    SELECT COUNT(*) as count
    FROM information_schema.key_column_usage
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
    AND referenced_table_name = '${targetTable}'
  `);
            return results[0].count > 0;
        });
    }
    getTableAssociations(tableName, allTables) {
        return __awaiter(this, void 0, void 0, function* () {
            const [foreignKeys] = yield this.sequelize.query(`
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
            const associations = yield Promise.all(foreignKeys.map((fk) => __awaiter(this, void 0, void 0, function* () {
                const targetModel = this.toPascalCase(fk.targetTable);
                const associationType = yield this.determineAssociationType(tableName, fk, allTables);
                return {
                    type: associationType,
                    target: targetModel,
                    options: Object.assign({ foreignKey: fk.sourceColumn }, (associationType === 'belongsToMany' ? {
                        through: this.getThroughModelName(tableName, fk.targetTable),
                        otherKey: yield this.getOtherForeignKey(tableName)
                    } : {}))
                };
            })));
            return {
                imports: [...new Set(associations.map(a => a.target))],
                decorators: associations.map(assoc => `  @${this.toPascalCase(assoc.type)}(() => ${assoc.target}${this.optionsToString(assoc.options)})\n` +
                    ` declare ${assoc.options.foreignKey}${this.toPascalCase(this.getAssociationPropertyName(assoc))}: ` +
                    `${this.getAssociationReturnType(assoc)};`).join('\n'),
                configs: associations
            };
        });
    }
    getOtherForeignKey(tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const [results] = yield this.sequelize.query(`
    SELECT column_name
    FROM information_schema.key_column_usage
    WHERE table_schema = '${this.sequelize.config.database}'
    AND table_name = '${tableName}'
    AND referenced_table_name IS NOT NULL
    LIMIT 1, 1
  `);
            return (_a = results[0]) === null || _a === void 0 ? void 0 : _a.column_name;
        });
    }
    getThroughModelName(sourceTable, targetTable) {
        const tables = [sourceTable, targetTable].sort();
        return `${tables[0]}_${tables[1]}`;
    }
    getAssociationReturnType(assoc) {
        return assoc.type === 'hasMany' || assoc.type === 'belongsToMany'
            ? `${assoc.target}[]`
            : assoc.target;
    }
    optionsToString(options) {
        if (!options || Object.keys(options).length === 0)
            return '';
        console.log(`options ${options.foreignKey}`);
        // return `, "${options.foreignKey}"`
        return `, {${JSON.stringify(options).slice(1, -1)}}`;
    }
    getAssociationPropertyName(assoc) {
        const baseName = this.toCamelCase(assoc.target);
        return assoc.type === 'hasMany' || assoc.type === 'belongsToMany'
            ? `${baseName}s`
            : baseName;
    }
}
exports.default = MysqlSequelizeModelGenerator;
