import nacl from 'tweetnacl';
import { GenezioHttpResponse, GenezioHttpRequest } from '@genezio/types';
import { GenezioDeploy, GenezioMethod } from '@genezio/types';
import { InteractionResponseType, InteractionType } from 'discord-interactions';
import axios from 'axios';
import { GenezioQStashQueue } from './helper';

export type DiscordBotCommandRequest = {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  options: DiscordBotOptions[];
};

export type DiscordBotCommandResponse = {
  id: string;
  application_id: string;
  version: string;
  default_member_permissions: null | any;
  type: number;
  name: string;
  description: string;
  dm_permission: boolean;
  contexts: null | any;
  integration_types: number[];
  options: DiscordBotOptions[];
  nsfw: boolean;
};

export type DiscordBotOptions = {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  required: boolean;
};

export type DiscordBotCommandError = {
  message: string;
  code: number;
  errors: any[];
}

export enum ApplicationCommandOptionType {
SUB_COMMAND = 1,
SUB_COMMAND_GROUP = 2,
STRING = 3,
INTEGER = 4,
BOOLEAN = 5,
USER = 6,
CHANNEL = 7,
ROLE = 8,
MENTIONABLE = 9,
NUMBER = 10,
ATTACHMENT = 11,
}

@GenezioDeploy()
export class DiscordBotService {
  @GenezioMethod({ type: 'http' })
  async bot(request: GenezioHttpRequest): Promise<GenezioHttpResponse> {
    const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;
    if (!PUBLIC_KEY) {
      throw new Error('Missing Discord Public Key');
    }

    const signature = request.headers['x-signature-ed25519'];
    const timestamp = request.headers['x-signature-timestamp'];
    const body = request.rawBody;

    const isVerified = nacl.sign.detached.verify(
      Buffer.from(timestamp + body),
      Buffer.from(signature, 'hex'),
      Buffer.from(PUBLIC_KEY, 'hex'),
    );

    if (!isVerified) {
      const response: GenezioHttpResponse = {
        body: { error: 'invalid request signature' },
        headers: { 'content-type': 'application/json' },
        statusCode: '401',
      };
      return response;
    }

    if (request.http.method === 'POST') {
      if (request.body.type === InteractionType.PING) {
        console.log('PING message received');
        const response: GenezioHttpResponse = {
          body: {
            type: InteractionResponseType.PONG,
          },
          headers: { 'content-type': 'application/json' },
          statusCode: '200',
        };
        return response;
      }

      if (request.body.type === InteractionType.APPLICATION_COMMAND) {
        switch (request.body.data.name) {
          case 'hello':
            const name:string = request.body.data.options[0].value;

            // Publish a task to the queue
            console.log('Pushing task to the queue');
            const genezioQueue = new GenezioQStashQueue(process.env.QSTASH_TOKEN!);
            try {

              genezioQueue.push(process.env.QUEUE_WEBHOOK_URL!, {
                discord_message_token: request.body.token,
                name: name,
              });
              console.log('Task pushed to the queue');
            } catch (error: any) {
              console.error('Error:', error.message);
            }

            // Return a deferred response to discord
            return {
              body: {
                type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE,
              },
              headers: { 'content-type': 'application/json' },
              statusCode: '200',
            };

          default:
            // Return a response to discord
            return {
              body: {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                  content: 'Hello world!',
                },
              },
              headers: { 'content-type': 'application/json' },
              statusCode: '200',
            };
        }
      }
    }

    const response: GenezioHttpResponse = {
      body: {},
      headers: { 'content-type': 'application/json' },
      statusCode: '405',
    };
    return response;
  }

  async getBotCommands(): Promise<DiscordBotCommandResponse[]> {
    const url =
      'https://discord.com/api/v10/applications/' +
      process.env.DISCORD_APPLICATION_ID +
      '/commands';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bot ' + process.env.DISCORD_TOKEN,
    };

    try {
      const response = await axios.get(url, { headers: headers });
      return response.data;
    } catch (error) {
      console.error('Error fetching bot commands:', error);
      throw error;
    }
  }

  async registerHelloCommand(): Promise<boolean | DiscordBotCommandError> {
    const command: DiscordBotCommandRequest = {
      name: 'hello',
      description: 'Say hello to someone',
      type: ApplicationCommandOptionType.SUB_COMMAND,
      options: [
        {
          name: 'name',
          description: 'The name of the person to say hello to',
          type: ApplicationCommandOptionType.STRING,
          required: true,
        },
      ],
    };

    return await this.registerBotCommands(command);
  }

  async registerBotCommands(command: DiscordBotCommandRequest): Promise<boolean | DiscordBotCommandError> {
    const url =
      'https://discord.com/api/v10/applications/' +
      process.env.DISCORD_APPLICATION_ID +
      '/commands';

    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bot ' + process.env.DISCORD_TOKEN,
    };

    const data = JSON.stringify(command);

    try {
      const res = await axios.post(url, data, { headers: headers });
      console.log(res.data);

      return true;
    } catch (error: any) {
      console.error(error.response.data);
      return error.response.data as DiscordBotCommandError;
    }
  }

  unregisterAllCommands(): Promise<boolean> {
    return new Promise<boolean>(async (resolve) => {
      const commands = await this.getBotCommands();
      let success = true;
      for (const command of commands) {
        const result = await this.unRegisterBotCommands(command.id);
        if (!result) {
          success = false;
        }
      }
      resolve(success);
    });
  }

  async unRegisterBotCommands(commandId: string): Promise<boolean> {
    const url =
      'https://discord.com/api/v10/applications/' +
      process.env.DISCORD_APPLICATION_ID +
      '/commands/' +
      commandId.replace(/"/g, '');
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bot ' + process.env.DISCORD_TOKEN,
    };

    try {
      const response = await axios.delete(url, { headers });
      console.log(response.data);
      return true;
    } catch (error: any) {
      console.error('Error deleting resource:', error.response?.data || error.message);
      return false;
    }

  }
}
