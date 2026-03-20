import { configureStore } from '@reduxjs/toolkit';
import fraudReducer from './slices/fraudSlice';

const store = configureStore({
  reducer: {
    fraud: fraudReducer,
  },
});

export default store;