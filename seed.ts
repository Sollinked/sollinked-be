import dotenv from 'dotenv';
import path from 'path';
import { seedUserTiers, seedUsers } from './src/Seeders';
import prompt from 'prompt-sync';
dotenv.config({ path: path.join(__dirname, '.env')});

(async() => {
    const yn = prompt({sigint: true})('Do you want to seed all tables? y/n\n');
    if(yn === 'y') {
        await seedUsers();
        await seedUserTiers();
        console.log('Seed ended, press CTRL / CMD + C');
    }
    return;
})();