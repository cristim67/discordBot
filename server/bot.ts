import nacl from 'tweetnacl';
import { GenezioHttpResponse, GenezioHttpRequest } from '@genezio/types';
import { GenezioDeploy, GenezioMethod } from '@genezio/types';
import { InteractionResponseType, InteractionType } from 'discord-interactions';
import axios from 'axios';
import { GenezioQStashQueue } from './helper';

export type DiscordBotCommand = {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  options: DiscordBotOptions[];
};

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

export type DiscordBotOptions = {
  name: string;
  description: string;
  type: ApplicationCommandOptionType;
  required: boolean;
};


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
            genezioQueue.push(process.env.QUEUE_WEBHOOK_URL!, {
              discord_message_token: request.body.token,
              name: name,
            });
            console.log('Task pushed to the queue');

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

  async getBotCommands(): Promise<DiscordBotCommand[]> {
    const url =
      'https://discord.com/api/v10/applications/' +
      process.env.DISCORD_APPLICATION_ID +
      '/commands';
    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bot ' + process.env.DISCORD_TOKEN,
    };

    const response = await axios.get(url, { headers: headers });
    return response.data;
  }

  async registerBotCommands(command: DiscordBotCommand): Promise<boolean> {
    const url =
      'https://discord.com/api/v10/applications/' +
      process.env.DISCORD_APPLICATION_ID +
      '/commands';

    const headers = {
      'Content-Type': 'application/json',
      Authorization: 'Bot ' + process.env.DISCORD_TOKEN,
    };

    const data = JSON.stringify(command);
    axios
      .post(url, data, { headers: headers })
      .then((res) => {
        console.log(res.data);
      })
      .catch((error) => {
        console.error(error);
        return false;
      });

    return true;
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

    axios
      .delete(url, { headers: headers })
      .then((res) => {
        console.log(res.data);
      })
      .catch((error) => {
        console.error(error);
        return false;
      });

    return true;
  }
}
