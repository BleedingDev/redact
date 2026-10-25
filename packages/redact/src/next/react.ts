import React, { ReactSharedInternals } from '../react'

export * from '../react'

// Next's Flight decoder uses this object for development stack tracking.
export const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = ReactSharedInternals
export default { ...React, __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE }
