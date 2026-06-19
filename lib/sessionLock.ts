/** WebRTC 세션 stop/start를 직렬화합니다. */
export function createSessionLock() {
  let tail: Promise<void> = Promise.resolve();

  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      const next = tail.then(operation, operation);
      tail = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
  };
}
