import { OpenAICompatibleProvider, GROQ_BASE_URL } from './custom.provider';

export class GroqProvider extends OpenAICompatibleProvider {
  constructor() {
    super(GROQ_BASE_URL);
  }
}
