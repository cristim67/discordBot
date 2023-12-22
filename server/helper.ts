import axios from 'axios';

export type GenezioEndpoint = {
  classname?: string;
  methodname: string;
}

export class GenezioQStashQueue {
  qstashToken: string;

  constructor(qstashToken: string) {
    this.qstashToken = qstashToken;
  }

  async push(webhook: string, body: any): Promise<void> {
    const payload = JSON.stringify(body);

    const headers = {
      Authorization: 'Bearer ' + this.qstashToken,
      'Content-Type': 'application/json',
    };

    axios
      .post(webhook, payload, { headers: headers })
      .catch((error) => {
        throw error;
      });
  }
}
