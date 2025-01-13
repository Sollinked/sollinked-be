import DB from './src/DB';
import prompt from 'prompt-sync';

(() => {
  const yn = prompt({sigint: true})('Do you want to drop all tables? y/n\n');
  if(yn === 'y') {
    DB
      .droptable()
      .then(() => {
        console.log('Dropped all table')
        return;
      });
  }
})();