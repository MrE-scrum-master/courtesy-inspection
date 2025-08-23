export interface CircuitBreakerOptions {
  timeout: number;
  errorThresholdPercentage: number;
  resetTimeout: number;
  minimumNumberOfCalls: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();
  private options: CircuitBreakerOptions;

  constructor(
    private readonly action: (...args: any[]) => Promise<any>,
    options: CircuitBreakerOptions
  ) {
    this.options = options;
  }

  async execute(...args: any[]): Promise<any> {
    if (this.state === CircuitState.OPEN) {
      if (this.nextAttempt <= Date.now()) {
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }

    try {
      const result = await Promise.race([
        this.action(...args),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), this.options.timeout)
        )
      ]);

      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
    }
    this.successCount++;
  }

  private onFailure(): void {
    this.failureCount++;
    const totalCalls = this.failureCount + this.successCount;

    if (totalCalls >= this.options.minimumNumberOfCalls) {
      const failurePercentage = (this.failureCount / totalCalls) * 100;
      
      if (failurePercentage >= this.options.errorThresholdPercentage) {
        this.state = CircuitState.OPEN;
        this.nextAttempt = Date.now() + this.options.resetTimeout;
      }
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    failurePercentage: number;
  } {
    const totalCalls = this.failureCount + this.successCount;
    const failurePercentage = totalCalls > 0 ? (this.failureCount / totalCalls) * 100 : 0;

    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      failurePercentage,
    };
  }
}