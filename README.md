# 🔄 MySQL Sequelize Model Generator

[![npm version](https://img.shields.io/npm/v/mysql-sequelize-model-generator.svg?style=for-the-badge&color=blue)](https://www.npmjs.com/package/mysql_sequelize_model_generator)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-✓-blue.svg?style=for-the-badge)](https://www.typescriptlang.org/)
[![Sequelize](https://img.shields.io/badge/Sequelize-✓-52B0E7.svg?style=for-the-badge)](https://sequelize.org/)

✨ **Automatically generate production-ready Sequelize TypeScript models from your MySQL database** ✨

---

## 🚀 Quick Installation

```bash
# Using npm
npm install mysql-sequelize-model-generator --save-dev

# Or using yarn
yarn add mysql-sequelize-model-generator -D 
```  

A Node.js utility to automatically generate Sequelize (with `sequelize-typescript`) models from an existing MySQL database schema. It introspects your database tables, columns, and relationships to create TypeScript model files and an initialization script, significantly speeding up the setup process for your Sequelize projects.

## ✨ Key Features

### 🔍 Database Introspection
- **MySQL Schema Scanning** - Automatically reads your database structure including tables, columns, and constraints
- **Comprehensive Analysis** - Examines table relationships, indexes, and column attributes

### � Model Generation
- **TypeScript Model Files** - Generates clean `.model.ts` files for each database table
- **Decorator Support** - Uses `sequelize-typescript` decorators:
    - `@Table` for model definitions
    - `@Column` for field mappings
    - `@PrimaryKey` for identifiers
    - `@AutoIncrement` for sequential IDs

### 🤝 Smart Relationship Detection
- **Automatic Association Mapping**:
    - `@BelongsTo` for foreign key relationships
    - `@HasMany` for one-to-many
    - `@HasOne` for one-to-one
    - `@BelongsToMany` for many-to-many via join tables
- **Bidirectional Linking** - Creates proper associations in both related models

### 🗂 Type Conversion
- **MySQL → TypeScript Type Mapping**:
    - `INT` → `number`
    - `VARCHAR` → `string`
    - `BOOLEAN` → `boolean`
    - `DATE` → `Date`
    - Custom type overrides available
- **Nullability Handling** - Properly marks optional fields

### 🧹 Naming Convention Conversion
| Database | Generated Code |
|----------|----------------|
| `user_accounts` | `UserAccount` (model) |
| `created_at` | `createdAt` (property) |
| `fk_order_user` | `@BelongsTo(() => User)` |

### ⚙️ Initialization Utilities
- **Ready-to-use `init-models.ts`** - Handles:
    - Sequelize instance configuration
    - Model registration
    - Association setup
    - Type-safe model references
- **Production-ready** - Includes proper error handling and logging setup

## 🛠 Prerequisites

Before using this generator, ensure you have:

### Core Requirements
- **Node.js** <img src="https://nodejs.org/static/images/favicons/favicon.png" width="16" height="16" alt="Node.js icon"> v12.x or higher (LTS version recommended)
- **Package Manager** (either):
    - npm <img src="https://static-production.npmjs.com/b0f1a8318363185cc2ea6a40ac23eeb2.png" width="16" height="16" alt="npm icon"> v6+
    - yarn <img src="https://yarnpkg.com/img/yarn-favicon.svg" width="16" height="16" alt="Yarn icon"> v1.22+

### Database Requirements
- **MySQL** <img src="https://labs.mysql.com/common/themes/sakila/favicon.ico" width="16" height="16" alt="MySQL icon"> Server v5.7+ (v8.0+ recommended)
- Database connection credentials with read access

### Project Dependencies
Ensure your project has these installed:
```bash
# Core dependencies
npm install sequelize sequelize-typescript reflect-metadata mysql2

# TypeScript (if using)
npm install typescript @types/node --save-dev
```

## 🚀 Usage

### 1. Configuration Setup

Create a `.env` file in your project root:

```env
# Database Connection
DB_HOST=localhost
DB_USER=your_username
DB_PASSWORD=your_secure_password
DB_NAME=your_database_name
DB_PORT=3306  # Optional (default: 3306)

```

### Create a generator script ``` generate-models.ts```

```node
import dotenv from 'dotenv';
import path from 'path';
import MysqlSequelizeModelGenerator from 'mysql-sequelize-model-generator';

dotenv.config({ path: path.resolve(__dirname, '../.env/.env') });

const generator = new MysqlSequelizeModelGenerator({
  host: process.env.dbHost!,
  port: parseInt(process.env.DB_PORT || '3306'),
  username: process.env.dbUser!,
  password: process.env.dbPassword!,
  database: process.env.dbName!,
  dialect: 'mysql',
});

(async () => {
  try {
    await generator.generateAll('./src/models');
    console.log('✅ Models generated successfully!');
  } catch (error) {
    console.error('❌ Model generation failed:', error);
  }
})();

```

### Run the generator

```bash 
  npx ts-node generate-models.ts 
```

## Support

For issues and feature requests, please [open an issue](https://github.com/yourusername/mysql-sequelize-model-generator/issues).

### Need Help?

- 📌 **Bug Reports**: Please include:
    - Steps to reproduce
    - Expected vs actual behavior
    - Node.js version
    - Database version
    - Any relevant error messages

- 💡 **Feature Requests**: Tell us:
    - What you'd like to see
    - Why it would be useful
    - Any implementation ideas you have
 

 
