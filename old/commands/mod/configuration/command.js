/*
 * Skink - A multi-purpose bot built with discord.js.
 * =======================================================
 * Copyright (c) 2018 TheDragonRing <thedragonring.bod@gmail.com>, under the MIT License.
 */

exports = {
  name: 'command',
  description: 'Enables or disables use of a certain command in this server.',
  usage: '<enable|disable|list> [which]',
  category: 'Mod',
  args: 1,
  cooldown: 3,
  restricted: {
    mod: true
  }
};

exports.run = (bot, message, data) => {
  const [, guildDB] = data;
  if (!['enable', 'disable', 'list'].includes(message.args[0]))
    return message.channel.send(
      `:x: | **${message.member.nickname ||
        message.author
          .username}**, the first argument must be either \`enable\`, \`disable\` or \`list\`!`
    );
  const command =
    command === 'help'
      ? bot.cmds.help
      : bot.cmds.general.get(message.args[1]) ||
        bot.cmds.general.find(
          cmd => cmd.aliases && cmd.aliases.includes(message.args[1])
        );
  if (message.args[0] !== 'list' && !command)
    return message.channel.send(
      `:x: | **${message.member.nickname || message.author.username}**, ${
        message.args[1]
          ? `the command \`${message.args[1]}\` does not exist! Run \`${
              guildDB.prefix
                ? guildDB.prefix.general
                : 0 || bot.config.prefix.general
            }help\` to see a list.`
          : `which command would you like to ${
              message.args[0]
            }? Try running \`${
              guildDB.prefix
                ? guildDB.prefix.general
                : 0 || bot.config.prefix.general
            } <command>\`
          `
      }`
    );

  switch (message.args[0]) {
    case 'enable':
      // enable command in guild
      bot.db.guilds.update(
        { _id: message.guild.id },
        { $pull: { 'disabled.commands': command.name } },
        {},
        (err, num) => {
          if (err) console.error(err);
          message.channel.send(
            `:eye: | **${message.member.nickname ||
              message.author.username}**, the command \`${
              command.name
            }\` is enabled in this server.`
          );
        }
      );
      break;

    case 'disable':
      if (command.bypass)
        return message.channel.send(
          `:x: | **${message.member.nickname ||
            message.author.username}**, the command \`${
            message.args[1]
          }\` cannot be disabled!`
        );
      // disable command in guild
      bot.db.guilds.update(
        { _id: message.guild.id },
        { $addToSet: { 'disabled.commands': command.name } },
        {},
        (err, num) => {
          if (err) console.error(err);
          message.channel.send(
            `:sleeping: | **${message.member.nickname ||
              message.author.username}**, the command \`${
              command.name
            }\` is disabled in this server.`
          );
        }
      );
      break;

    case 'list':
      let enabled = [],
        disabled = [];
      Array.from(bot.cmds.values()).forEach(cmd => {
        if (guildDB.disabled.commands.includes(cmd.name)) {
          disabled.push(cmd.name);
        } else enabled.push(cmd.name);
      });
      let embed = bot.embed();
      if (enabled.length)
        embed.addField(
          `:eye: Enabled Commands (${enabled.length})`,
          `\`${enabled.join('`, `')}\``
        );
      if (disabled.length)
        embed.addField(
          `:sleeping: Disabled Commands (${disabled.length})`,
          `\`${disabled.join('`, `')}\``
        );
      message.channel.send(embed);
      break;
  }
};
