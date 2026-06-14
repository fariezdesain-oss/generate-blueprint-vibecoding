import { OpenAICompatibleProvider, OPENROUTER_BASE_URL } from './custom.provider';

export class OpenRouterProvider extends OpenAICompatibleProvider {
  constructor() {
    super(OPENROUTER_BASE_URL);
  }
}
