import { Logger } from '@nestjs/common';

/**
 * Runs a side effect (a notification) after the triggering transaction has
 * committed. A failure is logged and never reaches the caller: the request
 * that committed must still succeed.
 */
export async function runAfterCommit(
  logger: Logger,
  label: string,
  effect: () => Promise<unknown> | unknown,
): Promise<void> {
  try {
    await effect();
  } catch (error) {
    logger.error(
      `After-commit effect failed: ${label}`,
      error instanceof Error ? error.stack : String(error),
    );
  }
}
