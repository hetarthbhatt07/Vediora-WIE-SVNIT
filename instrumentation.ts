import { LangfuseSpanProcessor } from '@langfuse/otel';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

export const langfuseSpanProcessor = new LangfuseSpanProcessor({
  exportMode: 'immediate',
  environment: process.env.LANGFUSE_TRACING_ENVIRONMENT || process.env.NODE_ENV,
});

export function register() {
  const tracerProvider = new NodeTracerProvider({
    spanProcessors: [langfuseSpanProcessor],
  });
  tracerProvider.register();
}
