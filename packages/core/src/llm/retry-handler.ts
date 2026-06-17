/**
 * Retry handler with fallback support for API calls
 */

export interface RetryConfig {
  readonly maxRetries: number;
  readonly retryDelayMs: number;
  readonly backoffMultiplier: number;
  readonly fallbackServices: ReadonlyArray<FallbackService>;
}

export interface FallbackService {
  readonly service: string;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

export interface RetryResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly attempts: number;
  readonly usedFallback: boolean;
  readonly serviceUsed?: string;
}

/**
 * Check if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return true; // Assume network-like error
  }

  const err = error as { status?: number; statusCode?: number; code?: string; message?: string };
  const status = err.status ?? err.statusCode;

  // Network errors (no status)
  if (status === undefined) {
    return true;
  }

  // Rate limit (429) - retry
  if (status === 429) {
    return true;
  }

  // 5xx server errors - retry
  if (status >= 500 && status < 600) {
    return true;
  }

  // 4xx errors (except 429) - no retry
  if (status >= 400 && status < 500) {
    return false;
  }

  // Other statuses - retry
  return true;
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(baseDelayMs: number, attempt: number, backoffMultiplier: number): number {
  return Math.floor(baseDelayMs * Math.pow(backoffMultiplier, attempt));
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute function with retries and fallback services
 *
 * @param config - Retry configuration including fallback services
 * @param primaryFn - Function to execute with primary service
 * @param fallbackFns - Optional array of functions for fallback services
 * @returns Result with success status, data, and metadata
 */
export async function withRetryAndFallback<T>(
  config: RetryConfig,
  primaryFn: (service: FallbackService) => Promise<T>,
  fallbackFns?: Array<(service: FallbackService) => Promise<T>>
): Promise<RetryResult<T>> {
  let lastError: unknown;
  let totalAttempts = 0;

  // Try primary function with retries
  if (config.fallbackServices.length > 0) {
    const primaryService = config.fallbackServices[0];

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      totalAttempts++;
      console.log(`[RetryHandler] Primary attempt ${attempt + 1}/${config.maxRetries + 1} with ${primaryService.service}`);

      try {
        const data = await primaryFn(primaryService);
        console.log(`[RetryHandler] Success on attempt ${attempt + 1} using ${primaryService.service}`);
        return {
          success: true,
          data,
          attempts: totalAttempts,
          usedFallback: false,
          serviceUsed: primaryService.service
        };
      } catch (error) {
        lastError = error;
        console.error(`[RetryHandler] Attempt ${attempt + 1} failed:`, error);

        if (!isRetryableError(error)) {
          console.log(`[RetryHandler] Non-retryable error, skipping remaining retries`);
          break;
        }

        if (attempt < config.maxRetries) {
          const delay = calculateDelay(config.retryDelayMs, attempt, config.backoffMultiplier);
          console.log(`[RetryHandler] Retrying in ${delay}ms...`);
          await sleep(delay);
        }
      }
    }
  }

  // Try fallback services (skipping first which is primary)
  const fallbackServices = config.fallbackServices.slice(1);

  if (fallbackServices.length > 0 && fallbackFns && fallbackFns.length > 0) {
    console.log(`[RetryHandler] Trying ${fallbackServices.length} fallback services`);

    for (let i = 0; i < fallbackServices.length; i++) {
      const service = fallbackServices[i];
      const fn = fallbackFns[i];

      if (!fn) {
        console.log(`[RetryHandler] No function for fallback service ${service.service}, skipping`);
        continue;
      }

      // Each fallback service gets its own retry attempts
      for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        totalAttempts++;
        console.log(`[RetryHandler] Fallback ${service.service} attempt ${attempt + 1}/${config.maxRetries + 1}`);

        try {
          const data = await fn(service);
          console.log(`[RetryHandler] Success on fallback ${service.service} at attempt ${attempt + 1}`);
          return {
            success: true,
            data,
            attempts: totalAttempts,
            usedFallback: true,
            serviceUsed: service.service
          };
        } catch (error) {
          lastError = error;
          console.error(`[RetryHandler] Fallback ${service.service} attempt ${attempt + 1} failed:`, error);

          if (!isRetryableError(error)) {
            console.log(`[RetryHandler] Non-retryable error on ${service.service}, moving to next fallback`);
            break;
          }

          if (attempt < config.maxRetries) {
            const delay = calculateDelay(config.retryDelayMs, attempt, config.backoffMultiplier);
            console.log(`[RetryHandler] Retrying ${service.service} in ${delay}ms...`);
            await sleep(delay);
          }
        }
      }
    }
  }

  // All attempts failed
  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError ?? 'Unknown error');
  console.error(`[RetryHandler] All attempts failed after ${totalAttempts} attempts`);

  return {
    success: false,
    error: errorMessage,
    attempts: totalAttempts,
    usedFallback: false
  };
}
