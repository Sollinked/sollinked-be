import DB from './src/DB';
import prompt from 'prompt-sync';

(() => {
  const yn = prompt({sigint: true})('Do you want to rollback? y/n\n');
  if(yn === 'y') {
    DB
      .rollback()
      .then(() => {
        console.log('Rollback Ended, press Ctrl + C to exit!')
        return;
      });
  }
})();