/*
 * Skink - A multi-purpose bot built with discord.js.
 * =======================================================
 * Copyright (c) 2018 TheDragonRing <thedragonring.bod@gmail.com>, under the MIT License.
 */

'use strict';

// variable for global use
const bot = {
  func: {
    // 0: both, 1: top, 2: bottom
    line: (string, char, where) => {
      let line = char;
      for (let i = 1; i < string.length; i++) {
        line += char;
      }
      if (where == 0) return `${line}\n${string}\n${line}`;
      if (where == 1) return `${line}\n${string}`;
      if (where == 2) return `${string}\n${line}`;
      return string;
    },
    // (['a', 'b', 'c'], ', ', ' and ') =>  'a, b, and c'
    join: (array, char, word) => {
      if (array.length === 1) return array[0];
      if (array.length === 2) return array.join(word);
      if (array.length > 2)
        return (
          array.slice(0, -1).join(char) +
          char +
          word +
          array.slice(-1)
        ).replace(/ +/g, ' ');
    },
    user: (bot, message, data, search) => {
      let member = message.member;
      if (search) member = bot.func.member(message, search);
      if (!member) return false;
      const user = member.user;
      if (member.id === message.member.id)
        return [member, member.user, data[0]];
      return [
        member,
        member.user,
        new Promise((resolve, reject) => {
          bot.db.users.findOne({ _id: user.id }, (err, doc) => {
            if (err) console.error(err);
            resolve(doc);
          });
        })
      ];
    },
    member: (message, search) => {
      return search
        ? message.guild.members.get(search.replace(/\D/g, '')) ||
            message.guild.members.find(
              member =>
                member.user.username.toLowerCase() === search.toLowerCase()
            ) ||
            message.guild.members.find(
              member =>
                member.nickname
                  ? member.nickname.toLowerCase() === search.toLowerCase()
                  : false
            )
        : false;
    }
  },
  pack: {}
};

// import packages
bot.pack.moment = require('moment');
bot.pack.countdown = require('countdown');
bot.pack.discord = require('discord.js');
bot.client = new bot.pack.discord.Client();
bot.embed = () => {
  return new bot.pack.discord.RichEmbed().setColor(bot.config.embedColour);
};
bot.collection = () => {
  return new bot.pack.discord.Collection();
};

const fs = require('fs'),
  path = require('path');

// set up database
const Datastore = require('nedb');
bot.db = {
  users: new Datastore({ filename: '.data/users.db', autoload: true }),
  guilds: new Datastore({ filename: '.data/guilds.db', autoload: true })
};
bot.db.users.ensureIndex({ fieldName: '_id', unique: true });
bot.db.users.persistence.setAutocompactionInterval(90000);
bot.db.guilds.ensureIndex({ fieldName: '_id', unique: true });
bot.db.guilds.persistence.setAutocompactionInterval(90000);

// load config, commands & events
bot.load = (what, which, type) => {
  const walkSync = (dir, filelist = []) =>
    [].concat.apply(
      [],
      fs
        .readdirSync(dir)
        .map(
          file =>
            fs.statSync(path.join(dir, file)).isDirectory()
              ? walkSync(path.join(dir, file))
              : path.join(dir, file)
        )
    );
  if (!what || what === 'config') {
    bot.config = require('./config.json');
    delete require.cache[require.resolve('./config.json')];
    console.log('- loaded config');
  }
  if (!what || what == 'command') {
    if (which) {
      let file = (
        bot.cmds.get(which) ||
        bot.cmds.find(cmd => cmd.aliases && cmd.aliases.includes(which)) || {
          file: false
        }
      ).file;
      if (!file) {
        file = walkSync('./commands/');
        if (
          !file.some(
            file => path.basename(file, '.js') === path.basename(which, '.js')
          )
        )
          return false;
        file = file.filter(
          file => path.basename(file, '.js') === path.basename(which, '.js')
        )[0];
      }
      delete require.cache[require.resolve(`.${path.sep}${file}`)];
      const command = require(`.${path.sep}${file}`);
      if (command && command.name && command.run)
        bot.cmds.set(command.name, {
          ...command,
          ...{ file: file }
        });
      console.log(
        `- loaded ${
          command.mod ? 'mod' : 'general'
        } command: ${((file = file.split(path.sep)),
        file.slice(1, file.length).join(path.sep))}`
      );
    } else {
      bot.cmds = bot.collection();
      const commands = walkSync('./commands');
      for (const file of commands) {
        if (path.extname(file) === '.js') {
          delete require.cache[require.resolve(`.${path.sep}${file}`)];
          const command = require(`.${path.sep}${file}`);
          if (command && command.name && command.run)
            bot.cmds.set(command.name, {
              ...command,
              ...{ file: file }
            });
        }
      }
      console.log('- loaded commands');
    }
  }
  if (!what || what === 'event') {
    if (which) {
      let file = walkSync('./events');
      if (
        !file.some(
          name => path.basename(name, '.js') === path.basename(which, '.js')
        )
      )
        return false;
      file = file.filter(
        name => path.basename(name, '.js') === path.basename(which, '.js')
      )[0];
      delete require.cache[require.resolve(`.${path.sep}${file}`)];
      const event = require(`.${path.sep}${file}`);
      if (event && event.trigger) {
        if (bot.client.listeners(which)[0])
          bot.client.removeListener(which, bot.client.listeners(which)[0]);
        bot.client.on(which, (...args) => event.trigger(bot, ...args));
        console.log(
          `- loaded event: ${((file = file.split(path.sep)),
          file.slice(1, file.length).join(path.sep))}`
        );
      }
    } else {
      const events = walkSync('./events');
      for (const file of events) {
        if (path.extname(file) === '.js') {
          delete require.cache[require.resolve(`.${path.sep}${file}`)];
          const event = require(`.${path.sep}${file}`);
          if (event && event.trigger) {
            if (bot.client.listeners(path.basename(file, '.js'))[0])
              bot.client.removeListener(
                path.basename(file, '.js'),
                bot.client.listeners(path.basename(file, '.js'))[0]
              );
            bot.client.on(path.basename(file, '.js'), (...args) =>
              event.trigger(bot, ...args)
            );
          }
        }
      }
      console.log('- loaded events');
    }
  }
  return true;
};
bot.load();

// set up cleverbot
const cleverbot = require('cleverbot.io');
bot.clever = new cleverbot(bot.config.cleverUser, bot.config.cleverKey);

// log the bot in
bot.client.login(bot.config.TOKEN);
