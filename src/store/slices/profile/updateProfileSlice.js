import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import updateClientData from "@/services/clientUser/updateProfileData";

export const updateClientDataAsyncThunk = createAsyncThunk(
  'profileEdit/updateClientDataAsync',
  async ({ userID, updatedFields }, { rejectWithValue }) => {
    try {
      const result = await updateClientData(userID, updatedFields);
      return result; 
    } catch (error) {
      return rejectWithValue(error.message || 'Xatolik yuz berdi');
    }
  }
);

const initialState = {
  loading: false,
  error: null,
  success: false,
  clientInfo: null,
};

const updateProfileSlice = createSlice({
  name: 'profileEdit',
  initialState,
  reducers: {
    resetProfileStatus: (state) => {
      state.success = false;
      state.error = null;
      state.loading = false;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(updateClientDataAsyncThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateClientDataAsyncThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.error = null;
        state.success = true;
        if (state.clientInfo) {
          state.clientInfo = { ...state.clientInfo, ...action.payload };
        }
      })
      .addCase(updateClientDataAsyncThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { resetProfileStatus } = updateProfileSlice.actions;
export default updateProfileSlice.reducer;