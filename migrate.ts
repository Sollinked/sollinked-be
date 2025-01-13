import DB from './src/DB';
import prompt from 'prompt-sync';

(() => {
  const yn = prompt({sigint: true})('Do you want to migrate? y/n\n');
  if(yn === 'y') {
    DB
      .migrate()
      .then(() => {
        console.log('Migration Ended, press Ctrl + C to exit!')
        return;
      });
  }
})();
  