import dotenv from 'dotenv';
import path from 'path';
import {  } from './src/Seeders';
dotenv.config({ path: path.join(__dirname, '.env')});

(async() => {
    console.log('Seed ended, press CTRL / CMD + C');
    return;
})();