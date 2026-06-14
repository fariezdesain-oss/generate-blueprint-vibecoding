import { OpenAICompatibleProvider, DEEPSEEK_BASE_URL } from './custom.provider';

export class DeepSeekProvider extends OpenAICompatibleProvider {
  constructor() {
    super(DEEPSEEK_BASE_URL);
  }
}
