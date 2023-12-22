import { GenezioHttpResponse, GenezioHttpRequest } from '@genezio/types';
import { GenezioDeploy, GenezioMethod } from '@genezio/types';
import axios from 'axios';

const DISCORD_WEBHOOK = 'https://discord.com/api/v10/webhooks/' + process.env.DISCORD_APPLICATION_ID + '/' + '<message_token>' + '/messages/@original';

@GenezioDeploy()
export class HelloWorker {
  @GenezioMethod({ type: 'http' })
  async hello(request: GenezioHttpRequest) {
    const name: string = request.body.name;
    console.log(`[HELLO WORKER] Hello world, ${name}!`);

    await this.sendReplyToDiscord(
      request.body.discord_message_token,
      name
    );

    const response: GenezioHttpResponse = {
      body: {},
      headers: { 'content-type': 'application/json' },
      statusCode: '200',
    };
    return response;
  }

  async sendReplyToDiscord(token: string, name: string) {
    const url = DISCORD_WEBHOOK.replace('<message_token>', token);
    const headers = {
      'Content-Type': 'application/json',
    };
    const payload = {
      content: 'Hello world, ' + name + '! ',
    };

    axios.patch(url, payload, { headers: headers }).catch((error) => {
      console.error(error);
    });
  }
}
