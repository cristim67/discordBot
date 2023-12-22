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

    try {
      await axios.post(webhook, payload, { headers });
    } catch (error: any) {
      console.error('Error posting data:', error.response?.data || error.message);
      throw new Error('Failed to post data to webhook.');
    }
  }
}
