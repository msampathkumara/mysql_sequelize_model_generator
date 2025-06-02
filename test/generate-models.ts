
import dotenv from 'dotenv';
import path from "path";
import MysqlSequelizeModelGenerator from "../src";


dotenv.config({path: path.resolve(__dirname, '../.env/.env')});

console.log(`process.env.dbName : ${process.env.dbName}`);

const dbName = process.env.dbName;
const password = process.env.dbPassword;
const dbUser = process.env.dbUser;
const dbHost = process.env.dbHost;

if (!dbName || !password || !dbUser || !dbHost) {
    throw new Error("Missing required database configuration in environment variables");
}

const generator = new MysqlSequelizeModelGenerator({
    host: dbHost,
    port: parseInt(process.env.DB_PORT || '3306'),
    username: dbUser,
    password: password,
    database: dbName,
    dialect: 'mysql',
});

(async () => {
    try {
        await generator.generateAll('./src/M/models');
        console.log('Models generated successfully!');
    } catch (error) {
        console.error('Model generation failed:', error);
    }
})();
