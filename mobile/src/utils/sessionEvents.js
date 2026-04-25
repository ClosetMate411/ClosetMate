const sessionExpiredListeners = new Set();

export const SESSION_EXPIRED_EVENT = 'auth:session-expired';

export const onSessionExpired = (listener) => {
  if (typeof listener !== 'function') return () => {};
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

export const emitSessionExpired = (payload = {}) => {
  sessionExpiredListeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (_e) {
      // Listener failures should never break API flow.
    }
  });
};

