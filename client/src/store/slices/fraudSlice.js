import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import {
  dismissFraudQueueItem,
  getFraudActions,
  getFraudMetrics,
  getFraudQueue,
  runFraudScan,
  takeFraudAction,
} from '../../api';

const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

export const fetchFraudQueue = createAsyncThunk('fraud/fetchQueue', async (params = {}, { rejectWithValue }) => {
  try {
    const { data } = await getFraudQueue(params);
    return data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Failed to load fraud queue.'));
  }
});

export const fetchModelMetrics = createAsyncThunk('fraud/fetchMetrics', async (_, { rejectWithValue }) => {
  try {
    const { data } = await getFraudMetrics();
    return data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Failed to load model metrics.'));
  }
});

export const fetchFraudActions = createAsyncThunk('fraud/fetchActions', async (params = {}, { rejectWithValue }) => {
  try {
    const { data } = await getFraudActions(params);
    return data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Failed to load action history.'));
  }
});

export const triggerFullScan = createAsyncThunk('fraud/triggerFullScan', async (_, { dispatch, rejectWithValue }) => {
  try {
    const { data } = await runFraudScan();
    dispatch(fetchFraudQueue());
    return data;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Failed to run fraud scan.'));
  }
});

export const takeAdminAction = createAsyncThunk('fraud/takeAdminAction', async (payload, { dispatch, rejectWithValue }) => {
  try {
    const { data } = await takeFraudAction(payload);
    dispatch(fetchFraudQueue());
    dispatch(fetchFraudActions());
    return { ...data, userId: payload.userId };
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Failed to apply fraud action.'));
  }
});

export const dismissAlert = createAsyncThunk('fraud/dismissAlert', async (userId, { dispatch, rejectWithValue }) => {
  try {
    await dismissFraudQueueItem(userId);
    dispatch(fetchFraudQueue());
    return userId;
  } catch (error) {
    return rejectWithValue(getErrorMessage(error, 'Failed to dismiss alert.'));
  }
});

const initialState = {
  alerts: [],
  history: [],
  metrics: null,
  selectedAlert: null,
  loading: false,
  error: null,
  scanLoading: false,
  scanStatus: null,
  actionLoading: false,
};

const fraudSlice = createSlice({
  name: 'fraud',
  initialState,
  reducers: {
    selectAlert(state, action) {
      state.selectedAlert = action.payload;
    },
    clearSelected(state) {
      state.selectedAlert = null;
    },
    upsertAlertFromSocket(state, action) {
      const incoming = action.payload;
      const idx = state.alerts.findIndex(alert => alert.user_id === incoming.user_id);
      if (idx === -1) state.alerts.unshift(incoming);
      else state.alerts[idx] = { ...state.alerts[idx], ...incoming };
      state.alerts.sort((a, b) => (b.fraud_probability || 0) - (a.fraud_probability || 0));
    },
    removeAlertByUserId(state, action) {
      state.alerts = state.alerts.filter(alert => alert.user_id !== action.payload);
      if (state.selectedAlert?.user_id === action.payload) {
        state.selectedAlert = null;
      }
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchFraudQueue.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchFraudQueue.fulfilled, (state, action) => {
        state.loading = false;
        state.alerts = Array.isArray(action.payload) ? action.payload : [];
        if (state.selectedAlert) {
          state.selectedAlert = state.alerts.find(alert => alert.user_id === state.selectedAlert.user_id) || null;
        }
      })
      .addCase(fetchFraudQueue.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(fetchModelMetrics.fulfilled, (state, action) => {
        state.metrics = action.payload;
      })
      .addCase(fetchFraudActions.fulfilled, (state, action) => {
        state.history = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(triggerFullScan.pending, state => {
        state.scanLoading = true;
        state.error = null;
      })
      .addCase(triggerFullScan.fulfilled, (state, action) => {
        state.scanLoading = false;
        state.scanStatus = action.payload;
        if (Array.isArray(action.payload?.queue)) {
          state.alerts = action.payload.queue;
        }
      })
      .addCase(triggerFullScan.rejected, (state, action) => {
        state.scanLoading = false;
        state.error = action.payload;
      })
      .addCase(takeAdminAction.pending, state => {
        state.actionLoading = true;
        state.error = null;
      })
      .addCase(takeAdminAction.fulfilled, (state, action) => {
        state.actionLoading = false;
        state.alerts = state.alerts.filter(alert => alert.user_id !== action.payload.userId);
        if (state.selectedAlert?.user_id === action.payload.userId) {
          state.selectedAlert = null;
        }
      })
      .addCase(takeAdminAction.rejected, (state, action) => {
        state.actionLoading = false;
        state.error = action.payload;
      })
      .addCase(dismissAlert.fulfilled, (state, action) => {
        state.alerts = state.alerts.filter(alert => alert.user_id !== action.payload);
        if (state.selectedAlert?.user_id === action.payload) {
          state.selectedAlert = null;
        }
      });
  },
});

export const { selectAlert, clearSelected, upsertAlertFromSocket, removeAlertByUserId } = fraudSlice.actions;

export default fraudSlice.reducer;