// client/src/store/store.js

import { configureStore } from '@reduxjs/toolkit'
import fraudReducer from './slices/fraudSlice'

// Import your other existing reducers here and keep them exactly as they were.
// Example (replace with your actual slice imports):
// import authReducer from './slices/authSlice'
// import workerReducer from './slices/workerSlice'

export const store = configureStore({
  reducer: {
    // auth: authReducer,       // ← keep all your existing reducers
    // worker: workerReducer,   // ← keep all your existing reducers
    fraud: fraudReducer,        // ← this is the new one
  },
})

export default store