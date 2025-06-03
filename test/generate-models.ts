import dotenv from 'dotenv';
import path from "path";
import MysqlSequelizeModelGenerator from "../src";


dotenv.config({path: path.resolve(__dirname, '../.env/.env')});


const dbName = process.env.DB_NAME;
const password = process.env.DB_PASSWORD;
const dbUser = process.env.DB_USER;
const dbHost = process.env.DB_HOST;
const dbport = parseInt(process.env.DB_PORT || '3306');

if (!dbName || !password || !dbUser || !dbHost) {
    throw new Error("Missing required database configuration in environment variables");
}

const generator = new MysqlSequelizeModelGenerator({
    host: dbHost,
    port: dbport,
    username: dbUser,
    password: password,
    database: dbName
});

(async () => {
    try {
        await generator.generate('./src/M/models');
        console.log('Models generated successfully!');
    } catch (error) {
        console.error('Model generation failed:', error);
    }
})();
