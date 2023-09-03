import { GithubBot } from '../../GithubBot';

export const processGithubInvitations = async() => {
    let bot = new GithubBot();
    await bot.acceptAllInvitations();
}

export const syncRepo = async() => {
    let bot = new GithubBot();
    await bot.trySyncRepo();
}